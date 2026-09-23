/**
 * MemberChainAnalyzer - Analyzes member access chains for bit access patterns
 *
 * Issue #644: Extracted from CodeGenerator to reduce file size.
 * Issue #1445: the header used to claim this delegates to
 * `buildMemberAccessChain`. It never imported it, and that function is now
 * deleted as dead code. This class walks the chain itself.
 *
 * Used to detect bit access at the end of member chains, e.g.:
 * - grid[2][3].flags[0] - detects that [0] is bit access on flags
 * - point.x[3, 4] - detects bit range access on integer field
 *
 * Migrated to use CodeGenState instead of constructor DI.
 *
 * ## It walks a plan, not a parse tree (#1445)
 *
 * The chain is `TPlannedTargetOp[]`: a member's name, or a subscript's arity
 * and a thunk for its rendered indexes. Everything the walk decides comes from
 * `CodeGenState` -- the base's type, a struct field's type, whether a type is
 * an integer -- so the tree was consulted only to tell a member access from a
 * subscript, which the union now states.
 */

import CodeGenState from "../../../../transpiler/state/CodeGenState";
import IBitAccessAnalysis from "../../../../transpiler/types/IBitAccessAnalysis";
import TPlannedTargetOp from "../../../../transpiler/types/TPlannedTargetOp";

/** Mutable state for tracking types through a member chain. */
interface IChainState {
  currentType: string;
  currentStructType: string | undefined;
  isCurrentArray: boolean;
  arrayDimsRemaining: number;
}

/**
 * Analyzes member access chains to detect bit access patterns.
 *
 * Walks the chain with type tracking to determine whether the final subscript
 * is bit access. (#1445: this said "delegates to buildMemberAccessChain"; no
 * such import ever existed and that function is now deleted.)
 */
class MemberChainAnalyzer {
  /**
   * Analyze a member chain target to detect bit access at the end.
   *
   * For patterns like grid[2][3].flags[0], detects that [0] is bit access.
   *
   * @param baseName - the target's base identifier, or null if it has none
   * @param ops - the postfix chain applied to it
   * @returns Analysis result with bit access information
   */
  static analyze(
    baseName: string | null,
    ops: readonly TPlannedTargetOp[],
  ): IBitAccessAnalysis {
    if (!baseName || ops.length === 0) {
      return { isBitAccess: false };
    }

    // Bit access is a single-index subscript at the end. A member access or a
    // `[start, width]` range there is not one.
    const lastOp = ops.at(-1)!;
    if (lastOp.kind !== "subscript" || lastOp.indexCount !== 1) {
      return { isBitAccess: false };
    }

    // Walk through the chain to find the type and array status before the last subscript
    const leadingOps = ops.slice(0, -1);
    const targetInfo = MemberChainAnalyzer.resolveTargetTypeAndArrayStatus(
      baseName,
      leadingOps,
    );
    if (!targetInfo) {
      return { isBitAccess: false };
    }

    // If the target is still an array, the last subscript is array access, not bit access
    if (targetInfo.isArray) {
      return { isBitAccess: false };
    }

    // Check if the type is an integer (bit access only works on integers)
    if (!MemberChainAnalyzer.isIntegerType(targetInfo.type)) {
      return { isBitAccess: false };
    }

    // Only now is anything rendered: every return above reached its answer
    // from CodeGenState alone.
    return {
      isBitAccess: true,
      baseTarget: MemberChainAnalyzer.buildBaseTarget(baseName, leadingOps),
      bitIndex: lastOp.renderIndexes()[0],
      baseType: targetInfo.type,
    };
  }

  /**
   * Resolve the type and array status of the target by walking through postfix operations.
   * Returns the type and whether it's still an array before the last subscript.
   *
   * #1445: a third parameter counted the subscripts before the last one and
   * was never read -- so the `filter` at the call site that computed it was
   * dead too. Both are gone.
   */
  private static resolveTargetTypeAndArrayStatus(
    baseId: string,
    ops: readonly TPlannedTargetOp[],
  ): { type: string; isArray: boolean } | undefined {
    const baseTypeInfo = CodeGenState.getVariableTypeInfo(baseId);
    if (!baseTypeInfo) {
      return undefined;
    }

    const state: IChainState = {
      currentType: baseTypeInfo.baseType,
      currentStructType: CodeGenState.isKnownStruct(baseTypeInfo.baseType)
        ? baseTypeInfo.baseType
        : undefined,
      isCurrentArray: baseTypeInfo.isArray,
      arrayDimsRemaining: baseTypeInfo.arrayDimensions?.length ?? 0,
    };

    for (let i = 0; i < ops.length; i++) {
      const op = ops[i];
      if (op.kind === "member") {
        const result = MemberChainAnalyzer.processMemberOp(
          op.name,
          ops,
          i,
          state,
        );
        if (!result) {
          return undefined;
        }
      } else {
        MemberChainAnalyzer.processSubscriptOp(state);
      }
    }

    return { type: state.currentType, isArray: state.isCurrentArray };
  }

  /**
   * Process a member access operation (.fieldName) and update chain state.
   * Returns false if the access is invalid.
   */
  private static processMemberOp(
    fieldName: string,
    ops: readonly TPlannedTargetOp[],
    opIndex: number,
    state: IChainState,
  ): boolean {
    if (!state.currentStructType) {
      return false;
    }

    // Issue #831: Use SymbolTable as single source of truth for struct fields
    const fieldInfo = CodeGenState.symbolTable?.getStructFieldInfo(
      state.currentStructType,
      fieldName,
    );
    if (!fieldInfo) {
      return false;
    }

    state.currentType = fieldInfo.type;

    // Check if this field is an array (has array dimensions)
    state.isCurrentArray =
      fieldInfo.arrayDimensions !== undefined &&
      fieldInfo.arrayDimensions.length > 0;

    // If the field type is a struct, update currentStructType
    state.currentStructType = CodeGenState.isKnownStruct(state.currentType)
      ? state.currentType
      : undefined;

    // Calculate array dimensions remaining based on remaining subscripts
    state.arrayDimsRemaining = state.isCurrentArray
      ? MemberChainAnalyzer.countRemainingSubscripts(ops, opIndex) + 1
      : 0;

    return true;
  }

  /**
   * Count remaining subscript operations after the given index.
   */
  private static countRemainingSubscripts(
    ops: readonly TPlannedTargetOp[],
    afterIndex: number,
  ): number {
    return ops.slice(afterIndex + 1).filter((op) => op.kind === "subscript")
      .length;
  }

  /**
   * Process a subscript operation ([expr]) and update chain state.
   */
  private static processSubscriptOp(state: IChainState): void {
    if (!state.isCurrentArray || state.arrayDimsRemaining <= 0) {
      return;
    }

    state.arrayDimsRemaining--;
    if (state.arrayDimsRemaining === 0) {
      state.isCurrentArray = false;
      state.currentStructType = CodeGenState.isKnownStruct(state.currentType)
        ? state.currentType
        : undefined;
    }
  }

  /**
   * Check if a type is an integer type.
   */
  private static isIntegerType(typeName: string): boolean {
    const intTypes = new Set([
      "u8",
      "u16",
      "u32",
      "u64",
      "i8",
      "i16",
      "i32",
      "i64",
    ]);
    return intTypes.has(typeName);
  }

  /**
   * Build the target expression string from base identifier and postfix operations.
   */
  private static buildBaseTarget(
    baseId: string,
    ops: readonly TPlannedTargetOp[],
  ): string {
    let result = baseId;

    for (const op of ops) {
      if (op.kind === "member") {
        result += "." + op.name;
      } else {
        result += "[" + op.renderIndexes().join(", ") + "]";
      }
    }

    return result;
  }
}

export default MemberChainAnalyzer;
