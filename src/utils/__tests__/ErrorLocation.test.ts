import { describe, it, expect } from "vitest";
import ErrorLocation from "../ErrorLocation";

describe("ErrorLocation", () => {
  describe("parse", () => {
    it.each([
      [
        "should extract line:column prefix from error message",
        "8:4 Error: Cannot assign u32 to u8 (narrowing)",
        8,
        4,
        "Error: Cannot assign u32 to u8 (narrowing)",
      ],
      ["should handle line 1 column 0", "1:0 Some error", 1, 0, "Some error"],
      [
        "should handle large line numbers",
        "999:42 Overflow at boundary",
        999,
        42,
        "Overflow at boundary",
      ],
      [
        "should preserve full message content after prefix",
        "5:10 Error: Use bit indexing: value[0, 8]",
        5,
        10,
        "Error: Use bit indexing: value[0, 8]",
      ],
    ])("%s", (_label, source, line, column, message) => {
      const result = ErrorLocation.parse(source);
      expect(result.line).toBe(line);
      expect(result.column).toBe(column);
      expect(result.message).toBe(message);
    });

    it.each([
      [
        "should default to line 1 column 0 when no prefix found",
        "Error: something went wrong",
      ],
      ["should default for empty string", ""],
      ["should not match non-numeric prefix", "abc:def some error"],
      ["should not match if no space after column", "8:4"],
      [
        "should not match numeric line with non-numeric column",
        "8:abc some error",
      ],
      ["should not match when colon is at position 0", ":4 some error"],
    ])("%s", (_label, source) => {
      const result = ErrorLocation.parse(source);
      expect(result.line).toBe(1);
      expect(result.column).toBe(0);
      expect(result.message).toBe(source);
    });
  });
});
