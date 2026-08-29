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

  /** List of member names (local names, not transpiled C names) */
  readonly members: string[];

  /** Functions in this scope */
  readonly functions: IFunctionSymbol[];

  /** Variables in this scope */
  readonly variables: unknown[];

  /** Visibility of each member */
  readonly memberVisibility: ReadonlyMap<string, TVisibility>;

  /**
   * Every block that declares this scope, as `${sourceFile}:${sourceLine}`.
   *
   * #1334: a scope may be REOPENED (ADR-016), so it has many declaration sites,
   * not one. `SymbolRegistry.getOrCreateScope` caches by path and `ScopeCollector`
   * used to overwrite `sourceFile`/`sourceLine` on the shared object, so a
   * reopened scope reported whichever block was collected LAST -- and a conflict
   * naming two definitions printed the same location twice, because there was
   * only ever one position.
   *
   * A `Set<string>` rather than a set of `{sourceFile, sourceLine}` objects: `Set`
   * deduplicates objects by reference, so two literals with identical contents
   * would both be retained -- it would look like deduplication and silently not
   * be. The string is also exactly the display format conflict messages already
   * build, so it is rendered directly and never split back apart.
   *
   * The scalar `sourceFile`/`sourceLine` inherited from IBaseSymbol carry the
   * FIRST site. That is not a lossy choice now, because the complete record is
   * here beside them.
   */
  readonly declarationSites: ReadonlySet<string>;
}

export default IScopeSymbol;
