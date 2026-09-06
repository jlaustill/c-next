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
 * read, and there is exactly one such place -- the capture that freezes the
 * questions for the plan to answer.
 *
 * This is the `layer-rules.test.ts` shape: a claim a comment cannot hold,
 * because the next person to add an include flag will reach for the pattern
 * they find, and what they find is what this file constrains.
 */

import { readFileSync } from "node:fs";
import { join, sep } from "node:path";

import FileScanner from "../utils/FileScanner";

const rootDir = join(__dirname, "..", "..");
const outputDir = join(rootDir, "src", "transpiler", "output");

/** The one method allowed to read the flags, and the reason it exists. */
const CAPTURE = "private captureEmissionFacts(";

/**
 * A decision read off `CodeGenState`: an include flag, or a helper-op set.
 *
 * `usedClampOps` and `usedSafeDivOps` are here because the plan carries them
 * too, and for a while the renderer took them from the state anyway -- the fact
 * in two places with the renderer using the other one. Nothing behavioural
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

interface IRead {
  readonly file: string;
  readonly offset: number;
  readonly text: string;
}

/** Every `needs*` read under `output/`, excluding tests. */
function flagReads(): IRead[] {
  const reads: IRead[] = [];
  for (const full of FileScanner.findFiles(outputDir, ".ts")) {
    if (full.includes(`${sep}__tests__${sep}`)) continue;
    const source = readFileSync(full, "utf-8");
    for (const match of source.matchAll(FLAG_READ)) {
      // A mention inside a comment is documentation, not a read.
      const lineStart = source.lastIndexOf("\n", match.index) + 1;
      const line = source.slice(lineStart, source.indexOf("\n", match.index));
      if (/^\s*(\*|\/\/)/.test(line)) continue;
      reads.push({
        file: full.slice(rootDir.length + 1),
        offset: match.index,
        text: match[0],
      });
    }
  }
  return reads;
}

/** Byte range of the one method permitted to read them. */
function captureRange(source: string): { start: number; end: number } {
  const start = source.indexOf(CAPTURE);
  if (start === -1) {
    throw new Error(
      `${CAPTURE} not found -- if the capture was renamed, rename it here too ` +
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
    expect(flagReads().length).toBeGreaterThan(0);
  });

  it("reads a decision off CodeGenState in exactly one file under output/", () => {
    const files = [...new Set(flagReads().map((read) => read.file))].sort();

    expect(files).toEqual(["src/transpiler/output/codegen/CodeGenerator.ts"]);
  });

  it("reads them only inside the capture, never at an emission site", () => {
    const path = join(outputDir, "codegen", "CodeGenerator.ts");
    const source = readFileSync(path, "utf-8");
    const { start, end } = captureRange(source);

    const outside = flagReads()
      .filter((read) => read.file.endsWith("CodeGenerator.ts"))
      .filter((read) => read.offset < start || read.offset > end)
      .map((read) => read.text);

    expect(outside).toEqual([]);
  });
});
