/**
 * Issue #1219: the severity table an ADR declares for its own matrix.
 *
 * The dangerous failure here is silent tolerance: a typo'd cell name that gets
 * skipped becomes `off`, so an author believes a cell is gated while nothing
 * checks it. These tests require a typo to be reported, not ignored.
 */

import AdrMatrixDeclaration from "../matrix/AdrMatrixDeclaration";

const withTable = (rows: string): string =>
  [
    "## Scope-Context Test Matrix",
    "",
    AdrMatrixDeclaration.SEVERITY_MARKER,
    "",
    "| Context | Relationship | Severity |",
    "| ------- | ------------ | -------- |",
    rows,
    "",
    "Some prose after the table.",
  ].join("\n");

describe("AdrMatrixDeclaration.parse", () => {
  it("returns an empty declaration when the ADR has no matrix marker", () => {
    const result = AdrMatrixDeclaration.parse(
      "# ADR-999\n\nNo matrix here.\n",
      "999",
    );
    expect(result.severities.size).toBe(0);
    expect(result.errors).toEqual([]);
  });

  it("reads a declared cell", () => {
    const result = AdrMatrixDeclaration.parse(
      withTable("| top-level function | same file | error |"),
      "051",
    );
    expect(result.errors).toEqual([]);
    expect(
      AdrMatrixDeclaration.severityOf(
        result,
        "top-level-function",
        "same-file",
      ),
    ).toBe("error");
  });

  it("treats an undeclared cell as off", () => {
    const result = AdrMatrixDeclaration.parse(
      withTable("| top-level function | same file | error |"),
      "051",
    );
    expect(
      AdrMatrixDeclaration.severityOf(
        result,
        "scope-method",
        "imported-transitive",
      ),
    ).toBe("off");
  });

  it("reads several cells", () => {
    const result = AdrMatrixDeclaration.parse(
      withTable(
        [
          "| top-level function | same file | error |",
          "| top-level function | imported direct | warn |",
          "| scope method | same file | warn |",
        ].join("\n"),
      ),
      "051",
    );
    expect(result.errors).toEqual([]);
    expect(result.severities.size).toBe(3);
  });

  it.each([
    // cspell:disable-next-line -- "top-levl" is a deliberate typo under test
    ["context", "| top-levl function | same file | error |", "unknown context"],
    [
      "relationship",
      "| top-level function | imported sideways | error |",
      "unknown relationship",
    ],
    [
      "severity",
      "| top-level function | same file | fatal |",
      "unknown severity",
    ],
  ])(
    "reports a typo'd %s instead of silently skipping it",
    (_label, row, expected) => {
      const result = AdrMatrixDeclaration.parse(withTable(row), "051");
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain(expected);
      // and it must NOT have been recorded
      expect(result.severities.size).toBe(0);
    },
  );

  it("reports a cell declared twice rather than letting the last win", () => {
    const result = AdrMatrixDeclaration.parse(
      withTable(
        [
          "| top-level function | same file | error |",
          "| top-level function | same file | warn |",
        ].join("\n"),
      ),
      "051",
    );
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("declared more than once");
    expect(
      AdrMatrixDeclaration.severityOf(
        result,
        "top-level-function",
        "same-file",
      ),
    ).toBe("error");
  });

  it("accepts canonical slugs as well as human spelling", () => {
    const result = AdrMatrixDeclaration.parse(
      withTable("| top-level-function | imported-transitive | warn |"),
      "051",
    );
    expect(result.errors).toEqual([]);
    expect(
      AdrMatrixDeclaration.severityOf(
        result,
        "top-level-function",
        "imported-transitive",
      ),
    ).toBe("warn");
  });

  it("reports a row with a missing column instead of skipping it", () => {
    // Verified against the real ADR: dropping the Relationship column from all
    // twelve ADR-051 rows previously produced zero cells AND zero errors, so
    // `check` printed "satisfied" with every obligation gone. The staleness
    // diff could not catch it either -- the report renders from occupancy and
    // came out byte-identical.
    const markdown = [
      AdrMatrixDeclaration.SEVERITY_MARKER,
      "",
      "| Context | Severity |",
      "| ------- | -------- |",
      "| global variable | error |",
      "| top-level function | error |",
      "",
      "Prose after, no further table.",
    ].join("\n");

    const result = AdrMatrixDeclaration.parse(markdown, "051");
    expect(result.severities.size).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.join("\n")).toContain("malformed row");
  });

  it("reports a single short row while the rest of the table still parses", () => {
    // Worse than the all-rows case: the other rows parse, so the ADR is not
    // dropped, and exactly one cell silently becomes `off`.
    const result = AdrMatrixDeclaration.parse(
      withTable(
        [
          "| top-level function | same file | error |",
          "| scope method | error |",
        ].join("\n"),
      ),
      "051",
    );
    expect(result.severities.size).toBe(1);
    expect(result.errors.join("\n")).toContain("malformed row");
  });

  it("does not keep scanning into a later table when the header is malformed", () => {
    // The short-row skip also left `started` false, so the walk continued past
    // the severity table and latched onto whatever markdown table came next --
    // reporting nonsense from an unrelated table instead of the real fault.
    const markdown = [
      AdrMatrixDeclaration.SEVERITY_MARKER,
      "",
      "| Context | Severity |",
      "| ------- | -------- |",
      "| global variable | error |",
      "",
      "## Some Later Section",
      "",
      "| Phase | Description | Status |",
      "| ----- | ----------- | ------ |",
      "| 1     | Detection   | done   |",
    ].join("\n");

    const result = AdrMatrixDeclaration.parse(markdown, "051");
    expect(result.errors.join("\n")).toContain("malformed row");
    expect(result.errors.join("\n")).not.toContain("Phase");
  });

  it("stops at the end of the table and ignores later prose", () => {
    const markdown = [
      AdrMatrixDeclaration.SEVERITY_MARKER,
      "",
      "| Context | Relationship | Severity |",
      "| ------- | ------------ | -------- |",
      "| scope member | same file | warn |",
      "",
      "Later prose.",
      "",
      "| Unrelated | Table | Here |",
      "| --------- | ----- | ---- |",
      "| nonsense  | rows  | fatal |",
    ].join("\n");
    const result = AdrMatrixDeclaration.parse(markdown, "051");
    expect(result.errors).toEqual([]);
    expect(result.severities.size).toBe(1);
  });
});
