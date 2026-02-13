import type IBaseSymbol from "./IBaseSymbol";
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

  /** Functions in this scope (forward declaration to avoid circular import) */
  readonly functions: ReadonlyArray<IBaseSymbol>;

  /** Variables in this scope */
  readonly variables: ReadonlyArray<unknown>;

  /** Visibility of each member */
  readonly memberVisibility: ReadonlyMap<string, TVisibility>;
}

export default IScopeSymbol;
