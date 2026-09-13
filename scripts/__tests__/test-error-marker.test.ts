/**
 * #1379: the `// test-error` marker was never read.
 *
 * The runner decided "is this an error fixture?" from the presence of the
 * `.expected.error` file alone. So a fixture declaring itself an error case
 * whose diagnostic did not fire was snapshotted as an ordinary passing
 * fixture -- `.expected.c` written, run reported green.
 *
 * That is the documented TDD order for a diagnostic (write the fixture that
 * should be rejected, watch it fail, then implement) and step two silently
 * succeeded, so the fixture was committed asserting nothing. Green whether or
 * not the diagnostic was ever implemented: the "test that cannot fail" shape,
 * arrived at through the documented workflow.
 *
 * #1316 fixed the TRANSITION -- an existing `.expected.error` unlinked and
 * rewritten as a `.expected.c`. It cannot fire here, because there was never
 * an `.expected.error` to transition away from.
 *
 * The marker and the file are two assertions of ONE fact. These four cases are
 * the whole decision, and the two failing ones are the directions it used to
 * fail open in.
 */

import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  existsSync,
  readFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import TestUtils from "../test-utils";

const rootDir = join(__dirname, "..", "..");

/** No gcc: these cases are decided at transpile time, before compilation. */
const TOOLS = { gcc: false };

const VALID = "u32 main() {\n    return 0;\n}\n";
const REJECTED =
  "u32 main() {\n    u32 x <- undefinedThing;\n    return 0;\n}\n";

describe("the // test-error marker decides, and disagreement is loud (#1379)", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "test-error-marker-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function fixture(source: string): string {
    const file = join(dir, "probe.test.cnx");
    writeFileSync(file, source);
    return file;
  }

  it("fails when a fixture declares the marker and produces no diagnostic", async () => {
    // The defect itself. This used to pass and write snapshots.
    const result = await TestUtils.runTest(
      fixture(`// test-error\n${VALID}`),
      true, // --update: the mode the bug was reported under
      TOOLS,
      rootDir,
      {},
    );

    expect(result.passed).toBe(false);
    expect(result.message).toContain("produced no diagnostic");
    // and it must not leave the snapshots it used to write
    expect(existsSync(join(dir, "probe.expected.c"))).toBe(false);
    expect(existsSync(join(dir, "probe.expected.cpp"))).toBe(false);
  });

  it("fails when a fixture declares the marker and its assertion is missing", async () => {
    const result = await TestUtils.runTest(
      fixture(`// test-error\n${REJECTED}`),
      false,
      TOOLS,
      rootDir,
      {},
    );

    expect(result.passed).toBe(false);
    expect(result.message).toContain("--update");
  });

  it("bootstraps the assertion under --update, from the real diagnostic", async () => {
    // The TDD order the card describes, now succeeding on purpose instead of
    // by failing open.
    const result = await TestUtils.runTest(
      fixture(`// test-error\n${REJECTED}`),
      true,
      TOOLS,
      rootDir,
      {},
    );

    expect(result.passed).toBe(true);
    const written = join(dir, "probe.expected.error");
    expect(existsSync(written)).toBe(true);
    expect(readFileSync(written, "utf-8")).toContain("E0427");
  });

  it("fails when an assertion exists and the fixture does not declare the marker", async () => {
    // The other direction, and the one 109 fixtures were in. Decided before
    // any transpilation, which is why it needs no diagnostic to trigger.
    const file = fixture(VALID);
    writeFileSync(join(dir, "probe.expected.error"), "1:1 error[E0000]: x\n");

    const result = await TestUtils.runTest(file, false, TOOLS, rootDir, {});

    expect(result.passed).toBe(false);
    expect(result.message).toContain("does not declare");
  });

  it("reports a committed C++ snapshot rather than silently cleaning it", async () => {
    // #1555 review, found auditing this PR: `runErrorTest` cleans files at the
    // start of a run, and it was hand-extended with the C++ pair on the belief
    // that this closed the orphan gap. It could not -- the forbidden-artifact
    // guard runs FIRST in `runTest` and returns, so the cleanup never sees
    // them, and the additions were dead the moment they were written.
    //
    // This asserts the behavior that actually matters, not which list holds
    // the entry: a committed snapshot beside an error fixture is REPORTED, so
    // an author deletes it deliberately. Silently cleaning it would rewrite the
    // working tree during a test run and leave nothing to explain why.
    const file = fixture(`// test-error\n${REJECTED}`);
    await TestUtils.runTest(file, true, TOOLS, rootDir, {});
    const orphan = join(dir, "probe.expected.cpp");
    writeFileSync(orphan, "/* a snapshot nothing regenerates or compares */\n");

    const result = await TestUtils.runTest(file, false, TOOLS, rootDir, {});

    expect(result.passed).toBe(false);
    expect(result.message).toContain("stale generated artifacts");
    expect(existsSync(orphan)).toBe(true); // reported, not deleted
  });

  it("passes when the marker and the assertion agree", async () => {
    // Negative control: the 376 fixtures in this state must stay green, or the
    // four assertions above would be satisfied by a runner that fails on
    // everything.
    const file = fixture(`// test-error\n${REJECTED}`);
    await TestUtils.runTest(file, true, TOOLS, rootDir, {});

    const result = await TestUtils.runTest(file, false, TOOLS, rootDir, {});
    expect(result.passed).toBe(true);
  });
});
