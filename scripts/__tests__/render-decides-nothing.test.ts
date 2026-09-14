/**
 * #1449: 2.2 decides, 2.3 formats -- asserted, not remembered.
 *
 * `docs/architecture/README.md` §1 gives 2.2 Plan the question "does this file
 * need `<stdint.h>`?" and gives 2.3 Render only the text. Nothing enforced it:
 * the answer crossed the boundary as `CodeGenState.needsStdint`, and a flag is a QUESTION,
 * so every reader answered it again. `addAutoIncludes` answered "emit it if the
 * flag is set" while `HeaderGeneratorUtils` answered "emit it always" -- one
 * question, two derivations, agreeing only on files where both happened to be
 * true.
 *
 * The fix is not "read the flag in fewer places", it is that a renderer must
 * not read the flag AT ALL: it reads `IEmissionPlan`, which holds the strings
 * to emit. So the property with teeth is about WHERE a `needs*` flag may be
 * read, and there are exactly two such places -- the captures that freeze the
 * questions for the plan to answer, one per emitted artifact.
 *
 * This is the `layer-rules.test.ts` shape: a claim a comment cannot hold,
 * because the next person to add an include flag will reach for the pattern
 * they find, and what they find is what this file constrains.
 *
 * ## Why this file covers five categories and not one
 *
 * #1449's definition of done says every "does this file need X?" decision is
 * made in 2.2 Plan exactly once, and names five: includes, helpers, MISRA
 * annotations, declaration order, and toolchain requirements. That box sat
 * unchecked with the reason on it -- "**exactly once** is a completeness claim
 * over all of `output/`, and nothing gates it yet". This file used to gate two
 * of the five (includes and helpers, both `CodeGenState` reads) over `output/`
 * alone, which is why the box could not be ticked from it.
 *
 * The three additions close that, each against the mutation that would
 * reintroduce the original defect:
 *
 * - **Scope.** The scan root was `src/transpiler/output/`, so the `needsISR`
 *   read in `Transpiler._captureHeaderEmissionFacts` -- a legitimate capture,
 *   but the SECOND one -- was outside the guard's view entirely. A new reader
 *   added beside it would have been invisible. The root is now `src/`, and
 *   both captures are named.
 * - **Toolchain requirements** need no separate assertion: `needsISR`,
 *   `needsIrqWrappers` and `needsFloatStaticAssert` ARE `needs*` flags, so the
 *   widened read rule is what covers them. Recorded here because "it is already
 *   covered" is exactly the claim a later reader would otherwise re-derive.
 * - **MISRA annotations** are text emitted INTO the generated C, so the
 *   authorship rule is about who may write that text. Note the discriminator:
 *   not the word "MISRA", which appears in two dozen legitimate *diagnostic*
 *   messages under `1-Analyze/`, but a `/*` comment opener naming a standard.
 *   A guard keyed on the word would fire on the wrong population.
 * - **Declaration order** is gated at the import, not the expression. The
 *   decider is four lines and has one caller, so a body-shaped check would only
 *   catch one spelling of an inlining. What generalizes is that a third module
 *   has started reasoning about declaration kinds at all.
 */

import { readFileSync } from "node:fs";
import { join, sep } from "node:path";

import FileScanner from "../utils/FileScanner";

const rootDir = join(__dirname, "..", "..");
const srcDir = join(rootDir, "src");

/**
 * The methods allowed to read the flags, and the reason each exists.
 *
 * Two, not one: the `.c` and the `.h` are separate artifacts with separate
 * emission facts, and each freezes the warm per-file state at the one moment
 * it is correct for that file (#1323). Everything downstream of both reads the
 * captured record instead -- see `IEmissionPlan` and `IHeaderEmissionFacts`.
 */
const CAPTURES = [
  {
    file: join("src", "transpiler", "output", "codegen", "CodeGenerator.ts"),
    needle: "private captureEmissionFacts(",
  },
  {
    file: join("src", "transpiler", "Transpiler.ts"),
    needle: "private _captureHeaderEmissionFacts(",
  },
] as const;

/**
 * A decision read off `CodeGenState`: an include flag, or a helper-op set.
 *
 * `usedClampOps` and `usedSafeDivOps` are here because the plan carries them
 * too, and for a while the renderer took them from the state anyway -- the fact
 * in two places with the renderer using the other one. Nothing behavioral
 * could catch that: the plan is BUILT from the state, so both hold the same
 * values and a test asserting the output cannot tell which was read. The claim
 * is structural, so the check is.
 *
 * `.add(` is excluded, not exempted: `applyEffects` mutating the set while
 * declarations are generated is the accumulate phase, which is what produces
 * the questions the plan answers. Reading one at emission time is the defect.
 */
const FLAG_READ =
  /CodeGenState\.(?:needs[A-Z]\w*|usedClampOps|usedSafeDivOps)(?!\.add\()/g;

/**
 * A compliance comment as it appears in the GENERATED C: a `/*` opener naming
 * a safety standard, either literally or through the owner's `STANDARD`.
 *
 * CLAUDE.md ("Compliance Annotations -- C-Next STANDARD") requires the
 * `/* <Standard> Rule <N>: <what> (<why>). *\/` form for every construct whose
 * shape a standard dictated. One module owns that form; a site hand-writing it
 * is a second author of the same decision.
 */
const ANNOTATION_TEXT =
  /\/\*\s*(?:\$\{[^}]*STANDARD[^}]*\}|MISRA|DO-178C?|CERT|AUTOSAR)/g;

/** The single author of generated-code compliance annotations. */
const ANNOTATION_OWNER = join(
  "src",
  "TRANSPILE",
  "2-Plan",
  "ComplianceAnnotations.ts",
);

/** Declaration-order reasoning: the decider, and the type it decides over. */
const KIND_TYPE = "TDeclarationKind";
const KIND_DECLARATION = join(
  "src",
  "transpiler",
  "types",
  "TDeclarationKind.ts",
);

interface IHit {
  readonly file: string;
  readonly offset: number;
  readonly text: string;
}

/** Every source file under `src/`, excluding tests. */
function sourceFiles(): string[] {
  return FileScanner.findFiles(srcDir, ".ts").filter(
    (full) => !full.includes(`${sep}__tests__${sep}`),
  );
}

/** True when the match sits on a line that is itself a comment. */
function inComment(source: string, index: number): boolean {
  const lineStart = source.lastIndexOf("\n", index) + 1;
  const lineEnd = source.indexOf("\n", index);
  const line = source.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
  return /^\s*(\*|\/\/)/.test(line);
}

/** Every match of `pattern` under `src/`, excluding mentions in comments. */
function scan(pattern: RegExp): IHit[] {
  const hits: IHit[] = [];
  for (const full of sourceFiles()) {
    const source = readFileSync(full, "utf-8");
    for (const match of source.matchAll(pattern)) {
      if (inComment(source, match.index)) continue;
      hits.push({
        file: full.slice(rootDir.length + 1),
        offset: match.index,
        text: match[0],
      });
    }
  }
  return hits;
}

/** Byte range of one permitted capture method. */
function captureRange(
  source: string,
  needle: string,
): { start: number; end: number } {
  const start = source.indexOf(needle);
  if (start === -1) {
    throw new Error(
      `${needle} not found -- if the capture was renamed, rename it here too ` +
        `rather than deleting this guard, which would pass over everything.`,
    );
  }
  let depth = 0;
  let i = source.indexOf("{", start);
  for (;;) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") depth -= 1;
    if (depth === 0) return { start, end: i };
    i += 1;
  }
}

describe("2.3 Render decides nothing (#1449)", () => {
  it("finds the reads at all", () => {
    // Guards the selector. If the regex stops matching, every assertion below
    // passes over an empty list -- #1297's shape, one level up.
    expect(scan(FLAG_READ).length).toBeGreaterThan(0);
  });

  it("reads a decision off CodeGenState in exactly the two capture files", () => {
    const files = [...new Set(scan(FLAG_READ).map((hit) => hit.file))].sort();

    expect(files).toEqual(CAPTURES.map((c) => c.file).sort());
  });

  it("reads them only inside a capture, never at an emission site", () => {
    const outside: string[] = [];

    for (const capture of CAPTURES) {
      const source = readFileSync(join(rootDir, capture.file), "utf-8");
      const { start, end } = captureRange(source, capture.needle);

      outside.push(
        ...scan(FLAG_READ)
          .filter((hit) => hit.file === capture.file)
          .filter((hit) => hit.offset < start || hit.offset > end)
          .map((hit) => `${hit.file}: ${hit.text}`),
      );
    }

    expect(outside).toEqual([]);
  });

  it("finds the compliance annotations at all", () => {
    // Same selector guard: an annotation form that stopped matching would make
    // the authorship assertion below vacuously true.
    expect(scan(ANNOTATION_TEXT).length).toBeGreaterThan(0);
  });

  it("has one author for generated-code compliance annotations", () => {
    const files = [
      ...new Set(scan(ANNOTATION_TEXT).map((hit) => hit.file)),
    ].sort();

    expect(files).toEqual([ANNOTATION_OWNER]);
  });

  it("reasons about declaration kinds only in the decider and the classifier", () => {
    const importers = sourceFiles()
      .filter((full) => readFileSync(full, "utf-8").includes(KIND_TYPE))
      .map((full) => full.slice(rootDir.length + 1))
      .filter((file) => file !== KIND_DECLARATION)
      .sort();

    // `DeclarationOrder` decides where the block goes; `CodeGenerator`
    // classifies each declaration into a kind and asks. Render says what the
    // file looks like, Plan says where the block goes -- a third module here
    // means a second answer to the same question.
    expect(importers).toEqual([
      join("src", "TRANSPILE", "2-Plan", "DeclarationOrder.ts"),
      join("src", "transpiler", "output", "codegen", "CodeGenerator.ts"),
    ]);
  });
});
