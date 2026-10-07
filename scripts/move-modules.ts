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

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Project } from "ts-morph";

import MOVES from "./move-modules/MOVES";
import MovePlan from "./move-modules/MovePlan";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

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
  const superseded = MovePlan.superseded(MOVES);
  for (const [index, move] of MOVES.entries()) {
    const fromAbsolute = join(rootDir, move.from);

    // A later entry moves this file on, so this `to` is not where it ends up.
    // Applying it would re-run a step the manifest has since reversed: #1322
    // moved two diagnostic types out of 1-Analyze and #1653 moved them back,
    // and treating each entry alone made `--apply` undo #1653 (#1826 review).
    if (superseded.has(index)) {
      console.log(
        `\n${move.from}\n  -> ${move.to}\n  (superseded by a later entry)`,
      );
      continue;
    }

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
      // ...and drops a `.json` one, which Node's JSON import needs (#1443:
      // `CacheManager`'s `package.json` came out as `../../../package`).
      if (
        specifier.startsWith(".") &&
        declaration.getAttributes() !== undefined &&
        !specifier.endsWith(".json") &&
        existsSync(join(sourceFile.getDirectoryPath(), `${specifier}.json`))
      ) {
        declaration.setModuleSpecifier(`${specifier}.json`);
        fixed += 1;
      }
    }
  }

  console.log(
    `\n${moved} file(s) moved, ${fixed} import specifier(s) had a ` +
      "`.ts` extension stripped or a `.json` one restored.",
  );

  if (!apply) {
    console.log(
      "\nDry run. Nothing written. Re-run with --apply to perform it.",
    );
    return;
  }

  project.saveSync();
  console.log("\nWritten.");

  reportStaleImporters();
}

/**
 * Importers OUTSIDE the tsconfig program that still name a moved module's old path.
 *
 * ts-morph rewrites the importers it can see, and it sees the root tsconfig's
 * program -- which does not include `scripts/`. So a move can leave a `scripts/`
 * import pointing at a path that no longer exists, and because a missing module
 * resolves to `any`/`unknown` rather than erroring at the import line, the
 * failure surfaces later as `TS18046: 'a' is of type 'unknown'` somewhere else
 * entirely. `npx tsc --noEmit` does not catch it either, since that is the root
 * config; only `typecheck:scripts` does.
 *
 * That is exactly how `IGrammarCoverageReport` moved with `scripts/grammar-coverage.ts`
 * left behind: the mover reported success, the root typecheck reported 0, and the
 * gate failed six lines into an unrelated sort comparator.
 *
 * The existing "not in the project" error covers a moved FILE the program cannot
 * see. This covers an IMPORTER it cannot see, which is the other half.
 */
function reportStaleImporters(): void {
  const tracked = execFileSync("git", ["ls-files", "*.ts"], {
    cwd: rootDir,
    encoding: "utf8",
  })
    .split("\n")
    .filter(Boolean);

  const movedFrom = new Set(
    [...MovePlan.stalePaths(MOVES)].map((path) => path.replace(/\.ts$/, "")),
  );

  const stale: string[] = [];
  for (const file of tracked) {
    // The manifest records every old path on purpose, and so do the guards
    // whose subject IS a path string.
    if (file === "scripts/move-modules/MOVES.ts") continue;
    // `git ls-files` lists the index, which still holds every file this run
    // just moved until the move is staged -- reading one threw ENOENT and
    // crashed the report after a successful apply (#1668, moving TChainRoot).
    if (!existsSync(join(rootDir, file))) continue;

    const source = readFileSync(join(rootDir, file), "utf8");
    // Only real module specifiers. Matching any OCCURRENCE reports every test
    // that feeds a path to a path-classifying function as a literal --
    // `unused-code.test.ts` and `layer-rules.test.ts` both do, so the first
    // draft of this cried wolf on two files it had no business naming. A guard
    // that over-reports gets switched off, which is the failure mode that
    // matters here.
    for (const [, specifier] of source.matchAll(
      /(?:from|require\()\s*["']([^"']+)["']/g,
    )) {
      if (!specifier.startsWith(".")) continue;
      const resolved = relative(
        rootDir,
        resolve(dirname(join(rootDir, file)), specifier),
      );
      if (movedFrom.has(resolved)) {
        stale.push(`  ! ${file} imports ${resolved}, which moved`);
      }
    }
  }

  if (stale.length === 0) return;
  console.error(
    "\nImporters outside the tsconfig program still name a moved path:\n" +
      stale.join("\n"),
  );
  process.exitCode = 1;
}

main();
