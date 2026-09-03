import type TSymbolKindCpp from "../../symbol-kinds/TSymbolKindCpp";
import type ESourceLanguage from "../../../../utils/types/ESourceLanguage";
import type TVisibility from "../../TVisibility";

/**
 * Base interface for all C++ language symbol types.
 * C++ symbols use simple strings for types since they pass through to codegen unchanged.
 */
interface ICppBaseSymbol {
  /** Symbol kind - discriminator for type narrowing */
  readonly kind: TSymbolKindCpp;

  /** Symbol name */
  readonly name: string;

  /** Source file where the symbol is defined */
  readonly sourceFile: string;

  /** Line number in the source file */
  readonly sourceLine: number;

  /** Source language - always Cpp for C++ symbols */
  readonly sourceLanguage: ESourceLanguage.Cpp;

  /** Visibility as declared. Interop symbols are always public — a header included by
   * C-Next has no notion of a private declaration. */
  readonly visibility: TVisibility;

  /** Parent namespace or class name */
  readonly parent?: string;
}

export default ICppBaseSymbol;
