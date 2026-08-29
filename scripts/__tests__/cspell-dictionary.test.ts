/**
 * Issue #1309: invariants on the `.cspell.json` word list.
 *
 * The dangerous failure here is silent growth. A list that is not sorted cannot
 * be searched, so contributors append instead of merging; an appended block
 * accumulates entries the list already covers, and cspell reports nothing
 * because a redundant entry is not an error. The list then grows monotonically
 * while its ability to catch a real typo stays flat.
 *
 * That is exactly how this file reached the state #1309 was filed against: 164
 * words were appended as a second sorted island after the existing one, and
 * carried nine entries already covered by a neighbor plus three British
 * spellings the project rejects everywhere it checks.
 *
 * The redundancy rules below are cspell's matching semantics, verified against
 * the real binary rather than assumed. To re-verify after a cspell upgrade,
 * delete a suspected-redundant entry and spell-check a file containing it:
 * a still-clean run means the remaining entry covers it.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const CONFIG_PATH = join(__dirname, "..", "..", ".cspell.json");

const words = (): string[] => {
  const config: unknown = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
  const list = (config as { words?: unknown }).words;
  if (!Array.isArray(list)) {
    throw new Error(`.cspell.json has no "words" array`);
  }
  return list as string[];
};

/** Case-insensitive, with the exact string as a deterministic tie-break. */
const inOrder = (left: string, right: string): boolean => {
  const a: [string, string] = [left.toLowerCase(), left];
  const b: [string, string] = [right.toLowerCase(), right];
  if (a[0] !== b[0]) return a[0] < b[0];
  return a[1] <= b[1];
};

describe(".cspell.json word list", () => {
  it("is a single case-insensitively sorted list", () => {
    const list = words();
    const outOfOrder = list
      .slice(1)
      .map((word, index) => ({ previous: list[index], word }))
      .filter((pair) => !inOrder(pair.previous, pair.word))
      .map((pair) => `${pair.previous} -> ${pair.word}`);

    expect(outOfOrder).toEqual([]);
  });

  it("has no exact duplicate entries", () => {
    const list = words();
    const seen = new Set<string>();
    const duplicates = list.filter((word) => {
      if (seen.has(word)) return true;
      seen.add(word);
      return false;
    });

    expect(duplicates).toEqual([]);
  });

  it("has no entry another entry already covers", () => {
    // A lowercase entry matches every case form of the word, and a base name
    // matches its possessive, so either variant alongside its base is dead
    // weight that hides the next duplicate.
    const list = words();
    const present = new Set(list);
    const covered = list
      .map((word) => {
        if (word !== word.toLowerCase() && present.has(word.toLowerCase())) {
          return `${word} (covered by ${word.toLowerCase()})`;
        }
        if (word.endsWith("'s") && present.has(word.slice(0, -2))) {
          return `${word} (covered by ${word.slice(0, -2)})`;
        }
        return null;
      })
      .filter((entry) => entry !== null);

    expect(covered).toEqual([]);
  });
});
