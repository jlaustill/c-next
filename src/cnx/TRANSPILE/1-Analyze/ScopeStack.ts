/**
 * ScopeStack - Generic scope management for variable tracking
 *
 * A linked-list stack of scopes where each scope contains variables.
 * Supports lexical scoping: inner scopes can shadow outer variables,
 * and lookups traverse from innermost to outermost scope.
 *
 * Used by InitializationAnalyzer, but generic enough for other analyses.
 */

import invariant from "../../utils/invariant";

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
   */
  declare(name: string, state: T): void {
    invariant(
      this.currentScope,
      "a variable is declared only inside a scope the analysis entered",
    );
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
   * Check if we're currently inside any scope
   */
  hasActiveScope(): boolean {
    return this.currentScope !== null;
  }
}

export default ScopeStack;
