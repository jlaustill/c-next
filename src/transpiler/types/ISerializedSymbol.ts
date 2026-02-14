/**
 * Serialized symbol for JSON storage
 * Uses string values for enums to ensure clean JSON serialization
 * ADR-055 Phase 7: Canonical format for cache storage (no ISymbol intermediate)
 */
interface ISerializedSymbol {
  /** Symbol name */
  name: string;
  /** Kind of symbol (function, variable, type, etc.) */
  kind: string;
  /** Type of the symbol */
  type?: string;
  /** Source file where the symbol is defined */
  sourceFile: string;
  /** Line number in the source file */
  sourceLine: number;
  /** Source language (c, cpp, cnext) */
  sourceLanguage: string;
  /** Whether this symbol is exported/public */
  isExported: boolean;
  /** Whether this is a declaration (not definition) */
  isDeclaration?: boolean;
  /** Function signature for overload detection */
  signature?: string;
  /** Parent namespace or class name */
  parent?: string;
  /** Access modifier for register members */
  accessModifier?: string;
  /** For arrays: element count. For integers: bit width */
  size?: number;
  /** Whether this variable is an array */
  isArray?: boolean;
  /** Array dimensions for extern declarations */
  arrayDimensions?: string[];
  /** Whether this variable is const */
  isConst?: boolean;
  /** Whether this variable is atomic (volatile in C) */
  isAtomic?: boolean;
  /** Initial value for const variables */
  initialValue?: string;
  /** Function parameters for header generation */
  parameters?: Array<{
    name: string;
    type: string;
    isConst: boolean;
    isArray: boolean;
    arrayDimensions?: string[];
  }>;
}

export default ISerializedSymbol;
