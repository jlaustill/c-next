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

    it("should default for empty string", () => {
      const result = ParserUtils.parseErrorLocation("");
      expect(result.line).toBe(1);
      expect(result.column).toBe(0);
      expect(result.message).toBe("");
    });

    it("should not match non-numeric prefix", () => {
      const result = ParserUtils.parseErrorLocation("abc:def some error");
      expect(result.line).toBe(1);
      expect(result.column).toBe(0);
      expect(result.message).toBe("abc:def some error");
    });

    it("should not match if no space after column", () => {
      const result = ParserUtils.parseErrorLocation("8:4");
      expect(result.line).toBe(1);
      expect(result.column).toBe(0);
      expect(result.message).toBe("8:4");
    });

    it("should preserve full message content after prefix", () => {
      const result = ParserUtils.parseErrorLocation(
        "5:10 Error: Use bit indexing: value[0, 8]",
      );
      expect(result.line).toBe(5);
      expect(result.column).toBe(10);
      expect(result.message).toBe("Error: Use bit indexing: value[0, 8]");
    });
  });
});
