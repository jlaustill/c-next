/**
 * DimensionResolver - resolves one array dimension expression during symbol
 * collection.
 *
 * Issue #1127: VariableCollector and StructCollector each carried their own
 * version of this, and they disagreed. Both now resolve through this one
 * function.
 *
 * #1175: a dimension that needs a name is recorded as WRITTEN, as a
 * `TConstExpr`, and 1.4 Resolve settles it where the declaration is written.
 * It used to be recorded as its `getText()`, which joins tokens with no
 * separator, so the text that reached the header could be different tokens
 * (`1 - -1` became `1--1`) or name what C cannot see (`(LOCAL)`, `u32`).
 */

import * as Parser from "../../../2-Parse/grammar/CNextParser";
import ConstExprLowering from "../../../../utils/ConstExprLowering";
import SyntaxLowering from "../../../2-Parse/SyntaxLowering";
import ConstantEvaluator from "../../../../utils/ConstantEvaluator";
import invariant from "../../../../utils/invariant";
import UNRESOLVED_DIMENSION from "../../../../types/UNRESOLVED_DIMENSION";
import type IConstantEnvironment from "../../../../utils/types/IConstantEnvironment";
import type IDeclaredDimension from "../types/IDeclaredDimension";

/** 1.3 binds no name: every name waits for 1.4 */
const NO_NAMES: IConstantEnvironment = {
  valueOf: (name) => ({
    kind: "notConstant",
    reason: "unknown",
    spelling: name.path.join("."),
    at: name.at,
  }),
  // 1.3 only folds what needs no name; writing C for the rest is 1.4's
  cTypeName: (typeName): string => {
    invariant(false, `1.3 writes no constant expression as C: ${typeName}`);
  },
};

class DimensionResolver {
  /**
   * Resolve one array dimension expression.
   *
   * A dimension that needs no name (a literal, arithmetic over literals,
   * `sizeof` of a primitive) folds here, by the one evaluator. Anything else
   * is kept as written for 1.4, which binds its names where the declaration
   * is written (#1664 box 7).
   */
  static resolve(sizeExpr: Parser.ExpressionContext): IDeclaredDimension {
    const expr = ConstExprLowering.lower(SyntaxLowering.expression(sizeExpr));
    const result = ConstantEvaluator.evaluate(expr, NO_NAMES);
    const size =
      result.kind === "value"
        ? ConstantEvaluator.toNumber(result.value)
        : undefined;
    return size === undefined
      ? { size: UNRESOLVED_DIMENSION, expr }
      : { size, expr: null };
  }
}

export default DimensionResolver;
