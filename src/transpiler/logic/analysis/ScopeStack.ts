/**
 * ScopeStack - Generic scope management for variable tracking
 *
 * A linked-list stack of scopes where each scope contains variables.
 * Supports lexical scoping: inner scopes can shadow outer variables,
 * and lookups traverse from innermost to outermost scope.
 *
 * Used by InitializationAnalyzer, but generic enough for other analyses.
 */

/**
 * A single scope in the stack
 */
interface IScope<T> {
  /** Variables declared in this scope */
  variables: Map<string, T>;
  /** Parent scope (null for outermost/global scope) */
  parent: IScope<T> | null;
}

/**
 * Generic scope stack for tracking variables across nested scopes
 *
 * @typeParam T - The type of data stored for each variable
 */
class ScopeStack<T> {
  private currentScope: IScope<T> | null = null;

  /**
   * Enter a new scope (e.g., function body, block)
   * The new scope becomes the current scope, with the previous as parent.
   */
  enterScope(): void {
    const newScope: IScope<T> = {
      variables: new Map(),
      parent: this.currentScope,
    };
    this.currentScope = newScope;
  }

  /**
   * Exit the current scope and return to parent
   * @returns The exited scope, or null if already at root
   */
  exitScope(): IScope<T> | null {
    const exited = this.currentScope;
    if (this.currentScope) {
      this.currentScope = this.currentScope.parent;
    }
    return exited;
  }

  /**
   * Declare a variable in the current scope
   * @param name - Variable name
   * @param state - Initial state for the variable
   * @throws Error if no scope exists (call enterScope first)
   */
  declare(name: string, state: T): void {
    if (!this.currentScope) {
      throw new Error("Cannot declare variable: no active scope");
    }
    this.currentScope.variables.set(name, state);
  }

  /**
   * Look up a variable by name, searching from innermost to outermost scope
   * @param name - Variable name to find
   * @returns The variable state, or null if not found in any scope
   */
  lookup(name: string): T | null {
    let scope = this.currentScope;
    while (scope) {
      const state = scope.variables.get(name);
      if (state !== undefined) {
        return state;
      }
      scope = scope.parent;
    }
    return null;
  }

  /**
   * Check if a variable exists in any scope
   * @param name - Variable name to check
   */
  has(name: string): boolean {
    return this.lookup(name) !== null;
  }

  /**
   * Check if a variable is declared in the current (innermost) scope only
   * Useful for detecting shadowing or redeclaration errors
   * @param name - Variable name to check
   */
  hasInCurrentScope(name: string): boolean {
    return this.currentScope?.variables.has(name) ?? false;
  }

  /**
   * Update a variable's state in the scope where it's defined
   * @param name - Variable name
   * @param updater - Function that receives current state and returns new state
   * @returns true if variable was found and updated, false otherwise
   */
  update(name: string, updater: (state: T) => T): boolean {
    let scope = this.currentScope;
    while (scope) {
      if (scope.variables.has(name)) {
        const current = scope.variables.get(name)!;
        scope.variables.set(name, updater(current));
        return true;
      }
      scope = scope.parent;
    }
    return false;
  }

  /**
   * Get all variables visible from the current scope
   * Variables in inner scopes shadow those in outer scopes.
   * @returns Map of variable name to state
   */
  getAllVisible(): Map<string, T> {
    const result = new Map<string, T>();
    let scope = this.currentScope;
    while (scope) {
      for (const [name, state] of scope.variables) {
        // Only add if not already shadowed by inner scope
        if (!result.has(name)) {
          result.set(name, state);
        }
      }
      scope = scope.parent;
    }
    return result;
  }

  /**
   * Clone the entire state of all visible variables
   * Useful for control flow analysis (saving state before branches)
   * @param cloner - Function to deep-clone individual variable states
   * @returns Map of variable name to cloned state
   */
  cloneState(cloner: (state: T) => T): Map<string, T> {
    const result = new Map<string, T>();
    let scope = this.currentScope;
    while (scope) {
      for (const [name, state] of scope.variables) {
        if (!result.has(name)) {
          result.set(name, cloner(state));
        }
      }
      scope = scope.parent;
    }
    return result;
  }

  /**
   * Restore variable states from a saved snapshot
   * Only updates variables that exist in both current scope chain and snapshot.
   * @param savedState - Previously cloned state map
   * @param restorer - Function to restore state (receives current and saved, returns new)
   */
  restoreState(
    savedState: Map<string, T>,
    restorer: (current: T, saved: T) => T,
  ): void {
    for (const [name, savedVarState] of savedState) {
      this.update(name, (current) => restorer(current, savedVarState));
    }
  }

  /**
   * Get the current scope depth (0 = no scope, 1 = one scope, etc.)
   * Useful for debugging and determining if we're at global level
   */
  getDepth(): number {
    let depth = 0;
    let scope = this.currentScope;
    while (scope) {
      depth++;
      scope = scope.parent;
    }
    return depth;
  }

  /**
   * Check if we're currently inside any scope
   */
  hasActiveScope(): boolean {
    return this.currentScope !== null;
  }

  /**
   * Iterate over all variables in the current scope only (not parents)
   * @returns Iterator of [name, state] pairs
   */
  *currentScopeVariables(): IterableIterator<[string, T]> {
    if (this.currentScope) {
      yield* this.currentScope.variables;
    }
  }
}

export default ScopeStack;
