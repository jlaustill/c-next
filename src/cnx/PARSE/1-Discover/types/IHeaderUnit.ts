import type ISourceSite from "../../../types/ISourceSite";

/**
 * Issue #985: every C header the `.cnx` files include, as a translation unit
 * includes it, deduped in first-seen source order.
 */
interface IHeaderUnit {
  readonly directives: readonly string[];

  /** #1844: per directive, each file's first include that wrote it */
  readonly sites: ReadonlyMap<string, readonly ISourceSite[]>;

  /**
   * #1755: each `<...>` directive the walk found no file for. Only the
   * compiler's own search path finds it, so 1.2 reads the unit whole.
   */
  readonly unresolvedSystem: readonly string[];
}

export default IHeaderUnit;
