import ConstantExpression from "./ConstantExpression";
import type TExpression from "../../../types/syntax/TExpression";
import type IAnalysisContext from "../types/IAnalysisContext";

/**
 * Whether a value is zero however it is spelled: `0`, `0x0`, `0b0`, `false`,
 * `!true`, or a const that folds to one, as the name binds where it is
 * written. C zero-fills what an initializer leaves out, so a write-1 register
 * bit (E0872) and an array's fill-all for a size C-Next cannot fold (#2196)
 * both turn on this one fact. The constant evaluator alone decides it: a
 * check of the spelling first (`"false"`, a const's initializer text) would
 * be a second rule for the same value (review of #2155).
 */
class ZeroValue {
  static of(expr: TExpression, context: IAnalysisContext): boolean {
    return ConstantExpression.valueAt(expr, context) === 0;
  }
}

export default ZeroValue;
