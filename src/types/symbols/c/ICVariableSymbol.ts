import type ICBaseSymbol from "./ICBaseSymbol";

/**
 * Symbol representing a C variable.
 */
interface ICVariableSymbol extends ICBaseSymbol {
  /** Discriminator narrowed to "variable" */
  readonly kind: "variable";

  /** Variable type as string */
  readonly type: string;

  /** Whether this variable is const */
  readonly isConst?: boolean;

  /** Whether this variable is extern */
  readonly isExtern?: boolean;

  /** Whether this variable is an array */
  readonly isArray?: boolean;

  /** Array dimensions if this is an array */
  readonly arrayDimensions?: ReadonlyArray<number | string>;
}

export default ICVariableSymbol;
