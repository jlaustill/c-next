/**
 * #1827 review: `vitest.config.ts` and `sonar-project.properties` each list
 * what coverage leaves out, and neither can import `SourceModule`. Both named
 * `__tests__/` but not `__testUtils__/`, so test doubles were measured as
 * production code. `.jscpd.json` had the same gap, so a double counted against
 * the duplication threshold. This holds all three lists to
 * `SourceModule.testDirectories`.
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

  /** The `ignore` globs of `.jscpd.json` (`analyze:duplication`). */
  static jscpd(): string[] {
    const config = JSON.parse(read(".jscpd.json")) as { ignore?: string[] };
    return config.ignore ?? [];
  }
}

describe("coverage and duplication leave out every SourceModule test directory", () => {
  // Each list with an entry it is known to hold, so an empty parse fails.
  const lists: Record<string, [globs: string[], control: string]> = {
    "vitest coverage.exclude": [
      CoverageExclusions.vitest(),
      "src/cli/index.ts",
    ],
    "sonar.coverage.exclusions": [
      CoverageExclusions.sonar(),
      "src/cli/index.ts",
    ],
    ".jscpd.json ignore": [CoverageExclusions.jscpd(), "**/node_modules/**"],
  };

  for (const [name, [globs, control]] of Object.entries(lists)) {
    it(`reads ${name}`, () => {
      expect(globs).toContain(control);
    });

    it.each(SourceModule.testDirectories)(`${name} names **/%s/**`, (dir) => {
      expect(globs).toContain(`**/${dir}/**`);
    });
  }
});
