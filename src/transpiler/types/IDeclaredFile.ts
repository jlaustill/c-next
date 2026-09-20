import type IParsedFile from "./IParsedFile";
import type TSymbol from "./symbols/TSymbol";

/**
 * One C-Next file's parse and declare, computed once and consumed twice.
 *
 * #1301: stage 3 and stage 5 each parsed and declared every `.cnx` in the run,
 * with `SymbolRegistry.reset()` running once per run rather than between them.
 * The two agreed, but only because `_sortFilesByDependency` orders files so that
 * an included file is declared before its includer -- which made the seed each
 * declare reads (`_collectExternalEnumSources`) identical by the time either ran.
 * #1167 records that a dependency cycle makes that order arbitrary, so the
 * agreement was a coincidence rather than a shared decision.
 *
 * Measured before removing it, over all 1142 `tests/**` fixtures: 1225 files were
 * resolved twice, the seed differed in 0 of them, and the resolved symbols
 * differed in 4 -- every one a spanned scope whose shared `IScopeSymbol` had
 * accumulated more `declarationSites` in between, reached by the SAME object
 * identity in both passes (175/175). So the second pass recomputed what the first
 * already knew.
 *
 * ## It holds 1.2's artifact; it does not restate it
 *
 * #1445. This interface used to list `tree`, `tokenStream` and
 * `declarationCount` as its own fields, copied verbatim from `IParsedFile`, and
 * `Transpiler._publishResolvedFile` destructured one into the other by hand.
 * Three shapes described one parse -- `CNextSourceParser`'s private
 * `IParseResult`, the artifact, and this -- so adding `comments` to the parse
 * meant editing all three, which is the duplicate-path anti-pattern.
 *
 * **This is a cache entry, not a pass artifact.** 1.3 Declare's artifact is
 * `IFileSymbols`, which carries no tree and has always had this right. What
 * this holds is "what 1.2 and 1.3 produced for one file", retained because
 * stage 5 reads it back instead of repeating both.
 *
 * ## Box 2 of #1445 is NOT satisfied by this shape
 *
 * *"1.3 consumes `ParsedFile` and does not re-export it; no artifact held by a
 * later pass reaches a parse node."* Holding `parsed` re-exports it, plainly.
 * The tree must survive 1.3 while 2.1 walks it to analyze and 2.3 walks it to
 * render, so nothing here can be true before the render layer stops walking --
 * that is box 3, and box 2 closes with it.
 *
 * This interface no longer NAMES a parse-context type, and it stays in
 * `parse-tree-confined-to-parser`'s population anyway -- the rule lists
 * `IParsedFile`, `IDeclaredFile` and `ITypeAccessors` in its `to` as sanctioned
 * carriers, precisely so that reaching the tree through a named artifact counts
 * the same as importing the grammar. That is the right answer and it was
 * already there: swapping three fields for one carrier is a re-homing, not a
 * decoupling, and a gate that let the count fall for it would be rewarding the
 * spelling change the rule's own comment warns about.
 */
interface IDeclaredFile {
  /**
   * What 1.2 Parse produced: the tree, its token stream, the declaration
   * count and the comments.
   *
   * Its `parseErrors` is always empty HERE, structurally: `_declarePipelineFile`
   * returns before declaring when the parse reported anything, so no file with
   * errors is ever cached. `IParsedFile`'s warning that a non-empty value means
   * a RECOVERY tree is about the value `parse` returns, not about this carrier
   * -- a later pass asking this one whether its tree is trustworthy would get
   * `[]` whatever the answer should be.
   */
  readonly parsed: IParsedFile;

  /**
   * Symbols declared by this file (pass 1.3).
   *
   * Stage 3 and stage 5 now hand the SAME objects to the symbol table and to
   * codegen. What makes that safe is NOT that the symbols are frozen. `readonly`
   * blocks reassigning a property, not mutating what it points at, and three of
   * `IScopeSymbol`'s fields are mutated in production by design:
   * `SymbolRegistry.registerFunction` pushes onto `scope.functions`, and
   * `ScopeCollector` casts the readonly view away to add a `declarationSites`
   * entry and a `members` entry. The four spanned-scope files whose symbols
   * differed between the two passes differed for exactly that reason -- so a
   * reader who took "readonly, therefore frozen" at face value would be reasoning
   * from a claim this file's own measurements disprove.
   *
   * Two measured properties make the sharing safe instead:
   *
   * 1. `SymbolRegistry.getOrCreateScope` caches by path and `reset()` runs once
   *    per run, so BOTH passes already reached the same `IScopeSymbol` by object
   *    identity -- 175/175 over the cross-file fixtures. Caching introduces no
   *    aliasing the double pass did not already have.
   * 2. Every mutation of that shared object is additive and idempotent: `Set.add`
   *    for `declarationSites`, the `members` dedup from #1334, and
   *    `registerFunction`'s `isAlreadyRegistered` guard. A later mutation can
   *    therefore never invalidate what an earlier reader already saw.
   *
   * There used to be a FOURTH mutation site, neither additive nor idempotent:
   * `SymbolTable.resolveVariableArrayDimensions` cast the readonly view away and
   * REPLACED `IVariableSymbol.arrayDimensions` wholesale, in a stage-3b pass that
   * fired BETWEEN the cache write and the cache read. It was benign only because
   * `TSymbolInfoAdapter.convert` never reads that field -- asserted rather than
   * remembered, by "#1301: convert() must not read arrayDimensions" in
   * `TSymbolInfoAdapter.test.ts`.
   *
   * #1447 removed it. Resolving a dimension needs the const's value, a const can
   * arrive through an include, and so it is a Tier 2 fact: `Program.build` now
   * rebuilds the symbol with resolved dimensions before anything caches it. The
   * cast is gone with the mutation -- its own justification was that "cloning
   * would require updating all maps", and the maps are now built afterwards.
   * The #1301 assertion is kept: it no longer guards a live hazard, but it still
   * pins that `convert` does not depend on when dimensions were resolved.
   *
   * The element type is `readonly` because nothing downstream mutates the array --
   * `TSymbolInfoAdapter.convert` and `SymbolTable.addTSymbols` both only iterate --
   * so the guarantee is structural rather than a convention to be remembered.
   */
  readonly symbols: readonly TSymbol[];
}

/*
 * Deliberately NOT cached here: `externalEnumSources` (pass 1.4). The tree and the
 * declare are pure functions of one file's text, but that field is a function of
 * how much of the RUN has happened -- it reads a map stage 3 fills incrementally.
 * Under a cyclic include graph the toposort fails, files are visited in insertion
 * order, and a stage 3 answer is therefore partial where the stage 5 one is whole.
 * Caching it regressed a mutually-including pair from compiling to E0427; it is
 * recomputed in `_transpileFile` instead. See
 * tests/bugs/issue-1301-cyclic-include-enum-sources/.
 */

export default IDeclaredFile;
