/**
 * Issue #1322: hold `docs/error-codes.md` to what it claims about itself.
 *
 * Its own preamble states the problem:
 *
 * > "next available" is read from this table: a code reserved elsewhere and
 * > recorded nowhere gets assigned a second time, and the collision is silent
 * > -- the registry is hand-maintained and has no gate, while
 * > `npm run diagnostics:manifest:check` only sees codes that already have a
 * > fixture.
 *
 * That was tolerable while the file held 55 codes and grew by one or two a
 * release. #1322 allocates roughly 45-60 at once, across eight ranges, with
 * eight reserved-do-not-reuse entries scattered through them. A silent
 * double-assignment there does not surface until a user reports two unrelated
 * errors sharing a code.
 *
 * Every invariant below holds on `main` today. The gate is added while it is
 * green, which is the only time adding one is cheap.
 *
 * Rows are keyed on their FIRST and LAST cell rather than on a fixed cell
 * count: E0807's description contains `|` characters and splits into six
 * cells, and a row this gate skipped would be a row it did not defend.
 */

interface IRegistryRow {
  readonly code: string;
  readonly description: string;
  readonly source: string;
}

class ErrorCodeRegistry {
  /** `E0424`, not the `E04xx` range-summary rows. */
  private static readonly CODE = /^E\d{4}$/;

  private static readonly RANGE = /^E(\d\d)xx$/;

  private static cells(line: string): string[] | null {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) {
      return null;
    }
    return trimmed
      .slice(1, -1)
      .split("|")
      .map((cell) => cell.trim());
  }

  static rows(markdown: string): IRegistryRow[] {
    const rows: IRegistryRow[] = [];
    for (const line of markdown.split("\n")) {
      const cells = ErrorCodeRegistry.cells(line);
      if (cells === null || cells.length < 2) continue;
      if (!ErrorCodeRegistry.CODE.test(cells[0])) continue;
      rows.push({
        code: cells[0],
        description: cells.slice(1, -1).join(" | "),
        source: cells[cells.length - 1],
      });
    }
    return rows;
  }

  /** `{ "E04xx": 9 }` from the range-summary table at the top of the file. */
  private static declaredCounts(markdown: string): Map<string, number> {
    const declared = new Map<string, number>();
    for (const line of markdown.split("\n")) {
      const cells = ErrorCodeRegistry.cells(line);
      if (cells === null || cells.length !== 3) continue;
      if (!ErrorCodeRegistry.RANGE.test(cells[0])) continue;
      const count = Number.parseInt(cells[2], 10);
      if (!Number.isNaN(count)) declared.set(cells[0], count);
    }
    return declared;
  }

  /**
   * A row for a code no source raises is legitimate only when the row says so.
   * Two spellings exist and both are load-bearing: `_(reserved)_` in the
   * description (E0428, E0506 -- reserved BY the #1321 audit precisely so they
   * would not be assigned twice) and `Planned` in the source cell (E0854,
   * E0855). Accepting neither would fail the file today; accepting anything
   * would let a genuinely orphaned row hide behind prose.
   */
  private static isUnimplemented(row: IRegistryRow): boolean {
    return row.description.includes("_(reserved)_") || row.source === "Planned";
  }

  static check(markdown: string, emitted: ReadonlySet<string>): string[] {
    const rows = ErrorCodeRegistry.rows(markdown);
    const errors: string[] = [];
    const seen = new Set<string>();

    for (const row of rows) {
      if (seen.has(row.code)) {
        errors.push(
          `${row.code} is listed twice -- "next available" is read from this table, so a duplicate row hides a collision`,
        );
      }
      seen.add(row.code);
      if (!emitted.has(row.code) && !ErrorCodeRegistry.isUnimplemented(row)) {
        errors.push(
          `${row.code} has a row but no source emits it -- mark it _(reserved)_ or Planned, or delete the row`,
        );
      }
    }

    for (const code of [...emitted].sort((a, b) => a.localeCompare(b))) {
      if (!seen.has(code)) {
        errors.push(
          `${code} is emitted in src/ but not registered in docs/error-codes.md`,
        );
      }
    }

    const codes = rows.map((row) => row.code);
    for (let index = 1; index < codes.length; index += 1) {
      if (codes[index] < codes[index - 1]) {
        errors.push(
          `${codes[index - 1]} -> ${codes[index]} is out of order; the table is read in sequence to find the next free code`,
        );
      }
    }

    const declared = ErrorCodeRegistry.declaredCounts(markdown);
    for (const [range, count] of declared) {
      const prefix = range.slice(0, 3);
      const actual = codes.filter((code) => code.startsWith(prefix)).length;
      if (actual !== count) {
        errors.push(
          `${range} declares ${count} code(s) and has ${actual} row(s)`,
        );
      }
    }

    return errors;
  }
}

export default ErrorCodeRegistry;
