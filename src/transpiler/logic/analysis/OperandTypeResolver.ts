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

/** One step of a member/subscript chain. */
interface IChainStep {
  readonly member: string | null;
  readonly isSubscript: boolean;
}

class OperandTypeResolver {
  private readonly scopes: ScopeFrameResolver;

  constructor(scopes: ScopeFrameResolver) {
    this.scopes = scopes;
  }

  /**
   * Strip one array dimension: `bool[2]` indexed once yields `bool`. Returns
   * null for a subscript into something with no dimension left, which is a bit
   * index or an error -- either way not a declared element type.
   */
  private static elementType(typeName: string): string | null {
    const bracket = typeName.indexOf("[");
    return bracket > 0 ? typeName.slice(0, bracket) : null;
  }

  /** Walk a resolved base type through the chain steps. */
  private applyChain(base: string | null, steps: IChainStep[]): string | null {
    let current = base;
    for (const step of steps) {
      if (!current) return null;
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
    }));

    return this.applyChain(this.scopes.typeOfName(baseName, frame), steps);
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

    if (primary.THIS() ?? primary.GLOBAL()) {
      // `this.member` / `global.member`: the first step names the declaration.
      const firstMember = ops.shift()?.IDENTIFIER()?.getText();
      if (!firstMember) return null;
      base = this.scopes.typeOfName(firstMember, frame);
    } else {
      const identifier = primary.IDENTIFIER()?.getText();
      if (!identifier) return null;
      base = this.scopes.typeOfName(identifier, frame);
    }

    const steps: IChainStep[] = [];
    for (const op of ops) {
      // Neither `.member` nor `[index]` means a call suffix: the result type is
      // a function's, not a declaration's, so it is not resolvable here.
      const isSubscript = op.LBRACKET() !== null;
      const member = op.DOT() !== null ? op.IDENTIFIER()?.getText() : null;
      if (!isSubscript && !member) return null;
      steps.push({ member: member ?? null, isSubscript });
    }

    return this.applyChain(base, steps);
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

    if (node instanceof Parser.PostfixExpressionContext) {
      return this.typeOfPostfixExpression(node, frame);
    }

    if (node instanceof Parser.PrimaryExpressionContext) {
      const inner = node.expression();
      return inner ? this.typeOfOperand(inner, frame) : null;
    }

    if (node instanceof ParserRuleContext) return null;

    const text = node.getText();
    if (text === "true" || text === "false") return "bool";
    return this.scopes.typeOfName(text, frame);
  }
}

export default OperandTypeResolver;
