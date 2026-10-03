import { describe, expect, it } from "vitest";

import TypeDeclarationAnalyzer from "../TypeDeclarationAnalyzer";
import testAnalysisContextFor from "./testAnalysisContextFor";

/** The analyzer's findings on `source`, declared and resolved as 1.3/1.4 do */
const errors = (source: string, helpers?: Record<string, string>) => {
  const { context } = testAnalysisContextFor(source, { helpers });
  return new TypeDeclarationAnalyzer(context).analyze();
};

describe("TypeDeclarationAnalyzer", () => {
  describe("E0893 -- a bitmap's field widths add up to its size (ADR-034)", () => {
    it("reports too few bits and too many, each at its own bitmap", () => {
      const found = errors(
        "bitmap8 Few {\n    a,\n    b[3]\n}\n\nbitmap16 Many {\n    v[17]\n}\n",
      );

      expect(found.map((e) => [e.code, e.line, e.column])).toEqual([
        ["E0893", 1, 0],
        ["E0893", 6, 0],
      ]);
      expect(found[0].message).toBe(
        "Bitmap 'Few' has 4 bits but bitmap8 requires exactly 8 bits",
      );
      expect(found[1].message).toBe(
        "Bitmap 'Many' has 17 bits but bitmap16 requires exactly 16 bits",
      );
    });

    it("stays silent on a bitmap its fields fill exactly", () => {
      expect(errors("bitmap8 Exact {\n    a[4],\n    b[4]\n}\n")).toEqual([]);
    });

    it("names a scope-declared bitmap by its C-Next name", () => {
      const found = errors(
        "scope Motor {\n    bitmap8 Flags {\n        Mode[3]\n    }\n}\n",
      );

      expect(found).toHaveLength(1);
      expect(found[0].message).toContain("'Motor.Flags'");
      expect([found[0].line, found[0].column]).toEqual([2, 4]);
    });
  });

  describe("E0894 -- an enum member's value is not negative (ADR-017)", () => {
    it("reports a negative member at the member, and stays silent on zero", () => {
      const found = errors("enum E {\n    ZERO <- 0,\n    NEG <- -1\n}\n");

      expect(found.map((e) => [e.code, e.line, e.column])).toEqual([
        ["E0894", 3, 4],
      ]);
      expect(found[0].message).toBe(
        "Negative values not allowed in enum (found -1 in E.NEG)",
      );
    });

    it("reports a member that counts on from a negative value", () => {
      const found = errors("enum E {\n    A <- -2,\n    B,\n    C\n}\n");

      // C counts on to 0, which is allowed.
      expect(found.map((e) => e.message)).toEqual([
        "Negative values not allowed in enum (found -2 in E.A)",
        "Negative values not allowed in enum (found -1 in E.B)",
      ]);
    });

    it("names a scope-declared enum's member by its C-Next name", () => {
      const found = errors(
        "scope Motor {\n    enum EMode {\n        OFF <- -2\n    }\n}\n",
      );

      expect(found).toHaveLength(1);
      expect(found[0].message).toContain("Motor.EMode.OFF");
    });
  });

  it("judges only the file being analyzed, not the files it includes", () => {
    // Each file reports its own declarations when it is analyzed. Judging an
    // included file's here as well would report its error once per includer,
    // at the wrong file.
    const found = errors('#include "lib.cnx"\n\nbitmap8 Ok {\n    a[8]\n}\n', {
      "lib.cnx": "bitmap8 Bad {\n    a\n}\n\nenum ELib {\n    X <- -1\n}\n",
    });

    expect(found).toEqual([]);
  });

  it("reports in source order, whatever order the declarations were registered in", () => {
    const found = errors(
      "enum E {\n    N <- -1\n}\n\nbitmap8 B {\n    a\n}\n\nenum F {\n    M <- -1\n}\n",
    );

    expect(found.map((e) => e.line)).toEqual([2, 5, 10]);
  });
});
