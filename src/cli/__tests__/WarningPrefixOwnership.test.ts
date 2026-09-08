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
 * ## Why this scans for the LITERAL rather than from `warnings.push(`
 *
 * The first version of this guard anchored on `warnings.push(` and read a
 * four-line window from it. That caught six of the seven sources and was blind
 * to the seventh -- `getReservedFieldWarning`, whose literal lives in a helper
 * the push sites only CALL:
 *
 *     warnings.push(
 *       SymbolUtils.getReservedFieldWarning("C", structName, fieldName),
 *     );
 *
 * No `Warning: ` in that window, so re-adding the prefix inside the helper left
 * the guard green. That source is precisely the one that
 * grepping push sites misses, which is why the census was wrong before the
 * fix -- so
 * the guard was blind to exactly the case that motivated it. Verified by
 * mutation, in both directions, rather than by reading.
 *
 * Scanning for the literal is shape-independent: it holds whether the message
 * is spelled at the push site, returned from a helper, or assembled three
 * functions away.
 *
 * ## What is allowed to spell its own prefix
 *
 * A direct `console.warn` / `console.error` never passes through
 * `ResultPrinter`, so nothing can apply the prefix for it and it must spell its
 * own. Those are recognized by their CALL, not by a list of files: a file-level
 * allowlist would also excuse a future `warnings.push` added to the same file,
 * which is the thing being guarded against.
 */
const SRC = new URL("../..", import.meta.url).pathname;

/** Strip comments so prose about the prefix is not mistaken for a message. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, " "))
    .replace(/\/\/[^\n]*/g, "");
}

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

/** The file that owns the prefix, and is therefore the one place it belongs. */
const OWNER = "cli/ResultPrinter.ts";

interface IHit {
  file: string;
  line: number;
}

/** Every `Warning: ` string literal in non-test src, minus the console sites. */
function offendingLiterals(files: string[]): IHit[] {
  const offenders: IHit[] = [];

  for (const file of files) {
    const relative = file.replace(SRC, "");
    if (relative === OWNER) continue;

    const lines = stripComments(readFileSync(file, "utf-8")).split("\n");
    lines.forEach((line, i) => {
      if (!/["'`]Warning: /.test(line)) return;

      // A direct console.* call spells its own prefix legitimately. The call
      // may open a line or two above the literal, so look back a short way --
      // recognizing the CALL, not the file.
      const preceding = lines.slice(Math.max(0, i - 2), i + 1).join("\n");
      if (/console\.(warn|error|log)\s*\(/.test(preceding)) return;

      offenders.push({ file: relative, line: i + 1 });
    });
  }

  return offenders;
}

describe("Warning prefix has exactly one owner (#1508)", () => {
  const files = tsFilesUnder(SRC);

  it("finds source files to scan", () => {
    // A scan that silently matched nothing would pass forever.
    expect(files.length).toBeGreaterThan(100);
  });

  it("no message outside ResultPrinter embeds its own `Warning: ` prefix", () => {
    expect(
      offendingLiterals(files).map((hit) => `${hit.file}:${hit.line}`),
    ).toEqual([]);
  });

  it("ResultPrinter is what applies the prefix", () => {
    const printer = readFileSync(join(SRC, OWNER), "utf-8");
    // If this moves, the rule above is enforcing something that no longer
    // happens, and the test should fail rather than quietly pass.
    expect(printer).toContain("`Warning: ${warning}`");
  });

  it("still recognizes a legitimate direct console.warn", () => {
    // Negative control for over-enforcement. Three such sites exist; without
    // this, a rule that flagged every `Warning: ` literal anywhere would pass
    // the assertion above only until someone added one, and would then be
    // "fixed" by deleting a prefix that has to be there.
    const consoleSites = files.filter((file) => {
      const stripped = stripComments(readFileSync(file, "utf-8"));
      return /console\.(warn|error|log)\s*\(\s*\n?\s*[`"']Warning: /.test(
        stripped,
      );
    });

    expect(consoleSites.length).toBeGreaterThan(0);
    expect(offendingLiterals(consoleSites)).toEqual([]);
  });
});
