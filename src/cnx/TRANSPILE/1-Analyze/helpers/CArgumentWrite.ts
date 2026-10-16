import OperandTyper from "../../../utils/OperandTyper";
import CPointerParameter from "../../../utils/CPointerParameter";
import type TExpression from "../../../types/syntax/TExpression";
import type IAnalysisContext from "../types/IAnalysisContext";
import type ICCallee from "../types/ICCallee";

/**
 * Whether a C callee may write what one argument hands it (ADR-071 Decision
 * 2): a parameter it can write through, or -- past a variadic callee's
 * declared parameters, where C says nothing -- an argument passed as an
 * address: `&x`, or an array or string, which C passes as a pointer to its
 * first element. `sscanf("5", "%d", &x)` writes `x`. E0899's write tracking
 * and E0900's check read this one answer.
 */
class CArgumentWrite {
  static mayWrite(
    callee: ICCallee,
    index: number,
    context: IAnalysisContext,
  ): boolean {
    const parameter = callee.parameters[index];
    if (parameter !== undefined) {
      return CPointerParameter.writesThrough(parameter);
    }
    return (
      callee.isVariadic &&
      CArgumentWrite.isPassedByAddress(callee.arguments[index], context)
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
