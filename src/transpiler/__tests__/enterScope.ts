import TranspileState from "../../TRANSPILE/TranspileState";
import SymbolRegistry from "../../PARSE/3-Declare/SymbolRegistry";
import Program from "../../PARSE/4-Resolve/Program";

/**
 * Enter a scope in a unit test, registering it with the symbol registry first.
 *
 * #1304: `state.setCurrentScopeByPath` now asserts that the path is one
 * the symbols pass registered. It used to call `getOrCreateScope`, so a path the
 * registry did not know was silently CREATED as a fresh scope parented to global
 * -- after which `currentScopePath` was that orphan's one-level name, #1295's
 * producer key (the whole path) missed, and the member generated as a bare C
 * identifier at exit 0. A unit test that sets a scope without running a symbols
 * pass therefore has to register it.
 *
 * This wrapper exists so that fact lives in ONE place. Inlining
 * `registry.getOrCreateScope(path)` above each of the sixty-odd
 * `setCurrentScopeByPath` calls in the suite would be the same sentence written
 * sixty times, and the next change to what entering a scope requires would have
 * to find every one of them -- the duplicate-decision shape this line of work
 * exists to remove.
 *
 * `null` exits the scope and registers nothing, matching the method it wraps.
 *
 * Deliberately NOT used by the tests that exercise `setCurrentScopeByPath`
 * itself: a guard's own test must call the guarded method directly, or it tests
 * the wrapper instead.
 */
/**
 * #1452 box 3: the registry is an instance now, and `setCurrentScopeByPath`
 * reads the scope graph off `state.program` rather than a global. Both
 * facts live HERE rather than at the sixty-odd call sites, which is the whole
 * reason this wrapper exists -- adding a parameter would have been the sentence
 * written sixty times, one indirection later.
 *
 * One registry per module, which under vitest is one per test FILE, and it
 * accumulates exactly as the static it replaces did. A test wanting a clean
 * graph builds its own registry rather than remembering to reset this one.
 */
const registry = new SymbolRegistry();

function enterScope(state: TranspileState, path: string | null): void {
  if (path !== null) {
    registry.getOrCreateScope(path);
    state.program = Program.build([], { registry });
  }
  state.setCurrentScopeByPath(path);
}

export default enterScope;
