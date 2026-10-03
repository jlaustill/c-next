/**
 * The corpus both the throw-citations gate and its remapper read: every
 * hand-written, non-test `.ts` under `src/`, keyed by repo-relative path, plus
 * the document that classifies them.
 *
 * Extracted for #1322. The gate owned this walk; the remapper needs the exact
 * same set, and a second copy would be free to drift -- a remapper that saw one
 * more file than the gate would move a row the gate then rejects, and one that
 * saw one fewer would leave a row it could have fixed. The corpus is a decision
 * ("what does this document classify?"), so it has one definition, not two
 * callers agreeing by coincidence.
 *
 * #1531 widened it from `3-Render/` to all of `src/`. #1322 had emptied
 * `3-Render/` of rejections, and the user-facing throws left were all outside
 * it: 1.3 Declare's bitmap and enum rules reached the user as `1:0` with no
 * code, and no gate could see them. A throw can be written in any directory, so
 * the corpus is every directory, and what is left out is derived rather than
 * listed: a test, and a file ANTLR generated.
 */

import { readFileSync } from "node:fs";
import { dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";

import FileScanner from "../utils/FileScanner";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * The first line ANTLR writes into every file it generates. Keyed on the
 * generator's own mark, not on the `grammar/` directories that hold the output
 * today: a directory list is a second record of where the generator writes,
 * and a parser regenerated somewhere new would then join the corpus with every
 * throw ANTLR wrote, or a hand-written file placed in `grammar/` would leave it.
 */
const GENERATED_BY_ANTLR = /^\/\/ Generated from .* by ANTLR/;

class ThrowSources {
  static readonly docPath = join(
    rootDir,
    "docs",
    "architecture",
    "throw-classification.md",
  );

  /**
   * `__tests__` is skipped because a test's own `throw new` is not a rejection
   * the transpiler makes. A generated parser is skipped because
   * nobody writes its throws: they are ANTLR's, and regenerating would undo
   * any classification of them.
   */
  static read(): Map<string, string> {
    const sources = new Map<string, string>();
    for (const full of FileScanner.findFiles(join(rootDir, "src"), ".ts")) {
      if (full.includes(`${sep}__tests__${sep}`)) {
        continue;
      }
      const text = readFileSync(full, "utf-8");
      if (GENERATED_BY_ANTLR.test(text)) {
        continue;
      }
      sources.set(full.slice(rootDir.length + 1), text);
    }
    return sources;
  }
}

export default ThrowSources;
