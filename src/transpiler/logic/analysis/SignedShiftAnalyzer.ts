/**
 * Signed Shift Analyzer
 * Detects shift operators used with signed integer types at compile time
 *
 * MISRA C:2012 Rule 10.1: Operands shall not be of an inappropriate essential type
 * - Left-shifting negative signed values is undefined behavior in C
 * - Right-shifting negative signed values is implementation-defined in C
 *
 * C-Next rejects all shift operations on signed types (i8, i16, i32, i64) at
 * compile time to ensure defined, portable behavior.
 *
 * Two-pass analysis:
 * 1. Collect variable declarations with their types
 * 2. Detect shift operations with signed operands
 */

import { ParseTreeWalker } from "antlr4ng";
import { CNextListener } from "../parser/grammar/CNextListener";
import * as Parser from "../parser/grammar/CNextParser";
import ISignedShiftError from "./types/ISignedShiftError";
import ParserUtils from "../../../utils/ParserUtils";
import TypeConstants from "../../../utils/constants/TypeConstants";

/**
 * First pass: Collect variable declarations with their types
 */
class SignedVariableCollector extends CNextListener {
  private readonly signedVars: Set<string> = new Set();

  public getSignedVars(): Set<string> {
    return this.signedVars;
  }

  /**
   * Track a typed identifier if it has a signed type
   */
  private trackIfSigned(
    typeCtx: Parser.TypeContext | null,
    identifier: { getText(): string } | null,
  ): void {
    if (!typeCtx) return;

    const typeName = typeCtx.getText();
    if (!TypeConstants.SIGNED_TYPES.includes(typeName)) return;

    if (!identifier) return;

    this.signedVars.add(identifier.getText());
  }

  /**
   * Track variable declarations with signed types
   */
  override enterVariableDeclaration = (
    ctx: Parser.VariableDeclarationContext,
  ): void => {
    this.trackIfSigned(ctx.type(), ctx.IDENTIFIER());
  };

  /**
   * Track function parameters with signed types
   */
  override enterParameter = (ctx: Parser.ParameterContext): void => {
    this.trackIfSigned(ctx.type(), ctx.IDENTIFIER());
  };

  /**
   * Track for-loop variable declarations with signed types
   */
  override enterForVarDecl = (ctx: Parser.ForVarDeclContext): void => {
    this.trackIfSigned(ctx.type(), ctx.IDENTIFIER());
  };
}

/**
 * Second pass: Detect shift operations with signed operands
 */
class SignedShiftListener extends CNextListener {
  private readonly analyzer: SignedShiftAnalyzer;

  // eslint-disable-next-line @typescript-eslint/lines-between-class-members
  private readonly signedVars: Set<string>;

  constructor(analyzer: SignedShiftAnalyzer, signedVars: Set<string>) {
    super();
    this.analyzer = analyzer;
    this.signedVars = signedVars;
  }

  /**
   * Check shift expressions for signed operands
   * shiftExpression: additiveExpression (('<<' | '>>') additiveExpression)*
   */
  override enterShiftExpression = (
    ctx: Parser.ShiftExpressionContext,
  ): void => {
    const operands = ctx.additiveExpression();
    if (operands.length < 2) return;

    // Check each operator between additive expressions
    for (let i = 0; i < operands.length - 1; i++) {
      const operatorToken = ctx.getChild(i * 2 + 1);
      if (!operatorToken) continue;

      const operator = operatorToken.getText();
      if (operator !== "<<" && operator !== ">>") continue;

      const leftOperand = operands[i];

      // Check left operand (the value being shifted)
      if (this.isSignedOperand(leftOperand)) {
        const { line, column } = ParserUtils.getPosition(leftOperand);
        this.analyzer.addError(line, column, operator);
      }
    }
  };

  /**
   * Check if an additive expression contains a signed type operand
   */
  private isSignedOperand(ctx: Parser.AdditiveExpressionContext): boolean {
    // Walk down to unary expressions
    const multExprs = ctx.multiplicativeExpression();
    for (const multExpr of multExprs) {
      const unaryExprs = multExpr.unaryExpression();
      for (const unaryExpr of unaryExprs) {
        if (this.isSignedUnaryExpression(unaryExpr)) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Check if a unary expression is a signed type
   */
  private isSignedUnaryExpression(ctx: Parser.UnaryExpressionContext): boolean {
    // Check for MINUS prefix (negation) - indicates signed context
    // Grammar: unaryExpression: MINUS unaryExpression | ...
    if (ctx.MINUS()) {
      const nestedUnary = ctx.unaryExpression();
      if (nestedUnary) {
        // If negating a literal, it's a negative number (signed)
        const nestedPostfix = nestedUnary.postfixExpression();
        if (nestedPostfix) {
          const nestedPrimary = nestedPostfix.primaryExpression();
          if (nestedPrimary?.literal()) {
            return true;
          }
        }
        // If negating a variable, check if it's signed
        return this.isSignedUnaryExpression(nestedUnary);
      }
      return false;
    }

    const postfixExpr = ctx.postfixExpression();
    if (!postfixExpr) return false;

    const primaryExpr = postfixExpr.primaryExpression();
    if (!primaryExpr) return false;

    // Check for parenthesized expression
    const parenExpr = primaryExpr.expression();
    if (parenExpr) {
      return this.isSignedExpression(parenExpr);
    }

    // Check for identifier that's a signed variable
    const identifier = primaryExpr.IDENTIFIER();
    if (identifier) {
      return this.signedVars.has(identifier.getText());
    }

    // Positive integer literals are treated as unsigned
    return false;
  }

  /**
   * Check if a full expression contains signed operands
   */
  private isSignedExpression(ctx: Parser.ExpressionContext): boolean {
    const ternary = ctx.ternaryExpression();
    if (!ternary) return false;

    const orExprs = ternary.orExpression();
    for (const orExpr of orExprs) {
      for (const andExpr of orExpr.andExpression()) {
        for (const eqExpr of andExpr.equalityExpression()) {
          for (const relExpr of eqExpr.relationalExpression()) {
            for (const borExpr of relExpr.bitwiseOrExpression()) {
              for (const bxorExpr of borExpr.bitwiseXorExpression()) {
                for (const bandExpr of bxorExpr.bitwiseAndExpression()) {
                  for (const shiftExpr of bandExpr.shiftExpression()) {
                    for (const addExpr of shiftExpr.additiveExpression()) {
                      if (this.isSignedOperand(addExpr)) {
                        return true;
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    return false;
  }
}

/**
 * Analyzer that detects shift operations on signed integer types
 */
class SignedShiftAnalyzer {
  private errors: ISignedShiftError[] = [];

  /**
   * Analyze the parse tree for signed shift operations
   */
  public analyze(tree: Parser.ProgramContext): ISignedShiftError[] {
    this.errors = [];

    // First pass: collect signed variables
    const collector = new SignedVariableCollector();
    ParseTreeWalker.DEFAULT.walk(collector, tree);
    const signedVars = collector.getSignedVars();

    // Second pass: detect shift with signed operands
    const listener = new SignedShiftListener(this, signedVars);
    ParseTreeWalker.DEFAULT.walk(listener, tree);

    return this.errors;
  }

  /**
   * Add a signed shift error
   */
  public addError(line: number, column: number, operator: string): void {
    this.errors.push({
      code: "E0805",
      line,
      column,
      message: `Shift operator '${operator}' not allowed on signed integer types`,
      helpText:
        "Shift operations on signed integers have undefined (<<) or implementation-defined (>>) behavior. Use unsigned types (u8, u16, u32, u64) for bit manipulation.",
    });
  }

  /**
   * Get all detected errors
   */
  public getErrors(): ISignedShiftError[] {
    return this.errors;
  }
}

export default SignedShiftAnalyzer;
