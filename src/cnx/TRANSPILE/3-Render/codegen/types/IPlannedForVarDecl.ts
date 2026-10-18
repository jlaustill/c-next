/**
 * A variable declared in a `for` header: `for (u32 i <- 0; ...)`.
 *
 * `typeName` is eager because it is unconditional -- every `for` variable has
 * a declared type and it is rendered before anything else here. The
 * initializer is a thunk, so it renders where the generator writes it, after
 * the type. There are no dimensions: 1.2 rejects an array or a
 * string here (E0917, #1823).
 */
interface IPlannedForVarDecl {
  /** Rendered `atomic`/`volatile` prefixes, each with its trailing space or "". */
  readonly const: string;
  readonly atomic: string;
  readonly volatile: string;
  /** The declared C type, already rendered. */
  readonly typeName: string;
  /** #1934: the C identifier it is emitted under, as 1.4 settled it (ADR-057) */
  readonly emittedName: string;
  /** #1643 review: why `emittedName` moved, above the `for` (ADR-057) */
  readonly nameMoveComments: string;
  /**
   * The initializer, written against the declared type, which 2.2 planned for
   * it (#1277: without it a struct literal in a `for` header was rejected as
   * "Cannot infer struct type"). Null when the header declares without
   * initializing.
   */
  readonly renderInitializer: (() => string) | null;
}

export default IPlannedForVarDecl;
