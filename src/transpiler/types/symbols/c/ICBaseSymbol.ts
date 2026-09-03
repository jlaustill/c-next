import type TSymbolKindC from "../../symbol-kinds/TSymbolKindC";
import type ESourceLanguage from "../../../../utils/types/ESourceLanguage";
import type TVisibility from "../../TVisibility";

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

  /** Line number in the source file */
  readonly sourceLine: number;

  /** Source language - always C for C symbols */
  readonly sourceLanguage: ESourceLanguage.C;

  /** Always "public": C has no declaration-site access control, and everything a header
   * declares is reachable from the file that includes it — a `static inline` included,
   * which is why `extern` is not the discriminator the old `isExported` treated it as.
   * (C++ differs: it does have `private:`, and does not yet record it — #1475.) */
  readonly visibility: TVisibility;
}

export default ICBaseSymbol;
