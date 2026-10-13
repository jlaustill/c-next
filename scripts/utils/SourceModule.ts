import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * The one definition of "a non-test module under `src/`" (#1826 review):
 * TypeScript under `src/`, outside `__tests__/` and `__testUtils__/`, and not a
 * `*.test.ts`. The same split `.dependency-cruiser.cjs` makes. #1827 moved it
 * here from `SourceScan` so every script that scans `src/` reads the same
 * population: `ThrowSources`, `scope-join-sites` and `error-codes` each
 * skipped `__tests__/` alone, so a `__testUtils__/` double read as transpiler
 * source. It takes the absolute path a `FileScanner` walk yields, so the
 * conversion to a repository-relative path is written once, here.
 */
class SourceModule {
  static readonly rootDir = rootDir;

  /** `full` relative to the repository root, with `/` separators. */
  static relativePath(full: string): string {
    return relative(rootDir, full).split(sep).join("/");
  }

  static isModule(full: string): boolean {
    const path = SourceModule.relativePath(full);
    return (
      path.startsWith("src/") &&
      path.endsWith(".ts") &&
      !path.includes("/__tests__/") &&
      !path.includes("/__testUtils__/") &&
      !path.endsWith(".test.ts")
    );
  }
}

export default SourceModule;
