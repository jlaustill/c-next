/**
 * Unit tests for BitmapCommentUtils
 */

import { describe, it, expect } from "vitest";
import BitmapCommentUtils from "../BitmapCommentUtils";

describe("BitmapCommentUtils", () => {
  describe("generateBitmapFieldComments", () => {
    it("should return empty array for empty field map", () => {
      const fields = new Map<string, { offset: number; width: number }>();
      const result = BitmapCommentUtils.generateBitmapFieldComments(fields);
      expect(result).toEqual([]);
    });

    it("should generate single bit field comment", () => {
      const fields = new Map([["Running", { offset: 0, width: 1 }]]);
      const result = BitmapCommentUtils.generateBitmapFieldComments(fields);
      expect(result).toEqual([
        "/* Fields:",
        " *   Running: bit 0 (1 bit)",
        " */",
      ]);
    });

    it("should generate multi-bit field comment with range", () => {
      const fields = new Map([["Mode", { offset: 2, width: 3 }]]);
      const result = BitmapCommentUtils.generateBitmapFieldComments(fields);
      expect(result).toEqual([
        "/* Fields:",
        " *   Mode: bits 2-4 (3 bits)",
        " */",
      ]);
    });

    it("should generate comments for multiple fields", () => {
      const fields = new Map([
        ["Running", { offset: 0, width: 1 }],
        ["Direction", { offset: 1, width: 1 }],
        ["Mode", { offset: 2, width: 3 }],
      ]);
      const result = BitmapCommentUtils.generateBitmapFieldComments(fields);
      expect(result).toEqual([
        "/* Fields:",
        " *   Running: bit 0 (1 bit)",
        " *   Direction: bit 1 (1 bit)",
        " *   Mode: bits 2-4 (3 bits)",
        " */",
      ]);
    });
  });
});
