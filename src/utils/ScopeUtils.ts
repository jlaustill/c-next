/**
 * Factory functions and type guards for IScopeSymbol.
 *
 * Provides utilities for creating and inspecting C-Next scopes.
 */
import type IScopeSymbol from "../transpiler/types/symbols/IScopeSymbol";
import type TVisibility from "../transpiler/types/TVisibility";
import ESourceLanguage from "./types/ESourceLanguage";
import QualifiedCName from "./QualifiedCName";

class ScopeUtils {
  // ============================================================================
  // Factory Functions
  // ============================================================================

  /**
   * Create the global scope with self-reference parent.
   *
   * Global scope has:
   * - name: "" (empty string)
   * - parent: points to itself (self-reference)
   * - scope: points to itself (self-reference)
   */
  static createGlobalScope(): IScopeSymbol {
    // Create a mutable object first to establish self-references
    const global: IScopeSymbol = {
      kind: "scope",
      name: "",
      parent: null as unknown as IScopeSymbol, // Temporary, will be set below
      scope: null as unknown as IScopeSymbol, // Temporary, will be set below
      members: [],
      functions: [],
      variables: [],
      memberVisibility: new Map(),
      sourceFile: "",
      sourceLine: 0,
      sourceLanguage: ESourceLanguage.CNext,
      isExported: true,
      // Patched below: identityOf walks the scope chain, and the chain is not
      // complete until the self-references are set.
      fullyQualifiedCName: "",
      cnxScopedName: "",
    };
    // Set self-references for global scope
    (global as unknown as { parent: IScopeSymbol }).parent = global;
    (global as unknown as { scope: IScopeSymbol }).scope = global;
    // #1285: computed through the same encoder as every other symbol rather than
    // hardcoded, so the global scope cannot become the one symbol whose identity
    // was derived a second way. Both resolve to "" -- it has no name and no
    // outer scope -- which is what makes a global symbol keep its bare name.
    Object.assign(global, ScopeUtils.identityOf(global));
    return global;
  }

  /**
   * Create a named scope with the given parent.
   *
   * Named scopes can be nested (e.g., Outer.Inner).
   */
  static createScope(name: string, parent: IScopeSymbol): IScopeSymbol {
    const scope: IScopeSymbol = {
      kind: "scope",
      name,
      parent,
      scope: parent, // Scope's containing scope is its parent
      // #1285: a nested scope's own identity comes from its parent chain, so
      // `Inner` inside `Outer` is `Outer__Inner` without any site knowing how
      // deep it sits.
      ...ScopeUtils.identityOf({ name, scope: parent }),
      members: [],
      functions: [],
      variables: [],
      memberVisibility: new Map(),
      sourceFile: "",
      sourceLine: 0,
      sourceLanguage: ESourceLanguage.CNext,
      isExported: true,
    };
    return scope;
  }

  // ============================================================================
  // Type Guards
  // ============================================================================

  /**
   * Check if a scope is the global scope.
   *
   * Global scope is identified by:
   * - Empty name ("")
   * - Self-referential parent (parent === scope)
   */
  static isGlobalScope(scope: IScopeSymbol): boolean {
    return scope.name === "" && scope.parent === scope;
  }

  // ============================================================================
  // Visibility Utilities
  // ============================================================================

  /**
   * ADR-016: Get the default visibility for a scope member based on its type.
   *
   * Member-type-aware defaults reduce boilerplate:
   * - Functions: public by default (API surface)
   * - Variables/types: private by default (internal state)
   *
   * @param isFunction - Whether the member is a function declaration
   * @returns The default visibility for this member type
   */
  static getDefaultVisibility(isFunction: boolean): TVisibility {
    return isFunction ? "public" : "private";
  }

  // ============================================================================
  // Path Utilities
  // ============================================================================

  /**
   * Get the scope path from outermost to innermost (excluding global scope).
   *
   * For scope "Outer.Inner", returns ["Outer", "Inner"].
   * For global scope, returns [].
   */
  static getScopePath(scope: IScopeSymbol): string[] {
    const path: string[] = [];
    const seen = new Set<IScopeSymbol>();
    let current = scope;

    while (!ScopeUtils.isGlobalScope(current)) {
      // A parent chain that revisits a scope never reaches the global scope.
      // Only createGlobalScope() may be its own parent, and only with an empty
      // name; anything else self-referential is malformed. Fail loudly: this
      // walk runs for every symbol added to the SymbolTable, and looping here
      // hangs the whole transpile with no output to diagnose.
      if (seen.has(current)) {
        throw new Error(
          `Malformed scope chain: '${current.name}' is its own ancestor, so it ` +
            `never reaches the global scope. Build scopes with ` +
            `ScopeUtils.createGlobalScope()/createScope() — only the global ` +
            `scope is self-parented, and its name must be empty.`,
        );
      }
      seen.add(current);

      path.unshift(current.name);

      // A chain that simply ends is the other way this walk fails to terminate
      // at the global scope, and it is the shape hand-built scopes actually
      // have — the encoder this replaced took `{ name: string }` structurally,
      // so an object with no parent was a complete scope to it. Without this the
      // next line hands `undefined` to isGlobalScope and the whole transpile
      // dies on a bare TypeError, now from inside SymbolTable.addTSymbol, which
      // runs for every symbol.
      if (!current.parent) {
        throw new Error(
          `Malformed scope chain: '${current.name}' has no parent, so it never ` +
            `reaches the global scope. Build scopes with ` +
            `ScopeUtils.createGlobalScope()/createScope().`,
        );
      }

      current = current.parent;
    }

    return path;
  }

  // ============================================================================
  // Transpiled C Names
  // ============================================================================

  /**
   * Build the transpiled C name for a symbol from its scope chain.
   *
   * This is the single encoder for symbol identity: `Motor__init` for `init`
   * in scope `Motor`, `Outer__Inner__process` for a nested scope, and the bare
   * name for a global symbol. ADR-063 makes the result injective, so it is also
   * the canonical identity a symbol can be looked up by.
   *
   * Walks the parent chain rather than reading `scope.name` alone — the latter
   * is the leaf name, so it silently drops outer scopes. The two agreed only
   * because the grammar does not admit nested scopes today, which is a latent
   * divergence rather than a shared decision.
   *
   * @param symbol Any symbol carrying a bare name and its declaring scope
   * @returns The C identifier, e.g. "Motor__init"
   */
  static getTranspiledCName(symbol: {
    name: string;
    scope: IScopeSymbol;
  }): string {
    return QualifiedCName.join(
      ...ScopeUtils.getScopePath(symbol.scope),
      symbol.name,
    );
  }

  /**
   * Build the SOURCE-language qualified name for a symbol from its scope chain.
   *
   * `Motor.init`, `Outer.Inner.process`, and the bare name for a global symbol --
   * the spelling a C-Next author would recognize. The counterpart to
   * getTranspiledCName, which builds the identifier the C compiler sees.
   *
   * Walks the same parent chain, for the same reason: reading `scope.name` alone
   * drops every outer scope.
   */
  static getCnxScopedName(symbol: {
    name: string;
    scope: IScopeSymbol;
  }): string {
    return QualifiedCName.joinSource(
      ...ScopeUtils.getScopePath(symbol.scope),
      symbol.name,
    );
  }

  /**
   * The C name a bare member of `scope` is emitted under, or the bare name at
   * file scope.
   *
   * The drop-in for `QualifiedCName.join(currentScopeName, name)`, which is the
   * leaf-only encoder #1285 exists to remove. Identical at depth one -- a
   * top-level scope's leaf name IS its whole chain -- and correct beyond it,
   * where the string version dropped every outer component.
   *
   * Null and the global scope both mean "no qualification": a global symbol
   * keeps its bare name, which is what makes `global.x` reachable.
   */
  static qualifyInScope(name: string, scope: IScopeSymbol | null): string {
    if (!scope || ScopeUtils.isGlobalScope(scope)) {
      return name;
    }
    return ScopeUtils.getTranspiledCName({ name, scope });
  }

  /**
   * Qualify a bare type name against a scope, if the scope declares it.
   *
   * ADR-057: a bare name inside a scope resolves local -> scope -> global. The
   * predicate is asked about the QUALIFIED name so that only actual type
   * declarations capture it -- a scope function or variable sharing a leaf name
   * with a global type must not shadow that type at a type position.
   *
   * Takes the scope REFERENCE, not its name. The string version this replaces
   * joined one level from a leaf, so at depth two it asked about
   * `Inner__Config` for a type whose name is `Outer__Inner__Config` and got
   * "no" -- silently falling through to the bare name, which is the #1200
   * failure shape (#1285).
   *
   * `isKnownType` is injected rather than read from CodeGenState so this stays
   * usable from the symbols layer, which must not depend on codegen.
   */
  static qualifyScopeType(
    typeName: string,
    scope: IScopeSymbol | null,
    isKnownType: (qualifiedName: string) => boolean,
  ): string {
    if (!scope || ScopeUtils.isGlobalScope(scope)) {
      return typeName;
    }
    const qualified = ScopeUtils.getTranspiledCName({ name: typeName, scope });
    return isKnownType(qualified) ? qualified : typeName;
  }

  /**
   * Both qualified names for a symbol, computed together.
   *
   * Returned as a pair rather than as two separate calls so a construction site
   * cannot produce half an identity. Setting one and forgetting the other leaves
   * a symbol whose C name and source name disagree about where it lives, which
   * is the shape of defect this whole line of work exists to remove.
   *
   * Spread into every C-Next symbol literal, so both names are a property of the
   * symbol from the moment it exists rather than something each consumer
   * re-derives from `scope`.
   */
  static identityOf(symbol: { name: string; scope: IScopeSymbol }): {
    fullyQualifiedCName: string;
    cnxScopedName: string;
  } {
    return {
      fullyQualifiedCName: ScopeUtils.getTranspiledCName(symbol),
      cnxScopedName: ScopeUtils.getCnxScopedName(symbol),
    };
  }
}

export default ScopeUtils;
