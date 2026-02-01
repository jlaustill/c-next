import IBitmapSymbol from "./IBitmapSymbol";
import IEnumSymbol from "./IEnumSymbol";
import IFunctionSymbol from "./IFunctionSymbol";
import IRegisterSymbol from "./IRegisterSymbol";
import IScopeSymbol from "./IScopeSymbol";
import IStructSymbol from "./IStructSymbol";
import IVariableSymbol from "./IVariableSymbol";

/**
 * Discriminated union of all symbol types.
 *
 * Use the `kind` field to narrow to a specific symbol type:
 * ```typescript
 * if (symbol.kind === ESymbolKind.Struct) {
 *   // TypeScript knows symbol is IStructSymbol here
 *   for (const [fieldName, fieldInfo] of symbol.fields) { ... }
 * }
 * ```
 *
 * Or use the type guard functions from typeGuards.ts:
 * ```typescript
 * if (isStructSymbol(symbol)) {
 *   // TypeScript knows symbol is IStructSymbol here
 * }
 * ```
 */
type TSymbol =
  | IStructSymbol
  | IEnumSymbol
  | IBitmapSymbol
  | IFunctionSymbol
  | IVariableSymbol
  | IScopeSymbol
  | IRegisterSymbol;

export default TSymbol;
