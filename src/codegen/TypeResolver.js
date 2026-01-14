"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const TTypeConstants_1 = require("./types/TTypeConstants");
class TypeResolver {
  codeGen;
  constructor(codeGen) {
    this.codeGen = codeGen;
  }
  /**
   * ADR-024: Check if a type is any integer (signed or unsigned)
   */
  isIntegerType(typeName) {
    return TTypeConstants_1.INTEGER_TYPES.includes(typeName);
  }
  /**
   * ADR-024: Check if a type is a floating point type
   */
  isFloatType(typeName) {
    return TTypeConstants_1.FLOAT_TYPES.includes(typeName);
  }
  /**
   * ADR-024: Check if a type is a signed integer
   */
  isSignedType(typeName) {
    return TTypeConstants_1.SIGNED_TYPES.includes(typeName);
  }
  /**
   * ADR-024: Check if a type is an unsigned integer
   */
  isUnsignedType(typeName) {
    return TTypeConstants_1.UNSIGNED_TYPES.includes(typeName);
  }
  /**
   * Check if a type is a user-defined struct
   */
  isStructType(typeName) {
    // Access CodeGenerator's knownStructs set via reference
    // eslint-disable-next-line @typescript-eslint/dot-notation
    return this.codeGen["knownStructs"].has(typeName);
  }
  /**
   * ADR-024: Check if conversion from sourceType to targetType is narrowing
   * Narrowing occurs when target type has fewer bits than source type
   */
  isNarrowingConversion(sourceType, targetType) {
    const sourceWidth = TTypeConstants_1.TYPE_WIDTH[sourceType] || 0;
    const targetWidth = TTypeConstants_1.TYPE_WIDTH[targetType] || 0;
    if (sourceWidth === 0 || targetWidth === 0) {
      return false; // Can't determine for unknown types
    }
    return targetWidth < sourceWidth;
  }
  /**
   * ADR-024: Check if conversion involves a sign change
   * Sign change occurs when converting between signed and unsigned types
   */
  isSignConversion(sourceType, targetType) {
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
  validateLiteralFitsType(literalText, targetType) {
    const range = TTypeConstants_1.TYPE_RANGES[targetType];
    if (!range) {
      return; // No validation for unknown types (floats, bools, etc.)
    }
    // Parse the literal value
    let value;
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
  getLiteralType(ctx) {
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
  getExpressionType(ctx) {
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
  getPostfixExpressionType(ctx) {
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
  getPrimaryExpressionType(ctx) {
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
  getUnaryExpressionType(ctx) {
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
  validateTypeConversion(targetType, sourceType) {
    // If we can't determine source type, skip validation
    if (!sourceType) return;
    // Skip if types are the same
    if (sourceType === targetType) return;
    // Only validate integer-to-integer conversions
    if (!this.isIntegerType(sourceType) || !this.isIntegerType(targetType))
      return;
    // Check for narrowing conversion
    if (this.isNarrowingConversion(sourceType, targetType)) {
      const targetWidth = TTypeConstants_1.TYPE_WIDTH[targetType] || 0;
      throw new Error(
        `Error: Cannot assign ${sourceType} to ${targetType} (narrowing). ` +
          `Use bit indexing: value[0, ${targetWidth}]`,
      );
    }
    // Check for sign conversion
    if (this.isSignConversion(sourceType, targetType)) {
      const targetWidth = TTypeConstants_1.TYPE_WIDTH[targetType] || 0;
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
  getMemberTypeInfo(structType, memberName) {
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
exports.default = TypeResolver;
