import { describe, it, expect } from "vitest";
import BaseIdentifierBuilder from "../BaseIdentifierBuilder";

describe("BaseIdentifierBuilder", () => {
  describe("build", () => {
    it("should return identifier unchanged for global prefix", () => {
      const result = BaseIdentifierBuilder.build("counter", true, false, null);

      expect(result).toEqual({
        result: "counter",
        firstId: "counter",
      });
    });

    it("should prefix with scope for this prefix", () => {
      const result = BaseIdentifierBuilder.build("speed", false, true, "Motor");

      expect(result).toEqual({
        result: "Motor_speed",
        firstId: "speed",
      });
    });

    it("should throw error when this is used outside scope", () => {
      expect(() => {
        BaseIdentifierBuilder.build("x", false, true, null);
      }).toThrow("Error: 'this' can only be used inside a scope");
    });

    it("should return identifier unchanged for bare identifier", () => {
      const result = BaseIdentifierBuilder.build("myVar", false, false, null);

      expect(result).toEqual({
        result: "myVar",
        firstId: "myVar",
      });
    });

    it("should return identifier unchanged for bare identifier with scope context", () => {
      // Even with a current scope, a bare identifier is not prefixed
      const result = BaseIdentifierBuilder.build(
        "localVar",
        false,
        false,
        "Motor",
      );

      expect(result).toEqual({
        result: "localVar",
        firstId: "localVar",
      });
    });

    it("should handle complex scope names", () => {
      const result = BaseIdentifierBuilder.build(
        "value",
        false,
        true,
        "GPIO_Controller",
      );

      expect(result).toEqual({
        result: "GPIO_Controller_value",
        firstId: "value",
      });
    });
  });
});
