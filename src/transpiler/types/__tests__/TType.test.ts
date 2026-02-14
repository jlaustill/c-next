import { describe, it, expect } from "vitest";
import TTypeUtils from "../../../utils/TTypeUtils";

describe("TType", () => {
  describe("createPrimitive", () => {
    it("creates a primitive type", () => {
      const t = TTypeUtils.createPrimitive("u32");
      expect(t.kind).toBe("primitive");
      expect(t.primitive).toBe("u32");
    });

    it("creates all primitive kinds", () => {
      const kinds = [
        "void",
        "bool",
        "u8",
        "i8",
        "u16",
        "i16",
        "u32",
        "i32",
        "u64",
        "i64",
        "f32",
        "f64",
      ] as const;
      for (const kind of kinds) {
        const t = TTypeUtils.createPrimitive(kind);
        expect(t.kind).toBe("primitive");
        expect(t.primitive).toBe(kind);
      }
    });
  });

  describe("createArray", () => {
    it("creates an array type with dimensions", () => {
      const elem = TTypeUtils.createPrimitive("u8");
      const t = TTypeUtils.createArray(elem, [10, 20]);
      expect(t.kind).toBe("array");
      expect(t.elementType).toBe(elem);
      expect(t.dimensions).toEqual([10, 20]);
    });

    it("creates single-dimension array", () => {
      const elem = TTypeUtils.createPrimitive("i32");
      const t = TTypeUtils.createArray(elem, [5]);
      expect(t.kind).toBe("array");
      expect(t.dimensions).toEqual([5]);
    });

    it("supports string dimensions for C macros", () => {
      const elem = TTypeUtils.createPrimitive("u8");
      const t = TTypeUtils.createArray(elem, ["BUFFER_SIZE"]);
      expect(t.dimensions).toEqual(["BUFFER_SIZE"]);
    });
  });

  describe("createString", () => {
    it("creates a string type with capacity", () => {
      const t = TTypeUtils.createString(32);
      expect(t.kind).toBe("string");
      expect(t.capacity).toBe(32);
    });

    it("creates string with different capacities", () => {
      const t1 = TTypeUtils.createString(64);
      const t2 = TTypeUtils.createString(256);
      expect(t1.capacity).toBe(64);
      expect(t2.capacity).toBe(256);
    });
  });

  describe("createExternal", () => {
    it("creates an external C++ type", () => {
      const t = TTypeUtils.createExternal("FlexCAN_T4<CAN1>");
      expect(t.kind).toBe("external");
      expect(t.name).toBe("FlexCAN_T4<CAN1>");
    });

    it("creates external type without template", () => {
      const t = TTypeUtils.createExternal("SomeExternalClass");
      expect(t.kind).toBe("external");
      expect(t.name).toBe("SomeExternalClass");
    });
  });

  describe("createStruct", () => {
    it("creates a struct type reference", () => {
      const t = TTypeUtils.createStruct("Point");
      expect(t.kind).toBe("struct");
      expect(t.name).toBe("Point");
    });
  });

  describe("createEnum", () => {
    it("creates an enum type reference", () => {
      const t = TTypeUtils.createEnum("Color");
      expect(t.kind).toBe("enum");
      expect(t.name).toBe("Color");
    });
  });

  describe("createBitmap", () => {
    it("creates a bitmap type reference", () => {
      const t = TTypeUtils.createBitmap("StatusFlags", 8);
      expect(t.kind).toBe("bitmap");
      expect(t.name).toBe("StatusFlags");
      expect(t.bitWidth).toBe(8);
    });

    it("creates bitmap with different widths", () => {
      const t16 = TTypeUtils.createBitmap("Flags16", 16);
      const t32 = TTypeUtils.createBitmap("Flags32", 32);
      expect(t16.bitWidth).toBe(16);
      expect(t32.bitWidth).toBe(32);
    });
  });

  describe("createCallback", () => {
    it("creates a callback type reference", () => {
      const t = TTypeUtils.createCallback("onClick");
      expect(t.kind).toBe("callback");
      expect(t.name).toBe("onClick");
    });
  });

  describe("createRegister", () => {
    it("creates a register type reference", () => {
      const t = TTypeUtils.createRegister("PORTA");
      expect(t.kind).toBe("register");
      expect(t.name).toBe("PORTA");
    });
  });

  describe("type guards", () => {
    it("isPrimitive returns true for primitives", () => {
      const t = TTypeUtils.createPrimitive("i64");
      expect(TTypeUtils.isPrimitive(t)).toBe(true);
    });

    it("isPrimitive returns false for non-primitives", () => {
      const t = TTypeUtils.createString(32);
      expect(TTypeUtils.isPrimitive(t)).toBe(false);
    });

    it("isArray returns true for arrays", () => {
      const t = TTypeUtils.createArray(TTypeUtils.createPrimitive("u8"), [5]);
      expect(TTypeUtils.isArray(t)).toBe(true);
    });

    it("isArray returns false for non-arrays", () => {
      const t = TTypeUtils.createPrimitive("u8");
      expect(TTypeUtils.isArray(t)).toBe(false);
    });

    it("isStruct returns true for structs", () => {
      const t = TTypeUtils.createStruct("Point");
      expect(TTypeUtils.isStruct(t)).toBe(true);
    });

    it("isStruct returns false for non-structs", () => {
      const t = TTypeUtils.createPrimitive("u32");
      expect(TTypeUtils.isStruct(t)).toBe(false);
    });

    it("isEnum returns true for enums", () => {
      const t = TTypeUtils.createEnum("Color");
      expect(TTypeUtils.isEnum(t)).toBe(true);
    });

    it("isEnum returns false for non-enums", () => {
      const t = TTypeUtils.createStruct("Point");
      expect(TTypeUtils.isEnum(t)).toBe(false);
    });

    it("isString returns true for strings", () => {
      const t = TTypeUtils.createString(64);
      expect(TTypeUtils.isString(t)).toBe(true);
    });

    it("isString returns false for non-strings", () => {
      const t = TTypeUtils.createPrimitive("u8");
      expect(TTypeUtils.isString(t)).toBe(false);
    });

    it("isBitmap returns true for bitmaps", () => {
      const t = TTypeUtils.createBitmap("Flags", 8);
      expect(TTypeUtils.isBitmap(t)).toBe(true);
    });

    it("isBitmap returns false for non-bitmaps", () => {
      const t = TTypeUtils.createEnum("Color");
      expect(TTypeUtils.isBitmap(t)).toBe(false);
    });

    it("isCallback returns true for callbacks", () => {
      const t = TTypeUtils.createCallback("handler");
      expect(TTypeUtils.isCallback(t)).toBe(true);
    });

    it("isCallback returns false for non-callbacks", () => {
      const t = TTypeUtils.createPrimitive("void");
      expect(TTypeUtils.isCallback(t)).toBe(false);
    });

    it("isRegister returns true for registers", () => {
      const t = TTypeUtils.createRegister("PORTB");
      expect(TTypeUtils.isRegister(t)).toBe(true);
    });

    it("isRegister returns false for non-registers", () => {
      const t = TTypeUtils.createExternal("SomeClass");
      expect(TTypeUtils.isRegister(t)).toBe(false);
    });

    it("isExternal returns true for external types", () => {
      const t = TTypeUtils.createExternal("FlexCAN_T4<CAN1>");
      expect(TTypeUtils.isExternal(t)).toBe(true);
    });

    it("isExternal returns false for non-external types", () => {
      const t = TTypeUtils.createPrimitive("u32");
      expect(TTypeUtils.isExternal(t)).toBe(false);
    });
  });

  describe("nested types", () => {
    it("creates array of structs", () => {
      const structType = TTypeUtils.createStruct("Point");
      const arrayType = TTypeUtils.createArray(structType, [10]);
      expect(arrayType.kind).toBe("array");
      expect(arrayType.elementType.kind).toBe("struct");
      if (arrayType.elementType.kind === "struct") {
        expect(arrayType.elementType.name).toBe("Point");
      }
    });

    it("creates multi-dimensional array of primitives", () => {
      const elemType = TTypeUtils.createPrimitive("f32");
      const arrayType = TTypeUtils.createArray(elemType, [3, 3]);
      expect(arrayType.dimensions).toEqual([3, 3]);
      expect(arrayType.elementType).toBe(elemType);
    });
  });
});
