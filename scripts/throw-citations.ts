#!/usr/bin/env tsx
/**
 * Issue #1365: verify `docs/architecture/output-throw-classification.md`.
 *
 * This header used to say there could be no `write` mode, "because the document
 * is authored, not generated -- a fixer would have to guess which throw a stale
 * citation meant, and nine sites share a message, so the guess is not safe."
 *
 * That is right about a fixer reading the DOCUMENT alone, and #1518 is what it
 * missed: a fixer may also read the PREVIOUS REVISION. When a file's
 * `throw new` count is unchanged there, the Nth throw then is the Nth throw
 * now, and nothing is guessed. When the count changes, `--write` REFUSES that
 * file -- which is precisely the case the original objection describes, left to
 * a human as it should be.
 *
 * The prose is still authored. `--write` only moves line numbers, and then
 * re-runs the check on its own output, so it cannot leave the document in a
 * state a human could not have reached.
 *
 *   npm run docs:throw-citations        - fix line numbers against HEAD
 *   npm run docs:throw-citations:check  - fail if the committed copy is stale
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import chalk from "chalk";

import ThrowCitations from "./diagnostics/ThrowCitations";
import OutputThrowSources from "./diagnostics/OutputThrowSources";
import type IRevision from "./diagnostics/IRevision";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const docPath = OutputThrowSources.docPath;

/**
 * Every file under `output/` that differs from HEAD, with both revisions.
 *
 * Keyed by basename because that is how the document cites -- some rows say
 * `codegen/CodeGenerator.ts`, others just `CodeGenerator.ts`, and the gate's
 * own `resolve` already treats the cited path as a suffix.
 */
/** A file's text at HEAD, or null when it did not exist there. */
function revisionAtHead(path: string): string | null {
  try {
    return execFileSync("git", ["show", `HEAD:${path}`], {
      encoding: "utf-8",
      cwd: rootDir,
      maxBuffer: 32 * 1024 * 1024,
      // git writes `fatal: path ... exists on disk, but not in HEAD` to stderr
      // for a file added since HEAD. That is the expected answer here, not a
      // failure, so it is not surfaced as one.
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return null;
  }
}

function changedRevisions(): Map<string, IRevision> {
  const changed = execFileSync(
    "git",
    ["diff", "--name-only", "HEAD", "--", "src/transpiler/output"],
    { encoding: "utf-8", cwd: rootDir },
  )
    .split("\n")
    .filter((path) => path.endsWith(".ts") && !path.includes("__tests__"));

  const revisions = new Map<string, IRevision>();
  for (const path of changed) {
    // `git diff --name-only` reports ADDED and DELETED files too, and this read
    // both revisions of every one unconditionally -- so a file that moved threw
    // ENOENT and took the whole run down. #1322 hit it merging main: #1449 had
    // moved `generators/TIncludeHeader.ts` to `types/`.
    //
    // A file with only one revision has no mapping to offer: there is no "the
    // Nth throw then" for a file that did not exist, and nothing to map to for
    // one that no longer does. Skipping is not a silent loss -- a citation into
    // either is exactly what `:check`'s invariants 1 and 2 report.
    const previous = revisionAtHead(path);
    if (previous === null) continue;
    if (!existsSync(join(rootDir, path))) continue;
    const current = readFileSync(join(rootDir, path), "utf-8");
    revisions.set(path.slice(path.lastIndexOf("/") + 1), { previous, current });
  }
  return revisions;
}

function write(): void {
  // Check FIRST, and stop if the document is already consistent. This is what
  // makes `--write` idempotent: the remap is a map from OLD line to new, so
  // running it twice would look up numbers that are already new and shift any
  // that happen to collide with an old one. Refusing to act on a document that
  // needs nothing removes that hazard entirely rather than detecting it.
  if (
    ThrowCitations.check(
      readFileSync(docPath, "utf-8"),
      OutputThrowSources.read(),
    ).ok
  ) {
    console.log("Citations already consistent; nothing to remap.");
    return;
  }

  const revisions = changedRevisions();
  if (revisions.size === 0) {
    console.error(
      chalk.red(
        "Citations are stale, but no file under output/ differs from HEAD.\n" +
          "  `--write` remaps against the previous revision, so it can only fix\n" +
          "  drift caused by the WORKING TREE. This drift is already committed:\n" +
          "  the source moved in an earlier commit and the document did not.\n" +
          "  Re-run it there (`git rebase -i` to that commit), or correct the\n" +
          "  rows by hand -- `:check` names the nearest `throw new` for each.",
      ),
    );
    process.exit(1);
  }

  const outcome = ThrowCitations.remap(
    readFileSync(docPath, "utf-8"),
    revisions,
  );

  for (const refusal of outcome.refusals) {
    console.error(chalk.red(`  refused: ${refusal}`));
  }
  if (outcome.refusals.length > 0) {
    console.error(
      chalk.red(
        "\nNothing written. Classify the added or removed site by hand, then " +
          "re-run -- a count change is the one case this cannot decide.",
      ),
    );
    process.exit(1);
  }

  // Checked BEFORE writing. An earlier version wrote first and checked after,
  // so a remap that did not verify left the document WORSE than it found it --
  // and then the next run saw a document that fails the check, decided it had
  // work to do, and remapped the already-remapped rows a second time. One bad
  // run poisoned every following one.
  //
  // Checking the candidate instead makes a failed remap a no-op, which is what
  // lets the idempotence guard above stay simple: the only states on disk are
  // "consistent" and "untouched since the last commit".
  const rechecked = ThrowCitations.check(
    outcome.markdown,
    OutputThrowSources.read(),
  );
  if (!rechecked.ok) {
    console.error(
      chalk.red(
        "Nothing written. The remap would not have satisfied the check it " +
          "exists to satisfy:\n" +
          rechecked.errors.map((error) => `  ${error}`).join("\n"),
      ),
    );
    process.exit(1);
  }

  writeFileSync(docPath, outcome.markdown);
  console.log(
    chalk.green(
      `Remapped ${outcome.rewritten} line number(s) across ` +
        `${revisions.size} changed file(s), verified against the check.`,
    ),
  );
}

function main(): void {
  if (process.argv.includes("--write")) {
    write();
    return;
  }

  const outcome = ThrowCitations.check(
    readFileSync(docPath, "utf-8"),
    OutputThrowSources.read(),
  );

  for (const line of outcome.info) {
    console.log(chalk.green(line));
  }
  if (!outcome.ok) {
    console.error(
      chalk.red(
        `docs/architecture/output-throw-classification.md is out of date:\n` +
          outcome.errors.map((error) => `  ${error}`).join("\n"),
      ),
    );
    process.exit(1);
  }
}

main();
