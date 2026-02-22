/**
 * Array Index Type Analyzer
 * Detects signed and floating-point types used as array or bit subscript indexes
 *
 * C-Next requires unsigned integer types for all subscript operations to prevent
 * undefined behavior from negative indexes. This analyzer catches type violations
 * at compile time with clear error messages.
 *
 * Two-pass analysis:
 * 1. Collect variable declarations with their types
 * 2. Validate subscript expressions use unsigned integer types
 *
 * Uses CodeGenState for state-based type resolution (struct fields, function
 * return types, enum detection) to handle complex expressions like arr[x + 1].
 */

import { ParseTreeWalker } from "antlr4ng";
import { CNextListener } from "../parser/grammar/CNextListener";
import * as Parser from "../parser/grammar/CNextParser";
import IArrayIndexTypeError from "./types/IArrayIndexTypeError";
import LiteralUtils from "../../../utils/LiteralUtils";
import ParserUtils from "../../../utils/ParserUtils";
import TypeConstants from "../../../utils/constants/TypeConstants";
import CodeGenState from "../../state/CodeGenState";

/**
 * First pass: Collect variable declarations with their types
 */
class VariableTypeCollector extends CNextListener {
  private readonly varTypes: Map<string, string> = new Map();

  public getVarTypes(): Map<string, string> {
    return this.varTypes;
  }

  private trackType(
    typeCtx: Parser.TypeContext | null,
    identifier: { getText(): string } | null,
  ): void {
    if (!typeCtx || !identifier) return;
    this.varTypes.set(identifier.getText(), typeCtx.getText());
  }

  override enterVariableDeclaration = (
    ctx: Parser.VariableDeclarationContext,
  ): void => {
    this.trackType(ctx.type(), ctx.IDENTIFIER());
  };

  override enterParameter = (ctx: Parser.ParameterContext): void => {
    this.trackType(ctx.type(), ctx.IDENTIFIER());
  };

  override enterForVarDecl = (ctx: Parser.ForVarDeclContext): void => {
    this.trackType(ctx.type(), ctx.IDENTIFIER());
  };
}

/**
 * Second pass: Validate subscript index expressions use unsigned integer types
 */
class IndexTypeListener extends CNextListener {
  private readonly analyzer: ArrayIndexTypeAnalyzer;

  // eslint-disable-next-line @typescript-eslint/lines-between-class-members
  private readonly varTypes: Map<string, string>;

  constructor(analyzer: ArrayIndexTypeAnalyzer, varTypes: Map<string, string>) {
    super();
    this.analyzer = analyzer;
    this.varTypes = varTypes;
  }

  /**
   * Check postfix operations in expressions (RHS: arr[idx], flags[bit])
   */
  override enterPostfixOp = (ctx: Parser.PostfixOpContext): void => {
    if (!ctx.LBRACKET()) return;

    const expressions = ctx.expression();
    for (const expr of expressions) {
      this.validateIndexExpression(expr);
    }
  };

  /**
   * Check postfix target operations in assignments (LHS: arr[idx] <- val)
   */
  override enterPostfixTargetOp = (
    ctx: Parser.PostfixTargetOpContext,
  ): void => {
    if (!ctx.LBRACKET()) return;

    const expressions = ctx.expression();
    for (const expr of expressions) {
      this.validateIndexExpression(expr);
    }
  };

  /**
   * Validate that a subscript index expression uses an unsigned integer type.
   * Collects all leaf operands from the expression and checks each one.
   */
  private validateIndexExpression(ctx: Parser.ExpressionContext): void {
    const operands = this.collectOperands(ctx);

    for (const operand of operands) {
      const resolvedType = this.resolveOperandType(operand);
      if (!resolvedType) continue;

      if (TypeConstants.SIGNED_TYPES.includes(resolvedType)) {
        const { line, column } = ParserUtils.getPosition(ctx);
        this.analyzer.addError(line, column, "E0850", resolvedType);
        return;
      }

      if (
        resolvedType === "float literal" ||
        TypeConstants.FLOAT_TYPES.includes(resolvedType)
      ) {
        const { line, column } = ParserUtils.getPosition(ctx);
        this.analyzer.addError(line, column, "E0851", resolvedType);
        return;
      }

      if (TypeConstants.UNSIGNED_INDEX_TYPES.includes(resolvedType)) {
        continue;
      }

      // Other non-integer types (e.g., string, struct) - E0852
      const { line, column } = ParserUtils.getPosition(ctx);
      this.analyzer.addError(line, column, "E0852", resolvedType);
      return;
    }
  }

  /**
   * Collect all leaf unary expression operands from an expression tree.
   * Handles binary operators at any level by flatMapping through the grammar hierarchy.
   */
  private collectOperands(
    ctx: Parser.ExpressionContext,
  ): Parser.UnaryExpressionContext[] {
    const ternary = ctx.ternaryExpression();
    if (!ternary) return [];

    const orExpressions = ternary.orExpression();
    if (orExpressions.length === 0) return [];

    // For ternary (cond ? true : false), skip the condition (index 0)
    // and only check the value branches (indices 1 and 2)
    const valueExpressions =
      orExpressions.length === 3 ? orExpressions.slice(1) : orExpressions;

    return valueExpressions
      .flatMap((o) => o.andExpression())
      .flatMap((a) => a.equalityExpression())
      .flatMap((e) => e.relationalExpression())
      .flatMap((r) => r.bitwiseOrExpression())
      .flatMap((bo) => bo.bitwiseXorExpression())
      .flatMap((bx) => bx.bitwiseAndExpression())
      .flatMap((ba) => ba.shiftExpression())
      .flatMap((s) => s.additiveExpression())
      .flatMap((a) => a.multiplicativeExpression())
      .flatMap((m) => m.unaryExpression());
  }

  /**
   * Resolve the type of a unary expression operand.
   * Uses local varTypes first, then falls back to CodeGenState for
   * struct fields, function return types, and enum detection.
   *
   * Returns null if the type cannot be resolved (pass-through).
   */
  private resolveOperandType(
    operand: Parser.UnaryExpressionContext,
  ): string | null {
    const postfixExpr = operand.postfixExpression();
    if (!postfixExpr) return null;

    const primaryExpr = postfixExpr.primaryExpression();
    if (!primaryExpr) return null;

    // Resolve base type from primaryExpression
    let currentType = this.resolveBaseType(primaryExpr);

    // Walk postfix operators to transform the type
    const postfixOps = postfixExpr.postfixOp();

    // If base type is null but there are postfix ops, use identifier name
    // for function call / member access resolution (e.g., getIndex())
    if (!currentType && postfixOps.length > 0) {
      const identifier = primaryExpr.IDENTIFIER();
      if (identifier) {
        currentType = identifier.getText();
      }
    }

    for (const op of postfixOps) {
      if (!currentType) return null;
      currentType = this.resolvePostfixOpType(currentType, op);
    }

    return currentType;
  }

  /**
   * Resolve the base type of a primary expression.
   */
  private resolveBaseType(
    primaryExpr: Parser.PrimaryExpressionContext,
  ): string | null {
    // Check for literal
    const literal = primaryExpr.literal();
    if (literal) {
      if (LiteralUtils.isFloat(literal)) return "float literal";
      // Integer literals are always valid
      return null;
    }

    // Check for parenthesized expression — recurse
    const parenExpr = primaryExpr.expression();
    if (parenExpr) {
      const innerOperands = this.collectOperands(parenExpr);
      for (const innerOp of innerOperands) {
        const innerType = this.resolveOperandType(innerOp);
        if (innerType) return innerType;
      }
      return null;
    }

    // Check for identifier
    const identifier = primaryExpr.IDENTIFIER();
    if (!identifier) return null;

    const varName = identifier.getText();

    // Local variables first (params, for-loop vars, function body vars)
    const localType = this.varTypes.get(varName);
    if (localType) return localType;

    // Fall back to CodeGenState for cross-file variables
    const typeInfo = CodeGenState.getVariableTypeInfo(varName);
    if (typeInfo) return typeInfo.baseType;

    return null;
  }

  /**
   * Resolve the resulting type after applying a postfix operator.
   */
  private resolvePostfixOpType(
    currentType: string,
    op: Parser.PostfixOpContext,
  ): string | null {
    // Dot access (e.g., config.value, EColor.RED)
    if (op.DOT()) {
      const fieldId = op.IDENTIFIER();
      if (!fieldId) return null;
      const fieldName = fieldId.getText();

      // Check if it's an enum access — always valid
      if (CodeGenState.isKnownEnum(currentType)) return null;

      // Check struct field type
      const fieldType = CodeGenState.getStructFieldType(currentType, fieldName);
      return fieldType ?? null;
    }

    // Array/bit subscript (e.g., lookup[idx])
    if (op.LBRACKET()) {
      // If current type is an array, result is the element type
      // If current type is an integer, result is "bool" (bit access)
      if (TypeConstants.UNSIGNED_INDEX_TYPES.includes(currentType)) {
        return "bool";
      }
      if (TypeConstants.SIGNED_TYPES.includes(currentType)) {
        return "bool";
      }
      // Array element type — strip array suffix
      return currentType;
    }

    // Function call (e.g., getIndex())
    if (op.LPAREN()) {
      const returnType = CodeGenState.getFunctionReturnType(currentType);
      return returnType ?? null;
    }

    return null;
  }
}

/**
 * Analyzer that detects non-unsigned-integer types used as subscript indexes
 */
class ArrayIndexTypeAnalyzer {
  private errors: IArrayIndexTypeError[] = [];

  /**
   * Analyze the parse tree for invalid subscript index types
   */
  public analyze(tree: Parser.ProgramContext): IArrayIndexTypeError[] {
    this.errors = [];

    // First pass: collect variable types
    const collector = new VariableTypeCollector();
    ParseTreeWalker.DEFAULT.walk(collector, tree);
    const varTypes = collector.getVarTypes();

    // Second pass: validate subscript index expressions
    const listener = new IndexTypeListener(this, varTypes);
    ParseTreeWalker.DEFAULT.walk(listener, tree);

    return this.errors;
  }

  /**
   * Add an index type error
   */
  public addError(
    line: number,
    column: number,
    code: string,
    actualType: string,
  ): void {
    this.errors.push({
      code,
      line,
      column,
      actualType,
      message: `Subscript index must be an unsigned integer type; got '${actualType}'`,
      helpText:
        "Use an unsigned integer type (u8, u16, u32, u64) for array and bit subscript indexes.",
    });
  }

  /**
   * Get all detected errors
   */
  public getErrors(): IArrayIndexTypeError[] {
    return this.errors;
  }
}

export default ArrayIndexTypeAnalyzer;
