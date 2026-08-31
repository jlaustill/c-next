import type { CommonTokenStream } from "antlr4ng";

import type { ProgramContext } from "../logic/parser/grammar/CNextParser";
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
 */
interface IDeclaredFile {
  /** The parse tree, walked by the analyzers and the generator. */
  readonly tree: ProgramContext;

  /**
   * The token stream that produced `tree`.
   *
   * Stage 3 discarded this and stage 5 obtained a fresh one from its own parse.
   * `runAnalyzers` needs the stream that belongs to the tree it walks, so the
   * two must be cached together or not at all.
   */
  readonly tokenStream: CommonTokenStream;

  /** Top-level declaration count, reported in parse-only and error results. */
  readonly declarationCount: number;

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
   * There is a FOURTH mutation site, and it is neither additive nor idempotent:
   * `SymbolTable.resolveVariableArrayDimensions` (reached from
   * `resolveExternalArrayDimensions()` in stage 3b) casts the readonly view away and
   * REPLACES `IVariableSymbol.arrayDimensions` wholesale. It fires BETWEEN the cache
   * write and the cache read, so stage 5 converts post-mutation symbols where it
   * previously converted freshly resolved ones -- the sharing described here is what
   * makes that reachable.
   *
   * It is benign because `TSymbolInfoAdapter.convert` never reads that field, which
   * is asserted rather than remembered: "#1301: convert() must not read
   * arrayDimensions" in `TSymbolInfoAdapter.test.ts` converts two symbols differing
   * only in `arrayDimensions` and requires identical output. Without that assertion
   * this would be exactly the "harmless today only by coincidence" shape the
   * `ScopeCollector` comments condemn.
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
