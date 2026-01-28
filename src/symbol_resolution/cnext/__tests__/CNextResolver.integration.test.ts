import { describe, expect, it } from "vitest";
import parse from "./testHelpers";
import CNextResolver from "../index";
import ESymbolKind from "../../../types/ESymbolKind";
import SymbolGuards from "../../types/typeGuards";

describe("CNextResolver Integration", () => {
  describe("single declaration types", () => {
    it("resolves top-level struct", () => {
      const code = `
        struct Point {
          i32 x;
          i32 y;
        }
      `;
      const tree = parse(code);
      const symbols = CNextResolver.resolve(tree, "test.cnx");

      expect(symbols.length).toBe(1);
      expect(SymbolGuards.isStruct(symbols[0])).toBe(true);
      expect(symbols[0].name).toBe("Point");
    });

    it("resolves top-level enum", () => {
      const code = `
        enum Color {
          Red,
          Green,
          Blue
        }
      `;
      const tree = parse(code);
      const symbols = CNextResolver.resolve(tree, "test.cnx");

      expect(symbols.length).toBe(1);
      expect(SymbolGuards.isEnum(symbols[0])).toBe(true);
    });

    it("resolves top-level function", () => {
      const code = `
        void main() {
        }
      `;
      const tree = parse(code);
      const symbols = CNextResolver.resolve(tree, "test.cnx");

      expect(symbols.length).toBe(1);
      expect(SymbolGuards.isFunction(symbols[0])).toBe(true);
      expect(symbols[0].name).toBe("main");
    });

    it("resolves top-level variable", () => {
      const code = `
        u32 counter <- 0;
      `;
      const tree = parse(code);
      const symbols = CNextResolver.resolve(tree, "test.cnx");

      expect(symbols.length).toBe(1);
      expect(SymbolGuards.isVariable(symbols[0])).toBe(true);
      expect(symbols[0].name).toBe("counter");
    });

    it("resolves top-level bitmap", () => {
      const code = `
        bitmap8 Flags {
          enabled,
          ready,
          error,
          reserved[5]
        }
      `;
      const tree = parse(code);
      const symbols = CNextResolver.resolve(tree, "test.cnx");

      expect(symbols.length).toBe(1);
      expect(SymbolGuards.isBitmap(symbols[0])).toBe(true);
      expect(symbols[0].name).toBe("Flags");
    });

    it("resolves top-level register", () => {
      const code = `
        register GPIO @ 0x40000000 {
          DATA: u32 rw @ 0x00,
          DIR:  u32 rw @ 0x04,
        }
      `;
      const tree = parse(code);
      const symbols = CNextResolver.resolve(tree, "test.cnx");

      expect(symbols.length).toBe(1);
      expect(SymbolGuards.isRegister(symbols[0])).toBe(true);
      expect(symbols[0].name).toBe("GPIO");
    });
  });

  describe("scope handling", () => {
    it("resolves scope with members", () => {
      const code = `
        scope Motor {
          u32 position;

          public void init() {
          }

          void update() {
          }
        }
      `;
      const tree = parse(code);
      const symbols = CNextResolver.resolve(tree, "test.cnx");

      // Scope + 3 members
      expect(symbols.length).toBe(4);

      const scope = symbols.find((s) => s.name === "Motor");
      expect(scope).toBeDefined();
      expect(SymbolGuards.isScope(scope!)).toBe(true);

      const positionVar = symbols.find((s) => s.name === "Motor_position");
      expect(positionVar).toBeDefined();
      expect(SymbolGuards.isVariable(positionVar!)).toBe(true);

      const initFunc = symbols.find((s) => s.name === "Motor_init");
      expect(initFunc).toBeDefined();
      if (SymbolGuards.isFunction(initFunc!)) {
        expect(initFunc.visibility).toBe("public");
      }

      const updateFunc = symbols.find((s) => s.name === "Motor_update");
      expect(updateFunc).toBeDefined();
      if (SymbolGuards.isFunction(updateFunc!)) {
        expect(updateFunc.visibility).toBe("private");
      }
    });

    it("resolves scope with nested types", () => {
      const code = `
        scope Motor {
          enum State {
            Off,
            On
          }

          struct Config {
            u32 maxSpeed;
          }
        }
      `;
      const tree = parse(code);
      const symbols = CNextResolver.resolve(tree, "test.cnx");

      // Scope + enum + struct
      expect(symbols.length).toBe(3);

      const enumSym = symbols.find((s) => s.name === "Motor_State");
      expect(enumSym).toBeDefined();
      expect(SymbolGuards.isEnum(enumSym!)).toBe(true);

      const structSym = symbols.find((s) => s.name === "Motor_Config");
      expect(structSym).toBeDefined();
      expect(SymbolGuards.isStruct(structSym!)).toBe(true);
    });
  });

  describe("two-pass collection", () => {
    it("collects bitmaps before registers reference them", () => {
      const code = `
        bitmap8 StatusFlags {
          enabled,
          running,
          error,
          reserved[5]
        }

        register GPIO @ 0x40000000 {
          STATUS: StatusFlags rw @ 0x00,
        }
      `;
      const tree = parse(code);
      const symbols = CNextResolver.resolve(tree, "test.cnx");

      expect(symbols.length).toBe(2);

      const regSymbol = symbols.find((s) => s.name === "GPIO");
      expect(regSymbol).toBeDefined();
      if (SymbolGuards.isRegister(regSymbol!)) {
        expect(regSymbol.members.get("STATUS")?.bitmapType).toBe("StatusFlags");
      }
    });

    it("handles scoped bitmaps referenced by scoped registers", () => {
      const code = `
        scope Motor {
          bitmap8 CtrlFlags {
            enabled,
            running,
            error,
            reserved[5]
          }

          register CTRL @ 0x40001000 {
            FLAGS: CtrlFlags rw @ 0x00,
          }
        }
      `;
      const tree = parse(code);
      const symbols = CNextResolver.resolve(tree, "test.cnx");

      // Scope + bitmap + register
      expect(symbols.length).toBe(3);

      const regSymbol = symbols.find((s) => s.name === "Motor_CTRL");
      expect(regSymbol).toBeDefined();
      if (SymbolGuards.isRegister(regSymbol!)) {
        expect(regSymbol.members.get("FLAGS")?.bitmapType).toBe(
          "Motor_CtrlFlags",
        );
      }
    });
  });

  describe("complex programs", () => {
    it("resolves a complete embedded program", () => {
      const code = `
        struct Point {
          i32 x;
          i32 y;
        }

        enum Direction {
          North,
          East,
          South,
          West
        }

        bitmap8 Status {
          active,
          error,
          reserved[6]
        }

        register GPIO @ 0x40000000 {
          DATA: u32 rw @ 0x00,
          DIR:  u32 rw @ 0x04,
        }

        scope Motor {
          u32 position;
          Direction direction;

          public void init() {
          }

          public void move(i32 distance) {
          }
        }

        void main() {
          Motor.init();
        }
      `;
      const tree = parse(code);
      const symbols = CNextResolver.resolve(tree, "test.cnx");

      // Count symbols:
      // 1 struct (Point)
      // 1 enum (Direction)
      // 1 bitmap (Status)
      // 1 register (GPIO)
      // 1 scope (Motor)
      // 2 scope variables (Motor_position, Motor_direction)
      // 2 scope functions (Motor_init, Motor_move)
      // 1 top-level function (main)
      // Total: 10
      expect(symbols.length).toBe(10);

      // Verify each type is present
      const structSymbols = symbols.filter(
        (s) => s.kind === ESymbolKind.Struct,
      );
      expect(structSymbols.length).toBe(1);

      const enumSymbols = symbols.filter((s) => s.kind === ESymbolKind.Enum);
      expect(enumSymbols.length).toBe(1);

      const bitmapSymbols = symbols.filter(
        (s) => s.kind === ESymbolKind.Bitmap,
      );
      expect(bitmapSymbols.length).toBe(1);

      const registerSymbols = symbols.filter(
        (s) => s.kind === ESymbolKind.Register,
      );
      expect(registerSymbols.length).toBe(1);

      const scopeSymbols = symbols.filter(
        (s) => s.kind === ESymbolKind.Namespace,
      );
      expect(scopeSymbols.length).toBe(1);

      const functionSymbols = symbols.filter(
        (s) => s.kind === ESymbolKind.Function,
      );
      expect(functionSymbols.length).toBe(3);

      const variableSymbols = symbols.filter(
        (s) => s.kind === ESymbolKind.Variable,
      );
      expect(variableSymbols.length).toBe(2);
    });

    it("resolves multiple scopes", () => {
      const code = `
        scope LED {
          public void on() {
          }

          public void off() {
          }
        }

        scope Motor {
          public void start() {
          }

          public void stop() {
          }
        }
      `;
      const tree = parse(code);
      const symbols = CNextResolver.resolve(tree, "test.cnx");

      // 2 scopes + 2 functions each = 6
      expect(symbols.length).toBe(6);

      const ledScope = symbols.find((s) => s.name === "LED");
      const motorScope = symbols.find((s) => s.name === "Motor");
      expect(ledScope).toBeDefined();
      expect(motorScope).toBeDefined();

      expect(symbols.find((s) => s.name === "LED_on")).toBeDefined();
      expect(symbols.find((s) => s.name === "LED_off")).toBeDefined();
      expect(symbols.find((s) => s.name === "Motor_start")).toBeDefined();
      expect(symbols.find((s) => s.name === "Motor_stop")).toBeDefined();
    });
  });

  describe("empty program", () => {
    it("returns empty array for empty program", () => {
      const code = ``;
      const tree = parse(code);
      const symbols = CNextResolver.resolve(tree, "test.cnx");

      expect(symbols).toEqual([]);
    });
  });

  describe("const value collection (Issue #455)", () => {
    it("resolves array dimensions from top-level const", () => {
      const code = `
        const u8 SIZE <- 4;
        bool arr[SIZE];
      `;
      const tree = parse(code);
      const symbols = CNextResolver.resolve(tree, "test.cnx");

      expect(symbols.length).toBe(2);

      const arrSymbol = symbols.find((s) => s.name === "arr");
      expect(arrSymbol).toBeDefined();
      if (SymbolGuards.isVariable(arrSymbol!)) {
        expect(arrSymbol.isArray).toBe(true);
        expect(arrSymbol.arrayDimensions).toEqual([4]);
      }
    });

    it("resolves array dimensions from scoped const", () => {
      const code = `
        scope Device {
          const u8 BUF_SIZE <- 8;
          public u8 buffer[BUF_SIZE];
        }
      `;
      const tree = parse(code);
      const symbols = CNextResolver.resolve(tree, "test.cnx");

      const bufferSymbol = symbols.find((s) => s.name === "Device_buffer");
      expect(bufferSymbol).toBeDefined();
      if (SymbolGuards.isVariable(bufferSymbol!)) {
        expect(bufferSymbol.isArray).toBe(true);
        expect(bufferSymbol.arrayDimensions).toEqual([8]);
      }
    });

    it("resolves hex constant array dimensions", () => {
      const code = `
        const u8 HEX_SIZE <- 0x10;
        bool hex_arr[HEX_SIZE];
      `;
      const tree = parse(code);
      const symbols = CNextResolver.resolve(tree, "test.cnx");

      const arrSymbol = symbols.find((s) => s.name === "hex_arr");
      expect(arrSymbol).toBeDefined();
      if (SymbolGuards.isVariable(arrSymbol!)) {
        expect(arrSymbol.arrayDimensions).toEqual([16]);
      }
    });

    it("resolves binary constant array dimensions", () => {
      const code = `
        const u8 BIN_SIZE <- 0b1010;
        i16 bin_arr[BIN_SIZE];
      `;
      const tree = parse(code);
      const symbols = CNextResolver.resolve(tree, "test.cnx");

      const arrSymbol = symbols.find((s) => s.name === "bin_arr");
      expect(arrSymbol).toBeDefined();
      if (SymbolGuards.isVariable(arrSymbol!)) {
        expect(arrSymbol.arrayDimensions).toEqual([10]);
      }
    });

    it("ignores non-integer const values", () => {
      const code = `
        const u8 STR_VAL <- "hello";
        bool arr[4];
      `;
      const tree = parse(code);
      const symbols = CNextResolver.resolve(tree, "test.cnx");

      // Should still parse without error
      expect(symbols.length).toBe(2);
    });

    it("passes through unresolved identifiers for C macros", () => {
      const code = `
        bool arr[DEVICE_COUNT];
      `;
      const tree = parse(code);
      const symbols = CNextResolver.resolve(tree, "test.cnx");

      // Issue #455: Unresolved identifiers (like C macros) should pass through
      const arrSymbol = symbols.find((s) => s.name === "arr");
      expect(arrSymbol).toBeDefined();
      if (SymbolGuards.isVariable(arrSymbol!)) {
        expect(arrSymbol.isArray).toBe(true);
        expect(arrSymbol.arrayDimensions).toEqual(["DEVICE_COUNT"]);
      }
    });

    it("passes through expressions in array dimension", () => {
      const code = `
        const u8 SIZE <- 4;
        bool arr[SIZE * 2];
      `;
      const tree = parse(code);
      const symbols = CNextResolver.resolve(tree, "test.cnx");

      // Issue #455: Complex expressions should pass through as strings
      const arrSymbol = symbols.find((s) => s.name === "arr");
      expect(arrSymbol).toBeDefined();
      if (SymbolGuards.isVariable(arrSymbol!)) {
        expect(arrSymbol.isArray).toBe(true);
        expect(arrSymbol.arrayDimensions).toEqual(["SIZE*2"]);
      }
    });
  });
});
