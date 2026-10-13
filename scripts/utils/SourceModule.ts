/**
 * The one definition of "a non-test module under `src/`" (#1826 review), for a
 * repository-relative path with `/` separators: TypeScript under `src/`,
 * outside `__tests__/` and `__testUtils__/`, and not a `*.test.ts`. The same
 * split `.dependency-cruiser.cjs` makes. #1827 moved it here from
 * `SourceScan` so the doc generators read the same population: `ThrowSources`
 * and `scope-join-sites` each skipped `__tests__/` alone, so a throw in a
 * `__testUtils__/` double read as an unclassified transpiler throw.
 */
class SourceModule {
  static isModule(path: string): boolean {
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
