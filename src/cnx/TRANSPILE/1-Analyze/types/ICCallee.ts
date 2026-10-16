import type TExpression from "../../../types/syntax/TExpression";
import type ICCalleeSignature from "./ICCalleeSignature";

/** A call to a C (or C++) function: what it is passed, and what it may reach */
interface ICCallee {
  readonly name: string;
  readonly arguments: readonly TExpression[];
  /** Each declaration the call may reach: one, or a C++ overload set */
  readonly signatures: readonly ICCalleeSignature[];
}

export default ICCallee;
