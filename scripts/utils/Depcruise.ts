import { execFileSync } from "node:child_process";
import { join } from "node:path";

import ExecFailure from "../../src/utils/ExecFailure";
import type IDepcruiseViolation from "../types/IDepcruiseViolation";

/**
 * dependency-cruiser, run through the SAME binary and config `npm run
 * depcruise` uses, so a gate built on its output and the architecture rules
 * cannot drift apart. Shared by `parse-tree-sites.ts` (#1317) and `layout.ts`
 * (#1443): two gates each spawning it would be two copies of the flags below.
 */
class Depcruise {
  /**
   * Every violation dependency-cruiser reports for the whole config.
   *
   * `depcruise` exits non-zero when there are ERROR-severity violations, but a
   * sibling rule going red must not make a caller throw something unreadable
   * instead of reporting its own result, so the exit code is ignored and the
   * JSON is what is trusted. `maxBuffer` is raised because the full graph is
   * several megabytes and the default 1MB truncates it into a parse error that
   * reads like a depcruise bug.
   */
  static violations(rootDir: string): readonly IDepcruiseViolation[] {
    const bin = join(rootDir, "node_modules", ".bin", "depcruise");
    let stdout: string;
    try {
      stdout = execFileSync(
        bin,
        ["src", "--config", ".dependency-cruiser.cjs", "--output-type", "json"],
        { cwd: rootDir, encoding: "utf-8", maxBuffer: 64 * 1024 * 1024 },
      );
    } catch (error: unknown) {
      const failure = ExecFailure.of(error);
      if (failure.stdout === undefined || failure.stdout.length === 0) {
        throw error;
      }
      stdout = failure.stdout;
    }
    const parsed: unknown = JSON.parse(stdout);
    const summary = (parsed as { summary?: { violations?: unknown } }).summary;
    if (!Array.isArray(summary?.violations)) {
      throw new Error(
        "dependency-cruiser returned no `summary.violations` array -- its JSON " +
          "shape changed, or the run produced no output",
      );
    }
    return summary.violations as readonly IDepcruiseViolation[];
  }
}

export default Depcruise;
