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
 */

import * as Parser from "../../../logic/parser/grammar/CNextParser.js";
import TypeValidator from "../TypeValidator.js";
import EnumAssignmentValidator from "./EnumAssignmentValidator.js";
import TTypeInfo from "../types/TTypeInfo.js";

/**
 * Dependencies required for assignment validation.
 */
interface IAssignmentValidatorDeps {
  /** Type registry for looking up variable types */
  readonly typeRegistry: ReadonlyMap<string, TTypeInfo>;
  /** Float shadow tracking state for invalidation */
  readonly floatShadowCurrent: Set<string>;
  /** Register member access modifiers for read-only checks */
  readonly registerMemberAccess: ReadonlyMap<string, string>;
  /** Callback field types for nominal typing validation */
  readonly callbackFieldTypes: ReadonlyMap<string, string>;
  /** Check if a type is a known struct */
  isKnownStruct: (typeName: string) => boolean;
  /** Check if a type is an integer type */
  isIntegerType: (typeName: string) => boolean;
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
  private readonly deps: IAssignmentValidatorDeps;

  constructor(deps: IAssignmentValidatorDeps) {
    this.deps = deps;
  }

  /**
   * Validate an assignment target.
   *
   * @param targetCtx - The assignment target context
   * @param expression - The expression being assigned
   * @param isCompound - Whether this is a compound assignment (+<-, -<-, etc.)
   * @param line - Line number for error messages
   */
  validate(
    targetCtx: Parser.AssignmentTargetContext,
    expression: Parser.ExpressionContext,
    isCompound: boolean,
    line: number,
  ): void {
    const postfixOps = targetCtx.postfixTargetOp();
    const baseId = targetCtx.IDENTIFIER()?.getText();

    // Case 1: Simple identifier assignment (no postfix ops)
    if (baseId && postfixOps.length === 0) {
      this.validateSimpleIdentifier(baseId, expression, isCompound);
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
      this.validateArrayElement(identifiers[0], subscriptExprs, line);
    }

    // Case 3: Has member access - validate member access
    if (identifiers.length >= 2) {
      this.validateMemberAccess(identifiers, expression);
    }
  }

  /**
   * Validate simple identifier assignment.
   */
  private validateSimpleIdentifier(
    id: string,
    expression: Parser.ExpressionContext,
    isCompound: boolean,
  ): void {
    // ADR-013: Validate const assignment
    const constError = TypeValidator.checkConstAssignment(id);
    if (constError) {
      throw new Error(constError);
    }

    // Invalidate float shadow when variable is assigned directly
    const shadowName = `__bits_${id}`;
    this.deps.floatShadowCurrent.delete(shadowName);

    const targetTypeInfo = this.deps.typeRegistry.get(id);
    if (!targetTypeInfo) {
      return;
    }

    // ADR-017: Validate enum type assignment
    if (targetTypeInfo.isEnum && targetTypeInfo.enumTypeName) {
      EnumAssignmentValidator.validateEnumAssignment(
        targetTypeInfo.enumTypeName,
        expression,
      );
    }

    // ADR-024: Validate integer type conversions
    if (this.deps.isIntegerType(targetTypeInfo.baseType)) {
      try {
        TypeValidator.validateIntegerAssignment(
          targetTypeInfo.baseType,
          expression.getText(),
          this.deps.getExpressionType(expression),
          isCompound,
        );
      } catch (validationError) {
        const line = expression.start?.line ?? 0;
        const col = expression.start?.column ?? 0;
        const msg =
          validationError instanceof Error
            ? validationError.message
            : String(validationError);
        throw new Error(`${line}:${col} ${msg}`, { cause: validationError });
      }
    }
  }

  /**
   * Validate array element assignment.
   */
  private validateArrayElement(
    arrayName: string,
    subscriptExprs: Parser.ExpressionContext[],
    line: number,
  ): void {
    // ADR-013: Validate const assignment on array
    const constError = TypeValidator.checkConstAssignment(arrayName);
    if (constError) {
      throw new Error(`${constError} (array element)`);
    }

    // ADR-036: Compile-time bounds checking
    const typeInfo = this.deps.typeRegistry.get(arrayName);
    if (typeInfo?.isArray && typeInfo.arrayDimensions) {
      TypeValidator.checkArrayBounds(
        arrayName,
        typeInfo.arrayDimensions,
        subscriptExprs,
        line,
        this.deps.tryEvaluateConstant,
      );
    }
  }

  /**
   * Validate member access assignment.
   */
  private validateMemberAccess(
    identifiers: string[],
    expression: Parser.ExpressionContext,
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
    const accessMod = this.deps.registerMemberAccess.get(fullName);
    if (accessMod === "ro") {
      throw new Error(
        `cannot assign to read-only register member '${memberName}' ` +
          `(${rootName}.${memberName} has 'ro' access modifier)`,
      );
    }

    // ADR-029: Validate callback field assignments with nominal typing
    const rootTypeInfo = this.deps.typeRegistry.get(rootName);
    if (rootTypeInfo && this.deps.isKnownStruct(rootTypeInfo.baseType)) {
      const structType = rootTypeInfo.baseType;
      const callbackFieldKey = `${structType}.${memberName}`;
      const expectedCallbackType =
        this.deps.callbackFieldTypes.get(callbackFieldKey);

      if (expectedCallbackType) {
        TypeValidator.validateCallbackAssignment(
          expectedCallbackType,
          expression,
          memberName,
          this.deps.isCallbackTypeUsedAsFieldType,
        );
      }
    }
  }
}

export default AssignmentValidator;
