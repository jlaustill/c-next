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

  /** Initial value expression (as string) */
  readonly initialValue?: string;
}

export default IVariableSymbol;
