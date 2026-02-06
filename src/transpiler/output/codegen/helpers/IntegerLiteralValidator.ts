/**
 * IntegerLiteralValidator - Validates integer literals and type conversions
 *
 * Issue #696: Extracted from CodeGenerator to reduce cognitive complexity.
 *
 * Handles:
 * - Checking if an expression is an integer literal
 * - Validating literals fit in target type
 * - Validating type conversions for narrowing/sign
 */

import LiteralUtils from "../../../../utils/LiteralUtils.js";

/**
 * Dependencies for validation operations.
 */
interface IValidatorDeps {
  /** Check if a type name is an integer type */
  isIntegerType: (typeName: string) => boolean;
  /** Validate that a literal value fits in the target type */
  validateLiteralFitsType: (literal: string, typeName: string) => void;
  /** Get the inferred type of an expression */
  getExpressionType: (exprText: string) => string | null;
  /** Validate type conversion for narrowing/sign changes */
  validateTypeConversion: (
    targetType: string,
    sourceType: string | null,
  ) => void;
}

/**
 * Validates integer literals and type conversions for variable initialization.
 */
class IntegerLiteralValidator {
  private readonly deps: IValidatorDeps;

  constructor(deps: IValidatorDeps) {
    this.deps = deps;
  }

  /**
   * Check if the given text is an integer literal.
   *
   * Uses LiteralUtils to check for decimal, hex, and binary formats.
   */
  isIntegerLiteral(text: string): boolean {
    return LiteralUtils.parseIntegerLiteral(text) !== undefined;
  }

  /**
   * Validate an expression being assigned to an integer type.
   *
   * If the expression is a literal, validates it fits in the type.
   * Otherwise, validates the type conversion.
   *
   * @param typeName - The target type name
   * @param exprText - The expression text
   * @param line - Source line for error messages
   * @param col - Source column for error messages
   * @throws Error with location if validation fails
   */
  validateIntegerAssignment(
    typeName: string,
    exprText: string,
    line: number,
    col: number,
  ): void {
    if (!this.deps.isIntegerType(typeName)) {
      return;
    }

    const trimmedExpr = exprText.trim();

    try {
      if (this.isIntegerLiteral(trimmedExpr)) {
        // Direct literal - validate it fits in the target type
        this.deps.validateLiteralFitsType(trimmedExpr, typeName);
      } else {
        // Not a literal - check for narrowing/sign conversions
        const sourceType = this.deps.getExpressionType(exprText);
        this.deps.validateTypeConversion(typeName, sourceType);
      }
    } catch (validationError) {
      const msg =
        validationError instanceof Error
          ? validationError.message
          : String(validationError);
      throw new Error(`${line}:${col} ${msg}`, { cause: validationError });
    }
  }
}

export default IntegerLiteralValidator;
