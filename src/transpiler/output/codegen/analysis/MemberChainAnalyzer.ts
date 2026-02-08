/**
 * MemberChainAnalyzer - Analyzes member access chains for bit access patterns
 *
 * Issue #644: Extracted from CodeGenerator to reduce file size.
 * Refactored to delegate to buildMemberAccessChain to eliminate code duplication.
 *
 * Used to detect bit access at the end of member chains, e.g.:
 * - grid[2][3].flags[0] - detects that [0] is bit access on flags
 * - point.x[3, 4] - detects bit range access on integer field
 */

import * as Parser from "../../../logic/parser/grammar/CNextParser.js";
import TTypeInfo from "../types/TTypeInfo.js";

/**
 * Result of analyzing a member chain for bit access.
 */
interface IBitAccessAnalysisResult {
  /** True if the last subscript is bit access on an integer */
  isBitAccess: boolean;
  /** The base target expression (without bit index) */
  baseTarget?: string;
  /** The bit index expression */
  bitIndex?: string;
  /** The base type of the target */
  baseType?: string;
}

/**
 * Dependencies required for member chain analysis.
 */
interface IMemberChainAnalyzerDeps {
  /** Type registry for looking up variable types */
  typeRegistry: ReadonlyMap<string, TTypeInfo>;
  /** Struct field types by struct name */
  structFields: ReadonlyMap<string, ReadonlyMap<string, string>>;
  /** Struct field array flags by struct name */
  structFieldArrays: ReadonlyMap<string, ReadonlySet<string>>;
  /** Function to check if a type name is a known struct */
  isKnownStruct: (name: string) => boolean;
  /** Function to generate expression code */
  generateExpression: (ctx: Parser.ExpressionContext) => string;
}

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
 * Delegates to buildMemberAccessChain with type tracking and bit access
 * detection callbacks to determine if the final subscript is bit access.
 */
class MemberChainAnalyzer {
  private readonly deps: IMemberChainAnalyzerDeps;

  constructor(deps: IMemberChainAnalyzerDeps) {
    this.deps = deps;
  }

  /**
   * Analyze a member chain target to detect bit access at the end.
   *
   * For patterns like grid[2][3].flags[0], detects that [0] is bit access.
   * Uses direct postfixTargetOp analysis with type tracking.
   *
   * @param targetCtx - The assignment target context to analyze
   * @returns Analysis result with bit access information
   */
  analyze(targetCtx: Parser.AssignmentTargetContext): IBitAccessAnalysisResult {
    const baseId = targetCtx.IDENTIFIER()?.getText();
    const postfixOps = targetCtx.postfixTargetOp();

    if (!baseId || postfixOps.length === 0) {
      return { isBitAccess: false };
    }

    // Check if the last postfix op is a single-expression subscript (potential bit access)
    const lastOp = postfixOps.at(-1)!;
    const lastExprs = lastOp.expression();
    if (lastExprs.length !== 1 || lastOp.IDENTIFIER()) {
      // Last op is member access or multi-expression subscript, not bit access
      return { isBitAccess: false };
    }

    // Count total subscript operations
    const subscriptCount = postfixOps.filter(
      (op) => !op.IDENTIFIER() && op.expression().length > 0,
    ).length;

    // Walk through the chain to find the type and array status before the last subscript
    const targetInfo = this.resolveTargetTypeAndArrayStatus(
      baseId,
      postfixOps.slice(0, -1),
      subscriptCount - 1, // subscripts before the last one
    );
    if (!targetInfo) {
      return { isBitAccess: false };
    }

    // If the target is still an array, the last subscript is array access, not bit access
    if (targetInfo.isArray) {
      return { isBitAccess: false };
    }

    // Check if the type is an integer (bit access only works on integers)
    if (!this.isIntegerType(targetInfo.type)) {
      return { isBitAccess: false };
    }

    // Build the base target expression (everything except the last subscript)
    const baseTarget = this.buildBaseTarget(baseId, postfixOps.slice(0, -1));
    const bitIndex = this.deps.generateExpression(lastExprs[0]);

    return {
      isBitAccess: true,
      baseTarget,
      bitIndex,
      baseType: targetInfo.type,
    };
  }

  /**
   * Resolve the type and array status of the target by walking through postfix operations.
   * Returns the type and whether it's still an array before the last subscript.
   */
  private resolveTargetTypeAndArrayStatus(
    baseId: string,
    ops: Parser.PostfixTargetOpContext[],
    _subscriptsSoFar: number,
  ): { type: string; isArray: boolean } | undefined {
    const baseTypeInfo = this.deps.typeRegistry.get(baseId);
    if (!baseTypeInfo) {
      return undefined;
    }

    const state: IChainState = {
      currentType: baseTypeInfo.baseType,
      currentStructType: this.deps.isKnownStruct(baseTypeInfo.baseType)
        ? baseTypeInfo.baseType
        : undefined,
      isCurrentArray: baseTypeInfo.isArray,
      arrayDimsRemaining: baseTypeInfo.arrayDimensions?.length ?? 0,
    };

    for (let i = 0; i < ops.length; i++) {
      const op = ops[i];
      if (op.IDENTIFIER()) {
        const result = this.processMemberOp(op, ops, i, state);
        if (!result) {
          return undefined;
        }
      } else {
        this.processSubscriptOp(state);
      }
    }

    return { type: state.currentType, isArray: state.isCurrentArray };
  }

  /**
   * Process a member access operation (.fieldName) and update chain state.
   * Returns false if the access is invalid.
   */
  private processMemberOp(
    op: Parser.PostfixTargetOpContext,
    ops: Parser.PostfixTargetOpContext[],
    opIndex: number,
    state: IChainState,
  ): boolean {
    const fieldName = op.IDENTIFIER()!.getText();
    if (!state.currentStructType) {
      return false;
    }

    const structFields = this.deps.structFields.get(state.currentStructType);
    if (!structFields) {
      return false;
    }

    const fieldType = structFields.get(fieldName);
    if (!fieldType) {
      return false;
    }

    state.currentType = fieldType;

    // Check if this field is an array
    const arrayFields = this.deps.structFieldArrays.get(
      state.currentStructType,
    );
    state.isCurrentArray = arrayFields?.has(fieldName) ?? false;

    // If the field type is a struct, update currentStructType
    state.currentStructType = this.deps.isKnownStruct(state.currentType)
      ? state.currentType
      : undefined;

    // Calculate array dimensions remaining based on remaining subscripts
    state.arrayDimsRemaining = state.isCurrentArray
      ? this.countRemainingSubscripts(ops, opIndex) + 1
      : 0;

    return true;
  }

  /**
   * Count remaining subscript operations after the given index.
   */
  private countRemainingSubscripts(
    ops: Parser.PostfixTargetOpContext[],
    afterIndex: number,
  ): number {
    return ops
      .slice(afterIndex + 1)
      .filter((o) => !o.IDENTIFIER() && o.expression().length > 0).length;
  }

  /**
   * Process a subscript operation ([expr]) and update chain state.
   */
  private processSubscriptOp(state: IChainState): void {
    if (!state.isCurrentArray || state.arrayDimsRemaining <= 0) {
      return;
    }

    state.arrayDimsRemaining--;
    if (state.arrayDimsRemaining === 0) {
      state.isCurrentArray = false;
      state.currentStructType = this.deps.isKnownStruct(state.currentType)
        ? state.currentType
        : undefined;
    }
  }

  /**
   * Check if a type is an integer type.
   */
  private isIntegerType(typeName: string): boolean {
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
  private buildBaseTarget(
    baseId: string,
    ops: Parser.PostfixTargetOpContext[],
  ): string {
    let result = baseId;

    for (const op of ops) {
      if (op.IDENTIFIER()) {
        result += "." + op.IDENTIFIER()!.getText();
      } else {
        const exprs = op.expression();
        if (exprs.length === 1) {
          result += "[" + this.deps.generateExpression(exprs[0]) + "]";
        } else if (exprs.length === 2) {
          result +=
            "[" +
            this.deps.generateExpression(exprs[0]) +
            ", " +
            this.deps.generateExpression(exprs[1]) +
            "]";
        }
      }
    }

    return result;
  }
}

export default MemberChainAnalyzer;
