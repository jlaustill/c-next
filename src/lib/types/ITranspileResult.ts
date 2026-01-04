/**
 * Represents an error or warning from the transpiler
 */
export interface ITranspileError {
  /** Line number (1-based) */
  line: number;
  /** Column number (0-based) */
  column: number;
  /** Error message */
  message: string;
  /** Severity: 'error' or 'warning' */
  severity: "error" | "warning";
}

/**
 * Result of transpiling C-Next source to C
 */
export interface ITranspileResult {
  /** Whether transpilation succeeded without errors */
  success: boolean;
  /** Generated C code (empty string if failed) */
  code: string;
  /** List of errors and warnings */
  errors: ITranspileError[];
  /** Number of top-level declarations found */
  declarationCount: number;
}

/**
 * Symbol kind for IDE features
 */
export type TSymbolKind =
  | "namespace"
  | "class"
  | "struct"
  | "register"
  | "function"
  | "variable"
  | "registerMember"
  | "field"
  | "method";

/**
 * Symbol information for IDE features (autocomplete, hover)
 * Simplified version of ISymbol for extension use
 */
export interface ISymbolInfo {
  /** Symbol name (e.g., "toggle", "DR_SET") - local name without parent prefix */
  name: string;
  /** Full qualified name (e.g., "LED_toggle", "GPIO7_DR_SET") */
  fullName: string;
  /** Kind of symbol */
  kind: TSymbolKind;
  /** Type of the symbol (e.g., "void", "u32") */
  type?: string;
  /** Parent namespace/class/register name */
  parent?: string;
  /** Function signature (e.g., "void toggle()") */
  signature?: string;
  /** Access modifier for register members (rw, ro, wo, w1c, w1s) */
  accessModifier?: string;
  /** Line number in source (1-based) */
  line: number;
  /** Array size or bit width */
  size?: number;
}

/**
 * Result of parsing with symbol extraction
 */
export interface IParseWithSymbolsResult {
  /** Whether parsing succeeded without errors */
  success: boolean;
  /** List of errors and warnings */
  errors: ITranspileError[];
  /** Extracted symbols */
  symbols: ISymbolInfo[];
}

export default ITranspileResult;
