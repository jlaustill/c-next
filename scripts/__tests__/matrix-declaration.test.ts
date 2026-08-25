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
