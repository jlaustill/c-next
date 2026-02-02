/**
 * Represents a function parameter symbol
 */
interface IParameterSymbol {
  name: string;
  type: string; // C-Next type (u32, Configuration, etc.)
  isConst: boolean;
  isArray: boolean;
  arrayDimensions?: string[]; // e.g., ["10", "20"] or ["", ""] for unbounded
  isAutoConst?: boolean; // Issue #268: true if parameter should get auto-const (unmodified pointer)
}

export default IParameterSymbol;
