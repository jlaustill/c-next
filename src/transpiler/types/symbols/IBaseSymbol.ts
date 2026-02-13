import type TSymbolKindCNext from "../symbol-kinds/TSymbolKindCNext";
import type ESourceLanguage from "../../../utils/types/ESourceLanguage";

/**
 * Base interface for all symbol types.
 * All concrete symbol interfaces extend this with a narrowed `kind` literal.
 */
interface IBaseSymbol {
  /** Symbol kind - discriminator for type narrowing */
  readonly kind: TSymbolKindCNext;

  /** Symbol name */
  readonly name: string;

  /** Scope this symbol belongs to (circular reference resolved at runtime) */
  readonly scope: IBaseSymbol;

  /** Source file where the symbol is defined */
  readonly sourceFile: string;

  /** Line number in the source file */
  readonly sourceLine: number;

  /** Source language (CNext, C, Cpp) */
  readonly sourceLanguage: ESourceLanguage;

  /** Whether this symbol is exported/public */
  readonly isExported: boolean;
}

export default IBaseSymbol;
