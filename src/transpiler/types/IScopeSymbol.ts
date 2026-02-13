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
 *
 * Note: IScopeSymbol and IFunctionSymbol have a mutual reference (scope contains
 * functions, functions have a scope). This is intentional and type-only imports
 * are used to minimize runtime coupling.
 */
import type IFunctionSymbol from "./IFunctionSymbol";

/**
 * Scope symbol representing a C-Next scope or the global scope.
 */
interface IScopeSymbol {
  readonly kind: "scope";
  readonly name: string;
  readonly parent: IScopeSymbol;
  /** Functions registered in this scope */
  readonly functions: IFunctionSymbol[];
  /** Variables registered in this scope (typed as unknown for now) */
  readonly variables: unknown[];
}

export default IScopeSymbol;
