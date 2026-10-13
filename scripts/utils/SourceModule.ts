import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * The one definition of "a non-test module under `src/`" (#1826 review):
 * TypeScript under `src/`, outside `__tests__/` and `__testUtils__/`, and not a
 * `*.test.ts`. `.dependency-cruiser.cjs` draws the same line in
 * `not-to-dev-dep` and the rules whose `pathNot` names both directories, but
 * its pass-order rules exempt `__tests__/` alone, so a `__testUtils__/` double
 * is held to the layer order (#2066). #1827 moved it here from `SourceScan` so
 * every script that scans `src/` reads the same population: `ThrowSources`,
 * `scope-join-sites`, `error-codes` and `PlanRenderState` each left out
 * `__tests__/` but not `__testUtils__/`, so a `__testUtils__/` double read as
 * transpiler source. It takes the absolute path a `FileScanner` walk yields, so
 * the conversion to a repository-relative path is written once, here.
 *
 * `vitest.config.ts`, `sonar-project.properties` and `.jscpd.json` cannot import
 * this, so they repeat `testDirectories` in their coverage and duplication
 * exclusions; `coverage-exclusions.test.ts` fails when any list lacks one.
 */
class SourceModule {
  static readonly rootDir = rootDir;

  /** Directories under `src/` that hold test code, at any depth. */
  static readonly testDirectories: readonly string[] = [
    "__tests__",
    "__testUtils__",
  ];

  /** `full` relative to the repository root, with `/` separators. */
  static relativePath(full: string): string {
    return relative(rootDir, full).split(sep).join("/");
  }

  static isModule(full: string): boolean {
    return SourceModule.isModulePath(SourceModule.relativePath(full));
  }

  /** `isModule` for a path already relative to the repository root. */
  static isModulePath(path: string): boolean {
    return (
      path.startsWith("src/") &&
      path.endsWith(".ts") &&
      !SourceModule.testDirectories.some((dir) => path.includes(`/${dir}/`)) &&
      !path.endsWith(".test.ts")
    );
  }
}

export default SourceModule;
