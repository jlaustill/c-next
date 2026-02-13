import type IBaseSymbol from "./IBaseSymbol";
import type IParameterInfo from "./IParameterInfo";
import type TType from "../TType";
import type TVisibility from "../TVisibility";

/**
 * Symbol representing a function definition.
 */
interface IFunctionSymbol extends IBaseSymbol {
  /** Discriminator narrowed to "function" */
  readonly kind: "function";

  /** Function parameters */
  readonly parameters: ReadonlyArray<IParameterInfo>;

  /** Return type */
  readonly returnType: TType;

  /** Visibility within scope */
  readonly visibility: TVisibility;

  /** AST reference for function body (unknown to avoid parser dependency) */
  readonly body: unknown;
}

export default IFunctionSymbol;
