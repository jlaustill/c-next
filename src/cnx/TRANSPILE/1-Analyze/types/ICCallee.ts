import type ICParameterInfo from "../../../types/symbols/c/ICParameterInfo";
import type ICppParameterInfo from "../../../types/symbols/cpp/ICppParameterInfo";
import type TExpression from "../../../types/syntax/TExpression";

/** A call to a C (or C++) function by name: what it is passed, and what it takes */
interface ICCallee {
  readonly name: string;
  readonly arguments: readonly TExpression[];
  readonly parameters: ReadonlyArray<ICParameterInfo | ICppParameterInfo>;
  /** Arguments past `parameters` fill the callee's `...` */
  readonly isVariadic: boolean;
}

export default ICCallee;
