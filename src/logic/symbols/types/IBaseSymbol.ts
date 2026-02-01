import ESourceLanguage from "../../../utils/types/ESourceLanguage";

/**
 * Common fields shared by all symbol types.
 * Extracted from ISymbol to provide a typed base for discriminated union members.
 */
interface IBaseSymbol {
  /** Symbol name (e.g., "LED_toggle", "GPIO7", "Point") */
  name: string;

  /** Source file where the symbol is defined */
  sourceFile: string;

  /** Line number in the source file */
  sourceLine: number;

  /** Source language (CNext, C, Cpp) */
  sourceLanguage: ESourceLanguage;

  /** Whether this symbol is exported/public */
  isExported: boolean;
}

export default IBaseSymbol;
