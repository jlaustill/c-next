/**
 * Shift Analyzer: E0805 (signed operand) and E0873 (amount out of range).
 *
 * MISRA C:2012 Rule 10.1: Operands shall not be of an inappropriate essential type
 * - Left-shifting negative signed values is undefined behavior in C
 * - Right-shifting negative signed values is implementation-defined in C
 *
 * C-Next rejects all shift operations on signed types (i8, i16, i32, i64) at
 * compile time to ensure defined, portable behavior.
 *
 * MISRA C:2012 Rule 12.2: the right operand of a shift shall lie in the range
 * zero to one less than the essential width of the left operand. #1322 moved
 * that rule here from `output/`, where two throws in `TypeValidator` reported
 * it as `1:0`. It reads the LEADING operand's declared type, as codegen did
 * (`(a + 1) << 9` is a composite and stays untyped), and evaluates the amount
 * when it is a literal or a named const. Two holes closed on the way, both
 * probed: `a <<<- 9` on a `u8` emitted `a = (uint8_t)(a << 9U)` unchecked --
 * the compound forms never reached the check -- and `a << N` with
 * `const u8 N <- 9` was accepted because only a literal amount was evaluated.
 *
 * The signed rule keeps its own operand walk: it asks whether ANY operand of a
 * composite is signed and treats a negated literal as signed, which is a
 * different question from "what is this operand's declared type". The width
 * rule asks the shared `OperandTypeResolver`, as every other typed rule in
 * this pass does.
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
import { CNextListener } from "../../transpiler/logic/parser/grammar/CNextListener";
import * as Parser from "../../transpiler/logic/parser/grammar/CNextParser";
import IShiftError from "./types/IShiftError";
import ParserUtils from "../../utils/ParserUtils";
import TypeConstants from "../../utils/constants/TypeConstants";
import ExpressionUtils from "../../utils/ExpressionUtils";
import CodeGenState from "../../transpiler/state/CodeGenState";
import DeclarationScopeCollector from "./DeclarationScopeCollector";
import ScopeFrameResolver from "./ScopeFrameResolver";
import OperandTypeResolver from "./OperandTypeResolver";
import LiteralUtils from "../../utils/LiteralUtils";
import ScopeUtils from "../../utils/ScopeUtils";
import TYPE_WIDTH from "../../transpiler/constants/TYPE_WIDTH";

/**
 * Second pass: Detect shift operations with signed operands
 */
class ShiftListener extends CNextListener {
  private readonly analyzer: ShiftAnalyzer;

  // eslint-disable-next-line @typescript-eslint/lines-between-class-members
  private readonly scopes: ScopeFrameResolver;

  private readonly types: OperandTypeResolver;

  constructor(analyzer: ShiftAnalyzer, scopes: ScopeFrameResolver) {
    super();
    this.analyzer = analyzer;
    this.scopes = scopes;
    this.types = new OperandTypeResolver(scopes);
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
        continue;
      }

      // Rule 12.2: the amount against the leading operand's width. Codegen
      // typed the first unary of the left additive expression -- `a + b << 9`
      // reads as `a`'s width -- and that is reproduced, not widened.
      const leading = leftOperand
        .multiplicativeExpression()[0]
        ?.unaryExpression()[0];
      if (!leading) continue;
      const leftType = this.types.typeOfOperand(
        leading,
        this.scopes.frameFor(ctx),
      );
      this.checkAmount(leftType, operands[i + 1], ctx);
    }
  };

  /**
   * E0873: a compile-time shift amount that is negative or not below the
   * width of the shifted operand's type. Silent when either side is unknown
   * -- a runtime amount, or an operand this pass cannot type.
   */
  private checkAmount(
    leftType: string | null,
    amountExpr: ParserRuleContext,
    at: ParserRuleContext,
  ): void {
    if (leftType === null || !/^[ui](8|16|32|64)$/.test(leftType)) return;
    const width = TYPE_WIDTH[leftType];
    const amount = this.amountOf(amountExpr, at);
    if (amount === null) return;
    const { line, column } = ParserUtils.getPosition(amountExpr);
    if (amount < 0) {
      this.analyzer.addAmountError(
        line,
        column,
        `Negative shift amount (${amount}) is undefined behavior (type: ${leftType}, expression: ${at.getText()})`,
        "Shift amounts must be non-negative (MISRA C:2012 Rule 12.2).",
      );
      return;
    }
    if (amount >= width) {
      this.analyzer.addAmountError(
        line,
        column,
        `Shift amount (${amount}) exceeds type width (${width} bits) for type '${leftType}' (expression: ${at.getText()})`,
        `Shift amount must be < ${width} for ${width}-bit types; shifting by the width or more is undefined behavior (MISRA C:2012 Rule 12.2).`,
      );
    }
  }

  /**
   * The amount as a compile-time integer: a literal with any number of
   * leading minus signs, or a const declared at file scope or in the enclosing
   * scope. Anything else is a runtime amount and returns null.
   */
  private amountOf(
    expr: ParserRuleContext,
    at: ParserRuleContext,
  ): number | null {
    let node: ParserRuleContext = expr;
    while (
      !(node instanceof Parser.UnaryExpressionContext) &&
      node.getChildCount() === 1 &&
      node.getChild(0) instanceof ParserRuleContext
    ) {
      node = node.getChild(0) as ParserRuleContext;
    }
    if (!(node instanceof Parser.UnaryExpressionContext)) return null;
    return this.unaryAmount(node, at);
  }

  private unaryAmount(
    ctx: Parser.UnaryExpressionContext,
    at: ParserRuleContext,
  ): number | null {
    const nested = ctx.unaryExpression();
    if (nested) {
      if (ctx.MINUS() === null) return null; // `!x`, `~x`, `&x` are not amounts
      const inner = this.unaryAmount(nested, at);
      return inner === null ? null : -inner;
    }
    const postfix = ctx.postfixExpression();
    const primary = postfix?.primaryExpression();
    if (!postfix || !primary) return null;
    const ops = postfix.postfixOp();
    const literal = primary.literal();
    if (literal && ops.length === 0) {
      const match = /^(0[xX][\da-fA-F]+|0[bB][01]+|\d+)([uUiI]\d+)?$/.exec(
        literal.getText(),
      );
      return match === null
        ? null
        : (LiteralUtils.parseIntegerLiteral(match[1]) ?? null);
    }
    // A named const: bare, `this.NAME` (the enclosing scope's) or
    // `global.NAME` (file scope). Anything else is a runtime amount.
    const member =
      ops.length === 1 && ops[0].DOT() !== null
        ? (ops[0].IDENTIFIER()?.getText() ?? null)
        : null;
    if (primary.THIS() && member !== null) {
      return this.constValue(member, at, "this");
    }
    if (primary.GLOBAL() && member !== null) {
      return this.constValue(member, at, "global");
    }
    const name = primary.IDENTIFIER()?.getText();
    if (name === undefined || ops.length > 0) return null;
    return this.constValue(name, at, null);
  }

  /**
   * A named const's value, from the program's order-independent const table.
   * A bare name tries the enclosing scope first, then file scope; `this.`
   * and `global.` state which one.
   */
  private constValue(
    name: string,
    at: ParserRuleContext,
    root: "this" | "global" | null,
  ): number | null {
    const here = this.scopes.frameFor(at).scopePath;
    const scoped =
      here === ""
        ? null
        : ScopeUtils.getTranspiledCName({ scopePath: here, name });
    const candidates =
      root === "global" ? [name] : root === "this" ? [scoped] : [scoped, name];
    for (const cName of candidates) {
      if (cName === null) continue;
      const value = CodeGenState.program?.constValue(cName);
      if (value !== undefined) return value;
    }
    return null;
  }

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
      return;
    }

    // Rule 12.2 for the compound forms, which codegen never checked:
    // `a <<<- 9` on a u8 emitted `a = (uint8_t)(a << 9U)` at exit 0.
    this.checkAmount(
      this.types.typeOfAssignmentTarget(target, this.scopes.frameFor(ctx)),
      ctx.expression(),
      ctx,
    );
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
 * Analyzer that detects shift operations on signed integer types, and shift
 * amounts outside the shifted operand's width.
 */
class ShiftAnalyzer {
  private errors: IShiftError[] = [];

  /**
   * Analyze the parse tree for shift operations
   */
  public analyze(tree: Parser.ProgramContext): IShiftError[] {
    this.errors = [];

    // First pass: build the lexical scope frames
    const declarations = new DeclarationScopeCollector();
    ParseTreeWalker.DEFAULT.walk(declarations, tree);

    // Second pass: detect shift with signed operands
    const listener = new ShiftListener(
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
   * Add a shift amount error (E0873)
   */
  public addAmountError(
    line: number,
    column: number,
    message: string,
    helpText: string,
  ): void {
    this.errors.push({ code: "E0873", line, column, message, helpText });
  }

  /**
   * Get all detected errors
   */
  public getErrors(): IShiftError[] {
    return this.errors;
  }
}

export default ShiftAnalyzer;
