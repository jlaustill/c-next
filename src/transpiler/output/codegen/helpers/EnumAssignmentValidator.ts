/**
 * EnumAssignmentValidator - Validates enum type assignments
 *
 * Issue #644: Extracted from CodeGenerator to reduce file size.
 * Static class using CodeGenState for all state access.
 *
 * Validates that enum assignments are type-safe:
 * - Cannot assign different enum types to each other
 * - Cannot assign integers to enums
 * - Handles this.Enum.MEMBER and global.Enum.MEMBER patterns
 * - Handles scoped enum patterns (Scope.Enum.MEMBER)
 */

import * as Parser from "../../../logic/parser/grammar/CNextParser.js";
import CodeGenState from "../CodeGenState.js";
import EnumTypeResolver from "../resolution/EnumTypeResolver.js";
import TypeCheckUtils from "../../../../utils/TypeCheckUtils.js";

/**
 * Validates enum type assignments.
 * All methods are static - uses CodeGenState for state access.
 */
class EnumAssignmentValidator {
  /**
   * Validate that an expression can be assigned to an enum-typed variable.
   * Throws an error if the assignment is invalid.
   *
   * @param typeName - The target enum type name
   * @param expression - The expression being assigned
   */
  static validateEnumAssignment(
    typeName: string,
    expression: Parser.ExpressionContext,
  ): void {
    // Only validate if the target type is a known enum
    if (!CodeGenState.isKnownEnum(typeName)) {
      return;
    }

    const valueEnumType = EnumTypeResolver.resolve(expression);

    // Check if assigning from a different enum type
    if (valueEnumType && valueEnumType !== typeName) {
      throw new Error(
        `Error: Cannot assign ${valueEnumType} enum to ${typeName} enum`,
      );
    }

    // Check if assigning integer to enum
    if (EnumAssignmentValidator.isIntegerExpression(expression)) {
      throw new Error(`Error: Cannot assign integer to ${typeName} enum`);
    }

    // Check if assigning a non-enum, non-integer expression
    if (!valueEnumType) {
      const exprText = expression.getText();
      EnumAssignmentValidator.validateNonEnumExpression(exprText, typeName);
    }
  }

  /**
   * Check if an expression is an integer literal or integer-typed variable.
   * Used to detect comparisons between enums and integers.
   */
  static isIntegerExpression(
    ctx: Parser.ExpressionContext | Parser.RelationalExpressionContext,
  ): boolean {
    const text = ctx.getText();

    // Check for integer literals
    if (
      /^-?\d+$/.exec(text) ||
      /^0[xX][0-9a-fA-F]+$/.exec(text) ||
      /^0[bB][01]+$/.exec(text)
    ) {
      return true;
    }

    // Check if it's a variable of primitive integer type
    if (/^[a-zA-Z_]\w*$/.exec(text)) {
      const typeInfo = CodeGenState.typeRegistry.get(text);
      if (
        typeInfo &&
        !typeInfo.isEnum &&
        TypeCheckUtils.isInteger(typeInfo.baseType)
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Validate a non-enum expression being assigned to an enum type.
   * Handles various access patterns like this.Enum.MEMBER, global.Enum.MEMBER, etc.
   */
  private static validateNonEnumExpression(
    exprText: string,
    typeName: string,
  ): void {
    const parts = exprText.split(".");

    // ADR-016: Handle this.State.MEMBER pattern
    if (parts[0] === "this" && parts.length >= 3) {
      EnumAssignmentValidator.validateThisEnumPattern(parts, typeName);
      return;
    }

    // Issue #478: Handle global.Enum.MEMBER or global.struct.field pattern
    if (parts[0] === "global" && parts.length >= 3) {
      EnumAssignmentValidator.validateGlobalEnumPattern(parts, typeName);
      return;
    }

    // Allow if it's an enum member access of the correct type
    if (exprText.startsWith(typeName + ".")) {
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
    // Allow if it's a known enum type (even if different - resolve would catch mismatches)
    if (
      parts.length === 2 &&
      !EnumAssignmentValidator.isMatchingEnum(parts[0], typeName)
    ) {
      throw new Error(
        `Error: Cannot assign non-enum value to ${typeName} enum`,
      );
    }
  }

  /**
   * ADR-016: Validate this.Enum.MEMBER pattern inside a scope.
   */
  private static validateThisEnumPattern(
    parts: string[],
    typeName: string,
  ): void {
    if (!CodeGenState.currentScope) {
      throw new Error(
        `Error: Cannot assign non-enum value to ${typeName} enum`,
      );
    }
    const scopedEnumName = `${CodeGenState.currentScope}_${parts[1]}`;
    if (scopedEnumName !== typeName) {
      throw new Error(
        `Error: Cannot assign non-enum value to ${typeName} enum`,
      );
    }
  }

  /**
   * Issue #478: Validate global.X.Y pattern.
   * If X is a known enum, validates it matches the target type.
   * If X is not an enum (e.g. struct variable), allows through since
   * EnumTypeResolver.resolve() with TypeResolver fallback handles the chain.
   */
  private static validateGlobalEnumPattern(
    parts: string[],
    typeName: string,
  ): void {
    const name = parts[1];

    // Not an enum (e.g. struct variable like global.input.field) — allow through
    // since EnumTypeResolver.resolve() with TypeResolver fallback handles the chain
    if (!CodeGenState.isKnownEnum(name)) {
      return;
    }

    // Known enum that doesn't match target type
    if (name !== typeName) {
      throw new Error(
        `Error: Cannot assign non-enum value to ${typeName} enum`,
      );
    }
  }

  /**
   * Check if an identifier is the target enum type or a known enum type.
   */
  private static isMatchingEnum(identifier: string, typeName: string): boolean {
    return identifier === typeName || CodeGenState.isKnownEnum(identifier);
  }
}

export default EnumAssignmentValidator;
