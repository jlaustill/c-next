import type IBaseSymbol from "./IBaseSymbol";
import type IScopeSymbol from "./IScopeSymbol";
import type IParameterInfo from "./IParameterInfo";
import type TType from "../TType";
import type TVisibility from "../TVisibility";

/**
 * Symbol representing a function definition.
 */
interface IFunctionSymbol extends IBaseSymbol {
  /** Discriminator narrowed to "function" */
  readonly kind: "function";

  /** Scope this function belongs to (overrides IBaseSymbol.scope with specific type) */
  readonly scope: IScopeSymbol;

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
