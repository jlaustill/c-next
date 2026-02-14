import type ICppBaseSymbol from "./ICppBaseSymbol";
import type ICppParameterInfo from "./ICppParameterInfo";

/**
 * Symbol representing a C++ function or method.
 */
interface ICppFunctionSymbol extends ICppBaseSymbol {
  /** Discriminator narrowed to "function" */
  readonly kind: "function";

  /** Return type as string */
  readonly type: string;

  /** Function parameters */
  readonly parameters?: ReadonlyArray<ICppParameterInfo>;

  /** Whether this is a declaration vs definition */
  readonly isDeclaration?: boolean;
}

export default ICppFunctionSymbol;
