import TSymbolKind from "./TSymbolKind";

/**
 * Symbol information for IDE features (autocomplete, hover)
 * Simplified version of ISymbol for extension use
 */
interface ISymbolInfo {
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

export default ISymbolInfo;
