/**
 * SymbolRegistry - Central registry for C-Next symbol management
 *
 * Provides centralized storage and lookup for all symbols in the C-Next transpiler.
 *
 * Design decisions:
 * - Static class with global state (reset between transpilation runs)
 * - `getOrCreateScope` handles scope merging across files (same scope name = same object)
 * - `resolveFunction` walks scope chain (current -> parent -> global)
 * - String keys in Maps for lookup, but values are proper symbol objects
 */
import ScopeUtils from "../../utils/ScopeUtils";
import type IScopeSymbol from "../types/symbols/IScopeSymbol";
import type IFunctionSymbol from "../types/symbols/IFunctionSymbol";

class SymbolRegistry {
  /** The global scope singleton (recreated on reset) */
  private static globalScope: IScopeSymbol = ScopeUtils.createGlobalScope();

  /** Map from scope path (e.g., "Outer.Inner") to scope object */
  private static readonly scopes: Map<string, IScopeSymbol> = new Map();

  // ============================================================================
  // Scope Management
  // ============================================================================

  /**
   * Get the global scope singleton.
   *
   * The global scope has:
   * - name: "" (empty string)
   * - parent: points to itself (self-reference)
   */
  static getGlobalScope(): IScopeSymbol {
    return this.globalScope;
  }

  /**
   * Get a scope by its dotted path without creating it.
   *
   * Use this for read-only lookups where you don't want to create
   * orphaned scopes. Returns null if the scope doesn't exist.
   */
  static getScope(path: string): IScopeSymbol | null {
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
  static getOrCreateScope(path: string): IScopeSymbol {
    if (path === "") return this.globalScope;
    if (this.scopes.has(path)) return this.scopes.get(path)!;

    const parts = path.split(".");
    const name = parts.pop()!;
    const parentPath = parts.join(".");
    const parent =
      parentPath === "" ? this.globalScope : this.getOrCreateScope(parentPath);

    const scope = ScopeUtils.createScope(name, parent);
    this.scopes.set(path, scope);
    return scope;
  }

  // ============================================================================
  // Function Management
  // ============================================================================

  /**
   * Register a function in its scope.
   *
   * #1358: this must be idempotent. Declare (pass 1.3) runs over the same tree
   * more than once per run -- Transpiler stages 3 and 5 both resolve every file,
   * and `reset()` runs once per run, not between them (#1301) -- so an
   * unconditional push appended a second copy of every function in the program.
   *
   * Idempotence here must key on the SYMBOL, never on the scope. `getOrCreateScope`
   * is deliberately repeat-safe because that is the mechanism by which a scope
   * spanned across two files merges (#1333); suppressing registration for an
   * already-seen scope would break spanned scopes, which are a designed feature.
   */
  static registerFunction(func: IFunctionSymbol): void {
    if (this.isAlreadyRegistered(func)) return;
    func.scope.functions.push(func);
  }

  /**
   * Is `func` a re-registration of a declaration already in its scope?
   *
   * Keyed on `fullyQualifiedCName`, but this does NOT rest on ADR-063's
   * program-wide injectivity. The search is over `func.scope.functions` -- one
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
  private static isAlreadyRegistered(func: IFunctionSymbol): boolean {
    return func.scope.functions.some(
      (existing) => existing.fullyQualifiedCName === func.fullyQualifiedCName,
    );
  }

  /**
   * Resolve a function by name, walking the scope chain.
   *
   * Searches in order:
   * 1. Current scope
   * 2. Parent scope
   * 3. Parent's parent (recursively)
   * 4. Global scope
   *
   * Returns null if the function is not found.
   */
  static resolveFunction(
    name: string,
    fromScope: IScopeSymbol,
  ): IFunctionSymbol | null {
    // Search in current scope
    const found = fromScope.functions.find((f) => f.name === name);
    if (found) return found;

    // Walk up the scope chain (stop when we reach global scope's self-reference)
    if (fromScope !== this.globalScope && fromScope.parent !== fromScope) {
      return this.resolveFunction(name, fromScope.parent);
    }

    return null;
  }

  // ============================================================================
  // Reset
  // ============================================================================

  /**
   * Reset all registry state.
   *
   * Creates a fresh global scope and clears all registered scopes.
   * Call this between transpilation runs.
   */
  static reset(): void {
    this.globalScope = ScopeUtils.createGlobalScope();
    this.scopes.clear();
  }

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
  static findByCName(cName: string): IFunctionSymbol | null {
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
  static getScopeByCFunctionName(cName: string): IScopeSymbol | null {
    const func = this.findByCName(cName);
    return func?.scope ?? null;
  }
}

export default SymbolRegistry;
