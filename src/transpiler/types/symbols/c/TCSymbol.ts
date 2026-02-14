import type ICStructSymbol from "./ICStructSymbol";
import type ICEnumSymbol from "./ICEnumSymbol";
import type ICEnumMemberSymbol from "./ICEnumMemberSymbol";
import type ICFunctionSymbol from "./ICFunctionSymbol";
import type ICVariableSymbol from "./ICVariableSymbol";
import type ICTypedefSymbol from "./ICTypedefSymbol";

/**
 * Discriminated union of all C language symbol types.
 *
 * Use the `kind` field to narrow to a specific symbol type:
 * ```typescript
 * if (symbol.kind === "struct") {
 *   // TypeScript knows symbol is ICStructSymbol here
 * }
 * ```
 */
type TCSymbol =
  | ICStructSymbol
  | ICEnumSymbol
  | ICEnumMemberSymbol
  | ICFunctionSymbol
  | ICVariableSymbol
  | ICTypedefSymbol;

export default TCSymbol;
