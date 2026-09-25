/**
 * #1662: `Transpiler.warnings` and `anyHeaderPreprocessFailed` are run-scoped
 * facts that `_initializeRun` did not reset.
 *
 * `warnings` is built in the CONSTRUCTOR and pushed to per run, so on one
 * transpiler three runs over the same source reported 1, then 2, then 3 copies
 * of the same missing-header warning. `ServeCommand` holds a
 * `private static transpiler`, so every result it returns carried every earlier
 * request's warnings.
 *
 * Found by the #1657 review, which reproduced it on BASE as well as HEAD -- it
 * predates #1452. It is fixed here rather than left filed because #1452 rewrote
 * that teardown as hand-listed `.clear()` calls and already dropped two fields
 * doing it; a third missing field in the same method is the same defect, not a
 * neighboring one.
 */
import { describe, it, expect } from "vitest";
import Transpiler from "../Transpiler";

/** The latch #985's recovery path is gated on, which is private. */
function preprocessFailedFlag(transpiler: Transpiler): boolean {
  return (transpiler as unknown as { anyHeaderPreprocessFailed: boolean })
    .anyHeaderPreprocessFailed;
}

const SOURCE = `#include "definitely-missing-header.h"

i32 main() {
    return 0;
}`;

describe("run-scoped warnings (#1662)", () => {
  it("reports each run's own warnings, not every earlier run's too", async () => {
    const transpiler = new Transpiler({ input: "", noCache: true });
    const run = async () =>
      (await transpiler.transpile({ kind: "source", source: SOURCE })).warnings
        .length;

    expect([await run(), await run(), await run()]).toEqual([
      await freshCount(),
      await freshCount(),
      await freshCount(),
    ]);
  });

  it("gives the same count on a fresh transpiler, so the case above is retention", async () => {
    // NEGATIVE CONTROL. Without it, a change that silenced the warning entirely
    // would satisfy the assertion above with [0, 0, 0].
    expect(await freshCount()).toBeGreaterThan(0);
  });

  it("clears the preprocess-failure latch between runs", async () => {
    // Asserted on the field rather than through behavior, and deliberately:
    // the latch gates `_collectExternalDeclarations`, which shells out to a
    // real preprocessor, so the only toolchain-free way to tell a cleared latch
    // from a set one is to look. A stale `true` makes a clean run pay for #985
    // recovery it does not need AND admits recovered names that can silence a
    // diagnostic -- the shape #1177 hit with `externalDeclarationNames`.
    const transpiler = new Transpiler({ input: "", noCache: true });

    (
      transpiler as unknown as { anyHeaderPreprocessFailed: boolean }
    ).anyHeaderPreprocessFailed = true;
    await transpiler.transpile({ kind: "source", source: SOURCE });

    expect(preprocessFailedFlag(transpiler)).toBe(false);
  });
});

/** The warning count a transpiler that has never run anything else reports. */
async function freshCount(): Promise<number> {
  const result = await new Transpiler({ input: "", noCache: true }).transpile({
    kind: "source",
    source: SOURCE,
  });
  return result.warnings.length;
}
