#!/usr/bin/env tsx
/**
 * Format fidelity gate (#1364).
 *
 * A formatter that mangles code is worse than no formatter, and the layout
 * tests cannot prove it does not: they assert 18 hand-written shapes. This
 * gate asserts the property that actually matters, across every fixture in the
 * corpus:
 *
 *   1. ACCEPTANCE  - the formatter accepts exactly what the parser accepts.
 *   2. FIDELITY    - transpiling the formatted source produces byte-identical
 *                    output, and the same diagnostics, as the original.
 *   3. IDEMPOTENCE - format(format(x)) === format(x).
 *   4. COMMENTS    - every comment survives, verbatim.
 *   5. EXEMPTIONS  - `.prettierignore` lists exactly the fixtures the parser
 *                    rejects, so that hand-written list cannot drift.
 *
 * (4) exists because comment loss is invisible to (2): ADR-043 carries only
 * some comments into the generated C, so a formatter can silently delete an
 * in-expression comment while the generated output stays byte-identical. Every
 * layout rule that reads a token's text instead of printing the token drops
 * that token's comments, and there is no way to see it from the C alone.
 *
 * (2) is the load-bearing one. It is what makes reformatting 1000+ committed
 * fixtures a mechanical change rather than a leap of faith. Diagnostics are
 * compared by message, never by line:column -- those legitimately move when
 * the source is reformatted, and pinning them would make the gate assert the
 * opposite of what it is for.
 *
 * Usage:
 *   npx tsx scripts/format-fidelity.ts [path] [--verbose]
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import chalk from "chalk";
import * as prettier from "prettier";

import CNextSourceParser from "../src/transpiler/logic/parser/CNextSourceParser";
import Transpiler from "../src/transpiler/Transpiler";

import FileScanner from "./utils/FileScanner";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const pluginPath = join(rootDir, "prettier-plugin/dist/index.js");
const includeDir = join(rootDir, "tests/include");

/** What the transpiler did with one source, stripped of anything positional. */
interface ITranspileOutcome {
  success: boolean;
  /** Diagnostic messages only: line and column legitimately move. */
  messages: string[];
  code: string;
  headerCode: string;
}

/** One fixture's verdict. */
interface IFixtureVerdict {
  file: string;
  failures: string[];
}

/**
 * Fixtures `.prettierignore` exempts by name.
 *
 * Only the `tests/**` entries matter here: they are the deliberately-invalid
 * fixtures Prettier would error on. Reading them back is what stops the list
 * silently disagreeing with the parser.
 */
function exemptedFixtures(target: string): Set<string> {
  const text = readFileSync(join(rootDir, ".prettierignore"), "utf-8");
  const prefix = target.endsWith("/") ? target : `${target}/`;
  return new Set(
    text
      .split("\n")
      .map((entry) => entry.trim())
      .filter((entry) => entry.startsWith("tests/") && entry.endsWith(".cnx"))
      // Scoped to what this run actually scanned: a run over one directory
      // must not report every exemption outside it as stale.
      .filter((entry) => entry.startsWith(prefix)),
  );
}

/** Every comment in a source, in order, as written. */
function commentsOf(source: string): string[] {
  const { tokenStream } = CNextSourceParser.parse(source);
  tokenStream.fill();
  return tokenStream
    .getTokens()
    .filter((token) => token.channel !== 0)
    .map((token) => (token.text ?? "").trim());
}

/** Every `.cnx` under `dir` that the parser rejects, repo-relative. */
function parseRejects(dir: string): Set<string> {
  const rejected = new Set<string>();
  for (const file of FileScanner.findFiles(dir, ".cnx")) {
    try {
      const { errors } = CNextSourceParser.parse(readFileSync(file, "utf-8"));
      if (errors.length > 0) rejected.add(relative(rootDir, file));
    } catch {
      rejected.add(relative(rootDir, file));
    }
  }
  return rejected;
}

/**
 * Format source exactly the way `prettier --write` would.
 *
 * The options come from `.prettierrc` rather than being restated here. A gate
 * that hardcodes them checks a pipeline nobody runs: deleting the `overrides`
 * block would leave this reporting every fixture green while `prettier --write`
 * reformatted the corpus at a different width.
 */
async function format(source: string, filepath: string): Promise<string> {
  const config = await prettier.resolveConfig(filepath, { editorconfig: true });
  return prettier.format(source, {
    ...config,
    filepath,
    plugins: [pluginPath],
    parser: "cnext",
  });
}

/** Transpile in memory, resolving includes against the fixture's real path. */
async function transpile(
  source: string,
  sourcePath: string,
): Promise<ITranspileOutcome> {
  const transpiler = new Transpiler({
    input: sourcePath,
    includeDirs: [includeDir, dirname(sourcePath)],
  });
  const result = await transpiler.transpile({
    kind: "source",
    source,
    sourcePath,
    workingDir: rootDir,
  });
  const file = result.files[0];
  return {
    success: result.success,
    messages: result.errors.map((error) => error.message).sort(),
    code: file?.code ?? "",
    headerCode: file?.headerCode ?? "",
  };
}

/** Describe the first difference between two outcomes, or null when identical. */
function diffOutcomes(
  before: ITranspileOutcome,
  after: ITranspileOutcome,
): string | null {
  if (before.success !== after.success) {
    return `transpile success changed: ${before.success} -> ${after.success}`;
  }
  if (before.messages.join("\n") !== after.messages.join("\n")) {
    return [
      "diagnostics changed:",
      `  before: ${JSON.stringify(before.messages)}`,
      `  after:  ${JSON.stringify(after.messages)}`,
    ].join("\n");
  }
  if (before.code !== after.code) {
    return `generated code changed (${before.code.length} -> ${after.code.length} bytes)`;
  }
  if (before.headerCode !== after.headerCode) {
    return `generated header changed (${before.headerCode.length} -> ${after.headerCode.length} bytes)`;
  }
  return null;
}

/**
 * Check one fixture.
 *
 * A fixture the formatter cannot parse is only acceptable when the transpiler
 * cannot parse it either -- deriving the exemption rather than listing it, so a
 * newly-unformattable fixture cannot hide behind a stale allowlist.
 */
async function checkFixture(file: string): Promise<IFixtureVerdict> {
  const failures: string[] = [];
  const source = readFileSync(file, "utf-8");

  let formatted: string;
  try {
    formatted = await format(source, file);
  } catch (error) {
    const before = await transpile(source, file);
    if (before.success) {
      failures.push(
        `formatter rejected a source the transpiler accepts: ${(error as Error).message}`,
      );
    }
    return { file, failures };
  }

  let twice: string;
  try {
    twice = await format(formatted, file);
  } catch (error) {
    // The formatter produced text it cannot itself parse. That is the worst
    // outcome available to a formatter, so it is reported separately.
    failures.push(
      `formatter emitted unparseable C-Next: ${(error as Error).message.split("\n")[0]}`,
    );
    return { file, failures };
  }
  if (twice !== formatted) {
    failures.push("not idempotent: format(format(x)) !== format(x)");
  }

  const commentsBefore = commentsOf(source);
  const commentsAfter = commentsOf(formatted);
  if (commentsBefore.join("\u0000") !== commentsAfter.join("\u0000")) {
    const lost = commentsBefore.filter(
      (comment) => !commentsAfter.includes(comment),
    );
    failures.push(
      lost.length > 0
        ? `comments lost: ${JSON.stringify(lost.slice(0, 3))}`
        : `comments reordered: ${commentsBefore.length} -> ${commentsAfter.length}`,
    );
  }

  const before = await transpile(source, file);
  const after = await transpile(formatted, file);
  const difference = diffOutcomes(before, after);
  if (difference !== null) failures.push(difference);

  return { file, failures };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const verbose = args.includes("--verbose");
  const target = args.find((arg) => !arg.startsWith("--")) ?? "tests";
  const searchDir = join(rootDir, target);

  // Every `.cnx`, not just `.test.cnx`: the files this used to skip are the
  // interesting ones -- `examples/`, and the cross-file helpers the project's
  // own testing guidance says to exercise rather than same-file fixtures.
  const files = existsSync(searchDir)
    ? FileScanner.findFiles(searchDir, ".cnx")
    : [];
  if (files.length === 0) {
    console.error(chalk.red(`No .cnx files found under ${target}`));
    process.exit(1);
  }

  console.log(
    chalk.bold(
      `Format fidelity: ${files.length} .cnx file(s) under ${target}\n`,
    ),
  );

  const exempted = exemptedFixtures(target);
  // Prettier sees every `.cnx`, not just `.test.cnx` fixtures, so the exemption
  // list is checked against all of them. Scanning only the fixtures would report
  // a legitimately-exempted helper file as a stale entry.
  const rejected = parseRejects(searchDir);
  const failed: IFixtureVerdict[] = [];
  let checked = 0;
  for (const file of files) {
    const verdict = await checkFixture(file).catch((error: Error) => ({
      file,
      failures: [`checker threw: ${error.message.split("\n")[0]}`],
    }));
    checked += 1;
    if (verdict.failures.length > 0) {
      failed.push(verdict);
      process.stdout.write(chalk.red("F"));
    } else if (verbose) {
      console.log(chalk.green(`  ok ${relative(rootDir, file)}`));
    } else {
      process.stdout.write(chalk.green("."));
    }
    if (checked % 80 === 0) process.stdout.write(` ${checked}\n`);
  }
  process.stdout.write("\n\n");

  const missingExemptions = [...rejected].filter((file) => !exempted.has(file));
  const staleExemptions = [...exempted].filter((file) => !rejected.has(file));
  if (missingExemptions.length > 0 || staleExemptions.length > 0) {
    console.log(chalk.red.bold(".prettierignore disagrees with the parser:\n"));
    for (const file of missingExemptions) {
      console.log(chalk.red(`  unparseable but not exempted: ${file}`));
    }
    for (const file of staleExemptions) {
      console.log(chalk.red(`  exempted but parses fine:     ${file}`));
    }
    process.exit(1);
  }

  if (failed.length === 0) {
    console.log(
      chalk.green.bold(`All ${files.length} .cnx file(s) survive formatting.`),
    );
    return;
  }

  console.log(chalk.red.bold(`${failed.length} fixture(s) failed:\n`));
  for (const verdict of failed) {
    console.log(chalk.red(`  ${relative(rootDir, verdict.file)}`));
    for (const failure of verdict.failures) {
      console.log(`    ${failure.split("\n").join("\n    ")}`);
    }
  }
  process.exit(1);
}

main().catch((error: Error) => {
  console.error(chalk.red(`format-fidelity failed: ${error.stack}`));
  process.exit(1);
});
