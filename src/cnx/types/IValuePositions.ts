import type IValuePosition from "./IValuePosition";
import type IValueSite from "./IValueSite";
import type TExpression from "./syntax/TExpression";

/** 2.1's one walk of where each value stands (#1991) */
interface IValuePositions {
  /** What each value's position says about it, for 2.1's rules */
  readonly positions: ReadonlyMap<TExpression, IValuePosition>;
  /** The site each value is rendered against, for 2.2's expected types */
  readonly sites: ReadonlyMap<TExpression, IValueSite>;
}

export default IValuePositions;
