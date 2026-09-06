#!/usr/bin/env tsx
/**
 * #1449: compile every generated header on its own.
 *
 * A generated header is only ever seen by a compiler through the `.c` that
 * includes it, and `assembleGeneratedOutput` pushes that self-include BEFORE
 * the auto-includes -- so most missing includes do surface. Most, not all: a
 * header with no self-including `.c`, or one belonging to a
 * `// test-transpile-only` fixture, is compiled by nothing at all. #1520 lived
 * there, and it is the shape this gate exists for.
 *
 * Self-containment is also a property a header ought to have on its own terms.
 * A consumer includes it first, or alone, or after something unrelated; a
 * header that only works in one of those orders is a header whose includes are
 * the caller's problem.
 *
 * ## It compiles the GENERATED files, never the snapshots
 *
 * `.expected.*` would be the wrong input: 48 of them are stale and 60 are
 * compared by nothing (#1521). Pointed at those, this gate reports a live
 * codegen bug for `chain-types-mid.expected.h` that does not exist -- the
 * committed `chain-types-mid.h` compiles clean. The generated file is what the
 * transpiler currently claims, so the generated file is what gets compiled.
 *
 * Usage:
 *   npm run headers:standalone        -- report
 *   npm run headers:standalone:check  -- fail on any unexpected result
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import chalk from "chalk";

import FileScanner from "./utils/FileScanner";
import HeaderPopulation from "./headers/HeaderPopulation";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const testsDir = join(rootDir, "tests");

/**
 * Headers that do not compile alone, and the reason each is allowed to.
 *
 * A two-sided ratchet, the shape `diagnostics:manifest` uses: an entry that
 * starts passing is reported as stale and must be deleted, so the list can only
 * shrink. A bare exclusion list would let a fix go unnoticed and the reason rot
 * in place.
 */
const EXPECTED_FAILURES: ReadonlyMap<string, string> = new Map([
  [
    "tests/bugs/issue-1312-undefined-type-position/sibling-consumer.h",
    "the source deliberately names an undefined `Mode` -- it is the negative " +
      "control for #1312's diagnostic, so its header cannot compile and a " +
      "version that did would mean the fixture had stopped testing anything",
  ],
]);

const sourceCache = new Map<string, string>();
function readSource(path: string): string {
  const cached = sourceCache.get(path);
  if (cached !== undefined) return cached;
  const text = readFileSync(path, "utf-8");
  sourceCache.set(path, text);
  return text;
}

interface IOutcome {
  readonly path: string;
  readonly compiled: boolean;
  readonly error: string;
}

function compileAlone(header: string): IOutcome {
  const isCpp = header.endsWith(".hpp");
  const compiler = isCpp ? "g++" : "gcc";
  const args = [
    "-fsyntax-only",
    isCpp ? "-std=c++14" : "-std=c99",
    "-x",
    isCpp ? "c++" : "c",
    "-I",
    join(rootDir, "tests/include"),
    "-I",
    dirname(header),
    header,
  ];
  try {
    execFileSync(compiler, args, {
      encoding: "utf-8",
      timeout: 20000,
      stdio: "pipe",
    });
    return { path: header, compiled: true, error: "" };
  } catch (error: unknown) {
    const err = error as { stderr?: string; stdout?: string; message: string };
    const output = err.stderr || err.stdout || err.message;
    const first =
      output
        .split("\n")
        .find((line) => line.includes("error:"))
        ?.trim() ?? output.split("\n")[0];
    return { path: header, compiled: false, error: first };
  }
}

function generatedHeaders(): string[] {
  const headers: string[] = [];
  for (const suffix of [".h", ".hpp"]) {
    for (const full of FileScanner.findFiles(testsDir, suffix)) {
      if (full.includes(".expected.")) continue;
      const source = HeaderPopulation.sourceOf(full, existsSync);
      if (source === null) continue; // not transpiler output
      if (HeaderPopulation.isModeOrphan(full, readSource(source))) {
        continue; // #1149
      }
      headers.push(full);
    }
  }
  return headers.sort();
}

function main(): void {
  const check = process.argv.includes("check");
  const headers = generatedHeaders();
  const failures = new Map<string, string>();

  for (const header of headers) {
    const outcome = compileAlone(header);
    if (!outcome.compiled) {
      failures.set(header.slice(rootDir.length + 1), outcome.error);
    }
  }

  const unexpected = [...failures].filter(
    ([path]) => !EXPECTED_FAILURES.has(path),
  );
  const stale = [...EXPECTED_FAILURES.keys()].filter(
    (path) => !failures.has(path),
  );

  console.log(
    `${headers.length} generated header(s) compiled standalone; ` +
      `${failures.size} did not, ${EXPECTED_FAILURES.size} expected.`,
  );

  for (const [path, error] of unexpected) {
    console.log(chalk.red(`  does not compile alone: ${path}`));
    console.log(chalk.red(`    ${error}`));
  }
  for (const path of stale) {
    console.log(
      chalk.red(
        `  now compiles, so its EXPECTED_FAILURES entry is stale: ${path}`,
      ),
    );
  }

  if (check && (unexpected.length > 0 || stale.length > 0)) {
    console.log(
      chalk.red(
        "\nA generated header must compile on its own. Fix the header, or -- " +
          "if it cannot compile by design -- add it to EXPECTED_FAILURES with " +
          "the reason.",
      ),
    );
    process.exitCode = 1;
    return;
  }
  console.log(chalk.green("\nEvery generated header compiles standalone."));
}

main();
