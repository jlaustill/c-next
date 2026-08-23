/**
 * Issue #1143: The invariant that makes the requirements registry trustworthy.
 *
 * Two directions, checked over the same corpus of snippets:
 *
 *   A. Every recorded requirement's probe MUST match the generated text.
 *      A requirement -- and therefore any #error guard, banner line, report row
 *      or documentation row derived from it -- cannot exist without the
 *      emission it describes.
 *
 *   B. Every probe that matches the generated text MUST have its key recorded.
 *      An emission cannot exist without its record, so adding a new
 *      requirement-bearing construct without registering it fails here.
 *
 * Direction A is the regression test for PR #1141, which was closed after
 * review found it shipped an #error about __builtin_*_overflow into 96
 * snapshots containing no builtin. Its guard keyed on `usedClampOps.size > 0`
 * while the emission keyed on the template family, so the two could disagree.
 * Under this test that PR fails on every signed-only snippet below.
 */
import { describe, it, expect } from "vitest";
import Transpiler from "../../../Transpiler";
import MockFileSystem from "../../../__tests__/MockFileSystem";
import TOOLCHAIN_REQUIREMENTS from "../../../constants/TOOLCHAIN_REQUIREMENTS";
import type TOutputMode from "../../../types/TOutputMode";

interface ICase {
  readonly name: string;
  readonly source: string;
}

/**
 * Snippets chosen to span the requirement-bearing constructs AND to include
 * negatives -- inputs that must NOT record a given requirement. A one-sided
 * corpus would let an over-firing guard pass.
 */
const CASES: readonly ICase[] = [
  {
    name: "plain arithmetic (no requirement beyond baseline)",
    source: `u32 main() { u8 a <- 1; u8 b <- 2; if (a + b != 3) return 1; return 0; }`,
  },
  {
    name: "signed-only clamp (the #1141 over-firing case)",
    source: `u32 main() { clamp i32 v <- 1; v +<- 1; if (v != 2) return 1; return 0; }`,
  },
  {
    name: "unsigned clamp",
    source: `u32 main() { clamp u8 v <- 250; v +<- 10; if (v != 255) return 1; return 0; }`,
  },
  {
    name: "critical block",
    source: `u32 c <- 0;\nvoid bump() { critical { c <- c + 1; } }\nu32 main() { bump(); return 0; }`,
  },
  {
    name: "atomic read-modify-write, no critical block",
    source: `atomic u32 n <- 0;\nvoid main() { n +<- 1; }`,
  },
  {
    name: "float bit indexing",
    source: `u32 main() { f32 f <- 1.5; u8 x <- f[0, 8]; if (x = 0) return 1; return 0; }`,
  },
  {
    name: "struct initializer",
    source: `struct P { i32 x; i32 y; }\nu32 main() { P p <- {x: 1, y: 2}; if (p.x != 1) return 1; return 0; }`,
  },
  {
    name: "array indexing",
    source: `u32 main() { u8[4] a <- [1, 2, 3, 4]; if (a[0] != 1) return 1; return 0; }`,
  },
];

const MODES: readonly TOutputMode[] = ["c", "cpp"];

async function generate(source: string, mode: TOutputMode) {
  const transpiler = new Transpiler(
    { input: "", noCache: true, cppRequired: mode === "cpp" },
    new MockFileSystem(),
  );
  const result = await transpiler.transpile({ kind: "source", source });
  const file = result.files[0];
  const text = `${file?.code ?? ""}\n${file?.headerCode ?? ""}`;
  const keys = new Set((result.requirements ?? []).map((entry) => entry.key));
  return { text, keys };
}

describe("toolchain requirement <-> emission invariant", () => {
  for (const mode of MODES) {
    describe(`${mode} mode`, () => {
      for (const testCase of CASES) {
        it(`A: every recorded requirement is present in the output -- ${testCase.name}`, async () => {
          const { text, keys } = await generate(testCase.source, mode);
          for (const key of keys) {
            const requirement = TOOLCHAIN_REQUIREMENTS[key];
            expect(
              requirement.modes,
              `${key} recorded in ${mode} mode`,
            ).toContain(mode);
            if (requirement.probe === null) continue;
            expect(
              requirement.probe.test(text),
              `${key} was recorded but its probe ${requirement.probe} does not match the generated output`,
            ).toBe(true);
          }
        });

        it(`B: every construct present in the output is recorded -- ${testCase.name}`, async () => {
          const { text, keys } = await generate(testCase.source, mode);
          for (const requirement of Object.values(TOOLCHAIN_REQUIREMENTS)) {
            if (requirement.probe === null) continue;
            if (!requirement.modes.includes(mode)) continue;
            if (!requirement.probe.test(text)) continue;
            expect(
              keys.has(requirement.key),
              `output matches ${requirement.probe} for ${requirement.key}, but that requirement was not recorded`,
            ).toBe(true);
          }
        });
      }
    });
  }

  it("records exactly the baseline for a file that needs nothing else", async () => {
    const { keys } = await generate(
      `u32 main() { u8 a <- 1; if (a != 1) return 1; return 0; }`,
      "c",
    );
    expect(Array.from(keys)).toEqual(["baseline-c"]);
  });

  it("does not record a C++ requirement for identical C output", async () => {
    // `.field = value` is C99 in C mode and C++20 (or a GNU extension) in C++
    // mode. The text is the same; only the mode distinguishes the cost.
    const source = `struct P { i32 x; i32 y; }\nu32 main() { P p <- {x: 1, y: 2}; if (p.x != 1) return 1; return 0; }`;
    const asC = await generate(source, "c");
    const asCpp = await generate(source, "cpp");
    expect(asC.keys.has("cpp-designated-initializer")).toBe(false);
    expect(asCpp.keys.has("cpp-designated-initializer")).toBe(true);
  });
});
