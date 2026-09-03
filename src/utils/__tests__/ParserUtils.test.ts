/**
 * Unit tests for ParserUtils
 * Tests source position extraction from parser contexts.
 */
import { describe, it, expect } from "vitest";
import ParserUtils from "../ParserUtils";

describe("ParserUtils", () => {
  describe("getPosition", () => {
    // ========================================================================
    // Valid contexts
    // ========================================================================

    it("should extract line and column from valid context", () => {
      const ctx = { start: { line: 10, column: 5 } };
      const pos = ParserUtils.getPosition(ctx);
      expect(pos.line).toBe(10);
      expect(pos.column).toBe(5);
    });

    it("should handle line 1 column 0 (first character)", () => {
      const ctx = { start: { line: 1, column: 0 } };
      const pos = ParserUtils.getPosition(ctx);
      expect(pos.line).toBe(1);
      expect(pos.column).toBe(0);
    });

    it("should handle large line numbers", () => {
      const ctx = { start: { line: 99999, column: 200 } };
      const pos = ParserUtils.getPosition(ctx);
      expect(pos.line).toBe(99999);
      expect(pos.column).toBe(200);
    });

    // ========================================================================
    // Null/undefined start token
    // ========================================================================

    it("should return 0,0 for null start", () => {
      const ctx = { start: null };
      const pos = ParserUtils.getPosition(ctx);
      expect(pos.line).toBe(0);
      expect(pos.column).toBe(0);
    });

    it("should return 0,0 for undefined start", () => {
      const ctx = { start: undefined };
      const pos = ParserUtils.getPosition(ctx);
      expect(pos.line).toBe(0);
      expect(pos.column).toBe(0);
    });

    it("should return 0,0 for missing start property", () => {
      const ctx = {};
      const pos = ParserUtils.getPosition(ctx);
      expect(pos.line).toBe(0);
      expect(pos.column).toBe(0);
    });

    // ========================================================================
    // Partial data
    // ========================================================================

    it("should handle missing line (return 0)", () => {
      const ctx = { start: { column: 5 } };
      const pos = ParserUtils.getPosition(ctx);
      expect(pos.line).toBe(0);
      expect(pos.column).toBe(5);
    });

    it("should handle missing column (return 0)", () => {
      const ctx = { start: { line: 10 } };
      const pos = ParserUtils.getPosition(ctx);
      expect(pos.line).toBe(10);
      expect(pos.column).toBe(0);
    });

    it("should handle empty start object", () => {
      const ctx = { start: {} };
      const pos = ParserUtils.getPosition(ctx);
      expect(pos.line).toBe(0);
      expect(pos.column).toBe(0);
    });

    // ========================================================================
    // Edge cases
    // ========================================================================

    it("should handle line 0 as valid value (not default)", () => {
      // Line 0 could theoretically exist in some parsers
      const ctx = { start: { line: 0, column: 5 } };
      const pos = ParserUtils.getPosition(ctx);
      expect(pos.line).toBe(0);
      expect(pos.column).toBe(5);
    });

    it("should handle undefined line and column in start", () => {
      const ctx = { start: { line: undefined, column: undefined } };
      const pos = ParserUtils.getPosition(ctx);
      expect(pos.line).toBe(0);
      expect(pos.column).toBe(0);
    });
  });

  describe("parseErrorLocation", () => {
    it("should extract line:column prefix from error message", () => {
      const result = ParserUtils.parseErrorLocation(
        "8:4 Error: Cannot assign u32 to u8 (narrowing)",
      );
      expect(result.line).toBe(8);
      expect(result.column).toBe(4);
      expect(result.message).toBe("Error: Cannot assign u32 to u8 (narrowing)");
    });

    it("should handle line 1 column 0", () => {
      const result = ParserUtils.parseErrorLocation("1:0 Some error");
      expect(result.line).toBe(1);
      expect(result.column).toBe(0);
      expect(result.message).toBe("Some error");
    });

    it("should handle large line numbers", () => {
      const result = ParserUtils.parseErrorLocation(
        "999:42 Overflow at boundary",
      );
      expect(result.line).toBe(999);
      expect(result.column).toBe(42);
      expect(result.message).toBe("Overflow at boundary");
    });

    it("should default to line 1 column 0 when no prefix found", () => {
      const result = ParserUtils.parseErrorLocation(
        "Error: something went wrong",
      );
      expect(result.line).toBe(1);
      expect(result.column).toBe(0);
      expect(result.message).toBe("Error: something went wrong");
    });

    it.each([
      ["should default for empty string", "", ""],
      [
        "should not match non-numeric prefix",
        "abc:def some error",
        "abc:def some error",
      ],
      ["should not match if no space after column", "8:4", "8:4"],
    ])("%s", (_label, source, expected) => {
      const result = ParserUtils.parseErrorLocation(source);
      expect(result.line).toBe(1);
      expect(result.column).toBe(0);
      expect(result.message).toBe(expected);
    });

    it("should preserve full message content after prefix", () => {
      const result = ParserUtils.parseErrorLocation(
        "5:10 Error: Use bit indexing: value[0, 8]",
      );
      expect(result.line).toBe(5);
      expect(result.column).toBe(10);
      expect(result.message).toBe("Error: Use bit indexing: value[0, 8]");
    });

    it("should not match numeric line with non-numeric column", () => {
      const result = ParserUtils.parseErrorLocation("8:abc some error");
      expect(result.line).toBe(1);
      expect(result.column).toBe(0);
      expect(result.message).toBe("8:abc some error");
    });

    it("should not match when colon is at position 0", () => {
      const result = ParserUtils.parseErrorLocation(":4 some error");
      expect(result.line).toBe(1);
      expect(result.column).toBe(0);
      expect(result.message).toBe(":4 some error");
    });
  });

  describe("getSpan", () => {
    // ========================================================================
    // The exclusive end -- the part that is easy to get wrong
    // ========================================================================

    it("ends one past the last character, not at the last token's start", () => {
      // ANTLR's `stop` is the LAST TOKEN, and its column is where that token
      // BEGINS. `scope Motor {` stopping on `{` at column 12 ends at 13.
      const span = ParserUtils.getSpan({
        start: { line: 3, column: 0 },
        stop: { line: 3, column: 12, text: "{" },
      });
      expect(span).toEqual({ line: 3, column: 0, endLine: 3, endColumn: 13 });
    });

    it("accounts for the full width of a multi-character final token", () => {
      // The case that makes the naive `endColumn: stop.column` read as correct
      // on single-character tokens and be wrong everywhere else.
      const span = ParserUtils.getSpan({
        start: { line: 1, column: 4 },
        stop: { line: 1, column: 10, text: "identifier" },
      });
      expect(span.endColumn).toBe(20);
    });

    it("carries a distinct endLine for a multi-line construct", () => {
      const span = ParserUtils.getSpan({
        start: { line: 5, column: 2 },
        stop: { line: 9, column: 0, text: "}" },
      });
      expect(span.line).toBe(5);
      expect(span.endLine).toBe(9);
    });

    // ========================================================================
    // Degenerate contexts -- a caller never sees a half-populated span
    // ========================================================================

    it("yields a zero-width span at start when there is no stop token", () => {
      const span = ParserUtils.getSpan({ start: { line: 8, column: 3 } });
      expect(span).toEqual({ line: 8, column: 3, endLine: 8, endColumn: 3 });
    });

    it("treats a null stop the same as a missing one", () => {
      const span = ParserUtils.getSpan({
        start: { line: 8, column: 3 },
        stop: null,
      });
      expect(span).toEqual({ line: 8, column: 3, endLine: 8, endColumn: 3 });
    });

    it("defaults every field to 0 when there is no start token", () => {
      expect(ParserUtils.getSpan({})).toEqual({
        line: 0,
        column: 0,
        endLine: 0,
        endColumn: 0,
      });
    });

    it("falls back to the start line when stop carries no line", () => {
      const span = ParserUtils.getSpan({
        start: { line: 4, column: 1 },
        stop: { text: "x" },
      });
      expect(span.endLine).toBe(4);
    });

    it("treats a stop with no text as zero-width at its own column", () => {
      // An imaginary token inserted by ANTLR error recovery has no text.
      const span = ParserUtils.getSpan({
        start: { line: 2, column: 0 },
        stop: { line: 2, column: 6, text: null },
      });
      expect(span.endColumn).toBe(6);
    });

    it("never reports a start-of-file position for a real declaration", () => {
      // The property #1318 exists to establish: 136 of 302 `.expected.error`
      // fixtures began at `1:0` because a symbol had no position to report.
      const span = ParserUtils.getSpan({
        start: { line: 42, column: 8 },
        stop: { line: 42, column: 8, text: "x" },
      });
      expect([span.line, span.column]).not.toEqual([1, 0]);
    });
  });
});
