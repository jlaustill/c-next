import type IChainBase from "../../../types/IChainBase";

/**
 * #1731 review: what one assignment's target writes, bound once in 2.2. Both
 * ADR-044's clamp and ADR-045's bounded copy read it, so they cannot disagree
 * about a site.
 */
interface IWrittenTarget {
  /** The target as the one binder binds it */
  readonly target: IChainBase;
  /** No postfix operation: `x`, `this.x` or `global.x`, which name the variable itself */
  readonly isSimple: boolean;
}

export default IWrittenTarget;
