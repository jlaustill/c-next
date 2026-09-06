/**
 * E0857: a compound operator needs a whole storage location.
 *
 * `+<-` and friends are read-modify-write. C-Next implements them where the
 * target names one location it can read and write back, and rejects them on a
 * bit index, a bit range, a slice or a string.
 *
 * #1322. This was the audit's largest duplicate group: **six** throws with four
 * message variants, across `AccessPatternHandlers`, `BitAccessHandlers`,
 * `AssignmentHandlerUtils`, `BitmapHandlers`, `StringHandlers` and
 * `ArrayHandlers` -- and `validateNotCompound` was defined twice, verbatim, in
 * two of them. Six sites deciding one thing, which is the shape CLAUDE.md calls
 * the project's worst anti-pattern.
 *
 * ## Why it is a 2.1 rule and not a syntactic one
 *
 * `arr[0] +<- 2` is accepted; `flags[0] +<- 1` is rejected. Same production.
 * What differs is whether the base was declared as an array -- on a scalar, a
 * subscript is a BIT index (ADR-007), and a bit is not a location the compound
 * lowering can write back to.
 *
 * That is why this family could not move before `IDeclaredVar.dimensions`
 * existed: the only place that knew `flags` was scalar and `arr` was not, was
 * codegen's type registry, which is populated after the analyzers run.
 *
 * A two-expression subscript needs no such lookup -- a range or a slice is not
 * one location whatever the base -- so the array-ness question is asked only
 * where it decides something.
 */

import { ParseTreeWalker } from "antlr4ng";

import { CNextListener } from "../../transpiler/logic/parser/grammar/CNextListener";
import * as Parser from "../../transpiler/logic/parser/grammar/CNextParser";
import ParserUtils from "../../utils/ParserUtils";
import ScopeUtils from "../../utils/ScopeUtils";
import CodeGenState from "../../transpiler/state/CodeGenState";
import DeclarationScopeCollector from "./DeclarationScopeCollector";
import ScopeFrameResolver from "./ScopeFrameResolver";
import ICompoundAssignmentError from "./types/ICompoundAssignmentError";

/** What made a target unusable, in words the message can name. */
type TRejection = "bit index" | "bit range or slice" | "string";

class CompoundAssignmentListener extends CNextListener {
  private readonly found: ICompoundAssignmentError[] = [];

  public constructor(private readonly scopes: ScopeFrameResolver) {
    super();
  }

  public errors(): ICompoundAssignmentError[] {
    return this.found;
  }

  override enterAssignmentStatement = (
    ctx: Parser.AssignmentStatementContext,
  ): void => {
    // `ASSIGN` is the plain `<-`; every other operator in the rule is compound.
    // Asking what it is NOT keeps this from listing the operators, which is the
    // enumeration that let E0853 miss `switch`.
    if (ctx.assignmentOperator().ASSIGN()) return;

    const reason = this.rejectionFor(ctx.assignmentTarget());
    if (reason === null) return;

    const { line, column } = ParserUtils.getPosition(ctx);
    this.found.push({
      code: "E0857",
      line,
      column,
      message: `Compound assignment operators are not supported on a ${reason}`,
      helpText:
        "A compound operator reads, modifies and writes back one storage location. Write the read and the write out separately.",
    });
  };

  /**
   * Why this target cannot take a compound operator, or null.
   *
   * Walks the postfix chain carrying the DIMENSIONS the next subscript would
   * apply to. That is what makes `bytes.data[0] +<- 5` legal while
   * `flags[0] +<- 1` is not: the first subscript indexes a struct field that
   * was declared an array, and the base variable's own array-ness says nothing
   * about it. The first version of this asked only the base and rejected three
   * real fixtures.
   */
  private rejectionFor(
    target: Parser.AssignmentTargetContext,
  ): TRejection | null {
    const declared = this.declaredBase(target);
    const ops = target.postfixTargetOp();

    if (ops.length === 0) {
      return declared !== null && declared.stringCapacity !== null
        ? "string"
        : null;
    }

    // What the next subscript indexes into. `null` means "not established" --
    // an unresolved base, or a field whose declaration this pass cannot see --
    // and an unestablished shape never rejects. A name this pass cannot resolve
    // is another diagnostic's to report, not this one's to guess at.
    let dimensions: readonly (number | string)[] | null =
      declared?.dimensions ?? null;
    let typeName: string | null = declared?.typeText ?? null;

    for (const op of ops) {
      const subscripts = op.expression();

      if (subscripts.length >= 2) {
        // A range or a slice is never one storage location, whatever it
        // indexes, so this needs no resolved shape.
        return "bit range or slice";
      }

      if (subscripts.length === 1) {
        if (dimensions === null) return null;
        if (dimensions.length === 0) return "bit index";
        dimensions = dimensions.slice(1);
        continue;
      }

      const field = op.IDENTIFIER()?.getText();
      if (field === undefined || typeName === null) {
        dimensions = null;
        typeName = null;
        continue;
      }
      const key = CompoundAssignmentAnalyzer.structKey(typeName);
      const fields = CodeGenState.symbols?.structFields.get(key);
      dimensions =
        CodeGenState.symbols?.structFieldDimensions.get(key)?.get(field) ??
        (fields?.has(field) ? [] : null);
      typeName = fields?.get(field) ?? null;
    }

    // The chain may END on a string -- `config.name +<- " suffix"` where `name`
    // is a `string<32>` field. Asking only the base variable missed it, because
    // the base is the struct. A string is a buffer copied by `strncpy`, not a
    // value `+` can be applied to, wherever it is reached from.
    return CompoundAssignmentAnalyzer.isStringType(typeName) ? "string" : null;
  }

  private declaredBase(target: Parser.AssignmentTargetContext) {
    return this.scopes.declarationOfNameLexical(
      target.IDENTIFIER().getText(),
      this.scopes.frameFor(target),
    );
  }
}

class CompoundAssignmentAnalyzer {
  /**
   * The key `structFields` is built with, from a type as WRITTEN.
   *
   * `TSymbolInfoAdapter` keys those maps by the transpiled C name, so a
   * scope-declared struct is `StrCompoundErr__Config` while its declaration
   * reads `StrCompoundErr.Config`. Looking up the source spelling misses every
   * scoped struct silently -- `config.name +<- " suffix"` compiled clean.
   *
   * The join goes through `ScopeUtils.getTranspiledCName`, the single encoder,
   * rather than being spelled here: CLAUDE.md's rule is never to re-derive a
   * qualified name by hand, and this is exactly the shape it means.
   */
  public static structKey(typeName: string): string {
    const cut = typeName.lastIndexOf(".");
    return cut === -1
      ? typeName
      : ScopeUtils.getTranspiledCName({
          scopePath: typeName.slice(0, cut),
          name: typeName.slice(cut + 1),
        });
  }

  /**
   * A declared type text naming a bounded string.
   *
   * `structFields` records a field's type as written, so a `string<32>` field
   * arrives here as that text rather than as a parsed capacity.
   */
  public static isStringType(typeName: string | null): boolean {
    return typeName !== null && /^string\s*</.test(typeName);
  }

  public analyze(tree: Parser.ProgramContext): ICompoundAssignmentError[] {
    const declarations = new DeclarationScopeCollector();
    ParseTreeWalker.DEFAULT.walk(declarations, tree);

    const listener = new CompoundAssignmentListener(
      new ScopeFrameResolver(declarations),
    );
    ParseTreeWalker.DEFAULT.walk(listener, tree);
    return listener.errors();
  }
}

export default CompoundAssignmentAnalyzer;
