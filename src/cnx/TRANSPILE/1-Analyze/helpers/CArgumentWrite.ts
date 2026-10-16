import OperandTyper from "../../../utils/OperandTyper";
import CPointerParameter from "../../../utils/CPointerParameter";
import type TExpression from "../../../types/syntax/TExpression";
import type IAnalysisContext from "../types/IAnalysisContext";
import CCallee from "./CCallee";
import type ICCallee from "../types/ICCallee";

/**
 * Whether a C callee may write what one argument hands it (ADR-071 Decision
 * 2): a parameter it can write through, or -- past a variadic callee's
 * declared parameters, where C says nothing -- an argument passed as an
 * address: `&x`, or an array or string, which C passes as a pointer to its
 * first element. `sscanf("5", "%d", &x)` writes `x`. A C++ overload set
 * writes it when every overload the call can reach does: a `const` one is
 * the one a read-only argument calls. E0899's write tracking and E0900's
 * check read this one answer.
 */
class CArgumentWrite {
  static mayWrite(
    callee: ICCallee,
    index: number,
    context: IAnalysisContext,
  ): boolean {
    const reached = CCallee.reachable(callee);
    const arg = callee.arguments[index];
    return (
      reached.length > 0 &&
      reached.every((signature) => {
        const parameter = signature.parameters[index];
        if (parameter !== undefined) {
          return CPointerParameter.writesThrough(parameter);
        }
        return (
          signature.isVariadic && CArgumentWrite.isPassedByAddress(arg, context)
        );
      })
    );
  }

  /** `&x`, an array or a string: C receives where the value lives */
  static isPassedByAddress(
    arg: TExpression,
    context: IAnalysisContext,
  ): boolean {
    if (arg.kind === "unary" && arg.operator === "&") return true;
    const typed = OperandTyper.typeOf(arg, context);
    return (
      typed !== null &&
      (typed.dimensions.length > 0 || typed.stringCapacity !== null)
    );
  }
}

export default CArgumentWrite;
