/**
 * TypeResolver - Handles type inference, classification, and validation
 * Extracted from CodeGenerator for better separation of concerns
 * Issue #61: Now independent of CodeGenerator
 */
import * as Parser from "../../logic/parser/grammar/CNextParser";
import ICodeGenSymbols from "../../types/ICodeGenSymbols";
import SymbolTable from "../../logic/symbols/SymbolTable";
import TTypeInfo from "./types/TTypeInfo";
import ITypeResolverDeps from "./types/ITypeResolverDeps";
import INTEGER_TYPES from "./types/INTEGER_TYPES";
import FLOAT_TYPES from "./types/FLOAT_TYPES";
import SIGNED_TYPES from "./types/SIGNED_TYPES";
import UNSIGNED_TYPES from "./types/UNSIGNED_TYPES";
import TYPE_WIDTH from "./types/TYPE_WIDTH";
import TYPE_RANGES from "./types/TYPE_RANGES";
import ExpressionUnwrapper from "./utils/ExpressionUnwrapper";

class TypeResolver {
  private readonly symbols: ICodeGenSymbols | null;
  private readonly symbolTable: SymbolTable | null;
  private readonly typeRegistry: Map<string, TTypeInfo>;
  private readonly resolveIdentifierFn: (name: string) => string;

  constructor(deps: ITypeResolverDeps) {
    this.symbols = deps.symbols;
    this.symbolTable = deps.symbolTable;
    this.typeRegistry = deps.typeRegistry;
    this.resolveIdentifierFn = deps.resolveIdentifier;
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
   * Check if a type is a user-defined struct (C-Next or C header).
   * Issue #103: Now checks both knownStructs AND SymbolTable.
   * Issue #60: Uses SymbolCollector for C-Next structs.
   * Issue #61: Uses injected dependencies instead of CodeGenerator.
   */
  isStructType(typeName: string): boolean {
    // Check C-Next structs first (Issue #60: use SymbolCollector)
    if (this.symbols?.knownStructs.has(typeName)) {
      return true;
    }
    // Issue #551: Bitmaps are struct-like (use pass-by-reference with -> access)
    if (this.symbols?.knownBitmaps.has(typeName)) {
      return true;
    }
    // Check SymbolTable for C header structs
    if (this.symbolTable?.getStructFields(typeName)) {
      return true;
    }
    return false;
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

      if (/^-?\d+$/.exec(cleanText)) {
        // Decimal integer
        value = BigInt(cleanText);
      } else if (/^0[xX][0-9a-fA-F]+$/.exec(cleanText)) {
        // Hex literal
        value = BigInt(cleanText);
      } else if (/^0[bB][01]+$/.exec(cleanText)) {
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
    const suffixMatch = /([uUiI])(8|16|32|64)$/.exec(text);
    if (suffixMatch) {
      const signChar = suffixMatch[1].toLowerCase();
      const width = suffixMatch[2];
      return (signChar === "u" ? "u" : "i") + width;
    }

    // Float suffix
    const floatMatch = /[fF](32|64)$/.exec(text);
    if (floatMatch) {
      return "f" + floatMatch[1];
    }

    // Unsuffixed literal - type depends on context (handled by caller)
    return null;
  }

  /**
   * ADR-024: Get the type of an expression for type checking.
   * Returns the inferred type or null if type cannot be determined.
   * Issue #61: Uses ExpressionUnwrapper utility for tree navigation.
   */
  getExpressionType(ctx: Parser.ExpressionContext): string | null {
    // Navigate through expression tree to get the actual value
    const postfix = ExpressionUnwrapper.getPostfixExpression(ctx);
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
   * Issue #304: Enhanced to track type through member access chains (e.g., cfg.mode)
   */
  getPostfixExpressionType(
    ctx: Parser.PostfixExpressionContext,
  ): string | null {
    const primary = ctx.primaryExpression();
    if (!primary) return null;

    // Get base type from primary expression
    let currentType = this.getPrimaryExpressionType(primary);
    if (!currentType) return null;

    // Check for postfix operations: member access, array indexing, bit indexing
    const suffixes = ctx.children?.slice(1) || [];
    for (const suffix of suffixes) {
      const text = suffix.getText();

      // Member access: .fieldName
      if (text.startsWith(".")) {
        const memberName = text.slice(1);
        const memberInfo = this.getMemberTypeInfo(currentType, memberName);
        if (memberInfo) {
          currentType = memberInfo.baseType;
        } else {
          // Can't determine member type, return null
          return null;
        }
        continue;
      }

      // Array or bit indexing: [index] or [start, width]
      if (text.startsWith("[") && text.endsWith("]")) {
        const inner = text.slice(1, -1);
        if (inner.includes(",")) {
          // Range indexing: [start, width]
          // ADR-024: Return null for bit indexing to skip type conversion validation
          // Bit indexing is the explicit escape hatch for narrowing/sign conversions
          return null;
        } else {
          // Single index: could be array access or bit indexing
          // For arrays, the type stays the same (element type)
          // For single bit on integer, returns bool
          if (this.isIntegerType(currentType)) {
            return "bool";
          }
          // For arrays, currentType is already the element type (from getMemberTypeInfo)
          continue;
        }
      }
    }

    return currentType;
  }

  /**
   * ADR-024: Get the type of a primary expression.
   * Issue #61: Uses injected dependencies instead of CodeGenerator.
   */
  getPrimaryExpressionType(
    ctx: Parser.PrimaryExpressionContext,
  ): string | null {
    // Check for identifier
    const id = ctx.IDENTIFIER();
    if (id) {
      const name = id.getText();
      const scopedName = this.resolveIdentifierFn(name);
      const typeInfo = this.typeRegistry.get(scopedName);
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
   * Issue #103: Now checks SymbolTable first for C header structs
   * Issue #61: Uses injected dependencies instead of CodeGenerator.
   */
  getMemberTypeInfo(
    structType: string,
    memberName: string,
  ): { isArray: boolean; baseType: string } | undefined {
    // First check SymbolTable (C header structs) - Issue #103 fix
    if (this.symbolTable) {
      const fieldInfo = this.symbolTable.getStructFieldInfo(
        structType,
        memberName,
      );
      if (fieldInfo) {
        return {
          isArray:
            fieldInfo.arrayDimensions !== undefined &&
            fieldInfo.arrayDimensions.length > 0,
          baseType: fieldInfo.type,
        };
      }
    }

    // Fall back to local C-Next struct fields (Issue #60: use SymbolCollector)
    const fieldType = this.symbols?.structFields
      .get(structType)
      ?.get(memberName);
    if (!fieldType) return undefined;

    // Check if this field is marked as an array (Issue #60: use SymbolCollector)
    const arrayFields = this.symbols?.structFieldArrays.get(structType);
    const isArray = arrayFields?.has(memberName) ?? false;

    return { isArray, baseType: fieldType };
  }
}

export default TypeResolver;
