import { describe, expect, it } from "vitest";
import parse from "./testHelpers";
import ScopeCollector from "../collectors/ScopeCollector";
import ESourceLanguage from "../../../../../utils/types/ESourceLanguage";
import SymbolGuards from "../../types/typeGuards";

describe("ScopeCollector", () => {
  describe("basic scope extraction", () => {
    it("collects an empty scope", () => {
      const code = `
        scope Motor {
        }
      `;
      const tree = parse(code);
      const scopeCtx = tree.declaration(0)!.scopeDeclaration()!;
      const result = ScopeCollector.collect(scopeCtx, "test.cnx", new Set());

      expect(result.scopeSymbol.kind).toBe("scope");
      expect(result.scopeSymbol.name).toBe("Motor");
      expect(result.scopeSymbol.members).toEqual([]);
      expect(result.scopeSymbol.sourceFile).toBe("test.cnx");
      expect(result.scopeSymbol.sourceLanguage).toBe(ESourceLanguage.CNext);
      expect(result.scopeSymbol.isExported).toBe(true);

      expect(result.memberSymbols).toEqual([]);
    });

    it("collects scope with functions", () => {
      const code = `
        scope Motor {
          public void init() {
          }
          void update() {
          }
        }
      `;
      const tree = parse(code);
      const scopeCtx = tree.declaration(0)!.scopeDeclaration()!;
      const result = ScopeCollector.collect(scopeCtx, "test.cnx", new Set());

      expect(result.scopeSymbol.members).toEqual(["init", "update"]);
      expect(result.scopeSymbol.memberVisibility.get("init")).toBe("public");
      expect(result.scopeSymbol.memberVisibility.get("update")).toBe("private");

      expect(result.memberSymbols.length).toBe(2);

      const initFunc = result.memberSymbols.find(
        (s) => s.name === "Motor_init",
      );
      expect(initFunc).toBeDefined();
      expect(SymbolGuards.isFunction(initFunc!)).toBe(true);
      if (SymbolGuards.isFunction(initFunc!)) {
        expect(initFunc.visibility).toBe("public");
        expect(initFunc.isExported).toBe(true);
      }

      const updateFunc = result.memberSymbols.find(
        (s) => s.name === "Motor_update",
      );
      expect(updateFunc).toBeDefined();
      expect(SymbolGuards.isFunction(updateFunc!)).toBe(true);
      if (SymbolGuards.isFunction(updateFunc!)) {
        expect(updateFunc.visibility).toBe("private");
        expect(updateFunc.isExported).toBe(false);
      }
    });

    it("collects scope with variables", () => {
      const code = `
        scope Motor {
          u32 position;
          public u32 speed;
        }
      `;
      const tree = parse(code);
      const scopeCtx = tree.declaration(0)!.scopeDeclaration()!;
      const result = ScopeCollector.collect(scopeCtx, "test.cnx", new Set());

      expect(result.scopeSymbol.members).toEqual(["position", "speed"]);
      expect(result.scopeSymbol.memberVisibility.get("position")).toBe(
        "private",
      );
      expect(result.scopeSymbol.memberVisibility.get("speed")).toBe("public");

      expect(result.memberSymbols.length).toBe(2);

      const posVar = result.memberSymbols.find(
        (s) => s.name === "Motor_position",
      );
      expect(posVar).toBeDefined();
      expect(SymbolGuards.isVariable(posVar!)).toBe(true);
      if (SymbolGuards.isVariable(posVar!)) {
        expect(posVar.type).toBe("u32");
        expect(posVar.isExported).toBe(false);
      }
    });
  });

  describe("nested type declarations", () => {
    it("collects scope with nested enum", () => {
      const code = `
        scope Motor {
          public enum State {
            Off,
            Running,
            Error
          }
        }
      `;
      const tree = parse(code);
      const scopeCtx = tree.declaration(0)!.scopeDeclaration()!;
      const result = ScopeCollector.collect(scopeCtx, "test.cnx", new Set());

      expect(result.scopeSymbol.members).toEqual(["State"]);

      const enumSymbol = result.memberSymbols.find(
        (s) => s.name === "Motor_State",
      );
      expect(enumSymbol).toBeDefined();
      expect(SymbolGuards.isEnum(enumSymbol!)).toBe(true);
      if (SymbolGuards.isEnum(enumSymbol!)) {
        expect(enumSymbol.members.get("Off")).toBe(0);
        expect(enumSymbol.members.get("Running")).toBe(1);
        expect(enumSymbol.members.get("Error")).toBe(2);
      }
    });

    it("collects scope with nested struct", () => {
      const code = `
        scope Motor {
          public struct Config {
            u32 maxSpeed;
            u32 acceleration;
          }
        }
      `;
      const tree = parse(code);
      const scopeCtx = tree.declaration(0)!.scopeDeclaration()!;
      const result = ScopeCollector.collect(scopeCtx, "test.cnx", new Set());

      const structSymbol = result.memberSymbols.find(
        (s) => s.name === "Motor_Config",
      );
      expect(structSymbol).toBeDefined();
      expect(SymbolGuards.isStruct(structSymbol!)).toBe(true);
      if (SymbolGuards.isStruct(structSymbol!)) {
        expect(structSymbol.fields.get("maxSpeed")?.type).toBe("u32");
        expect(structSymbol.fields.get("acceleration")?.type).toBe("u32");
      }
    });

    it("collects scope with nested bitmap", () => {
      const code = `
        scope Motor {
          bitmap8 Status {
            enabled,
            running,
            error,
            warning,
            reserved[4]
          }
        }
      `;
      const tree = parse(code);
      const scopeCtx = tree.declaration(0)!.scopeDeclaration()!;
      const result = ScopeCollector.collect(scopeCtx, "test.cnx", new Set());

      const bitmapSymbol = result.memberSymbols.find(
        (s) => s.name === "Motor_Status",
      );
      expect(bitmapSymbol).toBeDefined();
      expect(SymbolGuards.isBitmap(bitmapSymbol!)).toBe(true);
      if (SymbolGuards.isBitmap(bitmapSymbol!)) {
        expect(bitmapSymbol.backingType).toBe("uint8_t");
        expect(bitmapSymbol.fields.get("enabled")).toEqual({
          offset: 0,
          width: 1,
        });
      }
    });

    it("collects scope with nested register", () => {
      const code = `
        scope Motor {
          register CTRL @ 0x40001000 {
            STATUS: u32 rw @ 0x00,
            COMMAND: u32 wo @ 0x04,
          }
        }
      `;
      const tree = parse(code);
      const scopeCtx = tree.declaration(0)!.scopeDeclaration()!;
      const result = ScopeCollector.collect(scopeCtx, "test.cnx", new Set());

      const regSymbol = result.memberSymbols.find(
        (s) => s.name === "Motor_CTRL",
      );
      expect(regSymbol).toBeDefined();
      expect(SymbolGuards.isRegister(regSymbol!)).toBe(true);
      if (SymbolGuards.isRegister(regSymbol!)) {
        expect(regSymbol.baseAddress).toBe("0x40001000");
        expect(regSymbol.members.get("STATUS")?.access).toBe("rw");
        expect(regSymbol.members.get("COMMAND")?.access).toBe("wo");
      }
    });
  });

  describe("mixed members", () => {
    it("collects scope with multiple member types", () => {
      const code = `
        scope Motor {
          u32 position;

          public void init() {
          }

          enum State {
            Off,
            On
          }
        }
      `;
      const tree = parse(code);
      const scopeCtx = tree.declaration(0)!.scopeDeclaration()!;
      const result = ScopeCollector.collect(scopeCtx, "test.cnx", new Set());

      expect(result.scopeSymbol.members).toEqual(["position", "init", "State"]);
      expect(result.memberSymbols.length).toBe(3);

      // Verify each type was collected correctly
      const varSymbol = result.memberSymbols.find(
        (s) => s.name === "Motor_position",
      );
      expect(SymbolGuards.isVariable(varSymbol!)).toBe(true);

      const funcSymbol = result.memberSymbols.find(
        (s) => s.name === "Motor_init",
      );
      expect(SymbolGuards.isFunction(funcSymbol!)).toBe(true);

      const enumSymbol = result.memberSymbols.find(
        (s) => s.name === "Motor_State",
      );
      expect(SymbolGuards.isEnum(enumSymbol!)).toBe(true);
    });
  });

  describe("bitmap resolution in registers", () => {
    it("resolves scoped bitmap types in registers", () => {
      const code = `
        scope Motor {
          register CTRL @ 0x40001000 {
            FLAGS: MotorFlags rw @ 0x00,
          }
        }
      `;
      const tree = parse(code);
      const scopeCtx = tree.declaration(0)!.scopeDeclaration()!;
      // Simulate bitmap being collected in pass 1
      const knownBitmaps = new Set(["Motor_MotorFlags"]);
      const result = ScopeCollector.collect(scopeCtx, "test.cnx", knownBitmaps);

      const regSymbol = result.memberSymbols.find(
        (s) => s.name === "Motor_CTRL",
      );
      expect(SymbolGuards.isRegister(regSymbol!)).toBe(true);
      if (SymbolGuards.isRegister(regSymbol!)) {
        expect(regSymbol.members.get("FLAGS")?.bitmapType).toBe(
          "Motor_MotorFlags",
        );
      }
    });
  });

  describe("source line tracking", () => {
    it("captures the source line number", () => {
      const code = `

        scope OnLine3 {
        }
      `;
      const tree = parse(code);
      const scopeCtx = tree.declaration(0)!.scopeDeclaration()!;
      const result = ScopeCollector.collect(scopeCtx, "test.cnx", new Set());

      expect(result.scopeSymbol.sourceLine).toBe(3);
    });
  });
});
