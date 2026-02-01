import ESymbolKind from "../../../../utils/types/ESymbolKind";
import IBaseSymbol from "./IBaseSymbol";

/**
 * Symbol representing a variable (global, static, or extern).
 */
interface IVariableSymbol extends IBaseSymbol {
  /** Discriminant for type narrowing */
  kind: ESymbolKind.Variable;

  /** C-Next type (e.g., "u32", "Point") */
  type: string;

  /** Whether this variable is const */
  isConst: boolean;

  /** Issue #468: Whether this variable is atomic (volatile in C) */
  isAtomic: boolean;

  /** Whether this variable is an array */
  isArray: boolean;

  /** Array dimensions if isArray is true - numbers for resolved dimensions, strings for macros */
  arrayDimensions?: (number | string)[];

  /** Initial value expression (as string) */
  initialValue?: string;
}

export default IVariableSymbol;
