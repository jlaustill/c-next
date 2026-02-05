/**
 * Unit tests for BitmapAccessHelper
 *
 * Tests for the shared bitmap field access generation utility.
 */

import { describe, it, expect } from "vitest";
import BitmapAccessHelper from "../BitmapAccessHelper.js";

describe("BitmapAccessHelper", () => {
  describe("generate", () => {
    it("returns code and effects for known single-bit bitmap field", () => {
      const bitmapFields = new Map([
        ["Status", new Map([["Running", { offset: 0, width: 1 }]])],
      ]);

      const result = BitmapAccessHelper.generate(
        "status",
        "Running",
        "Status",
        bitmapFields,
        "type 'Status'",
      );

      expect(result.code).toBe("((status >> 0) & 1)");
      expect(result.effects).toHaveLength(0);
    });

    it("returns code for multi-bit bitmap field", () => {
      const bitmapFields = new Map([
        ["Control", new Map([["Mode", { offset: 2, width: 3 }]])],
      ]);

      const result = BitmapAccessHelper.generate(
        "ctrl",
        "Mode",
        "Control",
        bitmapFields,
        "type 'Control'",
      );

      expect(result.code).toContain("ctrl");
      expect(result.code).toContain("2");
      expect(result.effects).toHaveLength(0);
    });

    it("throws for unknown bitmap field with type context", () => {
      const bitmapFields = new Map([["Status", new Map()]]);

      expect(() =>
        BitmapAccessHelper.generate(
          "status",
          "Unknown",
          "Status",
          bitmapFields,
          "type 'Status'",
        ),
      ).toThrow("Unknown bitmap field 'Unknown' on type 'Status'");
    });

    it("throws for unknown bitmap field with register member context", () => {
      const bitmapFields = new Map([["CtrlBits", new Map()]]);

      expect(() =>
        BitmapAccessHelper.generate(
          "MOTOR_CTRL",
          "Missing",
          "CtrlBits",
          bitmapFields,
          "register member 'MOTOR_CTRL' (bitmap type 'CtrlBits')",
        ),
      ).toThrow("Unknown bitmap field 'Missing'");
      expect(() =>
        BitmapAccessHelper.generate(
          "MOTOR_CTRL",
          "Missing",
          "CtrlBits",
          bitmapFields,
          "register member 'MOTOR_CTRL' (bitmap type 'CtrlBits')",
        ),
      ).toThrow("register member");
    });

    it("throws for unknown bitmap field with struct member context", () => {
      const bitmapFields = new Map([["StatusBits", new Map()]]);

      expect(() =>
        BitmapAccessHelper.generate(
          "device.flags",
          "Missing",
          "StatusBits",
          bitmapFields,
          "struct member 'device.flags' (bitmap type 'StatusBits')",
        ),
      ).toThrow("struct member");
    });

    it("handles bitmap type not in field map", () => {
      const bitmapFields = new Map<
        string,
        Map<string, { offset: number; width: number }>
      >();

      expect(() =>
        BitmapAccessHelper.generate(
          "val",
          "Field",
          "Unknown",
          bitmapFields,
          "type 'Unknown'",
        ),
      ).toThrow("Unknown bitmap field 'Field' on type 'Unknown'");
    });
  });
});
