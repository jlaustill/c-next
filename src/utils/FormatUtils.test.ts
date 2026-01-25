import { describe, it, expect } from "vitest";
import FormatUtils from "./FormatUtils";

// ========================================================================
// indent
// ========================================================================
describe("FormatUtils.indent", () => {
  it("returns empty string for level 0", () => {
    expect(FormatUtils.indent(0)).toBe("");
  });

  it("returns 4 spaces for level 1", () => {
    expect(FormatUtils.indent(1)).toBe("    ");
  });

  it("returns 8 spaces for level 2", () => {
    expect(FormatUtils.indent(2)).toBe("        ");
  });

  it("returns 12 spaces for level 3", () => {
    expect(FormatUtils.indent(3)).toBe("            ");
  });
});

// ========================================================================
// indentLines
// ========================================================================
describe("FormatUtils.indentLines", () => {
  it("indents single line", () => {
    expect(FormatUtils.indentLines("code;", 1)).toBe("    code;");
  });

  it("indents multiple lines", () => {
    expect(FormatUtils.indentLines("line1;\nline2;", 1)).toBe(
      "    line1;\n    line2;",
    );
  });

  it("preserves empty lines without indentation", () => {
    expect(FormatUtils.indentLines("line1;\n\nline2;", 1)).toBe(
      "    line1;\n\n    line2;",
    );
  });

  it("handles level 0 (no indent)", () => {
    expect(FormatUtils.indentLines("code;", 0)).toBe("code;");
  });

  it("handles deeper indentation", () => {
    expect(FormatUtils.indentLines("x = 1;", 2)).toBe("        x = 1;");
  });
});

// ========================================================================
// joinNonEmpty
// ========================================================================
describe("FormatUtils.joinNonEmpty", () => {
  it("joins non-empty strings", () => {
    expect(FormatUtils.joinNonEmpty(["a", "b", "c"], ", ")).toBe("a, b, c");
  });

  it("filters out empty strings", () => {
    expect(FormatUtils.joinNonEmpty(["a", "", "b", "", "c"], ", ")).toBe(
      "a, b, c",
    );
  });

  it("returns empty string for all empty parts", () => {
    expect(FormatUtils.joinNonEmpty(["", "", ""], ", ")).toBe("");
  });

  it("handles single element", () => {
    expect(FormatUtils.joinNonEmpty(["only"], "-")).toBe("only");
  });

  it("uses different separators", () => {
    expect(FormatUtils.joinNonEmpty(["x", "y"], "\n")).toBe("x\ny");
  });
});

// ========================================================================
// wrapInBraces
// ========================================================================
describe("FormatUtils.wrapInBraces", () => {
  it("wraps content in braces with newlines by default", () => {
    expect(FormatUtils.wrapInBraces("code;")).toBe("{\ncode;\n}");
  });

  it("wraps content inline when specified", () => {
    expect(FormatUtils.wrapInBraces("1", true)).toBe("{ 1 }");
  });

  it("handles multi-line content", () => {
    expect(FormatUtils.wrapInBraces("line1;\nline2;")).toBe(
      "{\nline1;\nline2;\n}",
    );
  });

  it("handles empty content", () => {
    expect(FormatUtils.wrapInBraces("")).toBe("{\n\n}");
  });

  it("handles empty content inline", () => {
    expect(FormatUtils.wrapInBraces("", true)).toBe("{  }");
  });
});

// ========================================================================
// INDENT constant
// ========================================================================
describe("FormatUtils.INDENT", () => {
  it("is 4 spaces", () => {
    expect(FormatUtils.INDENT).toBe("    ");
    expect(FormatUtils.INDENT.length).toBe(4);
  });
});
