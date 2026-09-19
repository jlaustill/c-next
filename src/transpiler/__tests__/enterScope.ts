import CodeGenState from "../state/CodeGenState";
import SymbolRegistry from "../state/SymbolRegistry";

/**
 * Enter a scope in a unit test, registering it with the symbol registry first.
 *
 * #1304: `CodeGenState.setCurrentScopeByPath` now asserts that the path is one
 * the symbols pass registered. It used to call `getOrCreateScope`, so a path the
 * registry did not know was silently CREATED as a fresh scope parented to global
 * -- after which `currentScopePath` was that orphan's one-level name, #1295's
 * producer key (the whole path) missed, and the member generated as a bare C
 * identifier at exit 0. A unit test that sets a scope without running a symbols
 * pass therefore has to register it.
 *
 * This wrapper exists so that fact lives in ONE place. Inlining
 * `SymbolRegistry.getOrCreateScope(path)` above each of the sixty-odd
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
function enterScope(path: string | null): void {
  if (path !== null) {
    SymbolRegistry.getOrCreateScope(path);
  }
  CodeGenState.setCurrentScopeByPath(path);
}

export default enterScope;
