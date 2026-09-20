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
 * over all of `output/`, and nothing gates it yet".
 *
 * - **Scope.** The scan root was the render pass, so the `needsISR`
 *   read in `Transpiler._captureHeaderEmissionFacts` -- a legitimate capture,
 *   but the SECOND one -- was outside the guard's view entirely. The root is
 *   now `src/`, and both captures are named.
 * - **Toolchain requirements** need no separate assertion: `needsISR`,
 *   `needsIrqWrappers` and `needsFloatStaticAssert` ARE `needs*` flags, so the
 *   widened read rule is what covers them. Recorded here because "it is already
 *   covered" is exactly the claim a later reader would otherwise re-derive.
 * - **MISRA annotations** and **declaration order** get one check each, below.
 *
 * ## The two shapes, and why each category gets the one it does (#1583 review)
 *
 * The first version of this file had them backwards, and both errors were
 * demonstrated rather than argued:
 *
 * - Annotations were keyed on the standard's NAME (`MISRA|DO-178C?|…`, or an
 *   interpolation spelled `STANDARD`). A second author defeated that by
 *   renaming one constant -- `const spec = "MISRA C:2012"` in a template
 *   literal passed all six assertions. Name-keyed is not rename-proof, and the
 *   mutation that "proved" it wrote the standard LITERALLY, which is the one
 *   case the regex did catch. The mutation was too easy and the table read
 *   stronger than the guard.
 * - Declaration order was a substring match over whole file contents, so a
 *   COMMENT mentioning `TDeclarationKind` reddened it -- contradicting both
 *   this file's own "a mention inside a comment is documentation, not a read"
 *   and the claim that it gated the import.
 *
 * So: declaration order is import-shaped, and annotations get BOTH shapes,
 * because neither alone is sufficient. The import check is rename-proof but
 * blind to a fully hand-rolled string; the form check catches the hand-rolled
 * string but must be kept off the wrong population -- `1-Analyze/` writes
 * "(MISRA C:2012 Rule 3.1)" into DIAGNOSTIC text, which is not an emitted
 * annotation and never reaches generated C, because that layer generates none.
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
    file: join("src", "TRANSPILE", "3-Render", "codegen", "CodeGenerator.ts"),
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
 * The house form of a compliance annotation, keyed on its SHAPE: a C comment
 * opener and a cited rule. Deliberately not keyed on the standard's name --
 * see the header. `[^*\n]` stops the match at the comment's own `*\/`, so this
 * cannot span two unrelated comments on one line.
 */
const ANNOTATION_FORM = /\/\*[^*\n]{0,80}\bRule\b/g;

/** An import of a named module, however its path is spelled. */
const importOf = (name: string): RegExp =>
  new RegExp(`from\\s+"[^"]*${name}"`, "g");

/**
 * Diagnostic text cites rules too, and is not an emitted annotation.
 *
 * `1-Analyze` reports problems; it generates no C, so a rule citation there
 * cannot reach the certification artifact. This is the population the header
 * warns about, and the reason the form check is scoped rather than the reason
 * it is name-keyed.
 */
const DIAGNOSTIC_LAYER = join("src", "TRANSPILE", "1-Analyze") + sep;

const ANNOTATION_OWNER = join(
  "src",
  "TRANSPILE",
  "2-Plan",
  "ComplianceAnnotations.ts",
);
const ORDER_DECIDER = join("src", "TRANSPILE", "2-Plan", "DeclarationPlan.ts");
const ORDER_CLASSIFIER = join(
  "src",
  "TRANSPILE",
  "3-Render",
  "codegen",
  "CodeGenerator.ts",
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

/**
 * True when the match sits on a line that is itself a comment.
 *
 * Recognizes the three openers this corpus uses: a JSDoc continuation, a line
 * comment, and a bare single-line block -- the last added in the #1583 review,
 * because `/* MISRA C:2012 Rule 8.4 applies here *\/` written as documentation
 * was classified as code and would have failed the authorship assertion. House
 * style is JSDoc, so it was latent rather than live, but this function's reach
 * widened from `output/` to all of `src/`, where the population it screens is
 * much less uniform.
 */
function inComment(source: string, index: number): boolean {
  const lineStart = source.lastIndexOf("\n", index) + 1;
  const lineEnd = source.indexOf("\n", index);
  const line = source.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
  return /^\s*(\*|\/\/|\/\*)/.test(line);
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

/** The distinct files a pattern matches in, sorted. */
const filesMatching = (pattern: RegExp): string[] =>
  [...new Set(scan(pattern).map((hit) => hit.file))].sort();

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
    expect(filesMatching(FLAG_READ)).toEqual(
      CAPTURES.map((capture) => capture.file).sort(),
    );
  });

  it("reads them only inside a capture, never at an emission site", () => {
    // One shared list the two captures filter, rather than each scanning all
    // of `src/` (#1583 review).
    const reads = scan(FLAG_READ);
    const outside: string[] = [];

    for (const capture of CAPTURES) {
      const source = readFileSync(join(rootDir, capture.file), "utf-8");
      const { start, end } = captureRange(source, capture.needle);

      outside.push(
        ...reads
          .filter((hit) => hit.file === capture.file)
          .filter((hit) => hit.offset < start || hit.offset > end)
          .map((hit) => `${hit.file}: ${hit.text}`),
      );
    }

    expect(outside).toEqual([]);
  });

  it("has one author for the compliance-annotation TYPE", () => {
    // Rename-proof: a second author building on the shape has to obtain an
    // `IComplianceAnnotation`, whatever it or the standard gets renamed to.
    expect(filesMatching(importOf("IComplianceAnnotation"))).toEqual([
      ANNOTATION_OWNER,
    ]);
  });

  it("has one author for the compliance-annotation FORM", () => {
    // Catches the hand-rolled string the type check cannot see. Empty would
    // fail this too, so the selector cannot go vacuous.
    expect(
      filesMatching(ANNOTATION_FORM).filter(
        (file) => !file.startsWith(DIAGNOSTIC_LAYER),
      ),
    ).toEqual([ANNOTATION_OWNER]);
  });

  it("reasons about declaration kinds only in the decider and the classifier", () => {
    // Import-shaped, so documenting the Plan/Render split in a third module is
    // not reported as adding a second decider (#1583 review).
    expect(filesMatching(importOf("TDeclarationKind"))).toEqual(
      [ORDER_DECIDER, ORDER_CLASSIFIER].sort(),
    );
  });
});
