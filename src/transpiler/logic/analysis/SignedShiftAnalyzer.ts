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
 * 1. Build lexical scope frames (DeclarationScopeCollector)
 * 2. Detect shift operations with signed operands
 *
 * Issue #1220: pass 1 used to be private Set/Map caches built from this file's
 * parse tree alone, so an `i32` arriving through an #include was invisible and
 * `signedValue >> 1` shipped silently -- gcc accepts it even under
 * -Wall -Wextra -Wconversion, and right-shifting a negative value is
 * implementation-defined. Resolution now goes through ScopeFrameResolver,
 * which searches the lexical frames and falls back to the symbol table.
 */

import { ParserRuleContext, ParseTreeWalker } from "antlr4ng";
import { CNextListener } from "../parser/grammar/CNextListener";
import * as Parser from "../parser/grammar/CNextParser";
import ISignedShiftError from "./types/ISignedShiftError";
import ParserUtils from "../../../utils/ParserUtils";
import TypeConstants from "../../../utils/constants/TypeConstants";
import ExpressionUtils from "../../../utils/ExpressionUtils";
import CodeGenState from "../../state/CodeGenState";
import DeclarationScopeCollector from "./DeclarationScopeCollector";
import ScopeFrameResolver from "./ScopeFrameResolver";

/**
 * Second pass: Detect shift operations with signed operands
 */
class SignedShiftListener extends CNextListener {
  private readonly analyzer: SignedShiftAnalyzer;

  // eslint-disable-next-line @typescript-eslint/lines-between-class-members
  private readonly scopes: ScopeFrameResolver;

  constructor(analyzer: SignedShiftAnalyzer, scopes: ScopeFrameResolver) {
    super();
    this.analyzer = analyzer;
    this.scopes = scopes;
  }

  /**
   * Declared type of a name as seen from the frame enclosing `at`. One place
   * decides how this analyzer resolves a name, so the lexical-then-symbol-table
   * order cannot drift between the operand and assignment-target paths (#1220).
   */
  private declaredTypeAt(name: string, at: ParserRuleContext): string | null {
    return this.scopes.typeOfName(name, this.scopes.frameFor(at));
  }

  /**
   * Whether a name resolves to one of the signed integer types.
   */
  private isSignedName(name: string, at: ParserRuleContext): boolean {
    const typeName = this.declaredTypeAt(name, at);
    return typeName !== null && TypeConstants.SIGNED_TYPES.includes(typeName);
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
   * Check compound shift-assign statements for signed targets
   * assignmentStatement: assignmentTarget assignmentOperator expression ';'
   * Issue #1008: <<<- and >><- must also be rejected on signed types
   *
   * Handles both simple identifiers (x <<<- 2) and member chains (s.x <<<- 2)
   */
  override enterAssignmentStatement = (
    ctx: Parser.AssignmentStatementContext,
  ): void => {
    const opCtx = ctx.assignmentOperator();
    if (!opCtx) return;

    const isLeftShiftAssign = opCtx.LSHIFT_ASSIGN() !== null;
    const isRightShiftAssign = opCtx.RSHIFT_ASSIGN() !== null;
    if (!isLeftShiftAssign && !isRightShiftAssign) return;

    const target = ctx.assignmentTarget();
    if (!target) return;

    // Get the base identifier from the assignment target
    const identifier = target.IDENTIFIER();
    if (!identifier) return;

    // Check if the final target type is signed
    if (this.isSignedTarget(target)) {
      const operator = isLeftShiftAssign ? "<<<-" : ">><-";
      const { line, column } = ParserUtils.getPosition(target);
      this.analyzer.addError(line, column, operator);
    }
  };

  /**
   * Resolve the final type of an assignment target, handling member chains.
   * Returns true if the final target is a signed type.
   *
   * Examples:
   *   - "x" with no postfix ops → check if x is signed
   *   - "s" with postfixOps [".x"] → check if s.x field is signed
   *   - "arr" with postfixOps ["[0]", ".field"] → check if field is signed
   */
  private isSignedTarget(target: Parser.AssignmentTargetContext): boolean {
    const baseName = target.IDENTIFIER()?.getText();
    if (!baseName) return false;

    const postfixOps = target.postfixTargetOp();

    // Simple case: no member access, just a variable
    if (postfixOps.length === 0) {
      return this.isSignedName(baseName, target);
    }

    // Member chain case: resolve through the chain
    let currentType: string | null = this.declaredTypeAt(baseName, target);
    if (!currentType) {
      // Unknown base type - can't resolve, skip
      return false;
    }

    // Walk through the postfix operations
    for (const op of postfixOps) {
      const memberIdent = op.IDENTIFIER();
      if (memberIdent) {
        // Member access: .fieldName
        const fieldName = memberIdent.getText();
        const fieldType = CodeGenState.getStructFieldType(
          currentType,
          fieldName,
        );
        if (!fieldType) {
          // Unknown field - can't resolve, skip
          return false;
        }
        currentType = fieldType;
      } else {
        // Array subscript: [expr] - doesn't change the base type for primitives
        // For arrays like u8[4], after [i] we still have u8
        // Strip array dimensions if present
        const bracketIndex = currentType.indexOf("[");
        if (bracketIndex !== -1) {
          currentType = currentType.substring(0, bracketIndex);
        }
        // Otherwise keep the type as-is (e.g., bit indexing on u8)
      }
    }

    // Check if the final resolved type is signed
    return TypeConstants.SIGNED_TYPES.includes(currentType);
  }

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
      return this.isSignedName(identifier.getText(), ctx);
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

    const additiveExprs = ExpressionUtils.collectAdditiveExpressions(ternary);
    return additiveExprs.some((addExpr) => this.isSignedOperand(addExpr));
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

    // First pass: build the lexical scope frames
    const declarations = new DeclarationScopeCollector();
    ParseTreeWalker.DEFAULT.walk(declarations, tree);

    // Second pass: detect shift with signed operands
    const listener = new SignedShiftListener(
      this,
      new ScopeFrameResolver(declarations),
    );
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
