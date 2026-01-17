/**
 * Tests for generateEnumHeader
 */

import generateEnumHeader from "./generateEnumHeader";
import IHeaderTypeInput from "./IHeaderTypeInput";

/**
 * Creates a minimal IHeaderTypeInput with only enumMembers populated
 */
function createInput(
  enumMembers: Map<string, Map<string, number>>,
): IHeaderTypeInput {
  return {
    enumMembers,
    structFields: new Map(),
    structFieldDimensions: new Map(),
    bitmapBackingType: new Map(),
    bitmapFields: new Map(),
  };
}

describe("generateEnumHeader", () => {
  describe("basic enum generation", () => {
    it("should generate typedef enum with prefixed members", () => {
      const members = new Map<string, number>([
        ["IDLE", 0],
        ["RUNNING", 1],
        ["STOPPED", 2],
      ]);
      const input = createInput(new Map([["State", members]]));

      const result = generateEnumHeader("State", input);

      expect(result).toContain("typedef enum {");
      expect(result).toContain("State_IDLE = 0");
      expect(result).toContain("State_RUNNING = 1");
      expect(result).toContain("State_STOPPED = 2");
      expect(result).toContain("} State;");
    });

    it("should handle single-member enums", () => {
      const members = new Map<string, number>([["ONLY", 42]]);
      const input = createInput(new Map([["Single", members]]));

      const result = generateEnumHeader("Single", input);

      expect(result).toBe(`typedef enum {\n    Single_ONLY = 42\n} Single;`);
    });

    it("should sort members by value", () => {
      // Insert in non-sorted order
      const members = new Map<string, number>([
        ["THIRD", 30],
        ["FIRST", 10],
        ["SECOND", 20],
      ]);
      const input = createInput(new Map([["Priority", members]]));

      const result = generateEnumHeader("Priority", input);
      const lines = result.split("\n");

      // Members should appear in value order
      expect(lines[1]).toContain("FIRST = 10");
      expect(lines[2]).toContain("SECOND = 20");
      expect(lines[3]).toContain("THIRD = 30");
    });
  });

  describe("member prefixing", () => {
    it("should prefix all members with enum name", () => {
      const members = new Map<string, number>([
        ["SENSOR_DISABLED", 0],
        ["PRESSURE_0_100PSI", 1],
      ]);
      const input = createInput(new Map([["ESensorType", members]]));

      const result = generateEnumHeader("ESensorType", input);

      expect(result).toContain("ESensorType_SENSOR_DISABLED = 0");
      expect(result).toContain("ESensorType_PRESSURE_0_100PSI = 1");
    });

    it("should handle enum names with underscores", () => {
      const members = new Map<string, number>([["VALUE", 1]]);
      const input = createInput(new Map([["My_Enum", members]]));

      const result = generateEnumHeader("My_Enum", input);

      expect(result).toContain("My_Enum_VALUE = 1");
    });
  });

  describe("missing enum handling", () => {
    it("should return comment when enum not found", () => {
      const input = createInput(new Map());

      const result = generateEnumHeader("Unknown", input);

      expect(result).toBe(
        "/* Enum: Unknown (see implementation for values) */",
      );
    });

    it("should return comment when enum has no members", () => {
      const input = createInput(new Map([["Empty", new Map()]]));

      const result = generateEnumHeader("Empty", input);

      expect(result).toBe("/* Enum: Empty (see implementation for values) */");
    });
  });

  describe("comma placement", () => {
    it("should have commas after all members except last", () => {
      const members = new Map<string, number>([
        ["A", 0],
        ["B", 1],
        ["C", 2],
      ]);
      const input = createInput(new Map([["Letters", members]]));

      const result = generateEnumHeader("Letters", input);
      const lines = result.split("\n");

      // Lines 1, 2 should have commas (A, B)
      expect(lines[1]).toMatch(/,$/);
      expect(lines[2]).toMatch(/,$/);
      // Line 3 (C) should NOT have comma
      expect(lines[3]).not.toMatch(/,$/);
    });
  });

  describe("negative values", () => {
    it("should handle negative enum values", () => {
      const members = new Map<string, number>([
        ["NEGATIVE", -1],
        ["ZERO", 0],
        ["POSITIVE", 1],
      ]);
      const input = createInput(new Map([["Signed", members]]));

      const result = generateEnumHeader("Signed", input);

      expect(result).toContain("Signed_NEGATIVE = -1");
      expect(result).toContain("Signed_ZERO = 0");
      expect(result).toContain("Signed_POSITIVE = 1");
    });
  });

  describe("boundary values", () => {
    it("should handle large enum values at C int boundaries", () => {
      const members = new Map<string, number>([
        ["MIN", -2147483648], // INT32_MIN
        ["MAX", 2147483647], // INT32_MAX
        ["ZERO", 0],
      ]);
      const input = createInput(new Map([["Bounds", members]]));

      const result = generateEnumHeader("Bounds", input);

      expect(result).toContain("Bounds_MIN = -2147483648");
      expect(result).toContain("Bounds_MAX = 2147483647");
      expect(result).toContain("Bounds_ZERO = 0");
    });
  });
});
