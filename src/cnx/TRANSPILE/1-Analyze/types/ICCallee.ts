import type ICParameterInfo from "../../../types/symbols/c/ICParameterInfo";
import type TExpression from "../../../types/syntax/TExpression";

/** A call to a C function by name: what it is passed, and what it takes */
interface ICCallee {
  readonly name: string;
  readonly arguments: readonly TExpression[];
  readonly parameters: ReadonlyArray<ICParameterInfo>;
}

export default ICCallee;
