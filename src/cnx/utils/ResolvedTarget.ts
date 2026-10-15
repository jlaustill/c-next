import type ITargetDescription from "../types/ITargetDescription";
import type TRunTarget from "../types/TRunTarget";

/**
 * #1975 review: the run target's description, which a type's width reads --
 * one projection, so analysis and render measure a header type alike.
 */
class ResolvedTarget {
  /** Null while 1.4 has not resolved the target, or it was rejected */
  static of(target: TRunTarget | null | undefined): ITargetDescription | null {
    return target?.kind === "resolved" ? target.description : null;
  }
}

export default ResolvedTarget;
