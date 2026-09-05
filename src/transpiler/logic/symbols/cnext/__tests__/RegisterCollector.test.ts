import { describe, expect, it, beforeEach } from "vitest";
import parse from "./testHelpers";
import TestScopeUtils from "./testUtils";
import RegisterCollector from "../collectors/RegisterCollector";
import ESourceLanguage from "../../../../../utils/types/ESourceLanguage";

describe("RegisterCollector", () => {
  beforeEach(() => {
    TestScopeUtils.resetGlobalScope();
  });

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
      const symbol = RegisterCollector.collect(
        regCtx,
        "test.cnx",
        new Set(),
        "",
        "public",
      );

      expect(symbol.kind).toBe("register");
      expect(symbol.name).toBe("GPIO");
      expect(symbol.baseAddress).toBe("0x40000000");
      expect(symbol.sourceFile).toBe("test.cnx");
      expect(symbol.sourceLanguage).toBe(ESourceLanguage.CNext);
      expect(symbol.visibility).toBe("public");
      expect(symbol.scopePath).toBe("");

      expect(symbol.members.size).toBe(2);
      expect(symbol.members.get("DATA")).toMatchObject({
        offset: "0x00",
        cType: "uint32_t",
        access: "rw",
      });
      expect(symbol.members.get("DIR")).toMatchObject({
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
      const symbol = RegisterCollector.collect(
        regCtx,
        "test.cnx",
        new Set(),
        "",
        "public",
      );

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
      const symbol = RegisterCollector.collect(
        regCtx,
        "test.cnx",
        new Set(),
        "",
        "public",
      );

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
        "",
        "public",
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
      const symbol = RegisterCollector.collect(
        regCtx,
        "test.cnx",
        new Set(),
        "",
        "public",
      );

      expect(symbol.members.get("VALUE")?.bitmapType).toBeUndefined();
    });
  });

  describe("scoped registers", () => {
    it("uses scope reference properly", () => {
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
        "public",
      );

      expect(symbol.name).toBe("CTRL");
      expect(symbol.scopePath).toBe("Motor");
      expect(symbol.scopePath).toBe("Motor");
    });

    it("resolves a bare bitmap type through the ADR-057 ladder", () => {
      const code = `
        register CTRL @ 0x40005000 {
          FLAGS: MotorFlags rw @ 0x00,
        }
      `;
      const tree = parse(code);
      const regCtx = tree.declaration(0)!.registerDeclaration()!;
      // Bitmap would be collected as Motor__MotorFlags in a scope
      const knownBitmaps = new Set(["Motor__MotorFlags"]);
      // Production ALWAYS supplies this predicate -- CNextResolver builds it
      // from pass 0b -- so passing it is what makes this test model production.
      // The collector does not qualify names itself; it reads what the one
      // TypeBinding ladder resolved. The version of this test that omitted the
      // predicate passed only because the collector re-qualified the result,
      // which is precisely the capture #1472 removed.
      const isScopeType = (qualifiedName: string): boolean =>
        knownBitmaps.has(qualifiedName);
      const symbol = RegisterCollector.collect(
        regCtx,
        "motor.cnx",
        knownBitmaps,
        "Motor",
        "public",
        isScopeType,
      );

      expect(symbol.members.get("FLAGS")?.bitmapType).toBe("Motor__MotorFlags");
    });

    it("does not let a scope-local bitmap capture an explicit global. type", () => {
      const code = `
        register CTRL @ 0x40005000 {
          FLAGS: global.MotorFlags rw @ 0x00,
        }
      `;
      const tree = parse(code);
      const regCtx = tree.declaration(0)!.registerDeclaration()!;
      // BOTH names exist -- a global bitmap and a same-named one in the scope.
      // That collision is the whole point: ADR-057 says `global.` opts out, so
      // the member must bind the global one even though the scoped name is a
      // known bitmap and would match if anything re-qualified the result.
      const knownBitmaps = new Set(["Motor__MotorFlags", "MotorFlags"]);
      const isScopeType = (qualifiedName: string): boolean =>
        knownBitmaps.has(qualifiedName);
      const symbol = RegisterCollector.collect(
        regCtx,
        "motor.cnx",
        knownBitmaps,
        "Motor",
        "public",
        isScopeType,
      );

      expect(symbol.members.get("FLAGS")?.bitmapType).toBe("MotorFlags");
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
      const symbol = RegisterCollector.collect(
        regCtx,
        "test.cnx",
        new Set(),
        "",
        "public",
      );

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
      const symbol = RegisterCollector.collect(
        regCtx,
        "test.cnx",
        new Set(),
        "",
        "public",
      );

      expect(symbol.span.line).toBe(3);
    });
  });

  // #1300 review: every other test in this file passes "public", so the defect
  // class this parameter exists for -- a collector reporting a private
  // declaration as public -- was invisible at the unit level.
  describe("visibility (#1300)", () => {
    it("records a private declaration as private", () => {
      const tree = parse(`
        register Hidden @ 0x40000000 {
          DR: u32 rw @ 0x00,
        }
      `);
      const symbol = RegisterCollector.collect(
        tree.declaration(0)!.registerDeclaration()!,
        "test.cnx",
        new Set(),
        "",
        "private",
      );

      expect(symbol.visibility).toBe("private");
    });
  });

  describe("members carry their own position and identity (#1318)", () => {
    const collect = (code: string, scopePath = "", visibility = "public") =>
      RegisterCollector.collect(
        parse(code).declaration(0)!.registerDeclaration()!,
        "test.cnx",
        new Set<string>(),
        scopePath,
        visibility as "public" | "private",
      );

    it("gives each member a DISTINCT line, not the register's", () => {
      const symbol = collect(`
        register GPIO @ 0x40000000 {
          DATA: u32 rw @ 0x00,
          DIR:  u32 rw @ 0x04,
          MASK: u32 rw @ 0x08,
        }
      `);
      const lines = [...symbol.members.values()].map((m) => m.span.line);
      expect(new Set(lines).size).toBe(3);
      expect(lines).not.toContain(symbol.span.line);
    });

    it("keys a member by its owner, and inherits the owner's visibility", () => {
      const global = collect(
        `register GPIO @ 0x40000000 { DATA: u32 rw @ 0x00, }`,
      );
      expect(global.members.get("DATA")!.fullyQualifiedCName).toBe(
        "GPIO__DATA",
      );
      expect(global.members.get("DATA")!.name).toBe("DATA");

      const scoped = collect(
        `register GPIO @ 0x40000000 { DATA: u32 rw @ 0x00, }`,
        "Board",
        "private",
      );
      expect(scoped.members.get("DATA")!.fullyQualifiedCName).toBe(
        "Board__GPIO__DATA",
      );
      expect(scoped.members.get("DATA")!.visibility).toBe("private");
    });
  });
});
