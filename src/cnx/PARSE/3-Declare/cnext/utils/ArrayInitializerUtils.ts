/**
 * ArrayInitializerUtils - array size inference from an initializer.
 * Issue #636: one rule, so a header and its `.c` agree on an omitted size.
 */

import type TExpression from "../../../../types/syntax/TExpression";
import StringUtils from "../../../../utils/StringUtils";

class ArrayInitializerUtils {
  /**
   * The size an omitted dimension takes from its initializer: a listed
   * initializer's element count, or undefined when there is none to count
   * (not an array initializer, an empty one, or the fill-all form `[0*]`,
   * which requires an explicit size).
   *
   * ADR-035: a string literal initializes a `u8` array with its bytes and the
   * terminator (`u8[] message <- "Hello"` is `u8[6]`). Uncounted, the `.h`
   * stated a scalar against the `.c`'s `uint8_t message[] = "Hello"` (#1824
   * review); whether the element type allows a literal is E0866's.
   */
  static getInferredSize(expr: TExpression): number | undefined {
    if (expr.kind === "literal" && expr.literalKind === "string") {
      return StringUtils.literalLength(expr.text) + 1;
    }
    // The fill form lists no elements
    if (expr.kind !== "arrayInitializer" || expr.elements.length === 0) {
      return undefined;
    }
    return expr.elements.length;
  }
}

export default ArrayInitializerUtils;
