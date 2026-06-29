/**
 * TypeResolver - Handles type inference, classification, and validation
 * Static class that reads from CodeGenState directly.
 */
import { ParserRuleContext } from "antlr4ng";
import * as Parser from "../../logic/parser/grammar/CNextParser";
import CodeGenState from "../../state/CodeGenState";
import INTEGER_TYPES from "./types/INTEGER_TYPES";
import FLOAT_TYPES from "./types/FLOAT_TYPES";
import SIGNED_TYPES from "./types/SIGNED_TYPES";
import UNSIGNED_TYPES from "./types/UNSIGNED_TYPES";
import TYPE_WIDTH from "./types/TYPE_WIDTH";
import TYPE_RANGES from "./types/TYPE_RANGES";
import ExpressionUnwrapper from "../../../utils/ExpressionUnwrapper";

/**
 * Internal type info tracked through postfix suffix chains.
 * Preserves isArray so indexing can distinguish array access from bit indexing.
 */
type InternalTypeInfo = { baseType: string; isArray: boolean };

/**
 * Discriminated union for postfix suffix processing results.
 * stop=true: return type immediately (terminal suffix like bit indexing).
 * stop=false: continue chain with updated InternalTypeInfo.
 */
type SuffixResult =
  | { stop: true; type: string | null }
  | { stop: false; info: InternalTypeInfo };

class TypeResolver {
  /** Sentinel value for `global` keyword in postfix expression type resolution */
  private static readonly GLOBAL_SENTINEL = "__global__";
  /** Sentinel value for `this` keyword in postfix expression type resolution */
  private static readonly THIS_SENTINEL = "__this__";

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
    if (CodeGenState.symbolTable.getStructFields(typeName)) {
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

    // Plain integer literals (no suffix) have type int in C
    // Check for integer: starts with digit, no decimal point
    if (/^\d+$/.test(text) || /^0[xXbBoO][\da-fA-F]+$/.test(text)) {
      return "int";
    }

    // Plain float literals (no suffix) have type double in C
    if (
      /^\d*\.\d+([eE][+-]?\d+)?$/.test(text) ||
      /^\d+[eE][+-]?\d+$/.test(text)
    ) {
      return "f64";
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
   * Resolve the C-Next integer type of an expression, including composite
   * arithmetic/bitwise expressions that `getExpressionType` leaves unresolved.
   *
   * MISRA C:2012 Rule 10.4 (enforced by MixedTypeCategoryAnalyzer) guarantees a
   * binary operator's operands share an essential type category, so a composite
   * integer expression's category is uniform; its essential width is the widest
   * integer operand. This is what lets slice-assignment serialize an arithmetic
   * source (e.g. `a + b`) MISRA Rule 10.8-clean instead of guessing a width.
   *
   * Returns null when no integer-typed variable leaf can be resolved (e.g. a
   * struct-field or function-call composite — left for a later pass).
   */
  static getIntegerExpressionType(
    ctx: Parser.ExpressionContext,
  ): string | null {
    const direct = TypeResolver.getExpressionType(ctx);
    if (direct !== null) return direct;
    return TypeResolver.resolveCompositeIntegerType(ctx);
  }

  /**
   * Combine the leaf VALUE operands of a composite expression into a single
   * C-Next type: the (uniform, per Rule 10.4) category at the widest width.
   *
   * Operands are typed by their value (Issue #1085 review) — an array index
   * (`arr[i]`), bit offset (`x[off, w]`) or struct member name is NOT a value
   * operand and must not contribute to the width. A bit-extraction contributes
   * its EXTRACTED width, not the variable's full width (typing `a + b[0, 32]`
   * as u64 would cast the composite to a wider type — MISRA Rule 10.8).
   */
  private static resolveCompositeIntegerType(
    ctx: Parser.ExpressionContext,
  ): string | null {
    let category: "i" | "u" | null = null;
    let width = 0;

    for (const operand of TypeResolver.collectOperandPostfixes(ctx)) {
      const operandType = TypeResolver.typeOperandPostfix(operand);
      const match = operandType
        ? /^([iu])(8|16|32|64)$/.exec(operandType)
        : null;
      if (!match) continue;
      category ??= match[1] as "i" | "u";
      width = Math.max(width, Number.parseInt(match[2], 10));
    }

    return category && width > 0 ? `${category}${width}` : null;
  }

  /**
   * Type one leaf operand of a composite by its VALUE type. A bit-extraction
   * `x[start, width]` yields an unsigned value of the extracted width; a simple
   * function call `name(...)` yields its declared return type; everything else
   * (variable, array element, struct field, member chain) defers to
   * getPostfixExpressionType. Returns null for an operand it cannot classify
   * (e.g. a literal, which is contextually typed).
   */
  private static typeOperandPostfix(
    postfix: Parser.PostfixExpressionContext,
  ): string | null {
    const extractionWidth = TypeResolver.bitExtractionWidth(postfix);
    if (extractionWidth !== null) {
      return TypeResolver.unsignedTypeForBits(extractionWidth);
    }

    const direct = TypeResolver.getPostfixExpressionType(postfix);
    if (direct !== null) return direct;

    return TypeResolver.callReturnType(postfix);
  }

  /**
   * Collect the leaf operand postfix expressions of a composite WITHOUT
   * descending into a postfix's own internals — so an array index (`arr[i]`) or
   * bit offset (`x[off, w]`) variable is never mistaken for a value operand.
   */
  private static collectOperandPostfixes(
    node: ParserRuleContext,
  ): Parser.PostfixExpressionContext[] {
    if (node instanceof Parser.PostfixExpressionContext) return [node];
    const operands: Parser.PostfixExpressionContext[] = [];
    for (let i = 0; i < node.getChildCount(); i += 1) {
      const child = node.getChild(i);
      if (child instanceof ParserRuleContext) {
        operands.push(...TypeResolver.collectOperandPostfixes(child));
      }
    }
    return operands;
  }

  /**
   * If a postfix expression's terminal suffix is a bit-range extraction
   * `[start, width]` with a compile-time-constant width, return that width in
   * bits; else null.
   */
  private static bitExtractionWidth(
    postfix: Parser.PostfixExpressionContext,
  ): number | null {
    const ops = postfix.postfixOp();
    const last = ops.at(-1);
    if (last?.expression().length !== 2) return null;
    const widthExpr = last.expression()[1];

    // Resolve the width through the constant evaluator — the same path the slice
    // offset/length use — so a named const or any-base literal width
    // (`b[0, WIDTH]`, `b[0, 0b100000]`) is sized at its real width rather than
    // dropped, which would mis-type a composite slice source (Issue #1085 review).
    const evaluated = CodeGenState.generator?.tryEvaluateConstant(widthExpr);
    if (evaluated !== undefined) {
      return evaluated > 0 ? evaluated : null;
    }

    // Fallback for contexts with no generator (e.g. isolated unit tests): accept
    // a plain decimal/hex literal width directly.
    const widthText = widthExpr.getText();
    if (!/^(0x[0-9a-fA-F]+|\d+)$/.test(widthText)) return null;
    const value = Number.parseInt(
      widthText,
      widthText.startsWith("0x") ? 16 : 10,
    );
    return Number.isNaN(value) || value <= 0 ? null : value;
  }

  /** Smallest standard unsigned C-Next type holding `bits` bits, or null if >64. */
  private static unsignedTypeForBits(bits: number): string | null {
    if (bits <= 8) return "u8";
    if (bits <= 16) return "u16";
    if (bits <= 32) return "u32";
    if (bits <= 64) return "u64";
    return null;
  }

  /**
   * If a postfix expression is a simple function call `name(...)`, return the
   * function's declared return type — a call operand's width comes from its
   * return type, not from being ignored (Issue #1085 review).
   */
  private static callReturnType(
    postfix: Parser.PostfixExpressionContext,
  ): string | null {
    const ops = postfix.postfixOp();
    if (ops.length !== 1 || !ops[0].getText().startsWith("(")) return null;
    const name = postfix.primaryExpression()?.IDENTIFIER()?.getText();
    return name ? (CodeGenState.getFunctionReturnType(name) ?? null) : null;
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
      current = result.info;
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
  ): SuffixResult {
    if (text.startsWith(".")) {
      return TypeResolver.processMemberSuffix(text.slice(1), current);
    }

    if (text.startsWith("[") && text.endsWith("]")) {
      return TypeResolver.processIndexingSuffix(text, current);
    }

    return { stop: false, info: current };
  }

  /**
   * Process a member access suffix (.name) and resolve the resulting type.
   * Handles global/this sentinel values and regular struct member lookups.
   */
  private static processMemberSuffix(
    memberName: string,
    current: InternalTypeInfo,
  ): SuffixResult {
    // Handle global.X — resolve X as a global variable name
    if (current.baseType === TypeResolver.GLOBAL_SENTINEL) {
      return TypeResolver.resolveRegistryLookup(memberName);
    }

    // Handle this.X — resolve X as a scope member variable
    if (
      current.baseType === TypeResolver.THIS_SENTINEL &&
      CodeGenState.currentScope
    ) {
      const scopedName = `${CodeGenState.currentScope}_${memberName}`;
      return TypeResolver.resolveRegistryLookup(scopedName);
    }

    const memberInfo = TypeResolver.getMemberTypeInfo(
      current.baseType,
      memberName,
    );
    if (!memberInfo) {
      return { stop: true, type: null };
    }
    return {
      stop: false,
      info: { baseType: memberInfo.baseType, isArray: memberInfo.isArray },
    };
  }

  /**
   * Look up a variable name in the type registry and return a SuffixResult.
   */
  private static resolveRegistryLookup(name: string): SuffixResult {
    const typeInfo = CodeGenState.getVariableTypeInfo(name);
    if (typeInfo) {
      return {
        stop: false,
        info: { baseType: typeInfo.baseType, isArray: typeInfo.isArray },
      };
    }
    return { stop: true, type: null };
  }

  /**
   * Process array or bit indexing suffix.
   * Checks isArray BEFORE isIntegerType to correctly distinguish
   * array element access from bit indexing.
   */
  private static processIndexingSuffix(
    text: string,
    current: InternalTypeInfo,
  ): SuffixResult {
    const inner = text.slice(1, -1);

    // Range indexing: [start, width] - always bit extraction
    if (inner.includes(",")) {
      return { stop: true, type: null };
    }

    // Array access: if current type is known to be an array, index yields element
    if (current.isArray) {
      return {
        stop: false,
        info: { baseType: current.baseType, isArray: false },
      };
    }

    // Bit indexing on integer: single bit returns bool
    if (TypeResolver.isIntegerType(current.baseType)) {
      return { stop: true, type: "bool" };
    }

    // Unknown indexing - preserve current state
    return { stop: false, info: current };
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
      const typeInfo = CodeGenState.getVariableTypeInfo(scopedName);
      if (typeInfo) {
        return { baseType: typeInfo.baseType, isArray: typeInfo.isArray };
      }
      return null;
    }

    // Handle global.X and this.X — these are scope qualifiers, not types.
    // The actual variable name is the first .suffix after the keyword.
    // Return a sentinel so getPostfixExpressionType knows to consume one suffix.
    if (ctx.GLOBAL()) {
      return { baseType: TypeResolver.GLOBAL_SENTINEL, isArray: false };
    }
    if (ctx.THIS()) {
      return { baseType: TypeResolver.THIS_SENTINEL, isArray: false };
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
   * Issue #831: SymbolTable is the single source of truth for struct fields.
   */
  static getMemberTypeInfo(
    structType: string,
    memberName: string,
  ): { isArray: boolean; baseType: string } | undefined {
    const fieldInfo = CodeGenState.symbolTable?.getStructFieldInfo(
      structType,
      memberName,
    );
    if (!fieldInfo) return undefined;

    return {
      isArray:
        fieldInfo.arrayDimensions !== undefined &&
        fieldInfo.arrayDimensions.length > 0,
      baseType: fieldInfo.type,
    };
  }
}

export default TypeResolver;
