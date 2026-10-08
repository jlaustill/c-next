/**
 * What a dimension-or-index expression is worth, as seen from a scope.
 *
 * #1322 review: five analyzers each wrote this out --
 * `ArrayDeclarationAnalyzer`, `ArrayIndexBoundsAnalyzer`,
 * `SliceAssignmentAnalyzer`, `StringDeclarationAnalyzer` and
 * `RegisterAccessAnalyzer` -- and all five asked `Program.constValues()`, the
 * flat map. Its bare key is shared by every scope declaring that name, so the
 * answer was whichever scope the resolver derived LAST.
 *
 * That is not a stale value but a wrong one, and it was observable in both
 * directions: a legal program was rejected (`Small.table` sized by
 * `Large.SIZE`), and ADR-036's bounds check turned on and off when two scope
 * declarations were swapped -- the order-dependent diagnostic these analyzers'
 * own comments cite #1399 for, arriving through a different map.
 *
 * Asking from a position is ADR-057's candidate order -- locals, then the
 * enclosing scope, then file scope -- and it is the program's one binder that
 * walks it (`ConstantFold.at`), the same binder typing uses. A name bound to
 * a variable, a parameter or an unfolded const has no value, so it shadows a
 * folded const of the same name instead of letting that one answer (#1664
 * review).
 */

import * as Parser from "../../../PARSE/2-Parse/grammar/CNextParser";
import ConstExprLowering from "../../../utils/ConstExprLowering";
import SyntaxLowering from "../../../PARSE/2-Parse/SyntaxLowering";
import ConstantFold from "../../../utils/ConstantFold";
import type IAnalysisContext from "../types/IAnalysisContext";

class ConstantExpression {
  /**
   * The expression's integer value where it is written, or null when it is
   * not a compile-time constant there.
   *
   * #1664 box 7: "where it is written" includes the locals declared before
   * it. Asking only the enclosing scope (`constValuesIn`) missed a local
   * `const N <- 2`, so `u8[N] buf` was bounded by the global `N` and
   * `buf[5]` passed ADR-036's check against a two-element array.
   *
   * Null is a real answer, not a failure: a dimension may name a C macro this
   * pass cannot resolve, and a rule that guessed a value for it would report
   * against a bound the C compiler never sees.
   */
  static valueAt(
    expr: Parser.ExpressionContext,
    context: IAnalysisContext,
  ): number | null {
    return (
      ConstExprLowering.valueOf(
        SyntaxLowering.expression(expr),
        ConstantFold.environment(context.program, context.sourceFile),
      ) ?? null
    );
  }
}

export default ConstantExpression;
