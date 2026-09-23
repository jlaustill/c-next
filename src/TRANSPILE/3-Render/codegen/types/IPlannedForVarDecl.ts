/**
 * A variable declared in a `for` header: `for (u32 i <- 0; ...)`.
 *
 * `typeName` is eager because it is unconditional -- every `for` variable has
 * a declared type and it is rendered before anything else here, including
 * before the name is registered. Keeping it eager preserves that: the plan is
 * built where the generator used to start, so "before registration" still
 * holds.
 *
 * The other two are thunks because the generator registers the local variable
 * between them and the type. Registration is what gives back the EMITTED name
 * (ADR-057) -- a `for` variable shadowing a file-scope name moves, so
 * `global.x` in the body still reaches past it -- and an initializer rendered
 * ahead of that registration would resolve the loop variable's own name
 * against the outer scope.
 */
interface IPlannedForVarDecl {
  /** Rendered `atomic`/`volatile` prefixes, each with its trailing space or "". */
  readonly atomic: string;
  readonly volatile: string;
  /** The declared C type, already rendered. */
  readonly typeName: string;
  /** The identifier AS WRITTEN. The generator registers it to get the emitted one. */
  readonly declaredName: string;
  /** ADR-036 dimensions, or null when the declaration is not an array. */
  readonly renderArrayDimensions: (() => string) | null;
  /**
   * The initializer, rendered with the declared type as its expected type.
   *
   * Null when the header declares without initializing. The expected type is a
   * parameter rather than a captured value so the one fact -- `typeName` --
   * has one home on this record (#1277: without it a struct literal in a `for`
   * header was rejected as "Cannot infer struct type").
   */
  readonly renderInitializer: ((expectedType: string) => string) | null;
}

export default IPlannedForVarDecl;
