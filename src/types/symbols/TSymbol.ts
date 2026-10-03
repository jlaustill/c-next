import type IFunctionSymbol from "./IFunctionSymbol";
import type IScopeSymbol from "./IScopeSymbol";
import type IStructSymbol from "./IStructSymbol";
import type IEnumSymbol from "./IEnumSymbol";
import type IVariableSymbol from "./IVariableSymbol";
import type IBitmapSymbol from "./IBitmapSymbol";
import type IRegisterSymbol from "./IRegisterSymbol";

/**
 * Discriminated union of all C-Next symbol types.
 *
 * Use the `kind` field to narrow to a specific symbol type:
 * ```typescript
 * if (symbol.kind === "struct") {
 *   // TypeScript knows symbol is IStructSymbol here
 * }
 * ```
 *
 * Note: For C and C++ symbols, use TCSymbol and TCppSymbol respectively.
 * These are kept separate because C/C++ symbols have different properties
 * (e.g., no scope reference, string types instead of TType).
 */
type TSymbol =
  | IFunctionSymbol
  | IScopeSymbol
  | IStructSymbol
  | IEnumSymbol
  | IVariableSymbol
  | IBitmapSymbol
  | IRegisterSymbol;

export default TSymbol;
