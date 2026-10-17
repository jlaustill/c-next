import type ICParameterInfo from "../../../types/symbols/c/ICParameterInfo";
import type ICppParameterInfo from "../../../types/symbols/cpp/ICppParameterInfo";

/** One declaration a call to a C (or C++) function may reach: what it takes */
interface ICCalleeSignature {
  readonly parameters: ReadonlyArray<ICParameterInfo | ICppParameterInfo>;
  /** Arguments past `parameters` fill the callee's `...` */
  readonly isVariadic: boolean;
}

export default ICCalleeSignature;
