import ESymbolKind from "../../types/ESymbolKind";
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

  /** Whether this variable is an array */
  isArray: boolean;

  /** Array dimensions if isArray is true */
  arrayDimensions?: number[];

  /** Initial value expression (as string) */
  initialValue?: string;
}

export default IVariableSymbol;
