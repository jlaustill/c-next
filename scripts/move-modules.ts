#!/usr/bin/env tsx
/**
 * Move modules into the pass directories, rewriting every import that names
 * them.
 *
 * #1443 turns `src/` into the pass table, and each pass card moves its own
 * modules. That is a rename plus an import rewrite across the whole project --
 * mechanical, but not something to do by hand across 41 modules and 37
 * importers, and not something to do with a regex either: a relative specifier
 * changes differently depending on where the IMPORTER sits, so `../../utils`
 * from one directory and `../../../utils` from another must both come out
 * right.
 *
 * ts-morph is used rather than an editor plugin or an MCP because the move is
 * a REVIEWABLE ARTIFACT: the manifest below says exactly what moved and why,
 * it is committed with the change, and the next pass card adds entries instead
 * of repeating the reasoning. It also dry-runs by default, which is the
 * discipline CLAUDE.md asks for and which a one-shot tool call cannot offer.
 *
 *   npm run move:modules            # dry run -- prints the plan, writes nothing
 *   npm run move:modules -- --apply # perform it
 *
 * The `.ts` extension fixup at the end is not incidental: ts-morph writes
 * module specifiers with the extension included, and this project's imports
 * carry no extension. CLAUDE.md records the same gotcha against the ts-morph
 * MCP tools, so it is corrected here once rather than left for a reader to
 * notice in review.
 */

import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Project } from "ts-morph";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * One entry per directory or file that moves, with the reason it belongs there.
 *
 * The rule is `IFileSymbols`' own admission test: a module belongs to 1.3
 * Declare when everything it computes is computable with one file's parse tree
 * open, and to 1.4 Resolve when it needs more than one file. That test is
 * already authored, so this manifest records the ANSWER for each module rather
 * than inventing a second rule.
 */
interface IMove {
  /** Path relative to the repository root. A directory moves with its tree. */
  readonly from: string;
  readonly to: string;
  /** Why this destination, in the terms the admission rule uses. */
  readonly because: string;
}

const MOVES: readonly IMove[] = [
  // --- layer-neutral: reached by more than one pass ----------------------
  {
    from: "src/TRANSPILE/1-Analyze/helpers/AssignmentTargetExtractor.ts",
    to: "src/utils/ast/AssignmentTargetExtractor.ts",
    because:
      "#1322. Filed under `analysis/helpers/` but never a 2.1 fact: its own " +
      "header says it was extracted from `walkStatementForModifications` for " +
      "testability, and `CodeGenerator` reaches it. A generic parse-tree " +
      "walker that two passes use belongs where every layer may depend on it, " +
      "which the dependency-cruiser config already names as `utils/`. Leaving " +
      "it made `render-cannot-import-analyzers` unsatisfiable for a module " +
      "that decides nothing about legality.",
  },
  {
    from: "src/TRANSPILE/1-Analyze/helpers/ChildStatementCollector.ts",
    to: "src/utils/ast/ChildStatementCollector.ts",
    because:
      "Same: 'centralizes recursion patterns', extracted from `CodeGenerator` " +
      "under #566. It answers *what statements are inside this one?*, which is " +
      "a question about the tree, not about the program's legality.",
  },
  {
    from: "src/TRANSPILE/1-Analyze/helpers/StatementExpressionCollector.ts",
    to: "src/utils/ast/StatementExpressionCollector.ts",
    because: "Same shape, same reason (#565).",
  },
  {
    from: "src/TRANSPILE/1-Analyze/types/IBaseAnalysisError.ts",
    to: "src/transpiler/types/IBaseAnalysisError.ts",
    because:
      "#1322. The shape of a diagnostic is a shared contract, and `output/` " +
      "reads it. `logic-cannot-import-output`'s own comment prescribes the " +
      "remedy for exactly this: 'If you need shared types, move them to " +
      "`transpiler/types/`', which is layer-neutral.",
  },
  {
    from: "src/TRANSPILE/1-Analyze/types/INullCheckError.ts",
    to: "src/transpiler/types/INullCheckError.ts",
    because: "Same contract, same reader.",
  },
  // --- 2.2 Plan: what C should exist? -------------------------------------
  {
    from: "src/transpiler/logic/analysis/PassByValueAnalyzer.ts",
    to: "src/TRANSPILE/2-Plan/PassByValueAnalyzer.ts",
    because:
      "Named `Analyzer`, filed under `analysis/`, and not a `runAnalyzers` step: " +
      "its only importer is `CodeGenerator`, and what it computes is whether a " +
      "parameter is passed by value -- an emission decision, which 2.2 owns. " +
      "Leaving it in 1-Analyze would make `analyze-cannot-import-plan` " +
      "unsatisfiable on the day it was written.",
  },
  {
    from: "src/transpiler/logic/analysis/ModificationAnalyzer.ts",
    to: "src/TRANSPILE/2-Plan/ModificationAnalyzer.ts",
    because:
      "Const inference. Also not a step; its importer is `Transpiler`, and " +
      "`const` on a generated declaration is a fact about the C that should " +
      "exist, not about whether the C-Next is legal.",
  },
  {
    from: "src/transpiler/logic/analysis/helpers/TransitiveModificationPropagator.ts",
    to: "src/TRANSPILE/2-Plan/TransitiveModificationPropagator.ts",
    because: "Only `ModificationAnalyzer` uses it; it follows its one caller.",
  },
  // --- 2.1 Analyze: is this program legal? --------------------------------
  {
    from: "src/transpiler/logic/analysis",
    to: "src/TRANSPILE/1-Analyze",
    because:
      "#1322. `docs/architecture/README.md`: 2.1 Analyze owns *is this program " +
      "legal?* -- all diagnostics, codes, positions. This directory already IS " +
      "that pass: `runAnalyzers` and its sixteen steps are what authors every " +
      "coded diagnostic the transpiler emits. It moves whole rather than " +
      "gaining a sibling under `src/TRANSPILE/`, because two homes for one pass " +
      "is the duplicate code path CLAUDE.md calls the project's worst " +
      "anti-pattern -- and #1322 is about to author 145 more diagnostics, each " +
      "of which would have to pick a home.",
  },
  // --- 1.3 Declare: per-file identity and declaration ---------------------
  {
    from: "src/transpiler/logic/symbols/cnext",
    to: "src/PARSE/3-Declare/cnext",
    because:
      "collects what ONE C-Next file declares; every collector takes a single parse tree",
  },
  {
    from: "src/transpiler/logic/symbols/c",
    to: "src/PARSE/3-Declare/c",
    because: "collects what one C header declares",
  },
  {
    from: "src/transpiler/logic/symbols/cpp",
    to: "src/PARSE/3-Declare/cpp",
    because: "collects what one C++ header declares",
  },
  {
    from: "src/transpiler/logic/symbols/shared",
    to: "src/PARSE/3-Declare/shared",
    because: "parameter extraction shared by the C and C++ collectors",
  },
  {
    from: "src/transpiler/logic/symbols/TypeBinding.ts",
    to: "src/PARSE/3-Declare/TypeBinding.ts",
    because:
      "the one ladder from a type context to a name; reads only the tree and an injected predicate",
  },
  {
    from: "src/transpiler/logic/symbols/TYPE_FORMING_KINDS.ts",
    to: "src/PARSE/3-Declare/TYPE_FORMING_KINDS.ts",
    because:
      "which symbol kinds introduce a type name -- a constant, no file context",
  },
  {
    from: "src/transpiler/logic/symbols/SymbolUtils.ts",
    to: "src/PARSE/3-Declare/SymbolUtils.ts",
    because: "helpers for the C and C++ collectors, per declaration",
  },
  {
    from: "src/transpiler/logic/symbols/NameExistence.ts",
    to: "src/PARSE/3-Declare/NameExistence.ts",
    because:
      "asks the PER-FILE view whether a name exists; its own header is the statement of that split",
  },

  // --- 1.4 Resolve: facts requiring more than one file --------------------
  {
    from: "src/transpiler/logic/symbols/Program.ts",
    to: "src/PARSE/4-Resolve/Program.ts",
    because: "the artifact 1.4 emits",
  },
  {
    from: "src/transpiler/logic/symbols/DeferredTypes.ts",
    to: "src/PARSE/4-Resolve/DeferredTypes.ts",
    because:
      "settles bare names against the whole-program scope-type set, which no single file has",
  },
  {
    from: "src/transpiler/logic/symbols/TransitiveEnumCollector.ts",
    to: "src/PARSE/4-Resolve/TransitiveEnumCollector.ts",
    because:
      "walks the include graph, so it needs the graph rather than a file",
  },

  // --- NOT moved, and the reason is a measurement -------------------------
  // `SymbolTable.ts` and `PublicInterface.ts` stay at their current path with
  // an `awaiting` row in the destination map. Both are 1.4 facts by content --
  // one accumulates the whole run, the other queries it -- but 1.3 Declare
  // imports both today: the C and C++ collectors take a `SymbolTable` and
  // `TSymbolInfoAdapter` calls `PublicInterface.existsIn`. Moving them creates
  // a 3-Declare -> 4-Resolve edge, which is the pass order backwards, and a
  // rule forbidding it would fail on the first run.
  //
  // The edges are type-only -- injected parameters, not reached-for globals --
  // so this is not a deep coupling, but it is real and it is not this card's to
  // remove. `awaiting` is the shape #1443 sanctions for exactly this: a module
  // whose destination is known and whose move is gated on another card.

  // --- tests follow their subject ----------------------------------------
  // Listed one by one rather than moved as a directory: the modules they cover
  // land in two different passes, and `lint:test-location` requires a test to
  // sit in a `__tests__` beside what it tests.
  {
    from: "src/transpiler/logic/symbols/__tests__/NameExistence.test.ts",
    to: "src/PARSE/3-Declare/__tests__/NameExistence.test.ts",
    because: "covers NameExistence",
  },
  {
    from: "src/transpiler/logic/symbols/__tests__/SymbolUtils.test.ts",
    to: "src/PARSE/3-Declare/__tests__/SymbolUtils.test.ts",
    because: "covers SymbolUtils",
  },
  {
    from: "src/transpiler/logic/symbols/__tests__/Program.test.ts",
    to: "src/PARSE/4-Resolve/__tests__/Program.test.ts",
    because: "covers Program",
  },
  {
    from: "src/transpiler/logic/symbols/__tests__/TransitiveEnumCollector.test.ts",
    to: "src/PARSE/4-Resolve/__tests__/TransitiveEnumCollector.test.ts",
    because: "covers TransitiveEnumCollector",
  },
];

/** Every `.ts` file under a path, or the path itself when it is a file. */
function filesUnder(absolute: string): string[] {
  if (statSync(absolute).isFile()) {
    return [absolute];
  }
  return readdirSync(absolute).flatMap((entry) =>
    filesUnder(join(absolute, entry)),
  );
}

function main(): void {
  const apply = process.argv.includes("--apply");

  const project = new Project({
    tsConfigFilePath: join(rootDir, "tsconfig.json"),
    skipAddingFilesFromTsConfig: false,
  });

  let moved = 0;
  for (const move of MOVES) {
    const fromAbsolute = join(rootDir, move.from);

    // Already performed. Reported rather than skipped in silence, and NOT an
    // error: the manifest is a record of every move, so a later pass card can
    // add entries and re-run without first pruning the ones that already
    // happened.
    if (!existsSync(fromAbsolute)) {
      console.log(`\n${move.from}\n  -> ${move.to}\n  (already moved)`);
      continue;
    }

    console.log(`\n${move.from}\n  -> ${move.to}\n  (${move.because})`);

    for (const fileAbsolute of filesUnder(fromAbsolute)) {
      const sourceFile = project.getSourceFile(fileAbsolute);
      if (!sourceFile) {
        // Not in the tsconfig program. Loudly, rather than skipped in silence:
        // a module the move misses keeps its old path while its neighbors
        // change, which is the half-moved state this script exists to avoid.
        console.error(
          `  ! not in the project: ${relative(rootDir, fileAbsolute)}`,
        );
        process.exitCode = 1;
        continue;
      }

      const suffix = relative(fromAbsolute, fileAbsolute);
      const target = suffix
        ? join(rootDir, move.to, suffix)
        : join(rootDir, move.to);

      console.log(`    ${relative(rootDir, fileAbsolute)}`);
      sourceFile.move(target);
      moved += 1;
    }
  }

  // ts-morph writes specifiers with the extension; this project's are bare.
  // Applied to EVERY file, not just moved ones, because the rewrite lands on
  // the importers.
  let fixed = 0;
  for (const sourceFile of project.getSourceFiles()) {
    for (const declaration of sourceFile.getImportDeclarations()) {
      const specifier = declaration.getModuleSpecifierValue();
      if (specifier.startsWith(".") && specifier.endsWith(".ts")) {
        declaration.setModuleSpecifier(specifier.slice(0, -".ts".length));
        fixed += 1;
      }
    }
  }

  console.log(
    `\n${moved} file(s) moved, ${fixed} import specifier(s) had a \`.ts\` extension stripped.`,
  );

  if (!apply) {
    console.log(
      "\nDry run. Nothing written. Re-run with --apply to perform it.",
    );
    return;
  }

  project.saveSync();
  console.log("\nWritten.");
}

main();
