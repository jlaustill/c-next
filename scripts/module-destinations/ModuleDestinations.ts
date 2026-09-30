import { matchesGlob } from "node:path";

import IModuleDestinationFailure from "../types/IModuleDestinationFailure";
import IModuleDestinationRow from "../types/IModuleDestinationRow";
import IModuleDestinationsOutcome from "../types/IModuleDestinationsOutcome";

/** One pattern of one row, kept with the line it came from. */
interface IPlacedPattern {
  readonly pattern: string;
  readonly line: number;
}

/**
 * `npm run destinations:check` (#1653, carrying #1443 box 1 in the form of
 * owner rulings 16 and 17).
 *
 * The map stays AUTHORED: its `why` column is a judgement no generator can
 * write. What a gate can hold is its coverage, and until this existed nothing
 * did -- eight modules moved into 2.2 Plan with no row, and two prose counts
 * rotted in opposite directions at once, all with CI green.
 *
 * A row is resolved against the directory its section heading names
 * (`### 2.2 Plan — \`src/TRANSPILE/2-Plan/\``). A table with a `destination`
 * column is keyed on the destination, which is where the module is now, or on
 * its current path when the destination reads `awaiting #NNNN`. Tables with an
 * `outcome` column record deleted modules and place nothing.
 *
 * Four ways to fail, and the fourth is what makes the third a ratchet:
 * - a non-test module no row covers (an undecided module cannot land);
 * - a row that matches no module (a path-keyed guard detaches silently when
 *   its target moves, so a stale row is a failure, not a no-op);
 * - an `awaiting` row the committed baseline does not hold (the set may not
 *   grow; an `awaiting` row as such never fails);
 * - a baseline entry that is no longer an `awaiting` row (so a row that
 *   leaves `awaiting` cannot come back under the old allowance).
 */
class ModuleDestinations {
  static readonly MAP_PATH = "docs/architecture/module-destinations.md";

  private static readonly HEADING = /^#{1,6} (.*)$/;
  private static readonly HEADING_BASE = /`(src\/[^`]*\/)`\s*$/;
  private static readonly SPAN = /`([^`]+)`/g;
  private static readonly AWAITING = /awaiting #(\d+)/;

  /** The modules a row must place: non-test TypeScript under `src/`. */
  static population(files: readonly string[]): string[] {
    return files.filter(
      (file) =>
        file.startsWith("src/") &&
        file.endsWith(".ts") &&
        !file.includes("/__tests__/") &&
        !file.endsWith(".test.ts"),
    );
  }

  static checkOutcome(
    markdown: string,
    files: readonly string[],
    baseline: readonly string[],
  ): IModuleDestinationsOutcome {
    const modules = ModuleDestinations.population(files);
    const { rows, unresolvable } = ModuleDestinations.parse(markdown);
    const placed = ModuleDestinations.patternsOf(rows);
    const awaiting = ModuleDestinations.patternsOf(
      rows.filter((row) => row.awaiting !== null),
    );

    const withoutRow: IModuleDestinationFailure[] = modules
      .filter((module) => !placed.some((p) => matchesGlob(module, p.pattern)))
      .map((module) => ({ kind: "no-row", subject: module, line: null }));
    const unmatched: IModuleDestinationFailure[] = placed
      .filter((p) => !modules.some((module) => matchesGlob(module, p.pattern)))
      .map((p) => ({
        kind: "unmatched-row",
        subject: p.pattern,
        line: p.line,
      }));

    const allowed = new Set(baseline);
    const current = new Set(awaiting.map((p) => p.pattern));
    const grew: IModuleDestinationFailure[] = awaiting
      .filter((p) => !allowed.has(p.pattern))
      .map((p) => ({
        kind: "awaiting-grew",
        subject: p.pattern,
        line: p.line,
      }));
    const stale: IModuleDestinationFailure[] = baseline
      .filter((pattern) => !current.has(pattern))
      .map((pattern) => ({
        kind: "baseline-stale",
        subject: pattern,
        line: null,
      }));

    return {
      failures: [
        ...unresolvable,
        ...withoutRow,
        ...unmatched,
        ...grew,
        ...stale,
      ],
      modules: modules.length,
      rows: rows.length,
      awaiting: rows.filter((row) => row.awaiting !== null).length,
    };
  }

  /** Every placement row in the map, and the rows that resolve to no path. */
  static parse(markdown: string): {
    rows: IModuleDestinationRow[];
    unresolvable: IModuleDestinationFailure[];
  } {
    const lines = markdown.split("\n");
    const rows: IModuleDestinationRow[] = [];
    const unresolvable: IModuleDestinationFailure[] = [];
    let base: string | null = null;
    let index = 0;
    while (index < lines.length) {
      const heading = ModuleDestinations.HEADING.exec(lines[index]);
      if (heading !== null) {
        base = ModuleDestinations.HEADING_BASE.exec(heading[1])?.[1] ?? null;
        index++;
      } else if (lines[index].startsWith("|")) {
        const end = ModuleDestinations.tableEnd(lines, index);
        ModuleDestinations.readTable(lines, index, end, base, {
          rows,
          unresolvable,
        });
        index = end;
      } else {
        index++;
      }
    }
    return { rows, unresolvable };
  }

  private static tableEnd(lines: readonly string[], start: number): number {
    let end = start;
    while (end < lines.length && lines[end].startsWith("|")) end++;
    return end;
  }

  /** Reads rows `start + 2 .. end` of one table; the first two are its header. */
  private static readTable(
    lines: readonly string[],
    start: number,
    end: number,
    base: string | null,
    into: {
      rows: IModuleDestinationRow[];
      unresolvable: IModuleDestinationFailure[];
    },
  ): void {
    const header = ModuleDestinations.cells(lines[start]).map((cell) =>
      cell.toLowerCase(),
    );
    if (header.includes("outcome")) return;
    const destination = header.indexOf("destination");
    for (let index = start + 2; index < end; index++) {
      const cells = ModuleDestinations.cells(lines[index]);
      const line = index + 1;
      const row =
        destination === -1
          ? ModuleDestinations.placedRow(cells[0], base, line)
          : ModuleDestinations.destinationRow(cells, destination, line);
      if ("kind" in row) into.unresolvable.push(row);
      else into.rows.push(row);
    }
  }

  /** A `module | why` row: each path is relative to the section's directory. */
  private static placedRow(
    moduleCell: string,
    base: string | null,
    line: number,
  ): IModuleDestinationRow | IModuleDestinationFailure {
    const spans = ModuleDestinations.spans(moduleCell);
    const patterns: string[] = [];
    for (const span of spans) {
      if (span.startsWith("src/")) patterns.push(span);
      else if (base === null)
        return { kind: "unresolvable-row", subject: span, line };
      else patterns.push(`${base}${span}`);
    }
    if (patterns.length === 0)
      return { kind: "unresolvable-row", subject: moduleCell, line };
    return { line, patterns, awaiting: null };
  }

  /**
   * A `module | destination | …` row. The destination is where the module is
   * now; an `awaiting #NNNN` destination is not a path yet, so the module
   * column names the current one.
   */
  private static destinationRow(
    cells: readonly string[],
    destination: number,
    line: number,
  ): IModuleDestinationRow | IModuleDestinationFailure {
    const target = cells[destination] ?? "";
    const awaiting = ModuleDestinations.AWAITING.exec(target);
    const source = awaiting === null ? target : cells[0];
    const patterns = ModuleDestinations.spans(source).filter((span) =>
      span.startsWith("src/"),
    );
    if (patterns.length === 0)
      return { kind: "unresolvable-row", subject: cells[0], line };
    return {
      line,
      patterns,
      awaiting: awaiting === null ? null : Number(awaiting[1]),
    };
  }

  private static patternsOf(
    rows: readonly IModuleDestinationRow[],
  ): IPlacedPattern[] {
    return rows.flatMap((row) =>
      row.patterns.map((pattern) => ({ pattern, line: row.line })),
    );
  }

  /** A table line's cells, split on unescaped pipes. */
  private static cells(line: string): string[] {
    return line
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split(/(?<!\\)\|/)
      .map((cell) => cell.trim());
  }

  private static spans(cell: string): string[] {
    return [...cell.matchAll(ModuleDestinations.SPAN)].map((match) => match[1]);
  }
}

export default ModuleDestinations;
