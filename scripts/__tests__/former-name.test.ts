/**
 * #2163: the language's former name stays gone.
 *
 * The rename to cnx removed every spelling of the former name, history and
 * upgrade paths included (owner rulings, 2026-10-22: "no old names have to
 * stay", and the migration errors that recognized them are removed). No file
 * may spell it, in its content or in its path, unless it is listed below with
 * the reason it may.
 *
 * A two-sided ratchet, the shape `header-standalone.ts` uses: a file that
 * starts spelling the former name fails, and so does a listed file that stops,
 * so the list only shrinks.
 */

import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import ExecFailure from "../../src/cnx/utils/ExecFailure";
import FormerName from "../utils/FormerName";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Files whose CONTENT may spell the former name. */
const CONTENT: ReadonlyMap<string, string> = new Map([
  [
    "tests/libs/FreeRTOS/tasks.c",
    "vendored FreeRTOS: one of its own identifiers contains the letters",
  ],
]);

/** Files whose PATH may spell the former name. */
const NAMES: ReadonlyMap<string, string> = new Map();

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
  it("is spelled in no file's content but the listed ones", () => {
    const found = git([
      "grep",
      "-l",
      "-i",
      "-E",
      FormerName.PATTERN,
      "--",
      ".",
    ]);
    expect(drift(found, CONTENT)).toEqual({ unlisted: [], stale: [] });
  });

  it("is spelled in no tracked path but the listed ones", () => {
    const tracked = git(["ls-files"]);
    // Guards the selector: with no listed path left, an empty listing would
    // pass the assertion below over nothing.
    expect(tracked.length).toBeGreaterThan(1000);
    const found = tracked.filter((path) => FormerName.isIn(path));
    expect(drift(found, NAMES)).toEqual({ unlisted: [], stale: [] });
  });
});
