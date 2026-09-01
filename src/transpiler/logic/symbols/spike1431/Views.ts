/**
 * SPIKE #1431 — THROWAWAY. Deleted before this branch merges.
 *
 * Each live view, re-expressed twice over `IFactStore`.
 *
 * WHAT `asPrincipled` HOLDS FIXED, AND WHY IT MATTERS.
 *
 * A question can differ from its principled form along more than one axis, and this
 * spike measures exactly one of them: SCOPE -- which predicate over files the view
 * uses. So `asPrincipled` deliberately keeps every OTHER decision the live accessor
 * makes, including ones that look wrong.
 *
 * `isKnownStruct` is the worked example. It answers "yes" for a bitmap, on purpose
 * (#551: bitmaps are struct-like, taking pass-by-reference and `->` access). Making
 * `asPrincipled` answer "no" for bitmaps would flood every run with a systematic
 * difference that is a documented design decision rather than a divergence, and the
 * scope signal -- a run-wide `getStructFields` fallback inside a per-file question --
 * would be buried under it.
 *
 * So `asPrincipled` keeps the kind set and changes only the predicate. If a run shows
 * zero gap for a question, that means its scope is already right, not that the
 * accessor is beyond criticism.
 */
import type IFactStore from "./types/IFactStore";
import Queries from "./Queries";

class Views {
  private static has(
    rows: readonly { fullyQualifiedCName: string; kind: string }[],
    name: string,
    kinds: ReadonlySet<string>,
  ): boolean {
    return rows.some(
      (r) => r.fullyQualifiedCName === name && kinds.has(r.kind),
    );
  }

  private static readonly STRUCT_LIKE = new Set(["struct", "bitmap"]);

  /**
   * `CodeGenState.isKnownStruct`:
   *   per-file knownStructs OR per-file knownBitmaps OR run-wide getStructFields.
   *
   * asSpecified reproduces that union, run-wide fallback included.
   * asPrincipled asks the same kind question against the file's include closure only.
   *
   * A key that is visible run-wide but NOT include-visible is the D1 divergence: the
   * accessor answers "known" for a struct this file cannot see, and #1312 is the same
   * trap for types generally.
   */
  static isKnownStruct(
    store: IFactStore,
    file: string,
    name: string,
  ): { asSpecified: boolean; asPrincipled: boolean } {
    const visible = Queries.visibleFrom(store, file);
    const includeVisible = Views.has(visible, name, Views.STRUCT_LIKE);
    const runWide = Views.has(
      Queries.runWide(store),
      name,
      new Set(["struct", "typedef"]),
    );
    return {
      asSpecified: includeVisible || runWide,
      asPrincipled: includeVisible,
    };
  }

  /**
   * `CodeGenState.isScopeType`: the run-wide table, filtered to C-Next, asking whether
   * any overload's kind is type-forming.
   *
   * `NameExistence.ts:40-42` states outright that this routing "is wrong in both
   * directions at once" for the visibility question -- it reads the run-wide table AND
   * filters to C-Next. asSpecified reproduces it; asPrincipled asks the include-visible
   * closure with the same kind set and the same language filter, so the ONLY difference
   * is the predicate.
   */
  static isScopeType(
    store: IFactStore,
    file: string,
    qualifiedName: string,
    typeFormingKinds: ReadonlySet<string>,
  ): { asSpecified: boolean; asPrincipled: boolean } {
    const isCNext = (r: { sourceLanguage: string }): boolean =>
      r.sourceLanguage === "CNext" || r.sourceLanguage === "cnext";
    const matches = (r: {
      fullyQualifiedCName: string;
      kind: string;
      sourceLanguage: string;
    }): boolean =>
      r.fullyQualifiedCName === qualifiedName &&
      typeFormingKinds.has(r.kind) &&
      isCNext(r);

    return {
      asSpecified: Queries.runWide(store).some(matches),
      asPrincipled: Queries.visibleFrom(store, file).some(matches),
    };
  }

  /**
   * `CodeGenState.isKnownScope`: the per-file set only, with no fallback at all.
   *
   * Keyed by the BARE LEAF name, not the transpiled C name -- `TSymbolInfoAdapter`
   * collapses a scope to `scope.name`. So this query matches on `name`, and that
   * difference is the reason the identity control exists: matching on
   * `fullyQualifiedCName` here would report a disagreement on every nested scope that
   * is a translation step rather than a finding.
   */
  static isKnownScope(
    store: IFactStore,
    file: string,
    name: string,
  ): { asSpecified: boolean; asPrincipled: boolean } {
    const isScopeNamed = (r: { name: string; kind: string }): boolean =>
      r.kind === "scope" && r.name === name;
    return {
      asSpecified: Queries.visibleFrom(store, file).some(isScopeNamed),
      asPrincipled: Queries.visibleFrom(store, file).some(isScopeNamed),
    };
  }

  /**
   * `CodeGenState.isOpaqueType`: reads `symbols.opaqueTypes`, which LOOKS per-file but
   * is seeded entirely from the run-wide `SymbolTable.getAllOpaqueTypes()`. D5.
   *
   * There is no include-visible answer available from the store, because opacity is a
   * property of C header symbols and foreign rows carry no scope. asPrincipled asks
   * whether the owning header is include-visible, which is the question the per-file
   * SHAPE implies the accessor was answering.
   */
  static isOpaqueType(
    store: IFactStore,
    file: string,
    typeName: string,
    runWideOpaque: ReadonlySet<string>,
  ): { asSpecified: boolean; asPrincipled: boolean } {
    const asSpecified = runWideOpaque.has(typeName);
    const visibleFiles = new Set(
      Queries.visibleFrom(store, file).map((r) => r.sourceFile),
    );
    const declaredVisibly = store.symbols.some(
      (r) =>
        r.fullyQualifiedCName === typeName && visibleFiles.has(r.sourceFile),
    );
    return { asSpecified, asPrincipled: asSpecified && declaredVisibly };
  }
}

export default Views;
