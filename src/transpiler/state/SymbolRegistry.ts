/**
 * SymbolRegistry - Central registry for C-Next symbol management
 *
 * Provides centralized storage and lookup for all symbols in the C-Next transpiler.
 *
 * Design decisions:
 * - One instance per RUN, threaded; there is no global to clear (#1452 box 3)
 * - `getOrCreateScope` handles scope merging across files (same scope path = same object)
 * - `resolveFunction` walks scope chain (current -> parent -> global)
 * - String keys in Maps for lookup, but values are proper symbol objects
 *
 * ## An instance per run, not a static (#1452 box 3)
 *
 * The clearing was a correctness requirement tests had to remember: 23
 * `beforeEach` calls across 22 files. Measured before changing it -- deleting
 * all 23 reddens 5 files and 12 tests, so the requirement was real, not
 * vestigial. The failures are `Object.is` assertions, because
 * `getOrCreateScope` returns a CACHED object and a test that did not reset
 * received the previous test's scope.
 *
 * A run now constructs one registry and threads it, so isolation is what you
 * get by default rather than what you must remember. It also closes #1378 by
 * construction: `parseWithSymbols` never reset the global, so scopes from a
 * previously parsed source leaked into the next call. It builds its own now.
 *
 * **Per-RUN, not per-file, and that distinction is load-bearing.** The
 * cross-file merge and the object ALIASING 1.4 depends on both survive because
 * it is still one registry for the whole run: `DeferredTypes.settle` writes
 * into `IScopeSymbol.functions` in place and deliberately skips entries another
 * file settled, on the grounds that they share the object through here, and
 * `ScopeCollector` accumulates `declarationSites` across reopening blocks,
 * which #1334 needs. A per-file registry would break both.
 *
 * **Only 1.3 Declare creates.** Measured across 120 fixtures with a stack-frame
 * probe: 2.1 Analyze, 2.2 Plan and 2.3 Render produced ZERO creations, and the
 * probe fires from `CNextResolver`, so the zero is a real zero rather than a
 * broken instrument. Their `getOrCreateScope` calls are all
 * `ScopeUtils.pathOf(getOrCreateScope(name))` -- a name-to-path lookup where
 * the create arm is never taken. That is why the later passes reach this
 * through `IProgram`'s read surface and only 1.3 holds the registry itself.
 */
import ScopeUtils from "../../utils/ScopeUtils";
import type IScopeSymbol from "../types/symbols/IScopeSymbol";
import type IFunctionSymbol from "../types/symbols/IFunctionSymbol";

class SymbolRegistry {
  /** The global scope for this run. */
  private readonly globalScope: IScopeSymbol = ScopeUtils.createGlobalScope();

  /** Map from scope path (e.g., "Outer.Inner") to scope object */
  private readonly scopes: Map<string, IScopeSymbol> = new Map();

  // ============================================================================
  // Scope Management
  // ============================================================================

  /**
   * Get the global scope singleton.
   *
   * The global scope has:
   * - name: "" (empty string)
   * - scopePath: "" (it has no enclosing scope; #1298 removed the
   *   self-reference that made the symbol graph cyclic)
   */
  getGlobalScope(): IScopeSymbol {
    return this.globalScope;
  }

  /**
   * Get a scope by its dotted path without creating it.
   *
   * Use this for read-only lookups where you don't want to create
   * orphaned scopes. Returns null if the scope doesn't exist.
   */
  getScope(path: string): IScopeSymbol | null {
    if (path === "") return this.globalScope;
    return this.scopes.get(path) ?? null;
  }

  /**
   * Get or create a scope by its dotted path.
   *
   * For simple names (e.g., "Test"), creates scope with global parent.
   * For dotted paths (e.g., "Outer.Inner"), creates nested scopes.
   *
   * If the scope already exists, returns the existing scope.
   * This enables scope merging across files.
   *
   * Note: This creates scopes that don't exist. For read-only lookups,
   * use getScope() instead to avoid creating orphaned scopes.
   */
  getOrCreateScope(path: string): IScopeSymbol {
    if (ScopeUtils.isGlobalScopePath(path)) return this.globalScope;
    if (this.scopes.has(path)) return this.scopes.get(path)!;

    // Split through the shared helpers rather than re-implementing them: this
    // method open-coded `split`/`pop`/`join`, which is `leafOf` and `parentOf`
    // written a second time in the file that introduced both (#1298 review).
    const name = ScopeUtils.leafOf(path);
    const parentPath = ScopeUtils.parentOf(path);
    // Still created eagerly: an intermediate scope must exist as an object so
    // members can be registered into it, even though a child now names it by
    // path rather than pointing at it.
    if (!ScopeUtils.isGlobalScopePath(parentPath)) {
      this.getOrCreateScope(parentPath);
    }

    const scope = ScopeUtils.createScope(name, parentPath);
    this.scopes.set(path, scope);
    return scope;
  }

  // ============================================================================
  // Function Management
  // ============================================================================

  /**
   * Register a function in its scope.
   *
   * This is idempotent, and that is the CONTRACT of a declare pass rather than a
   * workaround for one caller. #1313 states the target as "a pass is a pure
   * function of its input", so registering the same declaration twice must leave
   * the registry as one registration left it, however many times it is called.
   *
   * #1358 introduced the guard for a concrete reason: Transpiler stages 3 and 5
   * each resolved every file while `reset()` ran once per run, so an unconditional
   * push appended a second copy of every function in the program. #1301 has since
   * removed that double pass -- stage 5 consumes the declare stage 3 performed --
   * so nothing in the pipeline calls this twice today. The guard is kept
   * deliberately, as a ratchet: a second unconditional pass, if one is ever
   * reintroduced, is absorbed here rather than silently duplicating. Its live
   * callers are the idempotence test and negative control in
   * `__tests__/SymbolRegistry.test.ts`.
   *
   * Idempotence here must key on the SYMBOL, never on the scope. `getOrCreateScope`
   * is deliberately repeat-safe because that is the mechanism by which a scope
   * spanned across two files merges (#1333); suppressing registration for an
   * already-seen scope would break spanned scopes, which are a designed feature.
   */
  registerFunction(func: IFunctionSymbol): void {
    if (this.isAlreadyRegistered(func)) return;
    this.getOrCreateScope(func.scopePath).functions.push(func);
  }

  /**
   * Is `func` a re-registration of a declaration already in its scope?
   *
   * Keyed on `fullyQualifiedCName`, but this does NOT rest on ADR-063's
   * program-wide injectivity. The search is over one scope's `functions` -- one
   * scope's array -- where the qualified prefix is constant, so the key reduces
   * to the bare name. The property actually required is the narrower "no two
   * functions in ONE scope share a name", which is the stronger result: it holds
   * even if the encoder changes.
   *
   * E0425 is what supplies it. C-Next has no function overloads, so two functions
   * sharing a name in a scope are rejected by `SymbolTable.detectCNextDuplicate`
   * before anything reads this list, whether their signatures differ or not --
   * gated by tests/bugs/issue-1358-declare-idempotence/. The same holds in the
   * global scope, where two same-named top-level functions in different files
   * also raise E0425 (verified, not assumed). So a collision reaching this point
   * is always the same declaration seen twice, never two declarations.
   *
   * Deliberately NOT keyed on the scope. `getOrCreateScope` is repeat-safe by
   * design -- that is how a scope spanned across two files merges (#1333) -- so
   * suppressing registration for an already-seen scope would break spanned
   * scopes. The negative control in the tests covers exactly that.
   */
  private isAlreadyRegistered(func: IFunctionSymbol): boolean {
    return this.getOrCreateScope(func.scopePath).functions.some(
      (existing: IFunctionSymbol) =>
        existing.fullyQualifiedCName === func.fullyQualifiedCName,
    );
  }

  /**
   * Resolve a function by name, walking outward through enclosing scopes.
   *
   * Searches in order:
   * 1. Current scope
   * 2. Enclosing scope
   * 3. Its enclosing scope (recursively)
   * 4. Global scope
   *
   * Returns null if the function is not found.
   *
   * #1298: walks PATHS rather than parent references, so the walk is bounded by
   * the number of separators in a string and cannot revisit a scope. The
   * termination guard this replaces compared object identity, which is precisely
   * the test that could not fire on a proxy chain.
   */
  resolveFunction(
    name: string,
    fromScope: IScopeSymbol,
  ): IFunctionSymbol | null {
    // Search in current scope
    const found = fromScope.functions.find((f) => f.name === name);
    if (found) return found;

    if (ScopeUtils.isGlobalScope(fromScope)) return null;

    // A scope's own `scopePath` IS its enclosing scope's path -- there is nothing
    // to re-derive, and no second spelling of "one level out".
    const enclosing = this.getScope(fromScope.scopePath);
    return enclosing === null ? null : this.resolveFunction(name, enclosing);
  }

  // ============================================================================
  // Reset
  // ============================================================================

  // ============================================================================
  // Bridge Methods (for gradual migration from string-based lookups)
  // ============================================================================

  /**
   * Find a function by its transpiled C name (e.g., "Test_fillData").
   *
   * This is a bridge method for gradual migration. New code should use
   * resolveFunction() with bare names and scope references instead.
   *
   * @param cName Transpiled C function name (e.g., "Test_fillData", "main")
   * @returns The function symbol, or null if not found
   */
  findByCName(cName: string): IFunctionSymbol | null {
    // Check global scope first (no underscore = global function)
    for (const func of this.globalScope.functions) {
      if (func.name === cName) {
        return func;
      }
    }

    // Check all scopes - the C name should match scope_name pattern
    for (const scope of this.scopes.values()) {
      for (const func of scope.functions) {
        if (ScopeUtils.getTranspiledCName(func) === cName) {
          return func;
        }
      }
    }

    return null;
  }

  /**
   * Get the scope of a function given its transpiled C name.
   *
   * This is a bridge method for gradual migration.
   *
   * @param cName Transpiled C function name
   * @returns The scope the function belongs to, or null if not found
   */
  getScopeByCFunctionName(cName: string): IScopeSymbol | null {
    const func = this.findByCName(cName);
    return func === null ? null : this.getScope(func.scopePath);
  }
}

export default SymbolRegistry;
