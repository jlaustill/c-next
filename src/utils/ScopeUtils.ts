/**
 * Factory functions and type guards for IScopeSymbol.
 *
 * Provides utilities for creating and inspecting C-Next scopes.
 */
import type IScopeSymbol from "../transpiler/types/symbols/IScopeSymbol";
import type TVisibility from "../transpiler/types/TVisibility";
import ESourceLanguage from "./types/ESourceLanguage";
import QualifiedCName from "./QualifiedCName";
import UNSET_SOURCE_SPAN from "../transpiler/constants/UNSET_SOURCE_SPAN";

class ScopeUtils {
  // ============================================================================
  // Factory Functions
  // ============================================================================

  /**
   * Create the global scope.
   *
   * The global scope has an empty name and an empty `scopePath`, which together
   * are what `isGlobalScope` identifies. It no longer points at itself: #1298
   * replaced the scope REFERENCE with a path, so the self-reference that made the
   * symbol graph cyclic -- and made `JsonCodec` recurse until the stack was
   * exhausted -- has nothing to be written into.
   *
   * That also removes the two `null as unknown as IScopeSymbol` casts and the
   * post-construction `Object.assign` this used to need: the identity could not
   * be computed until the self-references were patched in, because the encoder
   * walked the chain those references formed.
   */
  static createGlobalScope(): IScopeSymbol {
    return {
      kind: "scope",
      name: "",
      scopePath: "",
      members: [],
      functions: [],
      variables: [],
      memberVisibility: new Map(),
      // #1334: filled by ScopeCollector, one entry per declaring block.
      declarationSites: new Set<string>(),
      sourceFile: "",
      span: UNSET_SOURCE_SPAN,
      sourceLanguage: ESourceLanguage.CNext,
      visibility: "public",
      // #1285: computed through the same encoder as every other symbol rather
      // than hardcoded, so the global scope cannot become the one symbol whose
      // identity was derived a second way. Both resolve to "" -- it has no name
      // and no enclosing scope -- which is what makes a global symbol keep its
      // bare name.
      ...ScopeUtils.identityOf({ name: "", scopePath: "" }),
    };
  }

  /**
   * Create a named scope inside `parentPath`.
   *
   * Takes the enclosing scope's PATH rather than the scope object (#1298). A
   * scope is identified by where it sits, and a path is the whole answer: the
   * object added nothing but a cycle, since the only thing every consumer ever
   * read from it was the chain of names a path already spells out.
   */
  static createScope(name: string, parentPath: string): IScopeSymbol {
    return {
      kind: "scope",
      name,
      scopePath: parentPath,
      // #1285: a nested scope's own identity comes from its enclosing path, so
      // `Inner` inside `Outer` is `Outer__Inner` without any site knowing how
      // deep it sits.
      ...ScopeUtils.identityOf({ name, scopePath: parentPath }),
      members: [],
      functions: [],
      variables: [],
      memberVisibility: new Map(),
      // #1334: filled by ScopeCollector, one entry per declaring block.
      declarationSites: new Set<string>(),
      sourceFile: "",
      span: UNSET_SOURCE_SPAN,
      sourceLanguage: ESourceLanguage.CNext,
      visibility: "public",
    };
  }

  // ============================================================================
  // Type Guards
  // ============================================================================

  /**
   * Is this scope path the global (file) scope?
   *
   * The one place `""` is read as "no enclosing scope", rather than the same
   * comparison written at every call site. `null` used to be a second spelling of
   * the same state -- every helper here guarded `if (!scope || isGlobalScope(scope))`
   * -- and both now collapse into the empty path.
   */
  static isGlobalScopePath(scopePath: string): boolean {
    return scopePath === "";
  }

  /**
   * Is this scope the global scope?
   *
   * The global scope is the only scope with no name, so it is also the only one
   * whose own path (`cnxScopedName`) is empty. This used to compare
   * `parent === scope`, which is exactly the identity test that could not fire on
   * a proxy chain (#1298).
   */
  static isGlobalScope(scope: IScopeSymbol): boolean {
    return scope.name === "" && ScopeUtils.isGlobalScopePath(scope.scopePath);
  }

  /**
   * The dotted path of a scope's own position -- `""` for global, `"Outer.Inner"`
   * for a scope named `Inner` declared inside `Outer`.
   *
   * This is what a member of the scope carries as its `scopePath`.
   */
  static pathOf(scope: IScopeSymbol): string {
    return scope.cnxScopedName;
  }

  /**
   * The leaf name of a scope path -- `"Inner"` for `"Outer.Inner"`, `""` for the
   * global scope.
   */
  static leafOf(scopePath: string): string {
    return scopePath.split(QualifiedCName.SOURCE_SEPARATOR).at(-1) ?? "";
  }

  /**
   * The path of the scope enclosing `scopePath` -- `"Outer"` for `"Outer.Inner"`,
   * `""` for a top-level scope.
   */
  static parentOf(scopePath: string): string {
    const index = scopePath.lastIndexOf(QualifiedCName.SOURCE_SEPARATOR);
    return index === -1 ? "" : scopePath.slice(0, index);
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

  /**
   * ADR-016: visibility of a declaration that has no enclosing scope.
   *
   * A top-level declaration is unconditionally part of the file's interface --
   * scopes are how C-Next expresses privacy, and neither `public` nor `private`
   * parses at top level.
   *
   * This is deliberately NOT `getDefaultVisibility(false)`. That answers a
   * different question -- what an UNMARKED SCOPE MEMBER means -- and for every
   * non-function kind it answers "private". Reusing it here would make every
   * top-level struct and enum private and drop it from the header, which is
   * #1300 inverted. Two rules, two names, so neither can be reached by the
   * other's caller.
   */
  static getTopLevelVisibility(): TVisibility {
    return "public";
  }

  /**
   * ADR-016 visibility of one scope member, as the source declares it.
   *
   * THE single decision. Three places used to compute this independently --
   * the symbol collector, the early bitmap/struct pass whose symbols are the
   * ones that survive, and codegen -- so "is this member private" had three
   * answers that happened to agree. #1300 is what that costs: the collectors
   * for four kinds could not reach the answer at all and hardcoded `public`.
   *
   * Typed structurally rather than against `ScopeMemberContext` so the ANTLR
   * parse tree stays out of the utility layer (#1317), while the real context
   * satisfies it unchanged.
   */
  static getMemberVisibility(member: {
    visibilityModifier(): { getText(): string } | null;
    functionDeclaration(): unknown;
  }): TVisibility {
    const explicit = member.visibilityModifier()?.getText() as
      | TVisibility
      | undefined;
    return (
      explicit ??
      ScopeUtils.getDefaultVisibility(member.functionDeclaration() !== null)
    );
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
   * Takes the whole enclosing PATH rather than a scope's leaf name -- the latter
   * silently drops outer scopes. The two agreed only because the grammar does not
   * admit nested scopes today, which is a latent divergence rather than a shared
   * decision.
   *
   * `fromParts` expands a dotted component and drops empties, so the path goes in
   * as one element and needs no splitting: `["Outer.Inner", "process"]` joins to
   * `Outer__Inner__process`, and `["", "init"]` to `init`.
   *
   * @param symbol Any symbol carrying a bare name and its declaring scope path
   * @returns The C identifier, e.g. "Motor__init"
   */
  static getTranspiledCName(symbol: {
    name: string;
    scopePath: string;
  }): string {
    return QualifiedCName.fromParts([symbol.scopePath, symbol.name]);
  }

  /**
   * Build the SOURCE-language qualified name for a symbol from its scope chain.
   *
   * `Motor.init`, `Outer.Inner.process`, and the bare name for a global symbol --
   * the spelling a C-Next author would recognize. The counterpart to
   * getTranspiledCName, which builds the identifier the C compiler sees.
   *
   * Takes the same whole enclosing path, for the same reason: a scope's leaf name
   * drops every outer scope.
   */
  static getCnxScopedName(symbol: { name: string; scopePath: string }): string {
    return QualifiedCName.fromSourceParts([symbol.scopePath, symbol.name]);
  }

  /**
   * The C name a bare member of `scope` is emitted under, or the bare name at
   * file scope.
   *
   * The drop-in for `QualifiedCName.fromParts([currentScopeName, name])`, which is the
   * leaf-only encoder #1285 exists to remove. Identical at depth one -- a
   * top-level scope's leaf name IS its whole chain -- and correct beyond it,
   * where the string version dropped every outer component.
   *
   * The empty path means "no qualification": a global symbol keeps its bare name,
   * which is what makes `global.x` reachable. `null` used to be a second spelling
   * of that state and is now the empty string (#1298).
   */
  static qualifyInScope(name: string, scopePath: string): string {
    return ScopeUtils.qualifyPathInScope([name], scopePath);
  }

  /**
   * Qualify a bare type name against a scope, if the scope declares it.
   *
   * ADR-057: a bare name inside a scope resolves local -> scope -> global. The
   * predicate is asked about the QUALIFIED name so that only actual type
   * declarations capture it -- a scope function or variable sharing a leaf name
   * with a global type must not shadow that type at a type position.
   *
   * Takes the whole enclosing PATH, not a scope's leaf name. The leaf version
   * this replaces joined one level, so at depth two it asked about
   * `Inner__Config` for a type whose name is `Outer__Inner__Config` and got
   * "no" -- silently falling through to the bare name, which is the #1200
   * failure shape (#1285).
   *
   * `isKnownType` is injected rather than read from CodeGenState so this stays
   * usable from the symbols layer, which must not depend on codegen.
   */
  static qualifyScopeType(
    typeName: string,
    scopePath: string,
    isKnownType: (qualifiedName: string) => boolean,
  ): string {
    if (ScopeUtils.isGlobalScopePath(scopePath)) {
      return typeName;
    }
    const qualified = ScopeUtils.getTranspiledCName({
      name: typeName,
      scopePath,
    });
    return isKnownType(qualified) ? qualified : typeName;
  }

  /**
   * Resolve an array dimension that names a symbol (an enum count, a macro) to
   * the identifier the generated C should use.
   *
   * Issue #1127: this rule previously lived only in
   * HeaderSymbolAdapter.resolveArrayDimension() and served variables only, so a
   * struct field carrying `EColor.COUNT` had no way to reach `EColor__COUNT`. It is
   * shared so the variable path and the struct-field path apply one rule;
   * `isKnownEnum` is injected rather than read from CodeGenState so this stays
   * usable from any layer.
   *
   * #1357: moved here from QualifiedCName, and takes the whole enclosing PATH
   * rather than a scope's leaf name. It is a scope-aware operation -- three of its
   * four branches qualify against the enclosing scope -- so on QualifiedCName it
   * was the last API through which a caller holding only a scope NAME could still
   * build a one-level qualified name. A path carries every outer component, which
   * the leaf-taking version could not.
   *
   * @param dim Dimension text as written in the source
   * @param scopePath Enclosing scope path, or "" at file scope
   * @param isKnownEnum Does this *qualified* name name an enum?
   * @returns The C identifier, or `dim` unchanged when it names nothing
   *
   * @example resolveDimensionName("EColor.COUNT", global, p)      => "EColor__COUNT"
   * @example resolveDimensionName("State.COUNT", Motor, p)        => "Motor__State__COUNT"
   * @example resolveDimensionName("this.State.COUNT", Motor, p)   => "Motor__State__COUNT"
   * @example resolveDimensionName("global.EColor.COUNT", Motor, p) => "EColor__COUNT"
   * @example resolveDimensionName("10", Motor, p)                 => "10"
   */
  static resolveDimensionName(
    dim: string,
    scopePath: string,
    isKnownEnum: (qualifiedName: string) => boolean,
  ): string {
    if (!dim.includes(QualifiedCName.SOURCE_SEPARATOR)) {
      return dim;
    }

    const parts = dim.split(QualifiedCName.SOURCE_SEPARATOR);

    // `global.X.Y` is explicitly global - drop the marker, add no scope prefix
    if (parts[0] === "global") {
      return QualifiedCName.fromParts(parts.slice(1));
    }

    // `this.X.Y` is explicitly scope-local - drop the marker, prefix the scope
    if (parts[0] === "this") {
      return ScopeUtils.qualifyPathInScope(parts.slice(1), scopePath);
    }

    // Bare `X.Y` inside a scope resolves scope-first, then global (ADR-057).
    // Prefix only when the scope really declares that enum.
    if (
      !ScopeUtils.isGlobalScopePath(scopePath) &&
      isKnownEnum(ScopeUtils.qualifyInScope(parts[0], scopePath))
    ) {
      return ScopeUtils.qualifyPathInScope(parts, scopePath);
    }

    return QualifiedCName.fromParts(parts);
  }

  /**
   * The C name a multi-part member path takes inside `scopePath`, or the bare
   * joined path at file scope. The one implementation; `qualifyInScope` is the
   * single-component spelling of it.
   *
   * #1385 review: the two used to branch on the same guard and then both build
   * `fromParts([scopePath, ...])`, which is one decision written twice -- in the
   * file whose entire purpose is being the one encoder.
   *
   * Collapsing them settles a divergence rather than introducing one. The old
   * `qualifyInScope` returned a DOTTED name verbatim at file scope but expanded
   * it inside a scope, because only the second path reached `fromParts`:
   *
   *     qualifyInScope("a.b", null)   -> "a.b"      <- did not expand
   *     qualifyInScope("a.b", Motor)  -> "Motor__a__b"
   *
   * Both now expand. Nothing passes a dotted name today -- every one of the 21
   * call sites hands over a bare identifier or an already-split component -- so
   * this is behavior-preserving in practice and consistent for the first time.
   */
  static qualifyPathInScope(
    path: readonly string[],
    scopePath: string,
  ): string {
    return QualifiedCName.fromParts([scopePath, ...path]);
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
  static identityOf(symbol: { name: string; scopePath: string }): {
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
