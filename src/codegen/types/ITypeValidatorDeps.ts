/**
 * Dependencies for TypeValidator - allows TypeValidator to be independent of CodeGenerator
 * Issue #63: Extracted dependencies for better separation of concerns
 */
import SymbolCollector from "../SymbolCollector";
import SymbolTable from "../../symbols/SymbolTable";
import TTypeInfo from "./TTypeInfo";
import TParameterInfo from "./TParameterInfo";
import ICallbackTypeInfo from "./ICallbackTypeInfo";
import TypeResolver from "../TypeResolver";

interface ITypeValidatorDeps {
  /** Symbol information from C-Next source (Issue #60) */
  symbols: SymbolCollector | null;

  /** Symbol table for C header struct lookups */
  symbolTable: SymbolTable | null;

  /** Type registry for variable type information */
  typeRegistry: Map<string, TTypeInfo>;

  /** Type resolver for type checking operations (Issue #61) */
  typeResolver: TypeResolver;

  /** Callback type definitions for signature validation */
  callbackTypes: Map<string, ICallbackTypeInfo>;

  /** Known function names in the program */
  knownFunctions: Set<string>;

  /** Known global variable names */
  knownGlobals: Set<string>;

  /** Callback to get current scope name */
  getCurrentScope: () => string | null;

  /** Callback to get scope members map */
  getScopeMembers: () => Map<string, Set<string>>;

  /** Callback to get current function parameters */
  getCurrentParameters: () => Map<string, TParameterInfo>;

  /** Callback to get local variables in current function */
  getLocalVariables: () => Set<string>;

  /** Callback to resolve identifiers to scoped names */
  resolveIdentifier: (name: string) => string;

  /** Callback to get expression type */
  getExpressionType: (ctx: unknown) => string | null;
}

export default ITypeValidatorDeps;
