import ESymbolKind from "./ESymbolKind";
import ESourceLanguage from "./ESourceLanguage";

/**
 * Represents a symbol collected from a source file
 */
interface ISymbol {
  /** Symbol name (e.g., "LED_toggle", "GPIO7", "uint32_t") */
  name: string;

  /** Kind of symbol */
  kind: ESymbolKind;

  /** Type of the symbol (e.g., "void", "u32", "int*") */
  type?: string;

  /** Source file where the symbol is defined */
  sourceFile: string;

  /** Line number in the source file */
  sourceLine: number;

  /** Source language */
  sourceLanguage: ESourceLanguage;

  /** Whether this symbol is exported/public */
  isExported: boolean;

  /** Whether this is a declaration (not definition) */
  isDeclaration?: boolean;

  /** Function signature for overload detection (e.g., "void foo(int, float)") */
  signature?: string;

  /** Function parameters with names, types, and modifiers for header generation */
  parameters?: Array<{
    name: string;
    type: string; // C-Next type (u32, Configuration, etc.)
    isConst: boolean;
    isArray: boolean;
    arrayDimensions?: string[]; // e.g., ["10", "20"] or ["", ""] for unbounded
    isAutoConst?: boolean; // Issue #268: true if parameter should get auto-const (unmodified pointer)
  }>;

  /** Parent namespace or class name */
  parent?: string;

  /** Access modifier for register members (rw, ro, wo, w1c, w1s) */
  accessModifier?: string;

  /** For arrays: element count. For integers: bit width */
  size?: number;

  /** Issue #379: Whether this variable is an array */
  isArray?: boolean;

  /** Issue #379: Array dimensions for extern declarations (e.g., ["4"] or ["4", "8"]) */
  arrayDimensions?: string[];

  /** Issue #288: Whether this variable is const (for extern declarations) */
  isConst?: boolean;

  /** Issue #468: Whether this variable is atomic (volatile in C) */
  isAtomic?: boolean;

  /** Issue #461: Initial value expression for const variables (for resolving external array dimensions) */
  initialValue?: string;
}

export default ISymbol;
