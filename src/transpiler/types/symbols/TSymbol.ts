import type IFunctionSymbol from "./IFunctionSymbol";
import type IScopeSymbol from "./IScopeSymbol";
import type IStructSymbol from "./IStructSymbol";
import type IEnumSymbol from "./IEnumSymbol";
import type IVariableSymbol from "./IVariableSymbol";
import type IBitmapSymbol from "./IBitmapSymbol";
import type IRegisterSymbol from "./IRegisterSymbol";

/**
 * Discriminated union of all symbol types.
 *
 * Use the `kind` field to narrow to a specific symbol type:
 * ```typescript
 * if (symbol.kind === "struct") {
 *   // TypeScript knows symbol is IStructSymbol here
 * }
 * ```
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
