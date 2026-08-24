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
interface IScopeFrame {
  readonly vars: Map<string, string>;
  readonly parent: IScopeFrame | null;
}

export default IScopeFrame;
