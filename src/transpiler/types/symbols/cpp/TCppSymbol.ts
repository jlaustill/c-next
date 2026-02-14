import type ICppClassSymbol from "./ICppClassSymbol";
import type ICppStructSymbol from "./ICppStructSymbol";
import type ICppNamespaceSymbol from "./ICppNamespaceSymbol";
import type ICppEnumSymbol from "./ICppEnumSymbol";
import type ICppEnumMemberSymbol from "./ICppEnumMemberSymbol";
import type ICppFunctionSymbol from "./ICppFunctionSymbol";
import type ICppVariableSymbol from "./ICppVariableSymbol";
import type ICppTypeAliasSymbol from "./ICppTypeAliasSymbol";

/**
 * Discriminated union of all C++ language symbol types.
 *
 * Use the `kind` field to narrow to a specific symbol type:
 * ```typescript
 * if (symbol.kind === "class") {
 *   // TypeScript knows symbol is ICppClassSymbol here
 * }
 * ```
 */
type TCppSymbol =
  | ICppClassSymbol
  | ICppStructSymbol
  | ICppNamespaceSymbol
  | ICppEnumSymbol
  | ICppEnumMemberSymbol
  | ICppFunctionSymbol
  | ICppVariableSymbol
  | ICppTypeAliasSymbol;

export default TCppSymbol;
