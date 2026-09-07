/**
 * AssignmentValidator - Coordinates assignment validations
 *
 * Issue #644: Extracted from CodeGenerator.generateAssignment() to reduce cognitive complexity.
 *
 * Validates assignments for:
 * - Const violations (variables, parameters, arrays, struct members)
 * - Enum type safety
 * - Integer type conversions
 * - Array bounds checking
 * - Read-only register members
 * - Callback field assignments
 *
 * Migrated to use CodeGenState instead of constructor DI.
 */

import * as Parser from "../../../logic/parser/grammar/CNextParser.js";
import TypeValidator from "../TypeValidator.js";
import CodeGenState from "../../../state/CodeGenState.js";

/**
 * Callbacks required for assignment validation.
 * These need CodeGenerator context and cannot be replaced with static state.
 */
interface IAssignmentValidatorCallbacks {
  /** Get the type of an expression */
  getExpressionType: (ctx: Parser.ExpressionContext) => string | null;
  /** Try to evaluate a constant expression */
  tryEvaluateConstant: (ctx: Parser.ExpressionContext) => number | undefined;
  /** Check if a callback type is used as a field type */
  isCallbackTypeUsedAsFieldType: (funcName: string) => boolean;
}

/**
 * Coordinates all assignment validations.
 */
class AssignmentValidator {
  /**
   * Validate an assignment target.
   *
   * @param targetCtx - The assignment target context
   * @param expression - The expression being assigned
   * @param isCompound - Whether this is a compound assignment (+<-, -<-, etc.)
   * @param line - Line number for error messages
   * @param callbacks - Callbacks to CodeGenerator methods
   */
  static validate(
    targetCtx: Parser.AssignmentTargetContext,
    expression: Parser.ExpressionContext,
    isCompound: boolean,
    line: number,
    callbacks: IAssignmentValidatorCallbacks,
  ): void {
    const postfixOps = targetCtx.postfixTargetOp();
    const baseId = targetCtx.IDENTIFIER()?.getText();

    // Case 1: Simple identifier assignment (no postfix ops)
    if (baseId && postfixOps.length === 0) {
      AssignmentValidator.validateSimpleIdentifier(baseId);
      return;
    }

    // Analyze postfix ops for member/array patterns
    const identifiers: string[] = baseId ? [baseId] : [];
    const subscriptExprs: Parser.ExpressionContext[] = [];

    for (const op of postfixOps) {
      if (op.IDENTIFIER()) {
        identifiers.push(op.IDENTIFIER()!.getText());
      } else {
        for (const expr of op.expression()) {
          subscriptExprs.push(expr);
        }
      }
    }

    // Case 2: Has subscripts - validate array bounds
    if (subscriptExprs.length > 0 && identifiers.length > 0) {
      AssignmentValidator.validateArrayElement(identifiers[0]);
    }

    // Case 3: Has member access - validate member access
    if (identifiers.length >= 2) {
      AssignmentValidator.validateMemberAccess(
        identifiers,
        expression,
        callbacks,
      );
    }
  }

  /**
   * Validate simple identifier assignment.
   */
  private static validateSimpleIdentifier(id: string): void {
    // ADR-013: Validate const assignment
    const constError = TypeValidator.checkConstAssignment(id);
    if (constError) {
      throw new Error(constError);
    }

    // Invalidate float shadow when variable is assigned directly
    const shadowName = `__bits_${id}`;
    CodeGenState.floatShadowCurrent.delete(shadowName);

    const targetTypeInfo = CodeGenState.getVariableTypeInfo(id);
    if (!targetTypeInfo) {
      return;
    }

    // #1322: ADR-024's assignment rules are E0868/E0869 in pass 2.1. What
    // stood here caught the rule's throw and prefixed `${line}:${col}` onto it --
    // the position smuggled through the message on this path and not the cast's.
  }

  /**
   * Validate array element assignment.
   */
  private static validateArrayElement(arrayName: string): void {
    // ADR-013: Validate const assignment on array
    const constError = TypeValidator.checkConstAssignment(arrayName);
    if (constError) {
      throw new Error(`${constError} (array element)`);
    }

    // #1322: constant index bounds (ADR-036, E0854) are checked in pass 2.1.
  }

  /**
   * Validate member access assignment.
   */
  private static validateMemberAccess(
    identifiers: string[],
    expression: Parser.ExpressionContext,
    callbacks: IAssignmentValidatorCallbacks,
  ): void {
    if (identifiers.length < 2) {
      return;
    }

    const rootName = identifiers[0];
    const memberName = identifiers[1];

    // ADR-013: Validate const assignment on struct root
    const constError = TypeValidator.checkConstAssignment(rootName);
    if (constError) {
      throw new Error(`${constError} (member access)`);
    }

    // #1322: a write to an `ro` register member is E0871 in pass 2.1
    // (ADR-004). The check that stood here keyed on the first two identifiers,
    // so `this.R.ST <- 1` on a scoped register passed and emitted an
    // assignment through a `const` macro.

    // ADR-029: Validate callback field assignments with nominal typing
    const rootTypeInfo = CodeGenState.getVariableTypeInfo(rootName);
    if (rootTypeInfo && CodeGenState.isKnownStruct(rootTypeInfo.baseType)) {
      const structType = rootTypeInfo.baseType;

      const callbackFieldKey = `${structType}.${memberName}`;
      const expectedCallbackType =
        CodeGenState.callbackFieldTypes.get(callbackFieldKey);

      if (expectedCallbackType) {
        TypeValidator.validateCallbackAssignment(
          expectedCallbackType,
          expression,
          memberName,
          callbacks.isCallbackTypeUsedAsFieldType,
        );
      }
    }
  }
}

export default AssignmentValidator;
