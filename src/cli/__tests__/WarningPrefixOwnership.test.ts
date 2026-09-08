import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * `ResultPrinter` prepends `Warning: ` to every entry in
 * `ITranspilerResult.warnings`. It is the ONE owner of that prefix.
 *
 * Seven message sources used to embed the prefix themselves, so the user saw
 * `Warning: Warning: #include "x.h" not found` from those and a correctly
 * single-prefixed line from the rest -- two formats for one concept, decided in
 * eight places. Found while working #1508: the probe for E0506 printed the
 * doubled form.
 *
 * This is asserted rather than remembered because nothing else can catch it.
 * The doubling is not a type error, not a lint error, and no fixture compares
 * warning text, so the suite stayed green through all seven. A guard that
 * cannot fail on the case it exists to catch is the shape CLAUDE.md names
 * repeatedly (#1143, #1297); this one fails on it.
 *
 * Scope: only messages routed into the `warnings` array. A direct
 * `console.warn` does not pass through `ResultPrinter`, so it must spell its
 * own prefix and is deliberately not matched here.
 */
const SRC = new URL("../..", import.meta.url).pathname;

function tsFilesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "__tests__" || entry === "node_modules") continue;
      out.push(...tsFilesUnder(full));
      continue;
    }
    if (entry.endsWith(".ts")) out.push(full);
  }
  return out;
}

describe("Warning prefix has exactly one owner (#1508)", () => {
  const files = tsFilesUnder(SRC);

  it("finds source files to scan", () => {
    // A scan that silently matched nothing would pass forever.
    expect(files.length).toBeGreaterThan(100);
  });

  it("no warnings.push() message embeds its own `Warning: ` prefix", () => {
    const offenders: string[] = [];

    for (const file of files) {
      const lines = readFileSync(file, "utf-8").split("\n");
      lines.forEach((line, i) => {
        if (!/warnings\.push\(/.test(line)) return;
        // The message may sit on the push line or on the lines that follow it.
        const window = lines.slice(i, i + 4).join("\n");
        if (/[`"']Warning: /.test(window)) {
          offenders.push(`${file.replace(SRC, "src/")}:${i + 1}`);
        }
      });
    }

    expect(offenders).toEqual([]);
  });

  it("ResultPrinter is what applies the prefix", () => {
    const printer = readFileSync(join(SRC, "cli/ResultPrinter.ts"), "utf-8");
    // If this moves, the rule above is enforcing something that no longer
    // happens, and the test should fail rather than quietly pass.
    expect(printer).toContain("`Warning: ${warning}`");
  });
});
