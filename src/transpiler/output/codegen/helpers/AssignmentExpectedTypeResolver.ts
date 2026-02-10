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
import CodeGenState from "../CodeGenState.js";

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

    // Case 2: Has member access - extract identifiers from postfix chain
    if (baseId && postfixOps.length > 0) {
      const { identifiers, hasSubscript } = analyzePostfixOps(
        baseId,
        postfixOps,
      );

      // If we have member access (multiple identifiers), resolve for member chain
      if (identifiers.length >= 2 && !hasSubscript) {
        return AssignmentExpectedTypeResolver.resolveForMemberChain(
          identifiers,
        );
      }
    }

    // Case 3: Array access or complex patterns - no expected type resolution
    return { expectedType: null, assignmentContext: null };
  }

  /**
   * Resolve expected type for a simple identifier target.
   */
  private static resolveForSimpleIdentifier(id: string): IExpectedTypeResult {
    const typeInfo = CodeGenState.typeRegistry.get(id);
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
   */
  private static resolveForMemberChain(
    identifiers: string[],
  ): IExpectedTypeResult {
    if (identifiers.length < 2) {
      return { expectedType: null, assignmentContext: null };
    }

    const rootName = identifiers[0];
    const rootTypeInfo = CodeGenState.typeRegistry.get(rootName);

    if (!rootTypeInfo || !CodeGenState.isKnownStruct(rootTypeInfo.baseType)) {
      return { expectedType: null, assignmentContext: null };
    }

    let currentStructType: string | undefined = rootTypeInfo.baseType;

    // Walk through each member in the chain to find the final field's type
    for (let i = 1; i < identifiers.length && currentStructType; i++) {
      const memberName = identifiers[i];
      const structFieldTypes =
        CodeGenState.symbols?.structFields.get(currentStructType);

      if (!structFieldTypes?.has(memberName)) {
        break;
      }

      const memberType = structFieldTypes.get(memberName)!;

      if (i === identifiers.length - 1) {
        // Last field in chain - this is the assignment target's type
        return { expectedType: memberType, assignmentContext: null };
      } else if (CodeGenState.isKnownStruct(memberType)) {
        // Intermediate field - continue walking if it's a struct
        currentStructType = memberType;
      } else {
        // Intermediate field is not a struct - can't walk further
        break;
      }
    }

    return { expectedType: null, assignmentContext: null };
  }
}

export default AssignmentExpectedTypeResolver;
