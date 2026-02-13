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
import ScopeUtils from "../types/ScopeUtils";
import type IScopeSymbol from "../types/IScopeSymbol";
import type IFunctionSymbol from "../types/IFunctionSymbol";

class SymbolRegistry {
  /** The global scope singleton (recreated on reset) */
  private static globalScope: IScopeSymbol = ScopeUtils.createGlobalScope();

  /** Map from scope path (e.g., "Outer.Inner") to scope object */
  private static scopes: Map<string, IScopeSymbol> = new Map();

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
   * Get or create a scope by its dotted path.
   *
   * For simple names (e.g., "Test"), creates scope with global parent.
   * For dotted paths (e.g., "Outer.Inner"), creates nested scopes.
   *
   * If the scope already exists, returns the existing scope.
   * This enables scope merging across files.
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
   * The function is added to the scope's functions array.
   */
  static registerFunction(func: IFunctionSymbol): void {
    func.scope.functions.push(func);
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
    const found = fromScope.functions.find(
      (f) => (f as IFunctionSymbol).name === name,
    ) as IFunctionSymbol | undefined;
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
}

export default SymbolRegistry;
