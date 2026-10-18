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

import type IProgramSyntax from "../../types/syntax/IProgramSyntax";
import type IAssignmentSyntax from "../../types/syntax/IAssignmentSyntax";
import type TExpression from "../../types/syntax/TExpression";
import type TPostfixOpSyntax from "../../types/syntax/TPostfixOpSyntax";
import DeclarationParts from "../../utils/DeclarationParts";
import ExpressionNodes from "../../utils/ExpressionNodes";
import StatementNodes from "../../utils/StatementNodes";
import OperandTyper from "../../utils/OperandTyper";
import PROPERTY_NAMES from "../../utils/constants/PROPERTY_NAMES";
import RegisterMemberReference from "./helpers/RegisterMemberReference";
import ConstantExpression from "./helpers/ConstantExpression";
import IBitmapAccessError from "./types/IBitmapAccessError";
import TChainRoot from "../../types/TChainRoot";
import type IAnalysisContext from "./types/IAnalysisContext";
import SourceOrder from "../../utils/SourceOrder";

class BitmapAccessCheck {
  private readonly found: IBitmapAccessError[] = [];

  public constructor(private readonly context: IAnalysisContext) {}

  public errors(): IBitmapAccessError[] {
    return this.found;
  }

  /** A chain's leading names, its root, and the operations after the root */
  private static partsOf(expr: TExpression): {
    chain: string[];
    root: TChainRoot;
    ops: readonly TPostfixOpSyntax[];
  } | null {
    if (expr.kind !== "postfix") return null;
    const root = expr.primary.kind === "root" ? expr.primary.root : null;
    const names = expr.ops.map((op) => (op.kind === "member" ? op.name : null));
    const head =
      expr.primary.kind === "identifier" ? expr.primary.name : undefined;
    return {
      chain: RegisterMemberReference.leadingNames(head, names),
      root,
      ops: root === null ? expr.ops : expr.ops.slice(1),
    };
  }

  public checkExpression(expr: TExpression): void {
    const parts = BitmapAccessCheck.partsOf(expr);
    if (parts === null) return;
    this.checkChain(parts.chain, parts.root, parts.ops, expr);
  }

  public checkSite(site: IAssignmentSyntax): void {
    const parts = BitmapAccessCheck.partsOf(site.target);
    if (parts === null) return;
    const bitmapAt = this.checkChain(
      parts.chain,
      parts.root,
      parts.ops,
      site.target,
    );
    if (bitmapAt === null) return;

    // E0881: the value must fit the field it is written to. Folded by the
    // one binder, so a const is its value (#1760 second review: reading the
    // literal text let `f.Mode <- BIG` truncate silently).
    const layout = this.context.symbols.bitmapFields
      .get(bitmapAt.bitmap)
      ?.get(bitmapAt.field);
    if (layout === undefined) return;
    const value = ConstantExpression.valueAt(site.value, this.context);
    const maximum = 2 ** layout.width - 1;
    if (value === null || value <= maximum) return;
    this.report(
      site.value,
      "E0881",
      `Value ${value} exceeds ${layout.width}-bit field '${bitmapAt.field}' maximum of ${maximum}`,
      `A ${layout.width}-bit field holds 0 through ${maximum}; widen the field in the bitmap declaration, or write a value that fits (ADR-034).`,
    );
  }

  /**
   * Walk one chain. Reports E0882 and E0883 where they apply, and returns the
   * bitmap field a chain ends at when it ends at one.
   */
  private checkChain(
    chain: string[],
    root: TChainRoot,
    ops: readonly TPostfixOpSyntax[],
    node: TExpression,
  ): { bitmap: string; field: string } | null {
    const bitmaps = this.context.symbols.bitmapFields;
    if (!bitmaps || chain.length === 0) return null;

    if (this.reportsArrayField(node)) return null;
    const found = this.bitmapOf(chain, root, node);
    if (found === null) return null;
    const { bitmap, at } = found;

    // The op that follows the bitmap -- `ops` is aligned by the caller so that
    // `ops[i]` follows `chain[i]`. A subscript there is E0883: ADR-034
    // addresses a bitmap by named field, never by bit index.
    const after = ops[at - 1];
    if (after !== undefined && after.kind !== "member") {
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
   * E0918 (#2186): a field belongs to one bitmap value. An array of bitmaps,
   * or a row of one (`g2[1]` of `F[2][2]`), is no bitmap value, so a field of
   * it names no storage -- C rejects both the member access and the mask.
   */
  private reportsArrayField(node: TExpression): boolean {
    const step = OperandTyper.chainOf(node, this.context).steps.find(
      (candidate) =>
        candidate.member !== null &&
        candidate.property === null &&
        !!candidate.before?.bitmapTypeName &&
        candidate.before.dimensions.length > 0,
    );
    if (step === undefined) return false;
    const bitmap = step.before!.bitmapTypeName!;
    this.report(
      node,
      "E0918",
      `Field '${step.member}' of an array of '${bitmap}' names no element`,
      `A field belongs to one '${bitmap}' value; index every dimension first, e.g. NAME[i].${step.member} (ADR-034).`,
    );
    return true;
  }

  private bitmapOf(
    chain: string[],
    root: TChainRoot,
    node: TExpression,
  ): { bitmap: string; at: number } | null {
    const symbols = this.context.symbols;
    const member = RegisterMemberReference.resolve(
      root,
      chain,
      node.span,
      this.context,
    );
    if (member !== null) {
      const type = symbols.registerMemberTypes.get(member.key);
      if (type !== undefined && symbols.bitmapFields.has(type)) {
        return { bitmap: type, at: member.consumed };
      }
      return null;
    }
    if (root === "global") return null;
    const declared = OperandTyper.chainOf(node, this.context).steps[0]?.before;
    const bitmap =
      declared?.dimensions.length === 0 ? declared.bitmapTypeName : null;
    return bitmap !== null && symbols.bitmapFields.has(bitmap)
      ? { bitmap, at: 1 }
      : null;
  }

  private report(
    at: TExpression,
    code: string,
    message: string,
    helpText: string,
  ): void {
    this.found.push({
      code,
      line: at.span.line,
      column: at.span.column,
      message,
      helpText,
    });
  }
}

class BitmapAccessAnalyzer {
  /** #1456: handed in rather than read off shared state. */
  constructor(private readonly context: IAnalysisContext) {}

  /**
   * #1991: reads 1.2's syntax, not the parse tree. A target is checked as a
   * site, with its value, and not again as an expression.
   */
  public analyze(program: IProgramSyntax): IBitmapAccessError[] {
    const check = new BitmapAccessCheck(this.context);
    for (const member of program.declarations) {
      const sites = StatementNodes.assignments(member.declaration);
      const targets = new Set<TExpression>(sites.map((site) => site.target));
      for (const expr of DeclarationParts.of(member.declaration).flatMap(
        ExpressionNodes.of,
      )) {
        if (!targets.has(expr)) check.checkExpression(expr);
      }
      for (const site of sites) check.checkSite(site);
    }
    return check.errors().sort(SourceOrder.compare);
  }
}

export default BitmapAccessAnalyzer;
