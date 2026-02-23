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

import * as Parser from "../../../logic/parser/grammar/CNextParser.js";
import TOverflowBehavior from "../types/TOverflowBehavior.js";
import analyzePostfixOps from "../../../../utils/PostfixAnalysisUtils.js";
import CodeGenState from "../../../state/CodeGenState.js";

/**
 * Result of resolving expected type for an assignment target.
 */
interface IExpectedTypeResult {
  /** The resolved expected type (e.g., "u32", "Status"), or null if not resolved */
  expectedType: string | null;
  /** Assignment context for overflow behavior tracking */
  assignmentContext: IAssignmentContext | null;
}

/**
 * Assignment context for overflow behavior tracking (ADR-044).
 */
interface IAssignmentContext {
  targetName: string;
  targetType: string;
  overflowBehavior: TOverflowBehavior;
}

/**
 * Resolves expected type for assignment targets.
 */
class AssignmentExpectedTypeResolver {
  /**
   * Resolve expected type for an assignment target.
   *
   * @param targetCtx - The assignment target context
   * @returns The resolved expected type and assignment context
   */
  static resolve(
    targetCtx: Parser.AssignmentTargetContext,
  ): IExpectedTypeResult {
    const postfixOps = targetCtx.postfixTargetOp();
    const baseId = targetCtx.IDENTIFIER()?.getText();

    // Case 1: Simple identifier (x <- value) - no postfix ops
    if (baseId && postfixOps.length === 0) {
      return AssignmentExpectedTypeResolver.resolveForSimpleIdentifier(baseId);
    }

    // Case 2: Has postfix ops - extract identifiers from chain
    if (baseId && postfixOps.length > 0) {
      const { identifiers, hasSubscript } = analyzePostfixOps(
        baseId,
        postfixOps,
      );

      // Case 2a: Member access only (no subscript)
      if (identifiers.length >= 2 && !hasSubscript) {
        return AssignmentExpectedTypeResolver.resolveForMemberChain(
          identifiers,
        );
      }

      // Case 2b: Simple array element access (arr[i] <- value)
      // Issue #872: Resolve element type for MISRA 7.2 U suffix
      if (identifiers.length === 1 && hasSubscript) {
        return AssignmentExpectedTypeResolver.resolveForArrayElement(baseId);
      }

      // Case 2c: Member chain with array access (struct.arr[i] <- value)
      // Issue #872: Walk chain and resolve element type
      if (identifiers.length >= 2 && hasSubscript) {
        return AssignmentExpectedTypeResolver.resolveForMemberArrayElement(
          identifiers,
        );
      }
    }

    // Case 3: Complex patterns we can't resolve
    return { expectedType: null, assignmentContext: null };
  }

  /**
   * Resolve expected type for a simple identifier target.
   */
  private static resolveForSimpleIdentifier(id: string): IExpectedTypeResult {
    const typeInfo = CodeGenState.getVariableTypeInfo(id);
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
    identifiers: string[],
  ): IExpectedTypeResult {
    return AssignmentExpectedTypeResolver.walkMemberChain(identifiers);
  }

  /**
   * Resolve expected type for array element access.
   * Issue #872: arr[i] <- value needs baseType for MISRA 7.2 U suffix.
   */
  private static resolveForArrayElement(id: string): IExpectedTypeResult {
    const typeInfo = CodeGenState.getVariableTypeInfo(id);
    if (!typeInfo?.isArray) {
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
    identifiers: string[],
  ): IExpectedTypeResult {
    return AssignmentExpectedTypeResolver.walkMemberChain(identifiers);
  }

  /**
   * Walk a struct member chain to find the final field's type.
   * Shared implementation for both member chain and member-array-element patterns.
   *
   * Issue #831: Uses SymbolTable as single source of truth for struct fields.
   */
  private static walkMemberChain(identifiers: string[]): IExpectedTypeResult {
    if (identifiers.length < 2) {
      return { expectedType: null, assignmentContext: null };
    }

    const rootName = identifiers[0];
    const rootTypeInfo = CodeGenState.getVariableTypeInfo(rootName);

    if (!rootTypeInfo || !CodeGenState.isKnownStruct(rootTypeInfo.baseType)) {
      return { expectedType: null, assignmentContext: null };
    }

    let currentStructType: string | undefined = rootTypeInfo.baseType;

    for (let i = 1; i < identifiers.length && currentStructType; i++) {
      const memberName = identifiers[i];
      const memberType = CodeGenState.symbolTable?.getStructFieldType(
        currentStructType,
        memberName,
      );

      if (!memberType) {
        break;
      }

      if (i === identifiers.length - 1) {
        return { expectedType: memberType, assignmentContext: null };
      } else if (CodeGenState.isKnownStruct(memberType)) {
        currentStructType = memberType;
      } else {
        break;
      }
    }

    return { expectedType: null, assignmentContext: null };
  }
}

export default AssignmentExpectedTypeResolver;
