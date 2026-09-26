/**
 * AssignmentExpectedTypeResolver - Resolves expected type context for assignment targets
 *
 * Issue #644: Extracted from CodeGenerator.generateAssignment() to reduce cognitive complexity.
 *
 * Sets up expectedType and assignmentContext for expression generation,
 * enabling type-aware resolution of unqualified enum members and overflow behavior.
 *
 * Migrated to use CodeGenState instead of constructor DI.
 */

import IAssignmentOverflowContext from "../../../../transpiler/types/IAssignmentOverflowContext";
import type TranspileState from "../../../TranspileState";

/**
 * Result of resolving expected type for an assignment target.
 */
interface IExpectedTypeResult {
  /** The resolved expected type (e.g., "u32", "Status"), or null if not resolved */
  expectedType: string | null;
  /** Assignment context for overflow behavior tracking */
  assignmentContext: IAssignmentOverflowContext | null;
}

/**
 * Resolves expected type for assignment targets.
 */
/**
 * What an assignment target reduces to, once its node has been walked.
 *
 * `identifiers` and `hasSubscript` are `analyzePostfixOps`' output, and
 * `hasRangeSubscript` is `postfixOps.some((op) => op.expression().length === 2)`
 * -- the `[offset, length]` slice / bit-range form. `hasPostfixOps` is carried
 * rather than derived from `identifiers.length`, because the two answer
 * different questions and a reader should not have to work out that they
 * currently agree.
 */
interface IPlannedAssignmentTarget {
  readonly baseId: string | undefined;
  readonly identifiers: readonly string[];
  readonly hasSubscript: boolean;
  readonly hasRangeSubscript: boolean;
  readonly hasPostfixOps: boolean;
}

class AssignmentExpectedTypeResolver {
  /**
   * Resolve expected type for an assignment target.
   *
   * #1445 box 3: takes the target's shape, not its node. Everything this
   * class read off `AssignmentTargetContext` reduces to a name, a chain of
   * names and two booleans -- `analyzePostfixOps` already produced two of
   * them, and `hasRangeSubscript` was a `.some()` over one grammar predicate.
   * The walk stays with the caller, which holds the tree.
   *
   * @param target - The target's resolved shape
   * @returns The resolved expected type and assignment context
   */
  static resolve(
    target: IPlannedAssignmentTarget,
    state: TranspileState,
  ): IExpectedTypeResult {
    const { baseId, identifiers, hasSubscript } = target;

    // Case 1: Simple identifier (x <- value) - no postfix ops
    if (baseId && !target.hasPostfixOps) {
      return AssignmentExpectedTypeResolver.resolveForSimpleIdentifier(
        baseId,
        state,
      );
    }

    // Case 2: Has postfix ops - the chain was extracted by the caller
    if (baseId && target.hasPostfixOps) {
      // Case 2a: Member access only (no subscript)
      if (identifiers.length >= 2 && !hasSubscript) {
        return AssignmentExpectedTypeResolver.resolveForMemberChain(
          identifiers,
          state,
        );
      }

      // Case 2b: Simple array element access (arr[i] <- value)
      // Issue #872: Resolve element type for MISRA 7.2 U suffix
      if (identifiers.length === 1 && hasSubscript) {
        return AssignmentExpectedTypeResolver.resolveForArrayElement(
          baseId,
          target.hasRangeSubscript,
          state,
        );
      }

      // Case 2c: Member chain with array access (struct.arr[i] <- value)
      // Issue #872: Walk chain and resolve element type
      if (identifiers.length >= 2 && hasSubscript) {
        return AssignmentExpectedTypeResolver.resolveForMemberArrayElement(
          identifiers,
          state,
        );
      }
    }

    // Case 3: Complex patterns we can't resolve
    return { expectedType: null, assignmentContext: null };
  }

  /**
   * Resolve expected type for a simple identifier target.
   */
  private static resolveForSimpleIdentifier(
    id: string,
    state: TranspileState,
  ): IExpectedTypeResult {
    const typeInfo = state.getVariableTypeInfo(id);
    if (!typeInfo) {
      return { expectedType: null, assignmentContext: null };
    }

    return {
      expectedType: typeInfo.baseType,
      assignmentContext: {
        targetName: id,
        targetType: typeInfo.baseType,
        overflowBehavior: typeInfo.overflowBehavior || "clamp",
      },
    };
  }

  /**
   * Resolve expected type for a member access chain.
   * Walks the chain of struct types to find the final field's type.
   *
   * Issue #452: Enables type-aware resolution of unqualified enum members
   * for nested access (e.g., config.nested.field).
   *
   * Delegates to walkMemberChain shared implementation.
   */
  private static resolveForMemberChain(
    identifiers: readonly string[],
    state: TranspileState,
  ): IExpectedTypeResult {
    return AssignmentExpectedTypeResolver.walkMemberChain(identifiers, state);
  }

  /**
   * Resolve expected type for array element access.
   * Issue #872: arr[i] <- value needs baseType for MISRA 7.2 U suffix.
   *
   * An array SLICE (2-expression subscript `arr[off, len]`) is the exception:
   * its source serializes at the SOURCE's own width, so leaking the element type
   * as expectedType truncates an element-width-sensitive source such as a
   * bit-extraction (Issue #1085: `buf[0,4] <- b[0,32]` wrote only the low byte).
   * This applies only to arrays — a 2-expression subscript on a scalar is a
   * bit-range write, whose value is genuinely the field's type (unchanged).
   */
  private static resolveForArrayElement(
    id: string,
    hasRangeSubscript: boolean,
    state: TranspileState,
  ): IExpectedTypeResult {
    const typeInfo = state.getVariableTypeInfo(id);
    if (!typeInfo?.isArray) {
      return { expectedType: null, assignmentContext: null };
    }

    if (hasRangeSubscript) {
      return { expectedType: null, assignmentContext: null };
    }

    // Element type is the baseType (e.g., u8[10] -> "u8")
    return { expectedType: typeInfo.baseType, assignmentContext: null };
  }

  /**
   * Resolve expected type for member chain ending with array access.
   * Issue #872: struct.arr[i] <- value needs element type for MISRA 7.2.
   *
   * Delegates to walkMemberChain which handles both member chain and
   * member-array-element patterns identically (both return final field type).
   */
  private static resolveForMemberArrayElement(
    identifiers: readonly string[],
    state: TranspileState,
  ): IExpectedTypeResult {
    return AssignmentExpectedTypeResolver.walkMemberChain(identifiers, state);
  }

  /**
   * Walk a struct member chain to find the final field's type.
   * Shared implementation for both member chain and member-array-element patterns.
   *
   * Issue #831: Uses SymbolTable as single source of truth for struct fields.
   */
  private static walkMemberChain(
    identifiers: readonly string[],
    state: TranspileState,
  ): IExpectedTypeResult {
    if (identifiers.length < 2) {
      return { expectedType: null, assignmentContext: null };
    }

    const rootName = identifiers[0];
    const rootTypeInfo = state.getVariableTypeInfo(rootName);

    if (!rootTypeInfo || !state.isKnownStruct(rootTypeInfo.baseType)) {
      return { expectedType: null, assignmentContext: null };
    }

    let currentStructType: string | undefined = rootTypeInfo.baseType;

    for (let i = 1; i < identifiers.length && currentStructType; i++) {
      const memberName = identifiers[i];
      // Through the accessor -- see `AssignmentClassifier`: a bare
      // `symbolTable` lookup misses #1322's scope-declared-struct key.
      const memberType: string | undefined = state.getStructFieldInfo(
        currentStructType,
        memberName,
      )?.type;

      if (!memberType) {
        break;
      }

      if (i === identifiers.length - 1) {
        return { expectedType: memberType, assignmentContext: null };
      } else if (state.isKnownStruct(memberType)) {
        currentStructType = memberType;
      } else {
        break;
      }
    }

    return { expectedType: null, assignmentContext: null };
  }
}

export default AssignmentExpectedTypeResolver;
