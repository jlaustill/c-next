/**
 * DimensionResolver - resolves one array dimension expression during symbol
 * collection.
 *
 * Issue #1127: VariableCollector and StructCollector each carried their own
 * version of this, and they disagreed. StructCollector accepted only a bare
 * literal or a bare const and dropped everything else, so
 * `struct { u8[8+1] data; }` reached the header as a scalar. VariableCollector
 * kept unresolved text but folded nothing beyond a literal or a const, so
 * `u8[sizeof(u32)] sz;` put a C-Next type name into the generated C header:
 *
 *   .c   uint8_t sz[4]
 *   .h   extern uint8_t sz[sizeof(u32)]     error: 'u32' undeclared here
 *
 * Both now resolve through this one function, which folds through the same
 * ArrayDimensionParser and TYPE_WIDTH table codegen uses.
 */

import * as Parser from "../../../parser/grammar/CNextParser";
import ArrayDimensionParser from "../../../../../utils/ArrayDimensionParser";
import TYPE_WIDTH from "../../../../constants/TYPE_WIDTH";

class DimensionResolver {
  /**
   * Resolve one array dimension expression.
   *
   * @param sizeExpr The dimension expression
   * @param constValues Const name -> value, as known at collection time
   * @returns The folded size, or the expression's source text when it does not
   *          fold at compile time (an enum-qualified count, or a C macro).
   *          Never undefined: dropping a dimension loses the field's
   *          array-ness and shifts every dimension after it.
   */
  static resolve(
    sizeExpr: Parser.ExpressionContext,
    constValues?: Map<string, number>,
  ): number | string {
    const folded = ArrayDimensionParser.parseSingleDimension(sizeExpr, {
      constValues,
      typeWidths: TYPE_WIDTH,
    });
    return folded ?? sizeExpr.getText();
  }
}

export default DimensionResolver;
