import type ICBaseSymbol from "./ICBaseSymbol";
import type ICParameterInfo from "./ICParameterInfo";

/**
 * Symbol representing a C function definition or declaration.
 */
interface ICFunctionSymbol extends ICBaseSymbol {
  /** Discriminator narrowed to "function" */
  readonly kind: "function";

  /** Return type as string */
  readonly type: string;

  /** Function parameters */
  readonly parameters?: ReadonlyArray<ICParameterInfo>;

  /** Whether this is a declaration (prototype) vs definition */
  readonly isDeclaration?: boolean;
}

export default ICFunctionSymbol;
