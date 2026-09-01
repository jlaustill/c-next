/**
 * SPIKE #1431 — THROWAWAY. Deleted before the findings doc lands.
 *
 * Drives the equivalence probe across the fixture corpus and writes one JSONL line
 * per observation.
 *
 * FILES MODE, NOT SOURCE MODE. This is the single decision the whole run depends on.
 * `format-fidelity.ts` and `AdrProvenanceLines.ts` both transpile a fixture ALONE via
 * `{kind: "source"}`. Under source mode there is no include graph, so `visibleFrom(f)`
 * collapses into `runWide()` and every include-sensitive view agrees TRIVIALLY -- the
 * run would report a clean zero and mean nothing. CLAUDE.md already records this
 * limitation against `AdrProvenance` ("provenance transpiles the fixture alone, so
 * every site carries the fixture's own path"), and #1402 tracks it.
 *
 * The global control below is what PROVES the driver did not fall into it: breaking
 * the include closure must produce a large disagreement count. If it does not, the
 * run is discarded rather than published.
 */
import { mkdirSync, writeFileSync, appendFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import Transpiler from "../../src/transpiler/Transpiler";
import ViewProbe from "../../src/transpiler/logic/symbols/spike1431/ViewProbe";
import FileScanner from "../utils/FileScanner";

const rootDir = resolve(dirname(new URL(import.meta.url).pathname), "../..");
const outDir = process.env.SPIKE_OUT ?? join(rootDir, ".spike-1431");

interface IRunSummary {
  fixtures: number;
  observations: number;
  askedCounts: Record<string, number>;
  identityMismatches: number;
  divergences: Record<string, number>;
  neverAsked: string[];
}

async function transpileFixture(fixturePath: string): Promise<void> {
  const transpiler = new Transpiler({
    input: fixturePath,
    includeDirs: [join(rootDir, "tests/include"), dirname(fixturePath)],
    outDir: join(outDir, "out"),
    noCache: true,
  });
  // {kind: "files"} -- see the header. Source mode would make every include-visible
  // view agree by construction.
  await transpiler.transpile({ kind: "files" });
}

async function main(): Promise<void> {
  mkdirSync(outDir, { recursive: true });
  const jsonl = join(outDir, "observations.jsonl");
  writeFileSync(jsonl, "");

  const fixtures = FileScanner.findTestFiles(join(rootDir, "tests")).filter(
    (f: string) => f.endsWith(".test.cnx"),
  );
  const limit = process.env.SPIKE_LIMIT
    ? Number(process.env.SPIKE_LIMIT)
    : fixtures.length;
  const selected = fixtures.slice(0, limit);

  const asked = new Map<string, number>();
  const divergences = new Map<string, number>();
  let observations = 0;
  let identityMismatches = 0;

  for (const fixture of selected) {
    ViewProbe.reset();
    ViewProbe.arm(true);
    try {
      await transpileFixture(fixture);
    } catch {
      // A fixture that fails to transpile still produced observations up to the
      // failure. 300 fixtures are `test-error` on purpose; skipping them would
      // remove exactly the diagnostic paths this spike is about.
    }
    ViewProbe.arm(false);

    for (const [question, count] of ViewProbe.counts()) {
      asked.set(question, (asked.get(question) ?? 0) + count);
    }
    const lines: string[] = [];
    for (const o of ViewProbe.collect()) {
      observations++;
      if (o.live !== o.asSpecified) {
        identityMismatches++;
      }
      if (o.asSpecified !== o.asPrincipled) {
        divergences.set(o.question, (divergences.get(o.question) ?? 0) + 1);
      }
      lines.push(JSON.stringify({ fixture, ...o }));
    }
    if (lines.length > 0) {
      appendFileSync(jsonl, lines.join("\n") + "\n");
    }
  }

  const summary: IRunSummary = {
    fixtures: selected.length,
    observations,
    askedCounts: Object.fromEntries(asked),
    identityMismatches,
    divergences: Object.fromEntries(divergences),
    neverAsked: [],
  };
  writeFileSync(
    join(outDir, "summary.json"),
    JSON.stringify(summary, null, 2) + "\n",
  );

  console.log(`fixtures            ${summary.fixtures}`);
  console.log(`observations        ${summary.observations}`);
  console.log(`identity mismatches ${summary.identityMismatches}`);
  console.log("asked per question:");
  for (const [q, n] of asked) {
    console.log(`  ${q.padEnd(34)} ${n}`);
  }
  console.log("divergences (asSpecified != asPrincipled):");
  for (const [q, n] of divergences) {
    console.log(`  ${q.padEnd(34)} ${n}`);
  }

  // A question never asked is not a question that agrees. This is the check
  // `collectGrammarCoverage` never had, and it is why that hook could rot unnoticed.
  if (observations === 0) {
    console.error(
      "FAIL: probe recorded nothing. The hook is dead, not the views.",
    );
    process.exit(1);
  }
  if (identityMismatches > 0) {
    console.error(
      `FAIL: ${identityMismatches} identity-control mismatches. The schema failed to ` +
        `express a view; that is a probe defect, not a finding about the transpiler.`,
    );
    process.exit(1);
  }
}

await main();
