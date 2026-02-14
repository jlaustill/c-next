import type TSymbol from "./TSymbol";
import type TCSymbol from "./c/TCSymbol";
import type TCppSymbol from "./cpp/TCppSymbol";

/**
 * Union of all symbol types across all supported languages (C-Next, C, C++).
 *
 * Use this type when handling symbols that could come from any source file type:
 * - C-Next (.cnx) → TSymbol
 * - C (.c, .h) → TCSymbol
 * - C++ (.cpp, .hpp) → TCppSymbol
 *
 * The `sourceLanguage` field can be used to narrow the type:
 * ```typescript
 * if (symbol.sourceLanguage === ESourceLanguage.CNext) {
 *   // TypeScript knows symbol is TSymbol here
 * }
 * ```
 */
type TAnySymbol = TSymbol | TCSymbol | TCppSymbol;

export default TAnySymbol;
