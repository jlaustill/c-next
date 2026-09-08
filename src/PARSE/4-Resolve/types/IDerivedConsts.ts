/**
 * Every const's integer value, in the two shapes callers ask for.
 *
 * #1322 review: one flat map was not enough. It is keyed by bare name and, for
 * a scoped const, by its C name too -- so two scopes each declaring `SIZE`
 * shared the bare slot and the last one derived won. That is not a stale value
 * but a WRONG one: it made a legal program fail (an array sized by another
 * scope's const) and made ADR-036's bounds check depend on declaration order,
 * which is the hazard #1399 named arriving through a different map.
 */
interface IDerivedConsts {
  /**
   * Bare name to value, plus the transpiled C name for a scoped const. The
   * bare key means "the file-scope const of that name" wherever one exists,
   * and is what the cross-file lookups of #1220 read.
   */
  readonly flat: ReadonlyMap<string, number>;

  /** Scope path to that scope's own consts, by bare name. */
  readonly byScope: ReadonlyMap<string, ReadonlyMap<string, number>>;
}

export default IDerivedConsts;
