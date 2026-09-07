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
import * as Parser from "../../transpiler/logic/parser/grammar/CNextParser";
import IScopeFrame from "./types/IScopeFrame";
import ScopeFrameResolver from "./ScopeFrameResolver";
import CodeGenState from "../../transpiler/state/CodeGenState";
import QualifiedCName from "../../utils/QualifiedCName";
import ScopeUtils from "../../utils/ScopeUtils";

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
   * A struct field's declared type, WITH its array dimensions.
   *
   * #1322: `structFields` stores a field's ELEMENT type and
   * `structFieldDimensions` stores its shape, so reading only the first made
   * `DataPoint[10] samples` resolve to `DataPoint` -- an array that looks
   * scalar. Every consumer of this walk reads dimensions off the type TEXT
   * (`elementType` strips one `[...]` per subscript), so the two halves are
   * rejoined here, once, rather than at each caller that happens to care.
   */
  private static fieldType(structType: string, field: string): string | null {
    const base = CodeGenState.getStructFieldType(structType, field);
    if (base === undefined) return null;
    const dimensions = CodeGenState.getStructFieldDimensions(structType, field);
    if (dimensions === undefined || dimensions.length === 0) return base;
    return base + dimensions.map((d) => `[${d}]`).join("");
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
            QualifiedCName.fromParts(nameParts),
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
        current = OperandTypeResolver.fieldType(current, step.member);
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
    return this.typeOfAssignmentTargetPrefix(ctx, frame, 0);
  }

  /**
   * The same walk with the last `dropTrailingOps` operations left off.
   *
   * #1322: ADR-036's bounds check asks, at each subscript of a TARGET, what
   * is being subscripted -- `grid[i][9]` is bounded by `grid[i]`'s shape, not
   * `grid`'s -- which is the prefix walk `typeOfPostfixPrefix` already gives
   * an expression. Exposed the same way rather than as a second walker.
   */
  public typeOfAssignmentTargetPrefix(
    ctx: Parser.AssignmentTargetContext,
    frame: IScopeFrame,
    dropTrailingOps: number,
  ): string | null {
    const baseName = ctx.IDENTIFIER()?.getText();
    if (!baseName) return null;

    const ops = ctx.postfixTargetOp();
    const limit = Math.max(0, ops.length - dropTrailingOps);
    const steps: IChainStep[] = ops.slice(0, limit).map((op) => ({
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
    return this.typeOfPostfixPrefix(ctx, frame, 0);
  }

  /**
   * The same walk with the last `dropTrailingOps` operations left off.
   *
   * #1322: ADR-058's length properties are the LAST step of a chain, and the
   * rule is about what precedes them -- `.element_count` needs an array, so the
   * question is the type of `a.b[0]`, not of `a.b[0].element_count`. Exposed as
   * a bound on the existing walk rather than as a second walker: a copy would
   * be free to disagree about `this.`/`global.` roots, about subscripts
   * stripping one dimension at a time, and about struct-field keys, which are
   * exactly the three things that have already been got wrong once each.
   */
  public typeOfPostfixPrefix(
    ctx: Parser.PostfixExpressionContext,
    frame: IScopeFrame,
    dropTrailingOps: number,
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
        primary.THIS() !== null && frame.scopePath !== ""
          ? ScopeUtils.qualifyInScope(firstMember, frame.scopePath)
          : firstMember;
      base = this.scopes.typeOfName(firstMember, frame);
    } else {
      const identifier = primary.IDENTIFIER()?.getText();
      if (!identifier) return null;
      baseName = identifier;
      base = this.scopes.typeOfName(identifier, frame);
    }

    // Counted against the ops that REMAIN: a `this.`/`global.` root has
    // already consumed one above to name the declaration, and a caller saying
    // "drop the property step" must not have to know that.
    const limit = Math.max(0, ops.length - dropTrailingOps);
    const chain: IChainStep[] = [];
    for (const op of ops) {
      if (chain.length >= limit) break;
      // Neither `.member` nor `[index]` is a call suffix.
      const isSubscript = op.LBRACKET() !== null;
      const member = op.DOT() !== null ? op.IDENTIFIER()?.getText() : null;
      chain.push({
        member: member ?? null,
        isSubscript,
        isCall: !isSubscript && !member,
      });
    }

    return this.applyChain(base, baseName, chain);
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
