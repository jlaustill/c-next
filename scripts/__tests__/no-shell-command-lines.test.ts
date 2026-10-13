/**
 * #1827 box 4: no module under `src/` builds a shell command line from a
 * template literal. `ToolchainDetector` did, three times, and one of the values
 * it interpolated came from the project being compiled. A process is started
 * with an argument array (`execFileSync`, `spawnSync`, `execFile`), so no shell
 * parses a name or a path.
 *
 * What this cannot catch: a command line built into a variable first and passed
 * as `execSync(command)`. It matches the call that takes the template directly,
 * which is how all three sites were written.
 */
import { describe, expect, it } from "vitest";

import SourceScan from "./SourceScan";

// `\b` admits `child_process.execSync(` and `cp.execSync(`; `\s*` admits the
// template on the next line, as prettier wraps a long one.
const SHELL_TEMPLATE = /\bexecSync\(\s*`/g;

describe("no shell command line is built from a template literal", () => {
  it("no non-test module under src/ calls execSync with a template literal", () => {
    const hits = SourceScan.scan(SHELL_TEMPLATE).map(
      (hit) => `${hit.file}: ${hit.text}`,
    );
    expect(hits).toEqual([]);
  });

  // Population control: the scan reads the module that held the three sites,
  // and the pattern matches each spelling they had. Without it, a scan over
  // the wrong population, or a pattern that matches nothing, passes above.
  it("scans the module that held the defect", () => {
    expect(
      SourceScan.sourceFiles().some((file) =>
        file.endsWith(
          "src/cnx/PARSE/1-Discover/preprocessor/ToolchainDetector.ts",
        ),
      ),
    ).toBe(true);
  });

  it.each([
    "const result = execSync(`which ${name}`, {",
    "const result = execSync(`${compiler} --version`, {",
    "const result = execSync(\n  `echo | ${toolchain.cc} -E -Wp,-v - 2>&1`,",
    "child_process.execSync(`${cmd}`)",
  ])("matches %j", (line) => {
    expect([...line.matchAll(SHELL_TEMPLATE)]).toHaveLength(1);
  });

  it("does not match a call that passes an argument array", () => {
    const line = 'execFileSync(compiler, ["--version"], { encoding: "utf-8" })';
    expect([...line.matchAll(SHELL_TEMPLATE)]).toHaveLength(0);
  });
});
