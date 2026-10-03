/**
 * What KIND of value an expression is, for ADR-017's enum type rules.
 *
 * #1322. The codegen version of this split the expression's source text on `.`
 * and matched the pieces against patterns -- `this.X.Y`, `global.X.Y`, a
 * two-part path, a three-part path. That recognized what it had patterns for
 * and silently accepted everything else, which is why a bool, an f32, a
 * non-enum call and `1 + 1` were all assignable to an enum.
 *
 * Here the question is asked of the one operand typer (#1668), so the answer
 * is total: every expression is an enum of a named type, an integer, a value
 * of some other resolvable type, or unresolvable. Only the last is passed
 * over, and only because reporting an unresolvable name is E0427's job. This
 * class is the ADR-017 reading of the typer's facts, and decides nothing the
 * typer decides: a cast is the type it names, `Scope.Enum.MEMBER` is an enum
 * member however it is qualified, and a C enum is an enum.
 */

import { ParserRuleContext, ParseTree } from "antlr4ng";

import * as Parser from "../../PARSE/2-Parse/grammar/CNextParser";
import OperandTyper from "../../utils/OperandTyper";
import type IAnalysisContext from "./types/IAnalysisContext";
import type IOperandType from "../../types/IOperandType";

/** An expression's kind, as ADR-017's rules need to see it. */
type TValueKind =
  | { readonly kind: "enum"; readonly typeName: string }
  | { readonly kind: "integer" }
  | { readonly kind: "other" }
  | { readonly kind: "unresolved" };

const UNRESOLVED: TValueKind = { kind: "unresolved" };
const INTEGER: TValueKind = { kind: "integer" };
const OTHER: TValueKind = { kind: "other" };

class EnumValueResolver {
  public constructor(private readonly context: IAnalysisContext) {}

  public classify(ctx: ParserRuleContext): TValueKind {
    return EnumValueResolver.kindOf(OperandTyper.typeOf(ctx, this.context));
  }

  /**
   * An operand type, read as one of the kinds above. An unsuffixed integer
   * literal is an integer here, though it has no essential category of its
   * own, and so is arithmetic whose every leaf is one: `1 + 1` folds to `2`
   * in a later pass, which is why ADR-017's `s <- 1;` must catch it here.
   */
  public static kindOf(t: IOperandType | null): TValueKind {
    if (t === null) return UNRESOLVED;
    // A ternary is its arms' kind when they agree; a bare member arm, legal
    // where the position names the enum, binds to nothing and so is unresolved
    if (t.form.kind === "ternary") {
      return EnumValueResolver.ternaryKind(t.form.arms);
    }
    // ADR-017 governs C-Next enums; a header's enum is enum-category to Rule
    // 10.4 (E0810) but has no C-Next enum type here (it carries no
    // `enumTypeName`), which is why E0810 asks this reading what E0434 owns
    if (t.category === "enum" && t.enumTypeName !== null) {
      return { kind: "enum", typeName: t.enumTypeName };
    }
    if (EnumValueResolver.isInteger(t)) return INTEGER;
    if (t.form.kind === "composite") {
      return EnumValueResolver.compositeKind(t.form.leaves);
    }
    return OTHER;
  }

  /** A ternary is its arms' kind when they agree */
  private static ternaryKind(
    arms: ReadonlyArray<IOperandType | null>,
  ): TValueKind {
    const [whenTrue, whenFalse] = arms.map((arm) =>
      EnumValueResolver.kindOf(arm),
    );
    if (whenTrue.kind === "unresolved" || whenFalse.kind === "unresolved") {
      return UNRESOLVED;
    }
    const agree =
      whenTrue.kind === whenFalse.kind &&
      (whenTrue.kind !== "enum" ||
        (whenFalse.kind === "enum" &&
          whenTrue.typeName === whenFalse.typeName));
    return agree ? whenTrue : OTHER;
  }

  /** Arithmetic whose every leaf is an integer is one; an untyped leaf is unresolved */
  private static compositeKind(
    leaves: ReadonlyArray<IOperandType | null>,
  ): TValueKind {
    if (
      leaves.length > 0 &&
      leaves.every((leaf) => EnumValueResolver.kindOf(leaf).kind === "integer")
    ) {
      return INTEGER;
    }
    return leaves.includes(null) ? UNRESOLVED : OTHER;
  }

  private static isInteger(t: IOperandType): boolean {
    if (t.dimensions.length > 0) return false;
    if (t.category === "signed" || t.category === "unsigned") return true;
    return t.form.kind === "literal" && t.form.literal === "integer";
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
