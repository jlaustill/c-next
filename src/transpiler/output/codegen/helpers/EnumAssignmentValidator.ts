/**
 * EnumAssignmentValidator - Validates enum type assignments
 *
 * Issue #644: Extracted from CodeGenerator to reduce file size.
 *
 * Validates that enum assignments are type-safe:
 * - Cannot assign different enum types to each other
 * - Cannot assign integers to enums
 * - Handles this.Enum.MEMBER and global.Enum.MEMBER patterns
 * - Handles scoped enum patterns (Scope.Enum.MEMBER)
 */

import * as Parser from "../../../logic/parser/grammar/CNextParser.js";

/**
 * Dependencies required for enum validation.
 */
interface IEnumValidatorDeps {
  /** Set of known enum type names */
  knownEnums: ReadonlySet<string>;
  /** Get the current scope name (for this. prefix handling) */
  getCurrentScope: () => string | null;
  /** Get the enum type of an expression */
  getExpressionEnumType: (ctx: Parser.ExpressionContext) => string | null;
  /** Check if expression is an integer literal or variable */
  isIntegerExpression: (ctx: Parser.ExpressionContext) => boolean;
}

/**
 * Validates enum type assignments.
 */
class EnumAssignmentValidator {
  private readonly deps: IEnumValidatorDeps;

  constructor(deps: IEnumValidatorDeps) {
    this.deps = deps;
  }

  /**
   * Validate that an expression can be assigned to an enum-typed variable.
   * Throws an error if the assignment is invalid.
   *
   * @param typeName - The target enum type name
   * @param expression - The expression being assigned
   */
  validateEnumAssignment(
    typeName: string,
    expression: Parser.ExpressionContext,
  ): void {
    // Only validate if the target type is a known enum
    if (!this.deps.knownEnums.has(typeName)) {
      return;
    }

    const valueEnumType = this.deps.getExpressionEnumType(expression);

    // Check if assigning from a different enum type
    if (valueEnumType && valueEnumType !== typeName) {
      throw new Error(
        `Error: Cannot assign ${valueEnumType} enum to ${typeName} enum`,
      );
    }

    // Check if assigning integer to enum
    if (this.deps.isIntegerExpression(expression)) {
      throw new Error(`Error: Cannot assign integer to ${typeName} enum`);
    }

    // Check if assigning a non-enum, non-integer expression
    if (!valueEnumType) {
      const exprText = expression.getText();
      this.validateNonEnumExpression(exprText, typeName);
    }
  }

  /**
   * Validate a non-enum expression being assigned to an enum type.
   * Handles various access patterns like this.Enum.MEMBER, global.Enum.MEMBER, etc.
   */
  private validateNonEnumExpression(exprText: string, typeName: string): void {
    const parts = exprText.split(".");
    const currentScope = this.deps.getCurrentScope();

    // ADR-016: Handle this.State.MEMBER pattern
    if (parts[0] === "this" && currentScope && parts.length >= 3) {
      const scopedEnumName = `${currentScope}_${parts[1]}`;
      if (scopedEnumName === typeName) {
        // Valid this.Enum.Member access
        return;
      }
      throw new Error(
        `Error: Cannot assign non-enum value to ${typeName} enum`,
      );
    }

    // Issue #478: Handle global.Enum.MEMBER pattern
    if (parts[0] === "global" && parts.length >= 3) {
      // global.ECategory.CAT_A -> ECategory
      const globalEnumName = parts[1];
      if (globalEnumName === typeName) {
        // Valid global.Enum.Member access
        return;
      }
      throw new Error(
        `Error: Cannot assign non-enum value to ${typeName} enum`,
      );
    }

    // Allow if it's an enum member access of the correct type
    if (exprText.startsWith(typeName + ".")) {
      // Direct enum member access: EnumType.MEMBER
      return;
    }

    // Check for scoped enum
    if (parts.length >= 3) {
      const scopedEnumName = `${parts[0]}_${parts[1]}`;
      if (scopedEnumName !== typeName) {
        throw new Error(
          `Error: Cannot assign non-enum value to ${typeName} enum`,
        );
      }
      return;
    }

    // parts.length === 2: Could be Enum.Member or variable.field
    // Allow if it's a known enum type (even if different - getExpressionEnumType would catch mismatches)
    if (
      parts.length === 2 &&
      parts[0] !== typeName &&
      !this.deps.knownEnums.has(parts[0])
    ) {
      throw new Error(
        `Error: Cannot assign non-enum value to ${typeName} enum`,
      );
    }
  }
}

export default EnumAssignmentValidator;
