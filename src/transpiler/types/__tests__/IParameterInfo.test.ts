import { describe, it, expect } from "vitest";
import ParameterUtils from "../ParameterUtils";
import TTypeUtils from "../TTypeUtils";

describe("IParameterInfo", () => {
  describe("create", () => {
    it("creates parameter with TType", () => {
      const param = ParameterUtils.create(
        "count",
        TTypeUtils.createPrimitive("u32"),
        false,
      );
      expect(param.name).toBe("count");
      expect(param.type.kind).toBe("primitive");
      expect(param.isConst).toBe(false);
    });

    it("creates const parameter", () => {
      const param = ParameterUtils.create(
        "config",
        TTypeUtils.createPrimitive("u8"),
        true,
      );
      expect(param.isConst).toBe(true);
    });

    it("supports array dimensions", () => {
      const param = ParameterUtils.create(
        "buffer",
        TTypeUtils.createPrimitive("u8"),
        false,
        [64],
      );
      expect(param.arrayDimensions).toEqual([64]);
    });

    it("supports string dimensions for C macros", () => {
      const param = ParameterUtils.create(
        "data",
        TTypeUtils.createPrimitive("u8"),
        false,
        ["BUFFER_SIZE"],
      );
      expect(param.arrayDimensions).toEqual(["BUFFER_SIZE"]);
    });

    it("supports multi-dimensional arrays", () => {
      const param = ParameterUtils.create(
        "matrix",
        TTypeUtils.createPrimitive("f32"),
        false,
        [4, 4],
      );
      expect(param.arrayDimensions).toEqual([4, 4]);
    });

    it("defaults arrayDimensions to undefined when not provided", () => {
      const param = ParameterUtils.create(
        "value",
        TTypeUtils.createPrimitive("i32"),
        false,
      );
      expect(param.arrayDimensions).toBeUndefined();
    });
  });

  describe("type support", () => {
    it("supports struct type parameters", () => {
      const param = ParameterUtils.create(
        "config",
        TTypeUtils.createStruct("Config"),
        true,
      );
      expect(param.type.kind).toBe("struct");
      if (param.type.kind === "struct") {
        expect(param.type.name).toBe("Config");
      }
    });

    it("supports enum type parameters", () => {
      const param = ParameterUtils.create(
        "mode",
        TTypeUtils.createEnum("Mode"),
        false,
      );
      expect(param.type.kind).toBe("enum");
      if (param.type.kind === "enum") {
        expect(param.type.name).toBe("Mode");
      }
    });

    it("supports callback type parameters", () => {
      const param = ParameterUtils.create(
        "handler",
        TTypeUtils.createCallback("EventHandler"),
        false,
      );
      expect(param.type.kind).toBe("callback");
      if (param.type.kind === "callback") {
        expect(param.type.name).toBe("EventHandler");
      }
    });

    it("supports string type parameters", () => {
      const param = ParameterUtils.create(
        "name",
        TTypeUtils.createString(32),
        true,
      );
      expect(param.type.kind).toBe("string");
      if (param.type.kind === "string") {
        expect(param.type.capacity).toBe(32);
      }
    });
  });

  describe("isArray", () => {
    it("returns true when arrayDimensions is defined and non-empty", () => {
      const param = ParameterUtils.create(
        "buffer",
        TTypeUtils.createPrimitive("u8"),
        false,
        [64],
      );
      expect(ParameterUtils.isArray(param)).toBe(true);
    });

    it("returns false when arrayDimensions is undefined", () => {
      const param = ParameterUtils.create(
        "value",
        TTypeUtils.createPrimitive("i32"),
        false,
      );
      expect(ParameterUtils.isArray(param)).toBe(false);
    });

    it("returns false when arrayDimensions is empty", () => {
      const param = ParameterUtils.create(
        "value",
        TTypeUtils.createPrimitive("i32"),
        false,
        [],
      );
      expect(ParameterUtils.isArray(param)).toBe(false);
    });
  });
});
