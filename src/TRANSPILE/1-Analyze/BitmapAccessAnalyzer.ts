/**
 * ADR-034 bitmap access: E0881, E0882, E0883.
 *
 * #1322. Three throws in three files, each resolving "what bitmap is this?" its
 * own way and all reporting `1:0` -- the bracket-indexing one built a
 * `Error at line N:` prefix into its message, which is a position smuggled
 * through prose rather than carried by the diagnostic.
 *
 * ## One resolution, two ways to hold a bitmap
 *
 * A bitmap is reached either through a declared variable (`Flags f; f.Mode`)
 * or through a register member typed by one (`this.SysTick.CTRL`). Codegen
 * asked those separately -- the literal-overflow check keyed on the assignment
 * handler's already-resolved field, the unknown-field check on a map lookup
 * deep in expression generation, and the bracket check on
 * `registerMemberTypes` keyed by a GENERATED C name, which is why it could
 * only ever fire for registers. Here both routes answer one question,
 * `bitmapOf`, and all three rules ask it.
 *
 * That is also what closes the bracket rule's hole: `f[0]` on a bitmap
 * VARIABLE was accepted and emitted as a bit index, because the check looked
 * only in the register map. ADR-034 says a bitmap is addressed by named field.
 */

import { ParserRuleContext, ParseTreeWalker } from "antlr4ng";

import { CNextListener } from "../../transpiler/logic/parser/grammar/CNextListener";
import * as Parser from "../../transpiler/logic/parser/grammar/CNextParser";
import CodeGenState from "../../transpiler/state/CodeGenState";
import LiteralUtils from "../../utils/LiteralUtils";
import ParserUtils from "../../utils/ParserUtils";
import DeclarationScopeCollector from "./DeclarationScopeCollector";
import PROPERTY_NAMES from "./helpers/PROPERTY_NAMES";
import RegisterMemberReference from "./helpers/RegisterMemberReference";
import IBitmapAccessError from "./types/IBitmapAccessError";
import ScopeFrameResolver from "./ScopeFrameResolver";

class BitmapAccessListener extends CNextListener {
  private readonly found: IBitmapAccessError[] = [];

  public constructor(private readonly scopes: ScopeFrameResolver) {
    super();
  }

  public errors(): IBitmapAccessError[] {
    return this.found;
  }

  /** Reads: `f.Mode`, `this.SysTick.CTRL.EN`, and the bracket forms. */
  override enterPostfixExpression = (
    ctx: Parser.PostfixExpressionContext,
  ): void => {
    const primary = ctx.primaryExpression();
    if (!primary) return;
    const root = RegisterMemberReference.rootOf(primary);
    const ops = ctx.postfixOp();
    const names = ops.map((op) =>
      op.DOT() !== null ? op.IDENTIFIER()!.getText() : null,
    );
    const head = root === null ? primary.IDENTIFIER()?.getText() : undefined;
    // A `this.`/`global.` root puts the chain's FIRST name in an op, where a
    // bare head comes from the primary expression and consumes none. Slicing
    // here is what keeps `ops[i]` the op that FOLLOWS `chain[i]` in both
    // forms -- the alignment an assignment target has for free, since its head
    // is always the target's own IDENTIFIER.
    this.checkChain(
      RegisterMemberReference.leadingNames(head, names),
      root,
      root === null ? ops : ops.slice(1),
      ctx,
    );
  };

  /** Targets: `f.Mode <- 10;` and `this.SysTick.CTRL[0] <- true;`. */
  override enterAssignmentStatement = (
    ctx: Parser.AssignmentStatementContext,
  ): void => {
    const target = ctx.assignmentTarget();
    const ops = target.postfixTargetOp();
    const names = ops.map((op) =>
      op.DOT() !== null ? op.IDENTIFIER()!.getText() : null,
    );
    const chain = RegisterMemberReference.leadingNames(
      target.IDENTIFIER().getText(),
      names,
    );
    const bitmapAt = this.checkChain(
      chain,
      RegisterMemberReference.rootOfTarget(target),
      ops,
      target,
    );
    if (bitmapAt === null) return;

    // E0881: the value must fit the field it is written to.
    const layout = CodeGenState.symbols?.bitmapFields
      .get(bitmapAt.bitmap)
      ?.get(bitmapAt.field);
    if (layout === undefined) return;
    const value = LiteralUtils.parseIntegerLiteral(
      ctx.expression().getText().trim(),
    );
    const maximum = 2 ** layout.width - 1;
    if (value === undefined || value <= maximum) return;
    this.report(
      ctx.expression(),
      "E0881",
      `Value ${value} exceeds ${layout.width}-bit field '${bitmapAt.field}' maximum of ${maximum}`,
      `A ${layout.width}-bit field holds 0 through ${maximum}; widen the field in the bitmap declaration, or write a value that fits (ADR-034).`,
    );
  };

  /**
   * Walk one chain. Reports E0882 and E0883 where they apply, and returns the
   * bitmap field a chain ends at when it ends at one.
   */
  private checkChain(
    chain: string[],
    root: "this" | "global" | null,
    ops: readonly (Parser.PostfixOpContext | Parser.PostfixTargetOpContext)[],
    node: ParserRuleContext,
  ): { bitmap: string; field: string } | null {
    const bitmaps = CodeGenState.symbols?.bitmapFields;
    if (!bitmaps || chain.length === 0) return null;

    const found = this.bitmapOf(chain, root, node);
    if (found === null) return null;
    const { bitmap, at } = found;

    // The op that follows the bitmap -- `ops` is aligned by the caller so that
    // `ops[i]` follows `chain[i]`. A subscript there is E0883: ADR-034
    // addresses a bitmap by named field, never by bit index.
    const after = ops[at - 1];
    if (after?.DOT() === null) {
      this.report(
        node,
        "E0883",
        `Cannot use bracket indexing on bitmap type '${bitmap}'`,
        `A bitmap is addressed by named field, not by bit index -- write ${chain[at - 1]}.FIELD_NAME (ADR-034).`,
      );
      return null;
    }

    const field = chain[at];
    if (field === undefined) return null;
    // ADR-058's properties describe the type's shape rather than name a field,
    // so they are not unknown fields. E0867 owns whether one is used correctly.
    if (PROPERTY_NAMES.has(field)) return null;
    if (!bitmaps.get(bitmap)?.has(field)) {
      const known = [...(bitmaps.get(bitmap)?.keys() ?? [])];
      const quoted = known.map((k) => `'${k}'`).join(", ");
      this.report(
        node,
        "E0882",
        `Unknown bitmap field '${field}' on '${bitmap}'`,
        known.length === 0
          ? "The bitmap declares no fields (ADR-034)."
          : `'${bitmap}' declares ${quoted} (ADR-034).`,
      );
      return null;
    }
    return { bitmap, field };
  }

  /**
   * The bitmap a chain reaches and how many names it took to get there.
   *
   * Two routes, asked in the order codegen resolved them: a register member
   * whose declared type is a bitmap, then a declared variable whose type is
   * one. A register wins because its spelling (`this.SysTick.CTRL`) consumes
   * more names than a variable ever can.
   */
  private bitmapOf(
    chain: string[],
    root: "this" | "global" | null,
    node: ParserRuleContext,
  ): { bitmap: string; at: number } | null {
    const symbols = CodeGenState.symbols;
    if (!symbols) return null;

    const member = RegisterMemberReference.resolve(
      root,
      chain,
      node,
      this.scopes,
    );
    if (member !== null) {
      const type = symbols.registerMemberTypes.get(member.key);
      if (type !== undefined && symbols.bitmapFields.has(type)) {
        return { bitmap: type, at: member.consumed };
      }
      return null;
    }

    // A declared variable: `Flags f;` then `f.Mode`. `this.f` resolves through
    // the enclosing scope's frame, which is where a scope member is recorded.
    if (root === "global") return null;
    const name = chain[0];
    if (name === undefined) return null;
    const declared = this.scopes.declarationOfNameLexical(
      name,
      this.scopes.frameFor(node),
    );
    const typeText = declared?.typeText;
    if (typeText === undefined) return null;
    return symbols.bitmapFields.has(typeText)
      ? { bitmap: typeText, at: 1 }
      : null;
  }

  private report(
    at: ParserRuleContext,
    code: string,
    message: string,
    helpText: string,
  ): void {
    const { line, column } = ParserUtils.getPosition(at);
    this.found.push({ code, line, column, message, helpText });
  }
}

class BitmapAccessAnalyzer {
  public analyze(tree: Parser.ProgramContext): IBitmapAccessError[] {
    const declarations = new DeclarationScopeCollector();
    ParseTreeWalker.DEFAULT.walk(declarations, tree);
    const listener = new BitmapAccessListener(
      new ScopeFrameResolver(declarations),
    );
    ParseTreeWalker.DEFAULT.walk(listener, tree);
    return listener.errors();
  }
}

export default BitmapAccessAnalyzer;
