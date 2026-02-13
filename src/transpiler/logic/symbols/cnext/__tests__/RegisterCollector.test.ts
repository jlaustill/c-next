import { describe, expect, it } from "vitest";
import parse from "./testHelpers";
import RegisterCollector from "../collectors/RegisterCollector";
import ESourceLanguage from "../../../../../utils/types/ESourceLanguage";

describe("RegisterCollector", () => {
  describe("basic register extraction", () => {
    it("collects a simple register with primitive members", () => {
      const code = `
        register GPIO @ 0x40000000 {
          DATA: u32 rw @ 0x00,
          DIR:  u32 rw @ 0x04,
        }
      `;
      const tree = parse(code);
      const regCtx = tree.declaration(0)!.registerDeclaration()!;
      const symbol = RegisterCollector.collect(regCtx, "test.cnx", new Set());

      expect(symbol.kind).toBe("register");
      expect(symbol.name).toBe("GPIO");
      expect(symbol.baseAddress).toBe("0x40000000");
      expect(symbol.sourceFile).toBe("test.cnx");
      expect(symbol.sourceLanguage).toBe(ESourceLanguage.CNext);
      expect(symbol.isExported).toBe(true);

      expect(symbol.members.size).toBe(2);
      expect(symbol.members.get("DATA")).toEqual({
        offset: "0x00",
        cType: "uint32_t",
        access: "rw",
      });
      expect(symbol.members.get("DIR")).toEqual({
        offset: "0x04",
        cType: "uint32_t",
        access: "rw",
      });
    });

    it("handles different access modes", () => {
      const code = `
        register UART @ 0x40001000 {
          RX:    u8 ro @ 0x00,
          TX:    u8 wo @ 0x04,
          CTRL:  u16 rw @ 0x08,
          FLAGS: u8 w1c @ 0x0C,
          SET:   u8 w1s @ 0x10,
        }
      `;
      const tree = parse(code);
      const regCtx = tree.declaration(0)!.registerDeclaration()!;
      const symbol = RegisterCollector.collect(regCtx, "test.cnx", new Set());

      expect(symbol.members.get("RX")?.access).toBe("ro");
      expect(symbol.members.get("TX")?.access).toBe("wo");
      expect(symbol.members.get("CTRL")?.access).toBe("rw");
      expect(symbol.members.get("FLAGS")?.access).toBe("w1c");
      expect(symbol.members.get("SET")?.access).toBe("w1s");
    });

    it("converts C-Next types to C types", () => {
      const code = `
        register TIMERS @ 0x40002000 {
          COUNT8:  u8 rw @ 0x00,
          COUNT16: u16 rw @ 0x04,
          COUNT32: u32 rw @ 0x08,
          COUNT64: u64 rw @ 0x10,
          SIGNED:  i32 rw @ 0x18,
        }
      `;
      const tree = parse(code);
      const regCtx = tree.declaration(0)!.registerDeclaration()!;
      const symbol = RegisterCollector.collect(regCtx, "test.cnx", new Set());

      expect(symbol.members.get("COUNT8")?.cType).toBe("uint8_t");
      expect(symbol.members.get("COUNT16")?.cType).toBe("uint16_t");
      expect(symbol.members.get("COUNT32")?.cType).toBe("uint32_t");
      expect(symbol.members.get("COUNT64")?.cType).toBe("uint64_t");
      expect(symbol.members.get("SIGNED")?.cType).toBe("int32_t");
    });
  });

  describe("bitmap type references", () => {
    it("detects known bitmap types in members", () => {
      const code = `
        register STATUS @ 0x40003000 {
          FLAGS: StatusFlags rw @ 0x00,
        }
      `;
      const tree = parse(code);
      const regCtx = tree.declaration(0)!.registerDeclaration()!;
      const knownBitmaps = new Set(["StatusFlags"]);
      const symbol = RegisterCollector.collect(
        regCtx,
        "test.cnx",
        knownBitmaps,
      );

      const member = symbol.members.get("FLAGS");
      expect(member?.bitmapType).toBe("StatusFlags");
      expect(member?.cType).toBe("StatusFlags"); // User types stay as-is
    });

    it("does not set bitmapType for non-bitmap types", () => {
      const code = `
        register DATA @ 0x40004000 {
          VALUE: u32 rw @ 0x00,
        }
      `;
      const tree = parse(code);
      const regCtx = tree.declaration(0)!.registerDeclaration()!;
      const symbol = RegisterCollector.collect(regCtx, "test.cnx", new Set());

      expect(symbol.members.get("VALUE")?.bitmapType).toBeUndefined();
    });
  });

  describe("scoped registers", () => {
    it("prefixes name with scope when scopeName is provided", () => {
      const code = `
        register CTRL @ 0x40005000 {
          STATUS: u32 rw @ 0x00,
        }
      `;
      const tree = parse(code);
      const regCtx = tree.declaration(0)!.registerDeclaration()!;
      const symbol = RegisterCollector.collect(
        regCtx,
        "motor.cnx",
        new Set(),
        "Motor",
      );

      expect(symbol.name).toBe("Motor_CTRL");
    });

    it("resolves scoped bitmap types", () => {
      const code = `
        register CTRL @ 0x40005000 {
          FLAGS: MotorFlags rw @ 0x00,
        }
      `;
      const tree = parse(code);
      const regCtx = tree.declaration(0)!.registerDeclaration()!;
      // Bitmap would be collected as Motor_MotorFlags in a scope
      const knownBitmaps = new Set(["Motor_MotorFlags"]);
      const symbol = RegisterCollector.collect(
        regCtx,
        "motor.cnx",
        knownBitmaps,
        "Motor",
      );

      // The collector checks both scoped and unscoped names
      expect(symbol.members.get("FLAGS")?.bitmapType).toBe("Motor_MotorFlags");
    });
  });

  describe("base address expressions", () => {
    it("captures complex base address expressions", () => {
      const code = `
        register DMA @ BASE_ADDR {
          CTRL: u32 rw @ 0x00,
        }
      `;
      const tree = parse(code);
      const regCtx = tree.declaration(0)!.registerDeclaration()!;
      const symbol = RegisterCollector.collect(regCtx, "test.cnx", new Set());

      expect(symbol.baseAddress).toBe("BASE_ADDR");
    });
  });

  describe("source line tracking", () => {
    it("captures the source line number", () => {
      const code = `

        register OnLine3 @ 0x40000000 {
          DATA: u32 rw @ 0x00,
        }
      `;
      const tree = parse(code);
      const regCtx = tree.declaration(0)!.registerDeclaration()!;
      const symbol = RegisterCollector.collect(regCtx, "test.cnx", new Set());

      expect(symbol.sourceLine).toBe(3);
    });
  });
});
