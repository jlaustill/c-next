import type IBaseSymbol from "./IBaseSymbol";
import type TType from "../TType";

/**
 * Symbol representing a variable (global, static, or extern).
 */
interface IVariableSymbol extends IBaseSymbol {
  /** Discriminator narrowed to "variable" */
  readonly kind: "variable";

  /** Variable type */
  readonly type: TType;

  /** Whether this variable is const */
  readonly isConst: boolean;

  /** Whether this variable is atomic (volatile in C) */
  readonly isAtomic: boolean;

  /**
   * Whether this variable carries an explicit `volatile` modifier.
   *
   * Resolved here, once, so the `.c` definition and the `.h` declaration cannot
   * disagree: the header used to hardcode this false, which is a "conflicting
   * type qualifiers" error as soon as the `.c` includes its own header.
   */
  readonly isVolatile: boolean;

  /** Whether this variable is an array */
  readonly isArray: boolean;

  /** Array dimensions if isArray is true - numbers for resolved, strings for macros */
  readonly arrayDimensions?: ReadonlyArray<number | string>;

  /** Initial value expression (as string) */
  readonly initialValue?: string;
}

export default IVariableSymbol;
