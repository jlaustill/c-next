import ESymbolKind from "../../../utils/types/ESymbolKind";
import IBaseSymbol from "./IBaseSymbol";
import IParameterInfo from "./IParameterInfo";

/**
 * Symbol representing a function definition or declaration.
 */
interface IFunctionSymbol extends IBaseSymbol {
  /** Discriminant for type narrowing */
  kind: ESymbolKind.Function;

  /** Return type (e.g., "void", "u32", "Point") */
  returnType: string;

  /** Function parameters */
  parameters: IParameterInfo[];

  /** Visibility within a scope */
  visibility: "public" | "private";

  /** Full signature for overload detection (e.g., "void foo(int, float)") */
  signature?: string;
}

export default IFunctionSymbol;
