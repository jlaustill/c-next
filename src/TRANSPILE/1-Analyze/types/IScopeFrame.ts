import IDeclaredVar from "./IDeclaredVar";

/**
 * Declarations directly in one lexical scope (a function, named scope, block, or
 * for-loop header), with a link to the enclosing scope. Resolution searches
 * outward to the global frame, so inner declarations shadow outer ones.
 *
 * `vars` maps a declared name to what its declaration SAYS, so a consumer can
 * map the name to whatever notion it needs -- essential category for MISRA Rule
 * 10.4, essentially-Boolean for Rule 10.1, array bounds for a slice check --
 * without each analyzer building its own index of declarations.
 *
 * #1322 widened the value from the type text to `IDeclaredVar`. The text is
 * still there as `typeText`; what changed is that the dimensions, capacity and
 * const-ness the collector already walked past are kept rather than discarded.
 */

interface IScopeFrame {
  readonly vars: Map<string, IDeclaredVar>;
  readonly parent: IScopeFrame | null;
  /**
   * The path of the `scope` this frame belongs to, `""` outside one. Carried so a
   * `this.member()` call can be keyed by its transpiled C name, which is
   * qualified by the scope (Issue #1183 review).
   *
   * #1357: the whole PATH, not the scope's leaf name. Qualifying from the leaf
   * dropped every outer scope, so a frame inside `Outer.Inner` keyed
   * `this.member()` as `Inner__member`.
   */
  readonly scopePath: string;
}

export default IScopeFrame;
