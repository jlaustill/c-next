/**
 * The corpus both the throw-citations gate and its remapper read: every
 * non-test `.ts` under `src/transpiler/output/`, keyed by repo-relative path,
 * plus the document that classifies them.
 *
 * Extracted for #1322. The gate owned this walk; the remapper needs the exact
 * same set, and a second copy would be free to drift -- a remapper that saw one
 * more file than the gate would move a row the gate then rejects, and one that
 * saw one fewer would leave a row it could have fixed. The corpus is a decision
 * ("what does this document classify?"), so it has one definition, not two
 * callers agreeing by coincidence.
 */

import { readFileSync } from "node:fs";
import { dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";

import FileScanner from "../utils/FileScanner";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

class OutputThrowSources {
  static readonly docPath = join(
    rootDir,
    "docs",
    "architecture",
    "output-throw-classification.md",
  );

  /**
   * `__tests__` is skipped because a test's own `throw new` is not a rejection
   * the Plan/Render boundary has to account for -- 24 of them exist, and the
   * document's own command spells the same exclusion as `| grep -v __tests__`.
   */
  static read(): Map<string, string> {
    const sources = new Map<string, string>();
    const outputDir = join(rootDir, "src", "transpiler", "output");
    for (const full of FileScanner.findFiles(outputDir, ".ts")) {
      if (full.includes(`${sep}__tests__${sep}`)) {
        continue;
      }
      sources.set(full.slice(rootDir.length + 1), readFileSync(full, "utf-8"));
    }
    return sources;
  }
}

export default OutputThrowSources;
