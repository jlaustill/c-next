import type ICppBaseSymbol from "./ICppBaseSymbol";

/**
 * Symbol representing a C++ variable.
 */
interface ICppVariableSymbol extends ICppBaseSymbol {
  /** Discriminator narrowed to "variable" */
  readonly kind: "variable";

  /** Variable type as string */
  readonly type: string;

  /** Whether this variable is const */
  readonly isConst?: boolean;

  /** Whether this variable is an array */
  readonly isArray?: boolean;

  /** Array dimensions if this is an array */
  readonly arrayDimensions?: ReadonlyArray<number | string>;
}

export default ICppVariableSymbol;
