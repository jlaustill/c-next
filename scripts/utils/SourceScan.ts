import { readFileSync } from "node:fs";
import { join, sep } from "node:path";

import FileScanner from "./FileScanner";
import ISourceHit from "../types/ISourceHit";

const rootDir = join(__dirname, "..", "..");
const srcDir = join(rootDir, "src");

/**
 * Pattern scans over the non-test modules under `src/`, for guards that hold a
 * property of the source text. One definition of "a mention in a comment does
 * not count", shared by `render-decides-nothing.test.ts` and
 * `write-confined-to-3-1.test.ts` (#1653 moved it here rather than copy it).
 */
class SourceScan {
  /** Every source file under `src/`, excluding tests. */
  static sourceFiles(): string[] {
    return FileScanner.findFiles(srcDir, ".ts").filter(
      (full) => !full.includes(`${sep}__tests__${sep}`),
    );
  }

  /**
   * True when the match sits on a line that is itself a comment.
   *
   * Recognizes the three openers this corpus uses: a JSDoc continuation, a line
   * comment, and a bare single-line block -- the last added in the #1583 review,
   * because `/* MISRA C:2012 Rule 8.4 applies here *\/` written as documentation
   * was classified as code and would have failed the authorship assertion. House
   * style is JSDoc, so it was latent rather than live, but this function's reach
   * widened from `output/` to all of `src/`, where the population it screens is
   * much less uniform.
   */
  static inComment(source: string, index: number): boolean {
    const lineStart = source.lastIndexOf("\n", index) + 1;
    const lineEnd = source.indexOf("\n", index);
    const line = source.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
    return /^\s*(\*|\/\/|\/\*)/.test(line);
  }

  /** Every match of `pattern` under `src/`, excluding mentions in comments. */
  static scan(pattern: RegExp): ISourceHit[] {
    const hits: ISourceHit[] = [];
    for (const full of SourceScan.sourceFiles()) {
      const source = readFileSync(full, "utf-8");
      for (const match of source.matchAll(pattern)) {
        if (SourceScan.inComment(source, match.index)) continue;
        hits.push({
          file: full.slice(rootDir.length + 1),
          offset: match.index,
          text: match[0],
        });
      }
    }
    return hits;
  }
}

export default SourceScan;
