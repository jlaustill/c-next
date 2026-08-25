/**
 * Issue #1219: fixture -> ADR linkage.
 *
 * The detection logic is the part of the matrix that can silently lie, so these
 * tests assert both directions: that a real marker is found, and that things
 * which merely LOOK like markers are not.
 */

import TestUtils from "../test-utils";

describe("TestUtils.findAdrReferences", () => {
  it("finds a single marker", () => {
    expect(TestUtils.findAdrReferences("// test-adr: 051\n")).toEqual(["051"]);
  });

  it("finds several comma-separated ADRs in one marker", () => {
    expect(TestUtils.findAdrReferences("// test-adr: 051, 057, 006\n")).toEqual(
      ["051", "057", "006"],
    );
  });

  it("finds markers spread across several lines", () => {
    const source = "// test-adr: 051\nu8 x <- 1;\n// test-adr: 013\n";
    expect(TestUtils.findAdrReferences(source)).toEqual(["051", "013"]);
  });

  it("deduplicates a repeated ADR", () => {
    expect(
      TestUtils.findAdrReferences("// test-adr: 051\n// test-adr: 51\n"),
    ).toEqual(["051"]);
  });

  it.each([
    ["bare number", "// test-adr: 51", "051"],
    ["two digits", "// test-adr: 6", "006"],
    ["ADR- prefix", "// test-adr: ADR-051", "051"],
    ["lowercase prefix", "// test-adr: adr-051", "051"],
    ["extra whitespace", "//   test-adr:   051   ", "051"],
    ["indented", "    // test-adr: 051", "051"],
  ])("normalizes %s", (_label, source, expected) => {
    expect(TestUtils.findAdrReferences(source)).toEqual([expected]);
  });

  it.each([
    ["prose ADR mention", "// ADR-051: Division by zero detection"],
    // Pins the OUTER marker regex. Without this case a regex loosened to
    // /(?:test-)?adr[:-]/ still passes, because every other prose example has
    // trailing text the inner validator rejects -- the guard would hold only
    // by coincidence.
    ["bare ADR reference with no trailing text", "// ADR-051"],
    ["bare ADR reference, lowercase", "// adr-051"],
    [
      "qualifying NOTE",
      "// NOTE (ADR-063 / #1117): these calls used to be written",
    ],
    ["mid-sentence reference", "// widen ADR-029's nominal-typing rule."],
    ["block comment form", "/* test-adr: 051 */"],
    ["no marker at all", "u8 x <- 1;"],
    ["marker without a number", "// test-adr: division"],
    ["four digits", "// test-adr: 1051"],
  ])("does not treat %s as a coverage claim", (_label, source) => {
    expect(TestUtils.findAdrReferences(source)).toEqual([]);
  });

  it("keeps valid ADRs when one entry in the list is malformed", () => {
    expect(
      TestUtils.findAdrReferences("// test-adr: 051, banana, 013"),
    ).toEqual(["051", "013"]);
  });
});
