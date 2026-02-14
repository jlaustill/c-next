import { describe, it, expect } from "vitest";
import ParameterUtils from "../ParameterUtils";
import TTypeUtils from "../TTypeUtils";

describe("IParameterInfo", () => {
  describe("create", () => {
    it("creates parameter with TType", () => {
      const param = ParameterUtils.create({
        name: "count",
        type: TTypeUtils.createPrimitive("u32"),
        isConst: false,
        isArray: false,
      });
      expect(param.name).toBe("count");
      expect(param.type.kind).toBe("primitive");
      expect(param.isConst).toBe(false);
      expect(param.isArray).toBe(false);
    });

    it("creates const parameter", () => {
      const param = ParameterUtils.create({
        name: "config",
        type: TTypeUtils.createPrimitive("u8"),
        isConst: true,
        isArray: false,
      });
      expect(param.isConst).toBe(true);
    });

    it("supports array dimensions", () => {
      const param = ParameterUtils.create({
        name: "buffer",
        type: TTypeUtils.createPrimitive("u8"),
        isConst: false,
        isArray: true,
        arrayDimensions: [64],
      });
      expect(param.isArray).toBe(true);
      expect(param.arrayDimensions).toEqual([64]);
    });

    it("supports string dimensions for C macros", () => {
      const param = ParameterUtils.create({
        name: "data",
        type: TTypeUtils.createPrimitive("u8"),
        isConst: false,
        isArray: true,
        arrayDimensions: ["BUFFER_SIZE"],
      });
      expect(param.arrayDimensions).toEqual(["BUFFER_SIZE"]);
    });

    it("supports multi-dimensional arrays", () => {
      const param = ParameterUtils.create({
        name: "matrix",
        type: TTypeUtils.createPrimitive("f32"),
        isConst: false,
        isArray: true,
        arrayDimensions: [4, 4],
      });
      expect(param.arrayDimensions).toEqual([4, 4]);
    });

    it("defaults arrayDimensions to undefined when not provided", () => {
      const param = ParameterUtils.create({
        name: "value",
        type: TTypeUtils.createPrimitive("i32"),
        isConst: false,
        isArray: false,
      });
      expect(param.arrayDimensions).toBeUndefined();
    });

    it("supports isAutoConst field", () => {
      const param = ParameterUtils.create({
        name: "ptr",
        type: TTypeUtils.createPrimitive("u8"),
        isConst: false,
        isArray: true,
        arrayDimensions: [10],
        isAutoConst: true,
      });
      expect(param.isAutoConst).toBe(true);
    });
  });

  describe("type support", () => {
    it("supports struct type parameters", () => {
      const param = ParameterUtils.create({
        name: "config",
        type: TTypeUtils.createStruct("Config"),
        isConst: true,
        isArray: false,
      });
      expect(param.type.kind).toBe("struct");
      if (param.type.kind === "struct") {
        expect(param.type.name).toBe("Config");
      }
    });

    it("supports enum type parameters", () => {
      const param = ParameterUtils.create({
        name: "mode",
        type: TTypeUtils.createEnum("Mode"),
        isConst: false,
        isArray: false,
      });
      expect(param.type.kind).toBe("enum");
      if (param.type.kind === "enum") {
        expect(param.type.name).toBe("Mode");
      }
    });

    it("supports callback type parameters", () => {
      const param = ParameterUtils.create({
        name: "handler",
        type: TTypeUtils.createCallback("EventHandler"),
        isConst: false,
        isArray: false,
      });
      expect(param.type.kind).toBe("callback");
      if (param.type.kind === "callback") {
        expect(param.type.name).toBe("EventHandler");
      }
    });

    it("supports string type parameters", () => {
      const param = ParameterUtils.create({
        name: "name",
        type: TTypeUtils.createString(32),
        isConst: true,
        isArray: false,
      });
      expect(param.type.kind).toBe("string");
      if (param.type.kind === "string") {
        expect(param.type.capacity).toBe(32);
      }
    });
  });

  describe("isArray", () => {
    it("returns true when arrayDimensions is defined and non-empty", () => {
      const param = ParameterUtils.create({
        name: "buffer",
        type: TTypeUtils.createPrimitive("u8"),
        isConst: false,
        isArray: true,
        arrayDimensions: [64],
      });
      expect(ParameterUtils.isArray(param)).toBe(true);
    });

    it("returns false when arrayDimensions is undefined", () => {
      const param = ParameterUtils.create({
        name: "value",
        type: TTypeUtils.createPrimitive("i32"),
        isConst: false,
        isArray: false,
      });
      expect(ParameterUtils.isArray(param)).toBe(false);
    });

    it("returns false when arrayDimensions is empty", () => {
      const param = ParameterUtils.create({
        name: "value",
        type: TTypeUtils.createPrimitive("i32"),
        isConst: false,
        isArray: false,
        arrayDimensions: [],
      });
      expect(ParameterUtils.isArray(param)).toBe(false);
    });
  });
});
