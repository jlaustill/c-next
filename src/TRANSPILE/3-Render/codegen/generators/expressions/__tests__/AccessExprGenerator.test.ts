import { describe, it, expect } from "vitest";
import accessGenerators from "../AccessExprGenerator";
import TranspileState from "../../../../../TranspileState";

describe("AccessExprGenerator", () => {
  // #1668 review: the generators take the capacity the typer gives the
  // measured value -- a string's, or null for anything else -- rather than a
  // type info a caller assembled for them
  describe("generateCapacityProperty", () => {
    it.each([
      [64, "64"],
      [255, "255"],
    ])("returns a string's capacity %i", (capacity, code) => {
      const result = accessGenerators.generateCapacityProperty(capacity);
      expect(result.code).toBe(code);
      expect(result.effects).toHaveLength(0);
    });

    it("throws for a value with no capacity", () => {
      expect(() => accessGenerators.generateCapacityProperty(null)).toThrow(
        "E0887 rejects this in pass 2.1",
      );
    });
  });

  describe("generateSizeProperty", () => {
    it.each([
      [64, "65"],
      [127, "128"],
    ])(
      "returns a string's capacity %i plus its terminator",
      (capacity, code) => {
        const result = accessGenerators.generateSizeProperty(capacity);
        expect(result.code).toBe(code);
        expect(result.effects).toHaveLength(0);
      },
    );

    it("throws for a value with no capacity", () => {
      expect(() => accessGenerators.generateSizeProperty(null)).toThrow(
        "E0887 rejects this in pass 2.1",
      );
    });
  });

  describe("generateBitmapFieldAccess", () => {
    it("generates single bit access", () => {
      const result = accessGenerators.generateBitmapFieldAccess(
        "status",
        {
          offset: 0,
          width: 1,
        },
        new TranspileState(),
      );
      expect(result.code).toBe("((status >> 0) & 1)");
      expect(result.effects).toHaveLength(0);
    });

    it("generates single bit access at different offsets", () => {
      const result = accessGenerators.generateBitmapFieldAccess(
        "flags",
        {
          offset: 7,
          width: 1,
        },
        new TranspileState(),
      );
      expect(result.code).toBe("((flags >> 7) & 1)");
    });

    it("generates multi-bit access with correct mask", () => {
      const result = accessGenerators.generateBitmapFieldAccess(
        "control",
        {
          offset: 4,
          width: 4,
        },
        new TranspileState(),
      );
      // 4-bit mask: (1 << 4) - 1 = 15 = 0xF
      expect(result.code).toBe("((control >> 4) & 0xF)");
    });

    it("generates 2-bit field access", () => {
      const result = accessGenerators.generateBitmapFieldAccess(
        "reg",
        {
          offset: 2,
          width: 2,
        },
        new TranspileState(),
      );
      // 2-bit mask: (1 << 2) - 1 = 3
      expect(result.code).toBe("((reg >> 2) & 0x3)");
    });

    it("generates 8-bit field access", () => {
      const result = accessGenerators.generateBitmapFieldAccess(
        "data",
        {
          offset: 8,
          width: 8,
        },
        new TranspileState(),
      );
      // 8-bit mask: (1 << 8) - 1 = 255 = 0xFF
      expect(result.code).toBe("((data >> 8) & 0xFF)");
    });

    it("handles complex expressions as result", () => {
      const result = accessGenerators.generateBitmapFieldAccess(
        "arr[i].field",
        {
          offset: 0,
          width: 3,
        },
        new TranspileState(),
      );
      // 3-bit mask: (1 << 3) - 1 = 7
      expect(result.code).toBe("((arr[i].field >> 0) & 0x7)");
    });

    it("generates 16-bit field access", () => {
      const result = accessGenerators.generateBitmapFieldAccess(
        "word",
        {
          offset: 0,
          width: 16,
        },
        new TranspileState(),
      );
      // 16-bit mask: (1 << 16) - 1 = 65535 = 0xFFFF
      expect(result.code).toBe("((word >> 0) & 0xFFFF)");
    });
  });
});
