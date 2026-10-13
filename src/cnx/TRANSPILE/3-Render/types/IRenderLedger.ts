import type IFilePlan from "../../2-Plan/types/IFilePlan";
import type TExpression from "../../../types/syntax/TExpression";
import type TTypeSyntax from "../../../types/syntax/TTypeSyntax";

/**
 * #1991: one render of one file -- the plan 2.3 renders from, and what of it
 * 2.3 has rendered so far, checked against the plan once it is done. Made by
 * `render` and dropped when it returns, so nothing outlives the file.
 */
interface IRenderLedger {
  readonly plan: IFilePlan;
  readonly types: Set<TTypeSyntax>;
  readonly comparisons: Set<TExpression>;
  readonly casts: Set<TExpression>;
  readonly minimums: Set<TExpression>;
  readonly complementCasts: Set<TExpression>;
  readonly structInitializers: Set<TExpression>;
}

export default IRenderLedger;
