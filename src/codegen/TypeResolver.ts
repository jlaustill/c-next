/**
 * TypeResolver - Handles type inference, classification, and validation
 * Extracted from CodeGenerator for better separation of concerns
 */
import * as Parser from "../parser/grammar/CNextParser";
import CodeGenerator from "./CodeGenerator";
import INTEGER_TYPES from "./types/INTEGER_TYPES";
import FLOAT_TYPES from "./types/FLOAT_TYPES";
import SIGNED_TYPES from "./types/SIGNED_TYPES";
import UNSIGNED_TYPES from "./types/UNSIGNED_TYPES";
import TYPE_WIDTH from "./types/TYPE_WIDTH";
import TYPE_RANGES from "./types/TYPE_RANGES";

class TypeResolver {
  private codeGen: CodeGenerator;

  constructor(codeGen: CodeGenerator) {
    this.codeGen = codeGen;
  }

  /**
   * ADR-024: Check if a type is any integer (signed or unsigned)
   */
  isIntegerType(typeName: string): boolean {
    return (INTEGER_TYPES as readonly string[]).includes(typeName);
  }

  /**
   * ADR-024: Check if a type is a floating point type
   */
  isFloatType(typeName: string): boolean {
    return (FLOAT_TYPES as readonly string[]).includes(typeName);
  }

  /**
   * ADR-024: Check if a type is a signed integer
   */
  isSignedType(typeName: string): boolean {
    return (SIGNED_TYPES as readonly string[]).includes(typeName);
  }

  /**
   * ADR-024: Check if a type is an unsigned integer
   */
  isUnsignedType(typeName: string): boolean {
    return (UNSIGNED_TYPES as readonly string[]).includes(typeName);
  }

  /**
   * Check if a type is a user-defined struct
   */
  isStructType(typeName: string): boolean {
    // Access CodeGenerator's knownStructs set via reference
    // eslint-disable-next-line @typescript-eslint/dot-notation
    return this.codeGen["knownStructs"].has(typeName);
  }

  /**
   * ADR-024: Check if conversion from sourceType to targetType is narrowing
   * Narrowing occurs when target type has fewer bits than source type
   */
  isNarrowingConversion(sourceType: string, targetType: string): boolean {
    const sourceWidth = TYPE_WIDTH[sourceType] || 0;
    const targetWidth = TYPE_WIDTH[targetType] || 0;

    if (sourceWidth === 0 || targetWidth === 0) {
      return false; // Can't determine for unknown types
    }

    return targetWidth < sourceWidth;
  }

  /**
   * ADR-024: Check if conversion involves a sign change
   * Sign change occurs when converting between signed and unsigned types
   */
  isSignConversion(sourceType: string, targetType: string): boolean {
    const sourceIsSigned = this.isSignedType(sourceType);
    const sourceIsUnsigned = this.isUnsignedType(sourceType);
    const targetIsSigned = this.isSignedType(targetType);
    const targetIsUnsigned = this.isUnsignedType(targetType);

    return (
      (sourceIsSigned && targetIsUnsigned) ||
      (sourceIsUnsigned && targetIsSigned)
    );
  }

  /**
   * ADR-024: Validate that a literal value fits within the target type's range.
   * Throws an error if the value doesn't fit.
   * @param literalText The literal text (e.g., "256", "-1", "0xFF")
   * @param targetType The target type (e.g., "u8", "i32")
   */
  validateLiteralFitsType(literalText: string, targetType: string): void {
    const range = TYPE_RANGES[targetType];
    if (!range) {
      return; // No validation for unknown types (floats, bools, etc.)
    }

    // Parse the literal value
    let value: bigint;
    try {
      const cleanText = literalText.trim();

      if (cleanText.match(/^-?\d+$/)) {
        // Decimal integer
        value = BigInt(cleanText);
      } else if (cleanText.match(/^0[xX][0-9a-fA-F]+$/)) {
        // Hex literal
        value = BigInt(cleanText);
      } else if (cleanText.match(/^0[bB][01]+$/)) {
        // Binary literal
        value = BigInt(cleanText);
      } else {
        // Not an integer literal we can validate
        return;
      }
    } catch {
      return; // Can't parse, skip validation
    }

    const [min, max] = range;

    // Check if value is negative for unsigned type
    if (this.isUnsignedType(targetType) && value < 0n) {
      throw new Error(
        `Error: Negative value ${literalText} cannot be assigned to unsigned type ${targetType}`,
      );
    }

    // Check if value is out of range
    if (value < min || value > max) {
      throw new Error(
        `Error: Value ${literalText} exceeds ${targetType} range (${min} to ${max})`,
      );
    }
  }

  /**
   * ADR-024: Get the type from a literal (suffixed or unsuffixed).
   * Returns the explicit suffix type, or null for unsuffixed literals.
   */
  getLiteralType(ctx: Parser.LiteralContext): string | null {
    const text = ctx.getText();

    // Boolean literals
    if (text === "true" || text === "false") return "bool";

    // Check for type suffix on numeric literals
    const suffixMatch = text.match(/([uUiI])(8|16|32|64)$/);
    if (suffixMatch) {
      const signChar = suffixMatch[1].toLowerCase();
      const width = suffixMatch[2];
      return (signChar === "u" ? "u" : "i") + width;
    }

    // Float suffix
    const floatMatch = text.match(/[fF](32|64)$/);
    if (floatMatch) {
      return "f" + floatMatch[1];
    }

    // Unsuffixed literal - type depends on context (handled by caller)
    return null;
  }

  /**
   * ADR-024: Get the type of an expression for type checking.
   * Returns the inferred type or null if type cannot be determined.
   */
  getExpressionType(ctx: Parser.ExpressionContext): string | null {
    // Navigate through expression tree to get the actual value
    // eslint-disable-next-line @typescript-eslint/dot-notation
    const postfix = this.codeGen["getPostfixExpression"](ctx);
    if (postfix) {
      return this.getPostfixExpressionType(postfix);
    }

    // For more complex expressions (binary ops, etc.), try to infer type
    const ternary = ctx.ternaryExpression();
    const orExprs = ternary.orExpression();
    // If it's a ternary, we can't easily determine the type
    if (orExprs.length > 1) {
      return null;
    }
    const or = orExprs[0];
    if (or.andExpression().length > 1) {
      return "bool"; // Logical OR returns bool
    }

    const and = or.andExpression()[0];
    if (and.equalityExpression().length > 1) {
      return "bool"; // Logical AND returns bool
    }

    const eq = and.equalityExpression()[0];
    if (eq.relationalExpression().length > 1) {
      return "bool"; // Equality comparison returns bool
    }

    const rel = eq.relationalExpression()[0];
    if (rel.bitwiseOrExpression().length > 1) {
      return "bool"; // Relational comparison returns bool
    }

    // For arithmetic expressions, we'd need to track operand types
    // For now, return null for complex expressions
    return null;
  }

  /**
   * ADR-024: Get the type of a postfix expression.
   */
  getPostfixExpressionType(
    ctx: Parser.PostfixExpressionContext,
  ): string | null {
    const primary = ctx.primaryExpression();
    if (!primary) return null;

    // Get base type from primary expression
    const baseType = this.getPrimaryExpressionType(primary);

    // Check for postfix operations like bit indexing
    const suffixes = ctx.children?.slice(1) || [];
    for (const suffix of suffixes) {
      const text = suffix.getText();
      // Bit indexing: [start, width] or [index]
      if (text.startsWith("[") && text.endsWith("]")) {
        const inner = text.slice(1, -1);
        if (inner.includes(",")) {
          // Range indexing: [start, width]
          // ADR-024: Return null for bit indexing to skip type conversion validation
          // Bit indexing is the explicit escape hatch for narrowing/sign conversions
          return null;
        } else {
          // Single bit indexing: [index] - returns bool
          return "bool";
        }
      }
    }

    return baseType;
  }

  /**
   * ADR-024: Get the type of a primary expression.
   */
  getPrimaryExpressionType(
    ctx: Parser.PrimaryExpressionContext,
  ): string | null {
    // Check for identifier
    const id = ctx.IDENTIFIER();
    if (id) {
      const name = id.getText();
      // eslint-disable-next-line @typescript-eslint/dot-notation
      const scopedName = this.codeGen["resolveIdentifier"](name);
      // eslint-disable-next-line @typescript-eslint/dot-notation
      const typeInfo = this.codeGen["context"].typeRegistry.get(scopedName);
      if (typeInfo) {
        return typeInfo.baseType;
      }
      return null;
    }

    // Check for literal
    const literal = ctx.literal();
    if (literal) {
      return this.getLiteralType(literal);
    }

    // Check for parenthesized expression
    const expr = ctx.expression();
    if (expr) {
      return this.getExpressionType(expr);
    }

    // Check for cast expression
    const cast = ctx.castExpression();
    if (cast) {
      return cast.type().getText();
    }

    return null;
  }

  /**
   * ADR-024: Get the type of a unary expression (for cast validation).
   */
  getUnaryExpressionType(ctx: Parser.UnaryExpressionContext): string | null {
    // Check for unary operators - type doesn't change for !, ~, -, +
    const postfix = ctx.postfixExpression();
    if (postfix) {
      return this.getPostfixExpressionType(postfix);
    }

    // Check for recursive unary expression
    const unary = ctx.unaryExpression();
    if (unary) {
      return this.getUnaryExpressionType(unary);
    }

    return null;
  }

  /**
   * ADR-024: Validate that a type conversion is allowed.
   * Throws error for narrowing or sign-changing conversions.
   */
  validateTypeConversion(targetType: string, sourceType: string | null): void {
    // If we can't determine source type, skip validation
    if (!sourceType) return;

    // Skip if types are the same
    if (sourceType === targetType) return;

    // Only validate integer-to-integer conversions
    if (!this.isIntegerType(sourceType) || !this.isIntegerType(targetType))
      return;

    // Check for narrowing conversion
    if (this.isNarrowingConversion(sourceType, targetType)) {
      const targetWidth = TYPE_WIDTH[targetType] || 0;
      throw new Error(
        `Error: Cannot assign ${sourceType} to ${targetType} (narrowing). ` +
          `Use bit indexing: value[0, ${targetWidth}]`,
      );
    }

    // Check for sign conversion
    if (this.isSignConversion(sourceType, targetType)) {
      const targetWidth = TYPE_WIDTH[targetType] || 0;
      throw new Error(
        `Error: Cannot assign ${sourceType} to ${targetType} (sign change). ` +
          `Use bit indexing: value[0, ${targetWidth}]`,
      );
    }
  }

  /**
   * Get type info for a struct member field
   * Used to track types through member access chains like buf.data[0]
   */
  getMemberTypeInfo(
    structType: string,
    memberName: string,
  ): { isArray: boolean; baseType: string } | undefined {
    // eslint-disable-next-line @typescript-eslint/dot-notation
    const fieldType = this.codeGen["structFields"]
      .get(structType)
      ?.get(memberName);
    if (!fieldType) return undefined;

    // Check if this field is marked as an array
    // eslint-disable-next-line @typescript-eslint/dot-notation
    const arrayFields = this.codeGen["structFieldArrays"].get(structType);
    const isArray = arrayFields?.has(memberName) ?? false;

    return { isArray, baseType: fieldType };
  }
}

export default TypeResolver;
