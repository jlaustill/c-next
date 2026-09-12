/**
 * #1320: 2.1 Analyze is a PASS, not a step inside the per-file emission loop.
 *
 * Analysis used to be the first half of `_transpileFile`, so file N was analyzed
 * after files 1..N-1 had already been emitted. #1430 is what that cost: an
 * analyzer read a map codegen fills, so during analysis it held the PREVIOUS
 * file's names and `E0427` fired or not depending on which order an entry listed
 * its two `#include` lines.
 *
 * ## Why this is a structural gate and not a fixture
 *
 * A behavioral fixture cannot hold this property. Measured on `381e4a85`:
 * reversing the file walk order reddens NOTHING across the whole integration
 * suite, because there is no analyzer read of codegen-filled `CodeGenState`
 * left for the order to affect -- `typeRegistry`, `constValues`,
 * `knownFunctions` and `sourcePath` have zero live reads under
 * `src/TRANSPILE/1-Analyze/`, and the two surviving accessors bottom out in
 * `Program` and the run-wide `SymbolTable`, both complete before 2.1.
 *
 * So a fixture asserting "the hoist happened" would have to introduce the very
 * read the hoist exists to prevent. The honest artifact is this one: the
 * property is asserted over the call graph, the way `layer-rules.test.ts`
 * asserts `reachable: true` rather than trusting authors to add it.
 *
 * ## What it forbids, and what it deliberately allows
 *
 * Each pass's subtree stays on its own side: nothing reachable from the
 * ANALYSIS root may call the generator, and nothing reachable from the EMISSION
 * root may call the analyzers. Moving `runAnalyzers` back into `_transpileFile`
 * violates it, and so does the subtler version -- calling the analysis half from
 * a helper the emission half already reaches.
 *
 * The ORCHESTRATOR above them is expected to reach both, and is not a violation:
 * sequencing the two passes is exactly its job. An earlier draft of this gate
 * forbade any method from reaching both and flagged `_executePipeline` and
 * `transpile` -- which would have made the gate fire on the correct structure.
 */

import { join } from "node:path";
import { Project, SyntaxKind } from "ts-morph";
import type { ClassDeclaration } from "ts-morph";

const TRANSPILER_PATH = join(
  __dirname,
  "..",
  "..",
  "src",
  "transpiler",
  "Transpiler.ts",
);

/** Pass 2.1's entry point: running the analyzers over one tree. */
const ANALYSIS_CALL = "runAnalyzers";

/** Pass 2.2/2.3's entry point: handing one tree to the generator. */
const EMISSION_CALL = "this.codeGenerator.generate";

/** The method that performs 2.1 over the whole program. */
const ANALYSIS_ROOT = "_analyzeProgram";

/** The method that performs 2.2 and 2.3 for one file. */
const EMISSION_ROOT = "_transpileFile";

interface IMethodFacts {
  /** Sibling methods this one calls, as `this.x()` or `Transpiler.x()`. */
  readonly calls: ReadonlySet<string>;
  /** Calls the analyzers directly. */
  readonly analyzes: boolean;
  /** Calls the generator directly. */
  readonly emits: boolean;
}

function transpilerClass(): ClassDeclaration {
  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    skipFileDependencyResolution: true,
  });
  const source = project.addSourceFileAtPath(TRANSPILER_PATH);
  const found = source.getClass("Transpiler");
  if (found === undefined) {
    throw new Error("Transpiler class not found -- has the file moved?");
  }
  return found;
}

/** One entry per method, recording who it calls and what it reaches directly. */
function factsByMethod(cls: ClassDeclaration): Map<string, IMethodFacts> {
  const facts = new Map<string, IMethodFacts>();

  for (const method of cls.getMethods()) {
    const calls = new Set<string>();
    let analyzes = false;
    let emits = false;

    for (const call of method.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      const callee = call.getExpression().getText();

      if (callee === ANALYSIS_CALL) {
        analyzes = true;
        continue;
      }
      if (callee === EMISSION_CALL) {
        emits = true;
        continue;
      }
      // Intra-class edge: `this.x(...)` or the static `Transpiler.x(...)`.
      const sibling = /^(?:this|Transpiler)\.([A-Za-z_][\w$]*)$/.exec(callee);
      if (sibling !== null) {
        calls.add(sibling[1]);
      }
    }

    facts.set(method.getName(), { calls, analyzes, emits });
  }

  return facts;
}

/**
 * `root` plus every method it transitively calls.
 *
 * Iterated with an explicit worklist rather than recursed, so a cycle in the
 * call graph terminates instead of overflowing.
 */
function subtree(
  facts: ReadonlyMap<string, IMethodFacts>,
  root: string,
): Set<string> {
  const seen = new Set<string>();
  const pending = [root];

  while (pending.length > 0) {
    const name = pending.pop();
    if (name === undefined || seen.has(name)) {
      continue;
    }
    seen.add(name);

    const entry = facts.get(name);
    if (entry === undefined) {
      continue;
    }
    for (const callee of entry.calls) {
      if (!seen.has(callee)) {
        pending.push(callee);
      }
    }
  }

  return seen;
}

/** The methods in `names` that call `pick` directly. */
function sitesIn(
  facts: ReadonlyMap<string, IMethodFacts>,
  names: ReadonlySet<string>,
  pick: (entry: IMethodFacts) => boolean,
): string[] {
  return [...names].filter((name: string): boolean => {
    const entry = facts.get(name);
    return entry !== undefined && pick(entry);
  });
}

describe("2.1 Analyze is a pass, not a step in the emission loop (#1320)", () => {
  const facts = factsByMethod(transpilerClass());

  it("finds both pass roots at all", () => {
    // Vacuity guard: a rename would otherwise silently disable every assertion
    // below rather than fail it. Same opening move as `order-pair-fixtures`.
    expect([...facts.keys()]).toEqual(
      expect.arrayContaining([ANALYSIS_ROOT, EMISSION_ROOT]),
    );
  });

  it("the analysis pass actually reaches the analyzers", () => {
    const analysis = subtree(facts, ANALYSIS_ROOT);
    expect(
      sitesIn(
        facts,
        analysis,
        (entry: IMethodFacts): boolean => entry.analyzes,
      ),
      `nothing under ${ANALYSIS_ROOT} calls ${ANALYSIS_CALL} -- gate is vacuous`,
    ).not.toHaveLength(0);
  });

  it("the emission pass actually reaches the generator", () => {
    const emission = subtree(facts, EMISSION_ROOT);
    expect(
      sitesIn(facts, emission, (entry: IMethodFacts): boolean => entry.emits),
      `nothing under ${EMISSION_ROOT} calls ${EMISSION_CALL} -- gate is vacuous`,
    ).not.toHaveLength(0);
  });

  it("never analyzes from inside the emission pass", () => {
    const emission = subtree(facts, EMISSION_ROOT);
    const offenders = sitesIn(
      facts,
      emission,
      (entry: IMethodFacts): boolean => entry.analyzes,
    );

    expect(
      offenders,
      `${offenders.join(", ")} call ${ANALYSIS_CALL} from inside ${EMISSION_ROOT}. ` +
        `2.1 Analyze runs whole-program, before any file is planned (#1320) -- ` +
        `analysis here means file N is analyzed after files 1..N-1 were emitted.`,
    ).toEqual([]);
  });

  it("never generates from inside the analysis pass", () => {
    const analysis = subtree(facts, ANALYSIS_ROOT);
    const offenders = sitesIn(
      facts,
      analysis,
      (entry: IMethodFacts): boolean => entry.emits,
    );

    expect(
      offenders,
      `${offenders.join(", ")} call ${EMISSION_CALL} from inside ${ANALYSIS_ROOT}. ` +
        `2.1 decides nothing about output -- a program is planned only after ` +
        `every file has been analyzed.`,
    ).toEqual([]);
  });
});
