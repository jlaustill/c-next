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

  /**
   * #1789: whether disabling interrupts gives this target a critical section
   * -- the one answer `critical` (E0916) and an atomic read-modify-write's form
   * both read. Null, a target 1.4 rejected and already reported, counts as
   * able, so it draws no second error.
   */
  static masksInterrupts(description: ITargetDescription | null): boolean {
    return description?.interrupt_mask !== false;
  }
}

export default ResolvedTarget;
