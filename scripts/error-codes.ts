#!/usr/bin/env tsx
/**
 * Issue #1322: gate `docs/error-codes.md`, which says of itself that it has none.
 *
 * The registry is where "next available" is read from, so a code reserved in
 * one place and recorded nowhere is assigned twice and the collision is silent.
 * This card allocates roughly 45-60 codes into a file holding 55.
 *
 * `__tests__` is excluded from the emitted set with one exception that is not
 * an exception at all: E0000 is the reserved generic test code, and its only
 * emitter is the unit test that asserts the shape of `IBaseAnalysisError`. Its
 * row names that test file as its source, so the registry already documents
 * where it lives -- scanning tests wholesale instead would let a code invented
 * in a mock register itself as real.
 *
 * ## What this deliberately does not catch
 *
 * "Emitted" means the token `E####` appears anywhere in a non-test `.ts` file,
 * comments included. So a code deleted from its throw but still named in a
 * docstring reads as emitted, and the "no source emits it" arm will not fire.
 *
 * That is the right trade rather than an oversight. Codes are raised in several
 * shapes -- a `code:` field, a `E0856:` prefix inside a template literal, an
 * `error[E0503]:` tag -- which is why `DiagnosticManifest` matches text too,
 * and matching only the `code:` field form would miss most of `output/`. The
 * arm that actually guards against silent double-assignment is the other one:
 * a code emitted with no row. That one is exact, because a code cannot be
 * raised without its digits appearing somewhere.
 */

import { readFileSync } from "node:fs";
import { dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";

import chalk from "chalk";

import ErrorCodeRegistry from "./diagnostics/ErrorCodeRegistry";
import FileScanner from "./utils/FileScanner";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const registryPath = join(rootDir, "docs", "error-codes.md");

/** Codes a row explicitly attributes to a `__tests__` file, e.g. E0000. */
function testOwnedCodes(markdown: string): Set<string> {
  return new Set(
    ErrorCodeRegistry.rows(markdown)
      .filter((row) => row.source.includes("__tests__"))
      .map((row) => row.code),
  );
}

function emittedCodes(allowTestOwned: ReadonlySet<string>): Set<string> {
  const codes = new Set<string>();
  for (const full of FileScanner.findFiles(join(rootDir, "src"), ".ts")) {
    const isTest = full.includes(`${sep}__tests__${sep}`);
    for (const match of readFileSync(full, "utf-8").matchAll(/\bE\d{4}\b/g)) {
      if (!isTest || allowTestOwned.has(match[0])) {
        codes.add(match[0]);
      }
    }
  }
  return codes;
}

function main(): void {
  const markdown = readFileSync(registryPath, "utf-8");
  const emitted = emittedCodes(testOwnedCodes(markdown));
  const errors = ErrorCodeRegistry.check(markdown, emitted);

  if (errors.length > 0) {
    console.error(
      chalk.red(
        `docs/error-codes.md does not match the codes in src/:\n` +
          errors.map((error) => `  ${error}`).join("\n"),
      ),
    );
    process.exit(1);
  }

  console.log(
    chalk.green(
      `Error-code registry is consistent (${ErrorCodeRegistry.rows(markdown).length} row(s), ${emitted.size} emitted in src/).`,
    ),
  );
}

main();
