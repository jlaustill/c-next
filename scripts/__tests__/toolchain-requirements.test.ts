/**
 * Issue #1143: Properties the generated toolchain documentation must hold.
 *
 * The failure this guards against is specific and has already happened once in
 * this repo: GRAMMAR-COVERAGE.md is a tracked generated file whose CI job never
 * writes it and whose `> Generated: <ISO>` header would churn any diff gate, so
 * it silently drifted for months (#1150). Determinism and the absence of a
 * timestamp are what make a diff gate viable at all.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const script = join(repoRoot, "scripts", "toolchain-requirements.ts");

/** Spawning `npx tsx` is seconds, not milliseconds; well clear of the 5s default. */
const SUBPROCESS_TIMEOUT_MS = 60000;

/**
 * Cells in a markdown table row, split the way a renderer does: on pipes that
 * are not backslash-escaped. Counting raw `|` would treat a correctly escaped
 * `\|` inside a code span as a separator and report false corruption.
 */
function countCells(row: string): number {
  let inner = row.trim();
  if (inner.startsWith("|")) inner = inner.slice(1);
  if (inner.endsWith("|")) inner = inner.slice(0, -1);
  return inner.split(/(?<!\\)\|/).length;
}

function render(): string {
  return execFileSync("npx", ["tsx", script, "console"], {
    cwd: repoRoot,
    encoding: "utf-8",
    timeout: 60000,
  });
}

/**
 * Each render spawns `npx tsx` and takes seconds, so render once and share it.
 * Rendering per-test spent ~30s on identical subprocesses and pushed the
 * two-render determinism check past vitest's 5s default -- a test that passed
 * on a warm cache and failed under load.
 */
let rendered = "";

describe("toolchain documentation generator", () => {
  beforeAll(() => {
    rendered = render();
  }, SUBPROCESS_TIMEOUT_MS);

  it(
    "renders deterministically",
    () => {
      expect(render()).toBe(rendered);
    },
    SUBPROCESS_TIMEOUT_MS,
  );

  it("embeds no timestamp", () => {
    // A timestamp makes every regeneration a diff, which is what stopped
    // GRAMMAR-COVERAGE.md from ever being gated.
    const markdown = rendered;
    expect(markdown).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
    expect(markdown).not.toMatch(/^>\s*Generated:/m);
  });

  it("marks the output as generated and names how to regenerate it", () => {
    const markdown = rendered;
    expect(markdown).toContain("GENERATED FILE - DO NOT EDIT");
    expect(markdown).toContain("npm run docs:toolchain");
    expect(markdown).toContain("TOOLCHAIN_REQUIREMENTS.ts");
  });

  it("states the per-feature policy rather than a single global claim", () => {
    const markdown = rendered;
    expect(markdown).toContain("per-feature, not global");
  });

  it("matches the committed docs/compatibility.md", () => {
    const committed = readFileSync(
      join(repoRoot, "docs", "compatibility.md"),
      "utf-8",
    );
    expect(rendered).toBe(committed);
  });

  it("reports honestly that there is no compiler-version floor", () => {
    expect(rendered).toContain(
      "No construct C-Next emits has a minimum compiler version",
    );
  });

  it("emits structurally valid markdown tables", () => {
    // `docs:toolchain:check` diffs generated against committed, so it passes
    // happily when BOTH are corrupt -- generating from the registry rules out
    // drift, not a wrong generator. This asserts the output itself.
    //
    // The bug it was written for: `code()` already escapes pipes, and the row
    // builder escaped the composed string again, turning `a || b` into an
    // unescaped separator and splitting one row into 9 cells under a 7-cell
    // header. The shipped matrix claimed a requirement's platform library was
    // "C99".
    const malformed: string[] = [];
    let header: number | null = null;

    for (const [index, line] of rendered.split("\n").entries()) {
      if (!line.trimStart().startsWith("|")) {
        header = null;
        continue;
      }
      const cells = countCells(line);
      if (header === null) {
        header = cells;
        continue;
      }
      // separator row
      if (/^[\s|:-]+$/.test(line)) continue;
      if (cells !== header) {
        malformed.push(
          `line ${index + 1}: ${cells} cells under a ${header}-cell header`,
        );
      }
    }

    expect(malformed).toEqual([]);
  });

  it("never leaves an unescaped pipe inside a code span in a table", () => {
    // A pipe surviving unescaped inside a cell is the mechanism of the
    // corruption above, whatever produces it. Code spans are extracted first
    // and checked individually: testing the whole line lets the regex pair a
    // closing backtick with a later opening one and "find" a span straddling
    // the cell separator, which reports every row as an offender.
    const offenders: string[] = [];

    for (const line of rendered.split("\n")) {
      if (!line.trimStart().startsWith("|")) continue;
      for (const span of line.match(/`[^`]*`/g) ?? []) {
        if (/(?<!\\)\|/.test(span)) offenders.push(span);
      }
    }

    expect(offenders).toEqual([]);
  });

  it(
    "check mode passes against the committed documentation",
    () => {
      const output = execFileSync("npx", ["tsx", script, "check"], {
        cwd: repoRoot,
        encoding: "utf-8",
        timeout: 60000,
      });
      expect(output).toContain("up to date");
    },
    SUBPROCESS_TIMEOUT_MS,
  );
});
