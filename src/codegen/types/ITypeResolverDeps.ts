/**
 * Dependencies for TypeResolver - allows TypeResolver to be independent of CodeGenerator
 * Issue #61: Extracted dependencies for better separation of concerns
 */
import ISymbolInfo from "../generators/ISymbolInfo";
import SymbolTable from "../../symbol_resolution/SymbolTable";
import TTypeInfo from "./TTypeInfo";

interface ITypeResolverDeps {
  /** Symbol information from C-Next source (ADR-055: ISymbolInfo) */
  symbols: ISymbolInfo | null;

  /** Symbol table for C header struct lookups */
  symbolTable: SymbolTable | null;

  /** Type registry for variable type information */
  typeRegistry: Map<string, TTypeInfo>;

  /** Callback to resolve identifiers to scoped names */
  resolveIdentifier: (name: string) => string;
}

export default ITypeResolverDeps;
