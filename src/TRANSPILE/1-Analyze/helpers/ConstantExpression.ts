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
 * Asking from a scope is ADR-057's candidate order, which
 * `ConstAssignmentAnalyzer.constSymbol`, `RegisterAccessAnalyzer.isFalseConst`
 * and `ShiftAnalyzer.constValue` had each derived separately for const-ness
 * while the VALUE lookups kept the flat one.
 */

import * as Parser from "../../../transpiler/logic/parser/grammar/CNextParser";
import TYPE_WIDTH from "../../../transpiler/constants/TYPE_WIDTH";
import CodeGenState from "../../../transpiler/state/CodeGenState";
import ArrayDimensionParser from "../../../utils/ArrayDimensionParser";

class ConstantExpression {
  /**
   * The expression's integer value as seen from `scopePath`, or null when it
   * is not a compile-time constant here.
   *
   * Null is a real answer, not a failure: a dimension may name a C macro this
   * pass cannot resolve, and a rule that guessed a value for it would report
   * against a bound the C compiler never sees.
   */
  static valueIn(
    expr: Parser.ExpressionContext,
    scopePath: string,
  ): number | null {
    return (
      ArrayDimensionParser.parseSingleDimension(expr, {
        constValues: new Map(
          CodeGenState.program?.constValuesIn(scopePath) ?? [],
        ),
        typeWidths: TYPE_WIDTH,
      }) ?? null
    );
  }
}

export default ConstantExpression;
