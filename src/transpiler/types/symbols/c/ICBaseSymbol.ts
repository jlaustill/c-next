import type TSymbolKindC from "../../symbol-kinds/TSymbolKindC";
import type ESourceLanguage from "../../../../utils/types/ESourceLanguage";

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

  /** Whether this symbol is exported/public */
  readonly isExported: boolean;
}

export default ICBaseSymbol;
