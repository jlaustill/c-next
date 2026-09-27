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
 * enclosing scope, then file scope -- which
 * `ConstAssignmentAnalyzer.constSymbol`, `RegisterAccessAnalyzer.isFalseConst`
 * and `ShiftAnalyzer.constValue` had each derived separately for const-ness
 * while the VALUE lookups kept the flat one.
 */

import * as Parser from "../../../PARSE/2-Parse/grammar/CNextParser";
import TYPE_WIDTH from "../../../transpiler/constants/TYPE_WIDTH";
import ArrayDimensionParser from "../../../utils/ArrayDimensionParser";
import type { ParserRuleContext } from "antlr4ng";
import ParserUtils from "../../../utils/ParserUtils";
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
      ArrayDimensionParser.parseSingleDimension(expr, {
        constValues: ConstantExpression.visibleAt(expr, context),
        typeWidths: TYPE_WIDTH,
      }) ?? null
    );
  }

  /** The const values visible at `node`, as 1.4 settled them */
  static visibleAt(
    node: ParserRuleContext,
    context: IAnalysisContext,
  ): ReadonlyMap<string, number> {
    return context.program.constValuesAt(
      context.sourceFile,
      ParserUtils.getPosition(node),
    );
  }
}

export default ConstantExpression;
