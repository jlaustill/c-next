/**
 * Operand Type Resolver
 *
 * Resolves the declared type of an operand or an assignment target, following
 * member and subscript chains: `flag`, `this.flag`, `sensor.ready`,
 * `outer.inner.ready`, `flags[0]`.
 *
 * The essential-type rules need this in two places that used to answer it
 * separately -- the expression side (is this operand essentially Boolean?) and
 * the assignment side (is this target a bool?). Resolving both here keeps the
 * answer identical whichever spelling reaches it, which is what Issue #1183
 * review found missing: `ready + 1` was rejected while `this.ready + 1`,
 * `sensor.ready / other`, and `flags[0] / flags[1]` were all accepted.
 *
 * Declared names come from the lexical scope frames; struct field types come
 * from CodeGenState, which merges same-file and included-file structs and is
 * populated before runAnalyzers (Transpiler `_transpileFile`).
 */

import { ParserRuleContext, ParseTree } from "antlr4ng";
import * as Parser from "../parser/grammar/CNextParser";
import IScopeFrame from "./types/IScopeFrame";
import ScopeFrameResolver from "./ScopeFrameResolver";
import CodeGenState from "../../state/CodeGenState";
import QualifiedCName from "../../../utils/QualifiedCName";

/** One step of a member/subscript/call chain. */
interface IChainStep {
  readonly member: string | null;
  readonly isSubscript: boolean;
  readonly isCall: boolean;
}

/** The one type name that is essentially Boolean (MISRA C:2012 Rule 10.1). */
const BOOLEAN_TYPE_NAME = "bool";

class OperandTypeResolver {
  private readonly scopes: ScopeFrameResolver;

  constructor(scopes: ScopeFrameResolver) {
    this.scopes = scopes;
  }

  /**
   * Whether a resolved type is essentially Boolean. Callers test through this
   * rather than comparing to a literal, so what counts as Boolean is decided
   * once.
   */
  public static isBooleanType(typeName: string | null): boolean {
    return typeName === BOOLEAN_TYPE_NAME;
  }

  /**
   * Type of a ternary: the type its ARMS agree on. The condition does not
   * contribute -- it is always Boolean and says nothing about the result.
   *
   * The arms are reached through `orExpression()`, never `getChild(i)`: the
   * condition is parenthesized, so child 0 is `(` and an index-based skip
   * silently does nothing (CLAUDE.md). A real ternary has exactly three
   * orExpression children; anything else is a pass-through this never sees.
   */
  private typeOfTernary(
    ctx: Parser.TernaryExpressionContext,
    frame: IScopeFrame,
  ): string | null {
    const branches = ctx.orExpression();
    if (branches.length !== 3) return null;

    const whenTrue = this.typeOfOperand(branches[1], frame);
    const whenFalse = this.typeOfOperand(branches[2], frame);
    // Arms that disagree are a separate defect; report no type rather than
    // guessing which one the expression takes.
    return whenTrue !== null && whenTrue === whenFalse ? whenTrue : null;
  }

  /**
   * Whether a node is an applied operator whose result is Boolean: `||`, `&&`,
   * `=` / `!=`, or a relational comparison.
   *
   * Only an APPLIED one reaches here. Each of these grammar levels is a
   * pass-through when it holds a single operand, and the caller descends
   * through those before asking, so a node arriving here with more than one
   * child is a real operator application.
   */
  private static isBooleanValuedOperator(node: ParseTree): boolean {
    return (
      node instanceof Parser.OrExpressionContext ||
      node instanceof Parser.AndExpressionContext ||
      node instanceof Parser.EqualityExpressionContext ||
      node instanceof Parser.RelationalExpressionContext
    );
  }

  /**
   * Strip ONE array dimension per subscript, leading dimension first, matching
   * the C the transpiler emits: `bool[2][3] flags` becomes `bool flags[2][3]`,
   * so `flags[0]` is `bool[3]` and `flags[0][1]` is `bool`.
   *
   * Slicing at the first `[` and discarding the rest would collapse every
   * dimension at once. That is indistinguishable from the correct answer for a
   * one-dimensional array and wrong for every other -- `flags[0][1]` would
   * resolve to nothing, leaving `flags[0][1] / flags[1][2]` accepted as a
   * divide by zero.
   *
   * Returns null for a subscript into something with no dimension left, which
   * is a bit index or an error -- either way not a declared element type.
   */
  private static elementType(typeName: string): string | null {
    const open = typeName.indexOf("[");
    if (open <= 0) return null;

    const close = typeName.indexOf("]", open);
    if (close < 0) return null;

    return typeName.slice(0, open) + typeName.slice(close + 1);
  }

  /**
   * Walk a chain from its base, applying one step at a time.
   *
   * `current` carries a type for a subscript or member step, and the callee's
   * NAME for a call step -- a call is applied to what precedes it, which is a
   * function name rather than a value. The name path is tracked alongside so a
   * call can be resolved whether it is written bare (`isReady()`) or qualified
   * (`Sensors.isReady()`).
   */
  private applyChain(
    base: string | null,
    baseName: string,
    steps: IChainStep[],
  ): string | null {
    let current = base;
    const nameParts = [baseName];

    for (const step of steps) {
      if (step.isCall) {
        // Issue #1183 review: a bool-returning call was unresolvable, so
        // `n / isReady()` passed and divided by zero at runtime.
        //
        // functionReturnTypes is keyed by transpiled C name, so the key is
        // built with QualifiedCName -- the single encoder -- rather than
        // re-derived by hand (CLAUDE.md).
        return (
          CodeGenState.getFunctionReturnType(
            QualifiedCName.join(...nameParts),
          ) ?? null
        );
      }
      if (step.member) {
        nameParts.push(step.member);
      }
      if (!current) {
        // No value type yet. A member step may still be building a callee name,
        // so keep walking; anything else cannot be resolved.
        if (step.member) continue;
        return null;
      }
      if (step.isSubscript) {
        current = OperandTypeResolver.elementType(current);
      } else if (step.member) {
        current = CodeGenState.getStructFieldType(current, step.member) ?? null;
      } else {
        return null;
      }
    }
    return current;
  }

  /**
   * Declared type of an assignment target, following `postfixTargetOp` steps.
   * `global.x` and a bare `x` resolve the same way; `this.x` resolves `x`
   * against the enclosing scope frame, which is where a scope member is
   * recorded.
   */
  public typeOfAssignmentTarget(
    ctx: Parser.AssignmentTargetContext,
    frame: IScopeFrame,
  ): string | null {
    const baseName = ctx.IDENTIFIER()?.getText();
    if (!baseName) return null;

    const steps: IChainStep[] = ctx.postfixTargetOp().map((op) => ({
      member: op.DOT() !== null ? (op.IDENTIFIER()?.getText() ?? null) : null,
      isSubscript: op.LBRACKET() !== null,
      isCall: false, // an assignment target is never a call
    }));

    return this.applyChain(
      this.scopes.typeOfName(baseName, frame),
      baseName,
      steps,
    );
  }

  /**
   * Declared type of a postfix expression operand. A call anywhere in the chain
   * makes the type unresolvable here -- the result type is a function's, not a
   * declaration's.
   */
  public typeOfPostfixExpression(
    ctx: Parser.PostfixExpressionContext,
    frame: IScopeFrame,
  ): string | null {
    const primary = ctx.primaryExpression();
    if (!primary) return null;

    // Copy: shifting the parser's own child array would corrupt the tree.
    const ops = [...ctx.postfixOp()];
    let base: string | null;
    let baseName: string;

    if (primary.THIS() ?? primary.GLOBAL()) {
      // `this.member` / `global.member`: the first step names the declaration.
      const firstMember = ops.shift()?.IDENTIFIER()?.getText();
      if (!firstMember) return null;
      // `this.member()` transpiles to a scope-qualified C name, so the callee
      // key needs the enclosing scope. `global.` is deliberately not qualified.
      baseName =
        primary.THIS() !== null && frame.scopeName
          ? QualifiedCName.join(frame.scopeName, firstMember)
          : firstMember;
      base = this.scopes.typeOfName(firstMember, frame);
    } else {
      const identifier = primary.IDENTIFIER()?.getText();
      if (!identifier) return null;
      baseName = identifier;
      base = this.scopes.typeOfName(identifier, frame);
    }

    const steps: IChainStep[] = [];
    for (const op of ops) {
      // Neither `.member` nor `[index]` is a call suffix.
      const isSubscript = op.LBRACKET() !== null;
      const member = op.DOT() !== null ? op.IDENTIFIER()?.getText() : null;
      steps.push({
        member: member ?? null,
        isSubscript,
        isCall: !isSubscript && !member,
      });
    }

    return this.applyChain(base, baseName, steps);
  }

  /**
   * Declared type of any expression node that resolves to a single value leaf,
   * descending through pass-through operator levels and parentheses.
   *
   * Returns null for a multi-operand level: that is an operator application,
   * whose own level reports on its own operands.
   */
  public typeOfOperand(
    ctx: ParserRuleContext,
    frame: IScopeFrame,
  ): string | null {
    let node: ParseTree = ctx;
    while (node instanceof ParserRuleContext && node.getChildCount() === 1) {
      const child = node.getChild(0);
      if (!child) break;
      node = child;
    }

    // A comparison or logical operator yields a Boolean whatever its operands
    // were, so the expression HAS a type even though no declaration names it.
    //
    // Issue #1183 review: without this, `n / (a && b)` read as "type unknown"
    // and passed. The parent arithmetic operator is the only place that
    // violation can be reported -- `a && b` is well-formed on its own, so
    // nothing reports at the child level.
    if (OperandTypeResolver.isBooleanValuedOperator(node)) {
      return BOOLEAN_TYPE_NAME;
    }

    if (node instanceof Parser.TernaryExpressionContext) {
      return this.typeOfTernary(node, frame);
    }

    if (node instanceof Parser.UnaryExpressionContext) {
      // `!x` is Boolean; `-x`, `~x` and `&x` are not.
      return node.getChild(0)?.getText() === "!" ? BOOLEAN_TYPE_NAME : null;
    }

    if (node instanceof Parser.PostfixExpressionContext) {
      return this.typeOfPostfixExpression(node, frame);
    }

    if (node instanceof Parser.PrimaryExpressionContext) {
      const inner = node.expression();
      return inner ? this.typeOfOperand(inner, frame) : null;
    }

    if (node instanceof ParserRuleContext) return null;

    const text = node.getText();
    if (text === "true" || text === "false") return BOOLEAN_TYPE_NAME;
    return this.scopes.typeOfName(text, frame);
  }
}

export default OperandTypeResolver;
