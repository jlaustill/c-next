import { readFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

import FileScanner from "./FileScanner";
import ISourceHit from "../types/ISourceHit";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const srcDir = join(rootDir, "src");

/**
 * Pattern scans over the non-test modules under `src/`, for guards that hold a
 * property of the source text. One definition of "a mention in a comment does
 * not count", shared by `render-decides-nothing.test.ts` and
 * `write-confined-to-3-1.test.ts` (#1653 moved it here rather than copy it).
 */
class SourceScan {
  /**
   * The one definition of "a non-test module under `src/`" (#1826 review), for
   * a repository-relative path with `/` separators: TypeScript under `src/`,
   * outside `__tests__/` and `__testUtils__/`, and not a `*.test.ts`. The same
   * split `.dependency-cruiser.cjs` makes. `destinations:check` counts its
   * population with it, and the scans here read theirs through it.
   */
  static isModule(path: string): boolean {
    return (
      path.startsWith("src/") &&
      path.endsWith(".ts") &&
      !path.includes("/__tests__/") &&
      !path.includes("/__testUtils__/") &&
      !path.endsWith(".test.ts")
    );
  }

  /** Every non-test module under `src/`, as absolute paths. */
  static sourceFiles(): string[] {
    return FileScanner.findFiles(srcDir, ".ts").filter((full) =>
      SourceScan.isModule(relative(rootDir, full).split(sep).join("/")),
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

  /**
   * Every match of `pattern` under `src/`, excluding mentions in comments.
   * @public read by the architecture guard tests (render-decides-nothing, write-confined-to-3-1), which are the check
   */
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
