/**
 * Dependencies for TypeResolver - allows TypeResolver to be independent of CodeGenerator
 * Issue #61: Extracted dependencies for better separation of concerns
 */
import SymbolCollector from "../SymbolCollector";
import SymbolTable from "../../symbols/SymbolTable";
import TTypeInfo from "./TTypeInfo";

interface ITypeResolverDeps {
  /** Symbol information from C-Next source (Issue #60) */
  symbols: SymbolCollector | null;

  /** Symbol table for C header struct lookups */
  symbolTable: SymbolTable | null;

  /** Type registry for variable type information */
  typeRegistry: Map<string, TTypeInfo>;

  /** Callback to resolve identifiers to scoped names */
  resolveIdentifier: (name: string) => string;
}

export default ITypeResolverDeps;
