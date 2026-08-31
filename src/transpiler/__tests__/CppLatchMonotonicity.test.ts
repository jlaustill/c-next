/**
 * Issue #1319: the C++ latch is monotone, and that is gated rather than stated.
 *
 * "Is this run C++?" is seeded from `--cpp` and raised when an included header
 * proves the run emits C++. Because it only ever goes false -> true, it is
 * order-independent: one settled value per run whatever order the include graph
 * is walked. That property is the whole reason it is a legitimate cross-file
 * fact, and lowering it anywhere would silently destroy it -- a later file could
 * be emitted as C after an earlier one was emitted as C++.
 *
 * The field carried the comment "one-way flag, false -> true only" for the whole
 * time nothing checked it. Per principle 5 of docs/architecture/README.md, an
 * invariant without a gate does not count, so this reads the source and fails if
 * a second writer appears.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, it, expect } from "vitest";

import Transpiler from "../Transpiler";

const TRANSPILER_SOURCE = readFileSync(
  join(__dirname, "..", "Transpiler.ts"),
  "utf-8",
);

/** Strip comments so prose about the latch cannot satisfy or trip the gate. */
const codeLines = (source: string): string[] =>
  source
    .split("\n")
    .filter((line) => !/^\s*(\/\/|\/\*|\*)/.test(line))
    .filter((line) => line.trim() !== "");

describe("cpp latch monotonicity (#1319)", () => {
  const lines = codeLines(TRANSPILER_SOURCE);

  it("assigns the backing field in exactly one place", () => {
    const writes = lines.filter((line) =>
      /\bthis\.cppDetectedLatch\s*=(?!=)/.test(line),
    );

    expect(writes).toHaveLength(1);
  });

  it("only ever assigns true to the backing field", () => {
    const writes = lines.filter((line) =>
      /\bthis\.cppDetectedLatch\s*=(?!=)/.test(line),
    );

    for (const write of writes) {
      expect(write.trim()).toBe("this.cppDetectedLatch = true;");
    }
  });

  it("exposes no way to lower the latch", () => {
    // A setter, or any assignment through the `cppDetected` accessor, would
    // reintroduce the lowering path this class exists to forbid.
    const setters = lines.filter((line) =>
      /\bset\s+cppDetected\b|\bthis\.cppDetected\s*=(?!=)/.test(line),
    );

    expect(setters).toEqual([]);
  });

  it("routes every raise through raiseCppDetected", () => {
    // Negative control: the raises must actually exist. Without this, deleting
    // all four would pass the three assertions above -- an unwritten latch is
    // trivially monotone, and the gate would be measuring nothing.
    const raises = lines.filter((line) =>
      /\bthis\.raiseCppDetected\(\)/.test(line),
    );

    expect(raises.length).toBeGreaterThanOrEqual(4);
  });

  it("seeds from --cpp by raising, never by assigning", () => {
    // The seed used to be `this.cppDetected = this.config.cppRequired`, which is
    // an assignment of `false` on every C run -- indistinguishable from a lower.
    // It is now the absence of a raise, which is why the C case reads false here
    // without anything ever having written false.
    const c = new Transpiler({ input: "", noCache: true });
    expect(c.isCppDetected()).toBe(false);

    const cpp = new Transpiler({
      input: "",
      noCache: true,
      cppRequired: true,
    });
    expect(cpp.isCppDetected()).toBe(true);
  });
});
