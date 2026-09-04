import type TSymbolKindC from "../../symbol-kinds/TSymbolKindC";
import type ESourceLanguage from "../../../../utils/types/ESourceLanguage";
import type TVisibility from "../../TVisibility";
import type ISourceSpan from "../../ISourceSpan";

/**
 * Base interface for all C language symbol types.
 * C symbols use simple strings for types since they pass through to codegen unchanged.
 */
interface ICBaseSymbol {
  /** Symbol kind - discriminator for type narrowing */
  readonly kind: TSymbolKindC;

  /** Symbol name */
  readonly name: string;

  /** Source file where the symbol is defined */
  readonly sourceFile: string;

  /**
   * Where this symbol is declared, as a span rather than a bare line.
   *
   * Replaced `sourceLine` rather than joining it (#1318). Carrying both would
   * put one fact in two places -- `span.line` and `sourceLine` -- which is the
   * shape recorded in `visibility` below: two places held one fact, they
   * disagreed, and the header believed the wrong one (#1300).
   *
   * A column is what a symbol-level diagnostic was missing: 136 of 302
   * `.expected.error` fixtures began at `1:0` because a diagnostic about a
   * symbol had no position and fell back to the start of the file (#1316).
   */
  readonly span: ISourceSpan;

  /** Source language - always C for C symbols */
  readonly sourceLanguage: ESourceLanguage.C;

  /** Always "public": C has no declaration-site access control, and everything a header
   * declares is reachable from the file that includes it — a `static inline` included,
   * which is why `extern` is not the discriminator the old `isExported` treated it as.
   * (C++ differs: it does have `private:`, and does not yet record it — #1475.) */
  readonly visibility: TVisibility;
}

export default ICBaseSymbol;
