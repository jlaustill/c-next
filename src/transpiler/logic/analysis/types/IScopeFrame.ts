/**
 * Declarations directly in one lexical scope (a function, named scope, block, or
 * for-loop header), with a link to the enclosing scope. Resolution searches
 * outward to the global frame, so inner declarations shadow outer ones.
 *
 * `vars` maps a declared name to its declared type text, so a consumer can map
 * the name to whatever notion of type it needs -- essential category for MISRA
 * Rule 10.4, essentially-Boolean for Rule 10.1 -- without each analyzer building
 * its own index of declarations.
 */
import type IScopeSymbol from "../../../types/symbols/IScopeSymbol";

interface IScopeFrame {
  readonly vars: Map<string, string>;
  readonly parent: IScopeFrame | null;
  /**
   * The `scope` this frame belongs to, or null outside one. Carried so a
   * `this.member()` call can be keyed by its transpiled C name, which is
   * qualified by the scope (Issue #1183 review).
   *
   * #1357: the scope REFERENCE, not its leaf name. Qualifying from the leaf
   * dropped every outer scope, so a frame inside `Outer.Inner` keyed
   * `this.member()` as `Inner__member`.
   */
  readonly scope: IScopeSymbol | null;
}

export default IScopeFrame;
