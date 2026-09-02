import type IBaseSymbol from "./IBaseSymbol";
import type IParameterInfo from "./IParameterInfo";
import type TType from "../TType";

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

  /** AST reference for function body (unknown to avoid parser dependency) */
  readonly body: unknown;
}

export default IFunctionSymbol;
