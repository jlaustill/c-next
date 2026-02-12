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
import EnumAssignmentValidator from "./EnumAssignmentValidator.js";
import CodeGenState from "../../../state/CodeGenState.js";
import TypeCheckUtils from "../../../../utils/TypeCheckUtils.js";

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
      AssignmentValidator.validateSimpleIdentifier(
        baseId,
        expression,
        isCompound,
        callbacks,
      );
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
      AssignmentValidator.validateArrayElement(
        identifiers[0],
        subscriptExprs,
        line,
        callbacks,
      );
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
  private static validateSimpleIdentifier(
    id: string,
    expression: Parser.ExpressionContext,
    isCompound: boolean,
    callbacks: IAssignmentValidatorCallbacks,
  ): void {
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

    // ADR-017: Validate enum assignment for enum-typed variable
    if (targetTypeInfo.isEnum && targetTypeInfo.enumTypeName) {
      EnumAssignmentValidator.validateEnumAssignment(
        targetTypeInfo.enumTypeName,
        expression,
      );
    }

    // ADR-024: Validate integer type conversions
    if (TypeCheckUtils.isInteger(targetTypeInfo.baseType)) {
      try {
        TypeValidator.validateIntegerAssignment(
          targetTypeInfo.baseType,
          expression.getText(),
          callbacks.getExpressionType(expression),
          isCompound,
        );
      } catch (validationError) {
        const errorLine = expression.start?.line ?? 0;
        const col = expression.start?.column ?? 0;
        const msg =
          validationError instanceof Error
            ? validationError.message
            : String(validationError);
        throw new Error(`${errorLine}:${col} ${msg}`, {
          cause: validationError,
        });
      }
    }
  }

  /**
   * Validate array element assignment.
   */
  private static validateArrayElement(
    arrayName: string,
    subscriptExprs: Parser.ExpressionContext[],
    line: number,
    callbacks: IAssignmentValidatorCallbacks,
  ): void {
    // ADR-013: Validate const assignment on array
    const constError = TypeValidator.checkConstAssignment(arrayName);
    if (constError) {
      throw new Error(`${constError} (array element)`);
    }

    // ADR-036: Compile-time bounds checking
    const typeInfo = CodeGenState.getVariableTypeInfo(arrayName);
    if (typeInfo?.isArray && typeInfo.arrayDimensions) {
      TypeValidator.checkArrayBounds(
        arrayName,
        typeInfo.arrayDimensions,
        subscriptExprs,
        line,
        callbacks.tryEvaluateConstant,
      );
    }
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

    const fullName = `${rootName}_${memberName}`;

    // ADR-013: Check for read-only register members
    const accessMod = CodeGenState.symbols?.registerMemberAccess.get(fullName);
    if (accessMod === "ro") {
      throw new Error(
        `cannot assign to read-only register member '${memberName}' ` +
          `(${rootName}.${memberName} has 'ro' access modifier)`,
      );
    }

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
