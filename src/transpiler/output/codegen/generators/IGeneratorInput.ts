/**
 * Read-only input built before generation begins.
 * Contains all the context a generator needs to produce code.
 * Immutable - generators cannot modify this.
 */
import TTypeInfo from "../types/TTypeInfo";
import IFunctionSignature from "../types/IFunctionSignature";
import ICallbackTypeInfo from "../types/ICallbackTypeInfo";
import ITargetCapabilities from "../types/ITargetCapabilities";
import SymbolTable from "../../../logic/symbols/SymbolTable";
import ICodeGenSymbols from "../../../types/ICodeGenSymbols";

interface IGeneratorInput {
  /** Symbol table from parsed C/C++ headers (may be null for single-file transpilation) */
  readonly symbolTable: SymbolTable | null;

  /** C-Next symbols collected from the parse tree (enums, structs, scopes, etc.) */
  readonly symbols: ICodeGenSymbols | null;

  /** Variable type information indexed by scoped name */
  readonly typeRegistry: ReadonlyMap<string, TTypeInfo>;

  /** Function signatures for parameter validation */
  readonly functionSignatures: ReadonlyMap<string, IFunctionSignature>;

  /** Set of C-Next defined function names */
  readonly knownFunctions: ReadonlySet<string>;

  /** Set of known struct type names */
  readonly knownStructs: ReadonlySet<string>;

  /** Compile-time constant values (for array sizes, etc.) */
  readonly constValues: ReadonlyMap<string, number>;

  /** Callback/function-as-type definitions */
  readonly callbackTypes: ReadonlyMap<string, ICallbackTypeInfo>;

  /** Callback types used as struct field types: "StructName.fieldName" -> callback type name */
  readonly callbackFieldTypes: ReadonlyMap<string, string>;

  /** Target platform capabilities (affects atomic operations, etc.) */
  readonly targetCapabilities: ITargetCapabilities;

  /** Debug mode - affects overflow helper generation */
  readonly debugMode: boolean;
}

export default IGeneratorInput;
