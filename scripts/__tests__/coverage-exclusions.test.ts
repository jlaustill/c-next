/**
 * #1827 review: `vitest.config.ts` and `sonar-project.properties` each list
 * what coverage leaves out, and neither can import `SourceModule`. Both named
 * `__tests__/` but not `__testUtils__/`, so test doubles were measured as
 * production code. This holds both lists to `SourceModule.testDirectories`.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import SourceModule from "../utils/SourceModule";

const read = (file: string) =>
  readFileSync(join(SourceModule.rootDir, file), "utf-8");

class CoverageExclusions {
  /** The string literals in `test.coverage.exclude` of `vitest.config.ts`. */
  static vitest(): string[] {
    const block = /coverage:\s*\{[\s\S]*?exclude:\s*\[([\s\S]*?)\]/.exec(
      read("vitest.config.ts"),
    );
    return [...(block?.[1] ?? "").matchAll(/"([^"]*)"/g)].map((m) => m[1]);
  }

  /** The comma-separated globs of `sonar.coverage.exclusions`. */
  static sonar(): string[] {
    const line = /^sonar\.coverage\.exclusions=(.*)$/m.exec(
      read("sonar-project.properties"),
    );
    return (line?.[1] ?? "").split(",").map((glob) => glob.trim());
  }
}

describe("coverage leaves out every test directory SourceModule names", () => {
  const lists = {
    "vitest coverage.exclude": CoverageExclusions.vitest(),
    "sonar.coverage.exclusions": CoverageExclusions.sonar(),
  };

  for (const [name, globs] of Object.entries(lists)) {
    // Control: the list was found, so an empty parse cannot pass below.
    it(`reads ${name}`, () => {
      expect(globs).toContain("src/cli/index.ts");
    });

    it.each(SourceModule.testDirectories)(`${name} names **/%s/**`, (dir) => {
      expect(globs).toContain(`**/${dir}/**`);
    });
  }
});
