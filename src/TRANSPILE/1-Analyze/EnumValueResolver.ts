/**
 * What KIND of value an expression is, for ADR-017's enum type rules.
 *
 * #1322. The codegen version of this split the expression's source text on `.`
 * and matched the pieces against patterns -- `this.X.Y`, `global.X.Y`, a
 * two-part path, a three-part path. That recognized what it had patterns for
 * and silently accepted everything else, which is why a bool, an f32, a
 * non-enum call and `1 + 1` were all assignable to an enum.
 *
 * Here the question is asked of the parse tree and of declared types, so the
 * answer is total: every expression is an enum of a named type, an integer, a
 * value of some other resolvable type, or unresolvable. Only the last is passed
 * over, and only because reporting an unresolvable name is E0427's job.
 */

import { ParserRuleContext, ParseTree } from "antlr4ng";

import * as Parser from "../../transpiler/logic/parser/grammar/CNextParser";
import CodeGenState from "../../transpiler/state/CodeGenState";
import QualifiedCName from "../../utils/QualifiedCName";
import ScopeCandidates from "./helpers/ScopeCandidates";
import ScopeUtils from "../../utils/ScopeUtils";
import TypeCheckUtils from "../../utils/TypeCheckUtils";
import IScopeFrame from "./types/IScopeFrame";
import OperandTypeResolver from "./OperandTypeResolver";
import ScopeFrameResolver from "./ScopeFrameResolver";
import TChainRoot from "./types/TChainRoot";

/** An expression's kind, as ADR-017's rules need to see it. */
type TValueKind =
  | { readonly kind: "enum"; readonly typeName: string }
  | { readonly kind: "integer" }
  | { readonly kind: "other" }
  | { readonly kind: "unresolved" };

const UNRESOLVED: TValueKind = { kind: "unresolved" };
const INTEGER: TValueKind = { kind: "integer" };
const OTHER: TValueKind = { kind: "other" };

/** A decimal, hex or binary integer literal, as the lexer produces it. */
const INTEGER_LITERAL = /^-?(?:\d+|0[xX][0-9a-fA-F]+|0[bB][01]+)$/;

class EnumValueResolver {
  private readonly types: OperandTypeResolver;

  public constructor(private readonly scopes: ScopeFrameResolver) {
    this.types = new OperandTypeResolver(scopes);
  }

  public classify(ctx: ParserRuleContext, frame: IScopeFrame): TValueKind {
    const node = EnumValueResolver.descend(ctx);

    // A cast states its own type, and ADR-017 makes the cast the SANCTIONED
    // way to cross between an enum and an integer. Typing it by what is inside
    // the parentheses would reject `(State)1`, which the language allows.
    if (node instanceof Parser.CastExpressionContext) {
      return this.ofTypeName(node.type().getText(), frame);
    }

    if (node instanceof Parser.PrimaryExpressionContext) {
      const inner = node.expression();
      if (inner) return this.classify(inner, frame);
    }

    // An enum MEMBER access names a type that no declaration carries, so it is
    // recognized structurally before the declared-type resolver is asked.
    const member = this.enumOfMemberAccess(node, frame);
    if (member !== null) return { kind: "enum", typeName: member };

    // Asked of the ORIGINAL node, not the descended one: `typeOfOperand` does
    // its own descent and reads the levels on the way down. Handing it a bare
    // terminal instead loses the postfix level that carries the name, which is
    // how the first version of this resolved every plain variable to nothing.
    const declared = this.types.typeOfOperand(ctx, frame);
    if (declared !== null) return this.ofTypeName(declared, frame);

    const text = node.getText();
    if (INTEGER_LITERAL.test(text)) return INTEGER;
    if (text === "true" || text === "false") return OTHER;

    // A multi-operand arithmetic level has no declared type, but if every
    // operand is an integer the level is one. This is what makes `1 + 1`
    // reachable: the codegen check matched the source text against a pattern for a bare literal,
    // and folding to `2` happens afterwards, in a later pass.
    if (
      node instanceof ParserRuleContext &&
      EnumValueResolver.isArithmetic(node) &&
      this.everyOperandIsInteger(node, frame)
    ) {
      return INTEGER;
    }
    return UNRESOLVED;
  }

  /**
   * Whether the expression is a pure member PATH -- `a.b`, `this.X.Y` -- with
   * no call and no subscript anywhere in it.
   *
   * Such a path's type is settled entirely by declarations, so a path that
   * resolves to nothing names nothing, and "nothing" is not of any enum type.
   * That is the one place this analyzer reports on an unresolvable value, and
   * it is deliberate: `this.Other.X` inside a scope that has no `Other` was
   * rejected only by the codegen throw being replaced here, and PROBED to be
   * caught by nothing else -- `this.missingName` in a non-enum position is
   * still accepted today, so relocating without this would have turned a
   * rejection into silence.
   *
   * A call or a subscript is excluded because either can make a chain
   * legitimately unresolvable to this pass.
   */
  public isPureMemberPath(ctx: ParserRuleContext): boolean {
    const node = EnumValueResolver.descend(ctx);
    if (!(node instanceof Parser.PostfixExpressionContext)) return false;

    const ops = node.postfixOp();
    if (ops.length === 0) return false;
    return ops.every((op) => op.DOT() !== null && op.LBRACKET() === null);
  }

  /**
   * The name `knownEnums` holds for a type as WRITTEN, or null if it names no
   * enum.
   *
   * Every spelling of one enum has to arrive at one name, or the rule compares
   * a target against a value that is the same type under a different string.
   * Three spellings reach here: a bare `EMode` inside its own scope, a
   * `this.EMode` (which is how a scope member's own type is written, and is the
   * form `IDeclaredVar.typeText` records), and an already-qualified name.
   *
   * `this.` states the enclosing scope; it names no component of the type, so
   * it is stripped before qualifying. Leaving it produced `Motor__this.EMode`,
   * which matches nothing -- and because "matches nothing" reads as "not an
   * enum", the rule inverted: it reported every correct assignment inside a
   * scope as a non-enum value. Twelve fixtures caught it.
   */
  public enumTypeNameFor(written: string, frame: IScopeFrame): string | null {
    let path = written;
    // `global.` states FILE scope, so it both names no component and forbids
    // qualifying by the enclosing scope. `this.` states the enclosing scope and
    // names no component either. Both are prefixes about WHERE to look, and
    // treating them as parts of the name was what produced `Motor__this.EMode`.
    let rooted: TChainRoot = null;
    if (path.startsWith("this.")) {
      path = path.slice(5);
      rooted = "this";
    } else if (path.startsWith("global.")) {
      path = path.slice(7);
      rooted = "global";
    }

    const parts = path.split(".");
    // Never joined by hand -- `fromParts` is the single encoder (CLAUDE.md).
    const transpiled = QualifiedCName.fromParts(parts);

    // Each prefix admits exactly ONE candidate, because each one STATES where
    // to look. `this.X` is X in the enclosing scope and nothing else -- falling
    // back to a bare global `X` made `this.Global` resolve to the global enum,
    // so an invalid spelling read as valid. `global.X` is file scope and must
    // not be scope-qualified. Only a BARE name searches, and it searches in
    // ADR-057's order: the enclosing scope first, then file scope.
    const candidates = ScopeCandidates.forRoot(
      rooted,
      ScopeUtils.qualifyInScope(transpiled, frame.scopePath),
      [transpiled, path],
    );

    for (const candidate of candidates) {
      if (CodeGenState.isKnownEnum(candidate)) return candidate;
    }
    return null;
  }

  /** A resolved type name, read as one of the kinds above. */
  private ofTypeName(typeName: string, frame: IScopeFrame): TValueKind {
    const enumName = this.enumTypeNameFor(typeName, frame);
    if (enumName !== null) return { kind: "enum", typeName: enumName };
    if (TypeCheckUtils.isInteger(typeName)) return INTEGER;
    return OTHER;
  }

  /**
   * The enum type an enum-member access names, or null.
   *
   * The components come from the postfix chain rather than from splitting the
   * text, so `Motor.State.IDLE` is three named steps and not three substrings.
   * The LAST step is the member; everything before it names the enum, which is
   * why the join stops one short.
   */
  private enumOfMemberAccess(
    node: ParseTree,
    frame: IScopeFrame,
  ): string | null {
    if (!(node instanceof Parser.PostfixExpressionContext)) return null;

    const primary = node.primaryExpression();
    if (!primary) return null;

    const ops = node.postfixOp();
    const parts: string[] = [];
    let rootIsThis = false;

    if (primary.THIS()) {
      rootIsThis = true;
    } else if (primary.GLOBAL()) {
      // `global.` states file scope; it names no component of the type.
    } else {
      const identifier = primary.IDENTIFIER()?.getText();
      if (!identifier) return null;
      parts.push(identifier);
    }

    for (const op of ops) {
      // A subscript or a call is not part of a member path.
      if (op.LBRACKET() !== null || op.DOT() === null) return null;
      const name = op.IDENTIFIER()?.getText();
      if (!name) return null;
      parts.push(name);
    }

    // The last component is the member, so at least one has to precede it.
    if (parts.length < 2) return null;

    // Handed to the SAME normalizer a declared type goes through, so
    // `this.EMode.OFF`, `global.EGlobal.A`, `Motor.State.IDLE` and a bare
    // `B.c` inside `B`'s own scope all arrive at the one name `knownEnums`
    // holds. Resolving member access separately is what let a scope-local
    // `B.c` read as "not an enum" while `B` was a perfectly good enum.
    const written = (rootIsThis ? "this." : "") + parts.slice(0, -1).join(".");
    return this.enumTypeNameFor(written, frame);
  }

  private everyOperandIsInteger(
    node: ParserRuleContext,
    frame: IScopeFrame,
  ): boolean {
    const operands: ParserRuleContext[] = [];
    for (let index = 0; index < node.getChildCount(); index += 1) {
      const child = node.getChild(index);
      if (child instanceof ParserRuleContext) operands.push(child);
    }
    if (operands.length < 2) return false;
    return operands.every(
      (operand) => this.classify(operand, frame).kind === "integer",
    );
  }

  /** Arithmetic levels, where an all-integer operand list makes the level one. */
  private static isArithmetic(node: ParserRuleContext): boolean {
    return (
      node instanceof Parser.AdditiveExpressionContext ||
      node instanceof Parser.MultiplicativeExpressionContext
    );
  }

  /** Descend through pass-through levels that carry exactly one child. */
  private static descend(ctx: ParserRuleContext): ParseTree {
    let node: ParseTree = ctx;
    while (node instanceof ParserRuleContext && node.getChildCount() === 1) {
      const child = node.getChild(0);
      if (!child) break;
      node = child;
    }
    return node;
  }
}

export default EnumValueResolver;
