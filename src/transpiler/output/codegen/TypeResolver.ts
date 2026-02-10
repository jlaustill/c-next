/**
 * TypeResolver - Handles type inference, classification, and validation
 * Static class that reads from CodeGenState directly.
 */
import * as Parser from "../../logic/parser/grammar/CNextParser";
import CodeGenState from "./CodeGenState";
import INTEGER_TYPES from "./types/INTEGER_TYPES";
import FLOAT_TYPES from "./types/FLOAT_TYPES";
import SIGNED_TYPES from "./types/SIGNED_TYPES";
import UNSIGNED_TYPES from "./types/UNSIGNED_TYPES";
import TYPE_WIDTH from "./types/TYPE_WIDTH";
import TYPE_RANGES from "./types/TYPE_RANGES";
import ExpressionUnwrapper from "./utils/ExpressionUnwrapper";

/**
 * Internal type info tracked through postfix suffix chains.
 * Preserves isArray so indexing can distinguish array access from bit indexing.
 */
type InternalTypeInfo = { baseType: string; isArray: boolean };

class TypeResolver {
  /**
   * ADR-024: Check if a type is any integer (signed or unsigned)
   */
  static isIntegerType(typeName: string): boolean {
    return (INTEGER_TYPES as readonly string[]).includes(typeName);
  }

  /**
   * ADR-024: Check if a type is a floating point type
   */
  static isFloatType(typeName: string): boolean {
    return (FLOAT_TYPES as readonly string[]).includes(typeName);
  }

  /**
   * ADR-024: Check if a type is a signed integer
   */
  static isSignedType(typeName: string): boolean {
    return (SIGNED_TYPES as readonly string[]).includes(typeName);
  }

  /**
   * ADR-024: Check if a type is an unsigned integer
   */
  static isUnsignedType(typeName: string): boolean {
    return (UNSIGNED_TYPES as readonly string[]).includes(typeName);
  }

  /**
   * Check if a type is a user-defined struct (C-Next or C header).
   * Issue #103: Now checks both knownStructs AND SymbolTable.
   */
  static isStructType(typeName: string): boolean {
    if (CodeGenState.symbols?.knownStructs.has(typeName)) {
      return true;
    }
    // Issue #551: Bitmaps are struct-like (use pass-by-reference with -> access)
    if (CodeGenState.symbols?.knownBitmaps.has(typeName)) {
      return true;
    }
    if (CodeGenState.symbolTable?.getStructFields(typeName)) {
      return true;
    }
    return false;
  }

  /**
   * ADR-024: Check if conversion from sourceType to targetType is narrowing
   */
  static isNarrowingConversion(
    sourceType: string,
    targetType: string,
  ): boolean {
    const sourceWidth = TYPE_WIDTH[sourceType] || 0;
    const targetWidth = TYPE_WIDTH[targetType] || 0;

    if (sourceWidth === 0 || targetWidth === 0) {
      return false;
    }

    return targetWidth < sourceWidth;
  }

  /**
   * ADR-024: Check if conversion involves a sign change
   */
  static isSignConversion(sourceType: string, targetType: string): boolean {
    const sourceIsSigned = TypeResolver.isSignedType(sourceType);
    const sourceIsUnsigned = TypeResolver.isUnsignedType(sourceType);
    const targetIsSigned = TypeResolver.isSignedType(targetType);
    const targetIsUnsigned = TypeResolver.isUnsignedType(targetType);

    return (
      (sourceIsSigned && targetIsUnsigned) ||
      (sourceIsUnsigned && targetIsSigned)
    );
  }

  /**
   * ADR-024: Validate that a literal value fits within the target type's range.
   * Throws an error if the value doesn't fit.
   */
  static validateLiteralFitsType(
    literalText: string,
    targetType: string,
  ): void {
    const range = TYPE_RANGES[targetType];
    if (!range) {
      return;
    }

    let value: bigint;
    try {
      const cleanText = literalText.trim();

      if (/^-?\d+$/.exec(cleanText)) {
        value = BigInt(cleanText);
      } else if (/^0[xX][0-9a-fA-F]+$/.exec(cleanText)) {
        value = BigInt(cleanText);
      } else if (/^0[bB][01]+$/.exec(cleanText)) {
        value = BigInt(cleanText);
      } else {
        return;
      }
    } catch {
      return;
    }

    const [min, max] = range;

    if (TypeResolver.isUnsignedType(targetType) && value < 0n) {
      throw new Error(
        `Error: Negative value ${literalText} cannot be assigned to unsigned type ${targetType}`,
      );
    }

    if (value < min || value > max) {
      throw new Error(
        `Error: Value ${literalText} exceeds ${targetType} range (${min} to ${max})`,
      );
    }
  }

  /**
   * ADR-024: Get the type from a literal (suffixed or unsuffixed).
   */
  static getLiteralType(ctx: Parser.LiteralContext): string | null {
    const text = ctx.getText();

    if (text === "true" || text === "false") return "bool";

    const suffixMatch = /([uUiI])(8|16|32|64)$/.exec(text);
    if (suffixMatch) {
      const signChar = suffixMatch[1].toLowerCase();
      const width = suffixMatch[2];
      return (signChar === "u" ? "u" : "i") + width;
    }

    const floatMatch = /[fF](32|64)$/.exec(text);
    if (floatMatch) {
      return "f" + floatMatch[1];
    }

    return null;
  }

  /**
   * ADR-024: Get the type of an expression for type checking.
   */
  static getExpressionType(ctx: Parser.ExpressionContext): string | null {
    const postfix = ExpressionUnwrapper.getPostfixExpression(ctx);
    if (postfix) {
      return TypeResolver.getPostfixExpressionType(postfix);
    }

    const ternary = ctx.ternaryExpression();
    const orExprs = ternary.orExpression();
    if (orExprs.length > 1) {
      return null;
    }
    const or = orExprs[0];
    if (or.andExpression().length > 1) {
      return "bool";
    }

    const and = or.andExpression()[0];
    if (and.equalityExpression().length > 1) {
      return "bool";
    }

    const eq = and.equalityExpression()[0];
    if (eq.relationalExpression().length > 1) {
      return "bool";
    }

    const rel = eq.relationalExpression()[0];
    if (rel.bitwiseOrExpression().length > 1) {
      return "bool";
    }

    return null;
  }

  /**
   * ADR-024: Get the type of a postfix expression.
   * Tracks InternalTypeInfo (baseType + isArray) through the suffix chain
   * so that array indexing is correctly distinguished from bit indexing.
   */
  static getPostfixExpressionType(
    ctx: Parser.PostfixExpressionContext,
  ): string | null {
    const primary = ctx.primaryExpression();
    if (!primary) return null;

    let current = TypeResolver.getPrimaryExpressionTypeInfo(primary);
    if (!current) return null;

    const suffixes = ctx.children?.slice(1) || [];
    for (const suffix of suffixes) {
      const result = TypeResolver.processPostfixSuffix(
        suffix.getText(),
        current,
      );
      if (result.stop) {
        return result.type;
      }
      current = result.info!;
    }

    return current.baseType;
  }

  /**
   * Process a single postfix suffix and determine the resulting type.
   * Returns { type, stop, info } where stop=true means return type immediately.
   */
  private static processPostfixSuffix(
    text: string,
    current: InternalTypeInfo,
  ): { type: string | null; stop: boolean; info?: InternalTypeInfo } {
    if (text.startsWith(".")) {
      const memberName = text.slice(1);
      const memberInfo = TypeResolver.getMemberTypeInfo(
        current.baseType,
        memberName,
      );
      if (!memberInfo) {
        return { type: null, stop: true };
      }
      return {
        type: null,
        stop: false,
        info: { baseType: memberInfo.baseType, isArray: memberInfo.isArray },
      };
    }

    if (text.startsWith("[") && text.endsWith("]")) {
      return TypeResolver.processIndexingSuffix(text, current);
    }

    return { type: null, stop: false, info: current };
  }

  /**
   * Process array or bit indexing suffix.
   * Checks isArray BEFORE isIntegerType to correctly distinguish
   * array element access from bit indexing.
   */
  private static processIndexingSuffix(
    text: string,
    current: InternalTypeInfo,
  ): { type: string | null; stop: boolean; info?: InternalTypeInfo } {
    const inner = text.slice(1, -1);

    // Range indexing: [start, width] - always bit extraction
    if (inner.includes(",")) {
      return { type: null, stop: true };
    }

    // Array access: if current type is known to be an array, index yields element
    if (current.isArray) {
      return {
        type: null,
        stop: false,
        info: { baseType: current.baseType, isArray: false },
      };
    }

    // Bit indexing on integer: single bit returns bool
    if (TypeResolver.isIntegerType(current.baseType)) {
      return { type: "bool", stop: true };
    }

    // Unknown indexing - pass through
    return {
      type: null,
      stop: false,
      info: { baseType: current.baseType, isArray: false },
    };
  }

  /**
   * Get full InternalTypeInfo from a primary expression (preserves isArray).
   */
  private static getPrimaryExpressionTypeInfo(
    ctx: Parser.PrimaryExpressionContext,
  ): InternalTypeInfo | null {
    const id = ctx.IDENTIFIER();
    if (id) {
      const name = id.getText();
      const scopedName = CodeGenState.resolveIdentifier(name);
      const typeInfo = CodeGenState.typeRegistry.get(scopedName);
      if (typeInfo) {
        return { baseType: typeInfo.baseType, isArray: typeInfo.isArray };
      }
      return null;
    }

    const literal = ctx.literal();
    if (literal) {
      const litType = TypeResolver.getLiteralType(literal);
      return litType ? { baseType: litType, isArray: false } : null;
    }

    const expr = ctx.expression();
    if (expr) {
      const exprType = TypeResolver.getExpressionType(expr);
      return exprType ? { baseType: exprType, isArray: false } : null;
    }

    const cast = ctx.castExpression();
    if (cast) {
      return { baseType: cast.type().getText(), isArray: false };
    }

    return null;
  }

  /**
   * ADR-024: Get the type of a primary expression (public API, returns baseType only).
   */
  static getPrimaryExpressionType(
    ctx: Parser.PrimaryExpressionContext,
  ): string | null {
    const info = TypeResolver.getPrimaryExpressionTypeInfo(ctx);
    return info?.baseType ?? null;
  }

  /**
   * ADR-024: Get the type of a unary expression (for cast validation).
   */
  static getUnaryExpressionType(
    ctx: Parser.UnaryExpressionContext,
  ): string | null {
    const postfix = ctx.postfixExpression();
    if (postfix) {
      return TypeResolver.getPostfixExpressionType(postfix);
    }

    const unary = ctx.unaryExpression();
    if (unary) {
      return TypeResolver.getUnaryExpressionType(unary);
    }

    return null;
  }

  /**
   * ADR-024: Validate that a type conversion is allowed.
   */
  static validateTypeConversion(
    targetType: string,
    sourceType: string | null,
  ): void {
    if (!sourceType) return;
    if (sourceType === targetType) return;

    if (
      !TypeResolver.isIntegerType(sourceType) ||
      !TypeResolver.isIntegerType(targetType)
    )
      return;

    if (TypeResolver.isNarrowingConversion(sourceType, targetType)) {
      const targetWidth = TYPE_WIDTH[targetType] || 0;
      throw new Error(
        `Error: Cannot assign ${sourceType} to ${targetType} (narrowing). ` +
          `Use bit indexing: value[0, ${targetWidth}]`,
      );
    }

    if (TypeResolver.isSignConversion(sourceType, targetType)) {
      const targetWidth = TYPE_WIDTH[targetType] || 0;
      throw new Error(
        `Error: Cannot assign ${sourceType} to ${targetType} (sign change). ` +
          `Use bit indexing: value[0, ${targetWidth}]`,
      );
    }
  }

  /**
   * Get type info for a struct member field.
   * Issue #103: Checks SymbolTable first for C header structs.
   */
  static getMemberTypeInfo(
    structType: string,
    memberName: string,
  ): { isArray: boolean; baseType: string } | undefined {
    if (CodeGenState.symbolTable) {
      const fieldInfo = CodeGenState.symbolTable.getStructFieldInfo(
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

    const fieldType = CodeGenState.symbols?.structFields
      .get(structType)
      ?.get(memberName);
    if (!fieldType) return undefined;

    const arrayFields = CodeGenState.symbols?.structFieldArrays.get(structType);
    const isArray = arrayFields?.has(memberName) ?? false;

    return { isArray, baseType: fieldType };
  }
}

export default TypeResolver;
