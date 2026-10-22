/**
 * #2163: the language's former name stays gone.
 *
 * The rename to cnx removed every spelling of the former name, history
 * included (owner ruling, 2026-10-22: "no old names have to stay"). What still
 * spells it is code that has to: the migration errors that recognize an old
 * config name, environment variable, source extension or build script, their
 * tests and fixtures, and the notes that tell an upgrading user what to rename.
 * Every file that may spell it is listed below with the reason it may.
 *
 * A two-sided ratchet, the shape `header-standalone.ts` uses: a file that
 * starts spelling the former name fails, and so does a listed file that stops,
 * so the list only shrinks. Retiring a migration error takes its files off the
 * list in the same change.
 */

import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import ExecFailure from "../../src/cnx/utils/ExecFailure";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * Both spellings, with the hyphen and without. An extended regular expression
 * for `git grep -E` and a JavaScript one alike, matched in any case by both.
 */
const FORMER_NAME = "c-?next";

const CONFIG = "E0918 (#2165): the config file names before the rename";
const CROSS_COMPILER =
  "E0924 (#2166): the cross-compiler variable before the rename";
const EXTENSION = "E0519 (#2167): the source extension before the rename";
const BUILD_SCRIPT =
  "#2174: the PlatformIO build script before the rename, and the command it ran";
const HELP = "#2164: `--help` must never print the former command name";
const NOTES = "upgrade notes: what a user renames, and the code naming each";
const VENDORED = "vendored FreeRTOS: `cNextChar` is its identifier";

/** Files whose CONTENT may spell the former name. */
const CONTENT: ReadonlyMap<string, string> = new Map([
  [".cspell.json", "the words the migration code below spells"],
  ["CHANGELOG.md", NOTES],
  ["docs/architecture/throw-classification.md", EXTENSION],
  ["docs/decisions/adr-010-c-interoperability.md", EXTENSION],
  ["docs/error-codes.md", NOTES],
  ["docs/platformio-integration.md", NOTES],
  ["scripts/__tests__/cnx-extension-one-rule.test.ts", EXTENSION],
  ["scripts/__tests__/former-name.test.ts", "this guard, which lists them"],
  ["scripts/test-cli.ts", `${HELP}; ${BUILD_SCRIPT}; ${CONFIG}`],
  ["src/cli/PlatformIOCommand.ts", BUILD_SCRIPT],
  ["src/cli/__tests__/Cli.test.ts", CONFIG],
  ["src/cli/__tests__/ConfigLoader.test.ts", CONFIG],
  ["src/cli/__tests__/CrossCompilerVariable.test.ts", CROSS_COMPILER],
  ["src/cli/__tests__/MiscasedCnxExtension.test.ts", EXTENSION],
  ["src/cli/__tests__/PlatformIOCommand.test.ts", `${BUILD_SCRIPT}; ${CONFIG}`],
  [
    "src/cli/__tests__/cnx/PARSE/1-Discover/Discover.test.ts",
    `${CROSS_COMPILER}; ${CONFIG}`,
  ],
  [
    "src/cli/__tests__/cnx/TRANSPILE/1-Analyze/IncludeDirectiveAnalyzer.test.ts",
    EXTENSION,
  ],
  ["src/cli/serve/__tests__/ServeCommand.test.ts", CONFIG],
  ["src/cnx/PARSE/1-Discover/ConfigFileNames.ts", CONFIG],
  ["src/cnx/PARSE/1-Discover/CrossCompilerVariable.ts", CROSS_COMPILER],
  ["src/cnx/PARSE/1-Discover/__tests__/ConfigFileNames.test.ts", CONFIG],
  [
    "src/cnx/PARSE/1-Discover/__tests__/CppEntryPointScanner.test.ts",
    EXTENSION,
  ],
  ["src/cnx/PARSE/1-Discover/__tests__/IncludeDiscovery.test.ts", CONFIG],
  ["src/cnx/PARSE/1-Discover/__tests__/IncludeResolver.test.ts", EXTENSION],
  ["src/cnx/PARSE/1-Discover/__tests__/InputExpansion.test.ts", EXTENSION],
  ["src/cnx/PARSE/1-Discover/types/EFileType.ts", EXTENSION],
  ["src/cnx/TRANSPILE/1-Analyze/IncludeDirectiveAnalyzer.ts", EXTENSION],
  ["src/cnx/utils/CnxSourcePath.ts", EXTENSION],
  ["src/cnx/utils/__tests__/CnxSourcePath.test.ts", EXTENSION],
  [
    "tests/bugs/issue-1833-miscased-cnx-extension/miscased-include-error.test.cnx",
    EXTENSION,
  ],
  [
    "tests/bugs/issue-2165-renamed-config/renamed-config-beside-include.expected.error",
    CONFIG,
  ],
  [
    "tests/bugs/issue-2165-renamed-config/renamed-config-beside-include.test.cnx",
    CONFIG,
  ],
  [
    "tests/bugs/issue-2167-retired-extension/retired-include-error.expected.error",
    EXTENSION,
  ],
  [
    "tests/bugs/issue-2167-retired-extension/retired-include-error.test.cnx",
    EXTENSION,
  ],
  ["tests/bugs/issue-2167-retired-extension/retired-helper.cnext", EXTENSION],
  ["tests/libs/FreeRTOS/tasks.c", VENDORED],
]);

/** Files whose NAME may spell the former name: fixtures that must be found by it. */
const NAMES: ReadonlyMap<string, string> = new Map([
  ["tests/bugs/issue-2165-renamed-config/lib/cnext.config.json", CONFIG],
  ["tests/bugs/issue-2165-renamed-config/nested/cnext.config.json", CONFIG],
  ["tests/bugs/issue-2167-retired-extension/retired-helper.cnext", EXTENSION],
]);

function git(args: string[]): string[] {
  try {
    return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" })
      .split("\n")
      .filter((line) => line !== "");
  } catch (error: unknown) {
    // `git grep` exits 1 when nothing matches, which is an answer, not a failure.
    if (ExecFailure.of(error).status === 1) return [];
    throw error;
  }
}

/** The difference between what spells the name and what may, in both directions. */
function drift(
  found: readonly string[],
  allowed: ReadonlyMap<string, string>,
): { unlisted: string[]; stale: string[] } {
  const present = new Set(found);
  return {
    unlisted: found.filter((path) => !allowed.has(path)),
    stale: [...allowed.keys()].filter((path) => !present.has(path)),
  };
}

describe("the former name stays gone (#2163)", () => {
  it("is spelled only in files that detect it or tell a user to rename it", () => {
    const found = git(["grep", "-l", "-i", "-E", FORMER_NAME, "--", "."]);
    expect(drift(found, CONTENT)).toEqual({ unlisted: [], stale: [] });
  });

  it("names only the fixtures that have to carry it", () => {
    const pattern = new RegExp(FORMER_NAME, "i");
    const found = git(["ls-files"]).filter((path) => pattern.test(path));
    expect(drift(found, NAMES)).toEqual({ unlisted: [], stale: [] });
  });
});
