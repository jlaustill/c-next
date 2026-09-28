/**
 * #1760 second review: a host `// test-target-xfail` marked the whole cell as
 * an expected failure, so a `// test-execution` fixture whose -Werror compile
 * failed on a warning (#1062) was never run -- eight fixtures that executed
 * before stopped executing, and nothing reported it. The marker now waives
 * the -Werror compile only: the program still links and runs, and must pass.
 * And a quoted text is the failure the cell must show, so an expected failure
 * cannot absorb an unrelated one.
 *
 * Each case builds a real fixture and runs the harness on it, host alone.
 */

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import TestUtils from "../test-utils";

const rootDir = join(__dirname, "..", "..");
const TOOLS = { gcc: true };

/** A host program whose -Werror compile fails on #1062's warning */
const program = (marker: string, result: number): string =>
  [
    "#pragma target host",
    "// test-execution",
    "// test-c-only",
    marker,
    "u32 main() {",
    "    u64 q <- 1;",
    "    if (q = 18446744073709551615) return 1;",
    `    return ${result};`,
    "}",
    "",
  ].join("\n");

const WARNING =
  '// test-target-xfail: host #1062 "integer constant is so large that it is unsigned"';

describe("a host xfail waives the -Werror compile, not the execution", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "xfail-waiver-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  const run = (source: string) => {
    const file = join(dir, "probe.test.cnx");
    writeFileSync(file, source);
    return TestUtils.runTest(file, true, TOOLS, rootDir, {});
  };

  it("runs the program, and passes when it does", async () => {
    const result = await run(program(WARNING, 0));
    expect(result.passed).toBe(true);
    expect(result.message ?? "").not.toContain("exec skipped");
  }, 60000);

  it("fails when the program it still runs fails", async () => {
    const result = await run(program(WARNING, 3));
    expect(result.passed).toBe(false);
  }, 60000);

  it("fails when the cell fails otherwise than the marker quotes", async () => {
    const result = await run(
      program('// test-target-xfail: host #1062 "some other failure"', 0),
    );
    expect(result.passed).toBe(false);
    expect(result.message).toContain(
      'expects host to fail with "some other failure"',
    );
  }, 60000);
});
