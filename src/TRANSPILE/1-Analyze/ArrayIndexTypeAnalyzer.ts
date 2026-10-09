/**
 * Array Index Type Analyzer
 * Detects signed and floating-point types used as array or bit subscript indexes
 *
 * C-Next requires unsigned integer types for all subscript operations to prevent
 * undefined behavior from negative indexes. This analyzer catches type violations
 * at compile time with clear error messages.
 *
 * #1668 (C4e): each value leaf of an index is typed by the one operand typer,
 * which binds a name where it is used. This kept one map of type TEXT per
 * bare name for the whole file, filled by a walk before the check, so the
 * last declaration of a name in the file typed every use of it: a `u32` loop
 * index was rejected for another function's `i32 i`, and a real `i32` index
 * accepted (#1694). A prefix operator (`-i`) was not typed at all.
 */

import SyntaxLowering from "../../PARSE/2-Parse/SyntaxLowering";
import { ParseTreeWalker } from "antlr4ng";
import { CNextListener } from "../../PARSE/2-Parse/grammar/CNextListener";
import * as Parser from "../../PARSE/2-Parse/grammar/CNextParser";
import IArrayIndexTypeError from "./types/IArrayIndexTypeError";
import ParserUtils from "../../utils/ParserUtils";
import OperandTyper from "../../utils/OperandTyper";
import type IOperandType from "../../types/IOperandType";
import type IAnalysisContext from "./types/IAnalysisContext";

/**
 * Validate subscript index expressions use unsigned integer types
 */
class IndexTypeListener extends CNextListener {
  constructor(
    private readonly analyzer: ArrayIndexTypeAnalyzer,
    private readonly context: IAnalysisContext,
  ) {
    super();
  }

  /**
   * Check postfix operations in expressions (RHS: arr[idx], flags[bit])
   */
  override enterPostfixOp = (ctx: Parser.PostfixOpContext): void => {
    if (!ctx.LBRACKET()) return;
    for (const expr of ctx.expression()) {
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
    for (const expr of ctx.expression()) {
      this.validateIndexExpression(expr);
    }
  };

  /**
   * Validate that a subscript index uses an unsigned integer type: each value
   * leaf of it, reported once, at the index.
   */
  private validateIndexExpression(ctx: Parser.ExpressionContext): void {
    for (const leaf of OperandTyper.valueLeaves(
      SyntaxLowering.expressionNode(ctx),
      this.context,
    )) {
      const verdict = IndexTypeListener.verdictOf(leaf);
      if (verdict === null) continue;
      const { line, column } = ParserUtils.getPosition(ctx);
      this.analyzer.addError(line, column, verdict.code, verdict.actualType);
      return;
    }
  }

  /**
   * What a leaf's type makes it as an index: null when it is valid or
   * cannot be typed (another diagnostic's to report), else the code.
   */
  private static verdictOf(
    leaf: IOperandType | null,
  ): { code: string; actualType: string } | null {
    if (leaf === null) return null;
    if (leaf.form.kind === "literal") {
      // An integer or character literal is a valid index
      return leaf.category === "floating"
        ? { code: "E0851", actualType: "float literal" }
        : null;
    }
    const spelling = IndexTypeListener.spelling(leaf);
    if (leaf.dimensions.length > 0)
      return { code: "E0852", actualType: spelling };
    switch (leaf.category) {
      case "signed":
        return { code: "E0850", actualType: spelling };
      case "floating":
        return { code: "E0851", actualType: spelling };
      case "unsigned":
      case "boolean":
      case "enum":
        // ADR-054: an enum transpiles to an unsigned constant
        return null;
      default:
        // A struct, a string: E0852. A type the typer cannot name is passed
        // over, as before
        return leaf.typeName === null
          ? null
          : { code: "E0852", actualType: spelling };
    }
  }

  /** A type as the message names it: `i32`, `u8[4]` */
  private static spelling(leaf: IOperandType): string {
    const dimensions = leaf.dimensions.map((d) => `[${d}]`).join("");
    return `${leaf.typeName ?? leaf.category}${dimensions}`;
  }
}

/**
 * Analyzer that detects non-unsigned-integer types used as subscript indexes
 */
class ArrayIndexTypeAnalyzer {
  /** #1456: handed in rather than read off shared state. */
  constructor(private readonly context: IAnalysisContext) {}

  private errors: IArrayIndexTypeError[] = [];

  /**
   * Analyze the parse tree for invalid subscript index types
   */
  public analyze(tree: Parser.ProgramContext): IArrayIndexTypeError[] {
    this.errors = [];
    ParseTreeWalker.DEFAULT.walk(
      new IndexTypeListener(this, this.context),
      tree,
    );

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
}

export default ArrayIndexTypeAnalyzer;
