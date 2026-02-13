import type IBaseSymbol from "./IBaseSymbol";
import type IFunctionSymbol from "./IFunctionSymbol";
import type TVisibility from "../TVisibility";

/**
 * Symbol representing a scope (namespace) definition.
 * Scopes group related functions and variables.
 *
 * Note: IScopeSymbol has circular references with IFunctionSymbol.
 * Functions have a scope, scopes contain functions.
 */
interface IScopeSymbol extends IBaseSymbol {
  /** Discriminator narrowed to "scope" */
  readonly kind: "scope";

  /** Parent scope (global scope's parent is itself) */
  readonly parent: IScopeSymbol;

  /** List of member names (local names, not mangled) */
  readonly members: string[];

  /** Functions in this scope */
  readonly functions: IFunctionSymbol[];

  /** Variables in this scope */
  readonly variables: unknown[];

  /** Visibility of each member */
  readonly memberVisibility: ReadonlyMap<string, TVisibility>;
}

export default IScopeSymbol;
