/**
 * C-Next Scope Symbol
 *
 * Represents a scope in the C-Next type system (global scope or named scope).
 * Scopes contain functions and variables, and can be nested.
 *
 * Design decisions:
 * - Global scope has `name: ""` and `parent` points to itself (self-reference)
 * - Scopes can nest (Outer.Inner.func)
 * - `scope Test` in multiple files merges into single IScopeSymbol
 * - Functions and variables arrays hold references to symbols in this scope
 *
 * Use ScopeUtils for factory functions and type guards.
 */

/**
 * Scope symbol representing a C-Next scope or the global scope.
 *
 * Note: functions and variables arrays use `unknown[]` as placeholders.
 * In Phase 2, these will be typed as `IFunctionSymbol[]` and `IVariableSymbol[]`.
 */
interface IScopeSymbol {
  readonly kind: "scope";
  readonly name: string;
  readonly parent: IScopeSymbol;
  readonly functions: unknown[];
  readonly variables: unknown[];
}

export default IScopeSymbol;
