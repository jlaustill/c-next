import { beforeEach, describe, expect, it } from "vitest";
import parse from "./testHelpers";
import CNextResolver from "../index";
import SymbolGuards from "../../../../types/symbols/SymbolGuards";
import SymbolRegistry from "../../../../state/SymbolRegistry";
import TypeResolver from "../../../../../utils/TypeResolver";

describe("CNextResolver Integration", () => {
  // CLAUDE.md, "Test isolation": CNextResolver writes to the SymbolRegistry, so
  // without this every test in this file inherits the scopes the previous one
  // registered.
  beforeEach(() => {
    SymbolRegistry.reset();
  });

  describe("single declaration types", () => {
    it("resolves top-level struct", () => {
      const code = `
        struct Point {
          i32 x;
          i32 y;
        }
      `;
      const tree = parse(code);
      const symbols = CNextResolver.resolve(tree, "test.cnx").symbols;

      expect(symbols).toHaveLength(1);
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
      const symbols = CNextResolver.resolve(tree, "test.cnx").symbols;

      expect(symbols).toHaveLength(1);
      expect(SymbolGuards.isEnum(symbols[0])).toBe(true);
    });

    it("resolves top-level function", () => {
      const code = `
        void main() {
        }
      `;
      const tree = parse(code);
      const symbols = CNextResolver.resolve(tree, "test.cnx").symbols;

      expect(symbols).toHaveLength(1);
      expect(SymbolGuards.isFunction(symbols[0])).toBe(true);
      expect(symbols[0].name).toBe("main");
    });

    it("resolves top-level variable", () => {
      const code = `
        u32 counter <- 0;
      `;
      const tree = parse(code);
      const symbols = CNextResolver.resolve(tree, "test.cnx").symbols;

      expect(symbols).toHaveLength(1);
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
      const symbols = CNextResolver.resolve(tree, "test.cnx").symbols;

      expect(symbols).toHaveLength(1);
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
      const symbols = CNextResolver.resolve(tree, "test.cnx").symbols;

      expect(symbols).toHaveLength(1);
      expect(SymbolGuards.isRegister(symbols[0])).toBe(true);
      expect(symbols[0].name).toBe("GPIO");
    });
  });

  describe("scope handling", () => {
    it("resolves scope with members", () => {
      // ADR-016: Functions are public by default, variables are private by default
      const code = `
        scope Motor {
          u32 position;

          void init() {
          }

          private void update() {
          }
        }
      `;
      const tree = parse(code);
      const symbols = CNextResolver.resolve(tree, "test.cnx").symbols;

      // Scope + 3 members
      expect(symbols).toHaveLength(4);

      const scope = symbols.find((s) => s.name === "Motor");
      expect(scope).toBeDefined();
      expect(SymbolGuards.isScope(scope!)).toBe(true);

      // Members now have bare names with scope references
      const positionVar = symbols.find((s) => s.name === "position");
      expect(positionVar).toBeDefined();
      expect(SymbolGuards.isVariable(positionVar!)).toBe(true);
      expect(positionVar!.scopePath).toBe("Motor");

      // init() is public by default (no modifier needed)
      const initFunc = symbols.find((s) => s.name === "init");
      expect(initFunc).toBeDefined();
      if (SymbolGuards.isFunction(initFunc!)) {
        expect(initFunc.visibility).toBe("public");
        expect(initFunc.scopePath).toBe("Motor");
      }

      // update() has explicit 'private' keyword
      const updateFunc = symbols.find((s) => s.name === "update");
      expect(updateFunc).toBeDefined();
      if (SymbolGuards.isFunction(updateFunc!)) {
        expect(updateFunc.visibility).toBe("private");
        expect(updateFunc.scopePath).toBe("Motor");
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
      const symbols = CNextResolver.resolve(tree, "test.cnx").symbols;

      // Scope + enum + struct
      expect(symbols).toHaveLength(3);

      // Nested types have bare names with scope references
      const enumSym = symbols.find((s) => s.name === "State");
      expect(enumSym).toBeDefined();
      expect(SymbolGuards.isEnum(enumSym!)).toBe(true);
      expect(enumSym!.scopePath).toBe("Motor");

      const structSym = symbols.find((s) => s.name === "Config");
      expect(structSym).toBeDefined();
      expect(SymbolGuards.isStruct(structSym!)).toBe(true);
      expect(structSym!.scopePath).toBe("Motor");
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
      const symbols = CNextResolver.resolve(tree, "test.cnx").symbols;

      expect(symbols).toHaveLength(2);

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
      const symbols = CNextResolver.resolve(tree, "test.cnx").symbols;

      // Scope + bitmap + register
      expect(symbols).toHaveLength(3);

      // Both bitmap and register have bare names with scope references
      const regSymbol = symbols.find((s) => s.name === "CTRL");
      expect(regSymbol).toBeDefined();
      expect(regSymbol!.scopePath).toBe("Motor");
      if (SymbolGuards.isRegister(regSymbol!)) {
        expect(regSymbol.members.get("FLAGS")?.bitmapType).toBe(
          "Motor__CtrlFlags",
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
      const symbols = CNextResolver.resolve(tree, "test.cnx").symbols;

      // Count symbols:
      // 1 struct (Point)
      // 1 enum (Direction)
      // 1 bitmap (Status)
      // 1 register (GPIO)
      // 1 scope (Motor)
      // 2 scope variables (position, direction)
      // 2 scope functions (init, move)
      // 1 top-level function (main)
      // Total: 10
      expect(symbols).toHaveLength(10);

      // Verify each type is present
      const structSymbols = symbols.filter((s) => s.kind === "struct");
      expect(structSymbols).toHaveLength(1);

      const enumSymbols = symbols.filter((s) => s.kind === "enum");
      expect(enumSymbols).toHaveLength(1);

      const bitmapSymbols = symbols.filter((s) => s.kind === "bitmap");
      expect(bitmapSymbols).toHaveLength(1);

      const registerSymbols = symbols.filter((s) => s.kind === "register");
      expect(registerSymbols).toHaveLength(1);

      const scopeSymbols = symbols.filter((s) => s.kind === "scope");
      expect(scopeSymbols).toHaveLength(1);

      const functionSymbols = symbols.filter((s) => s.kind === "function");
      expect(functionSymbols).toHaveLength(3);

      const variableSymbols = symbols.filter((s) => s.kind === "variable");
      expect(variableSymbols).toHaveLength(2);
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
      const symbols = CNextResolver.resolve(tree, "test.cnx").symbols;

      // 2 scopes + 2 functions each = 6
      expect(symbols).toHaveLength(6);

      const ledScope = symbols.find((s) => s.name === "LED");
      const motorScope = symbols.find((s) => s.name === "Motor");
      expect(ledScope).toBeDefined();
      expect(motorScope).toBeDefined();

      // Functions have bare names with scope references
      const onFunc = symbols.find((s) => s.name === "on");
      expect(onFunc).toBeDefined();
      expect(onFunc!.scopePath).toBe("LED");

      const offFunc = symbols.find((s) => s.name === "off");
      expect(offFunc).toBeDefined();
      expect(offFunc!.scopePath).toBe("LED");

      const startFunc = symbols.find((s) => s.name === "start");
      expect(startFunc).toBeDefined();
      expect(startFunc!.scopePath).toBe("Motor");

      const stopFunc = symbols.find((s) => s.name === "stop");
      expect(stopFunc).toBeDefined();
      expect(stopFunc!.scopePath).toBe("Motor");
    });
  });

  describe("empty program", () => {
    it("returns empty array for empty program", () => {
      const code = ``;
      const tree = parse(code);
      const symbols = CNextResolver.resolve(tree, "test.cnx").symbols;

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
      const symbols = CNextResolver.resolve(tree, "test.cnx").symbols;

      expect(symbols).toHaveLength(2);

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
      const symbols = CNextResolver.resolve(tree, "test.cnx").symbols;

      // Find buffer by bare name with scope reference
      const bufferSymbol = symbols.find(
        (s) => s.name === "buffer" && s.scopePath === "Device",
      );
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
      const symbols = CNextResolver.resolve(tree, "test.cnx").symbols;

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
      const symbols = CNextResolver.resolve(tree, "test.cnx").symbols;

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
      const symbols = CNextResolver.resolve(tree, "test.cnx").symbols;

      // Should still parse without error
      expect(symbols).toHaveLength(2);
    });

    it("passes through unresolved identifiers for C macros", () => {
      const code = `
        bool arr[DEVICE_COUNT];
      `;
      const tree = parse(code);
      const symbols = CNextResolver.resolve(tree, "test.cnx").symbols;

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
      const symbols = CNextResolver.resolve(tree, "test.cnx").symbols;

      // Issue #455: Complex expressions should pass through as strings
      const arrSymbol = symbols.find((s) => s.name === "arr");
      expect(arrSymbol).toBeDefined();
      if (SymbolGuards.isVariable(arrSymbol!)) {
        expect(arrSymbol.isArray).toBe(true);
        expect(arrSymbol.arrayDimensions).toEqual(["SIZE*2"]);
      }
    });
  });
  describe("IFileSymbols: the per-file artifact (#1472)", () => {
    it("declaredScopeTypes holds what THIS file declares", () => {
      const code = `
        scope Local {
          public struct S { u8 a; }
          public enum E { x, y }
        }
      `;
      const declared = CNextResolver.resolve(parse(code), "test.cnx");

      expect(declared.sourceFile).toBe("test.cnx");
      expect([...declared.declaredScopeTypes].sort()).toEqual([
        "Local__E",
        "Local__S",
      ]);
    });

    it("does NOT let the cross-file seed leak onto the per-file artifact", () => {
      // The negative control. Declare used to collect local scope types INTO the
      // seeded set, so "declared here" and "visible here" were one object and
      // neither could be read back. Collapsing them again passes every other
      // test in this file and fails only this one -- which is the whole reason
      // it is here, because that collapse is what makes the artifact a lie.
      const code = `scope Local { public struct S { u8 a; } }`;
      const seed = new Set(["Elsewhere__T"]);

      const declared = CNextResolver.resolve(parse(code), "test.cnx", seed);

      expect(declared.declaredScopeTypes.has("Local__S")).toBe(true);
      expect(declared.declaredScopeTypes.has("Elsewhere__T")).toBe(false);
    });

    it("still resolves a bare type against the seed it was given", () => {
      // The positive half: excluding the seed from the ARTIFACT must not
      // exclude it from RESOLUTION. Without this pair, a change that dropped
      // the seed entirely would still satisfy the negative control above.
      const code = `
        scope Spanned {
          public Point origin() { ... }
        }
      `.replace("...", "return this.stored;");
      const seed = new Set(["Spanned__Point"]);

      const declared = CNextResolver.resolve(parse(code), "test.cnx", seed);
      const origin = declared.symbols.find((sym) => sym.name === "origin");

      expect(origin && SymbolGuards.isFunction(origin)).toBe(true);
      if (origin && SymbolGuards.isFunction(origin)) {
        expect(TypeResolver.getTypeName(origin.returnType)).toBe(
          "Spanned__Point",
        );
      }
    });
  });

  describe("ADR-057 scope type qualification (#1130)", () => {
    const typeOf = (
      declared: ReturnType<typeof CNextResolver.resolve>,
      name: string,
    ) => declared.symbols.find((sym) => sym.name === name);

    it("qualifies a bare scope-local type at a parameter and return position", () => {
      const code = `
        scope A {
          public enum B { c, d }
          public B pick(B value) { return value; }
        }
      `;
      const symbols = CNextResolver.resolve(parse(code), "test.cnx");

      const pick = typeOf(symbols, "pick");
      expect(pick && SymbolGuards.isFunction(pick)).toBe(true);
      if (pick && SymbolGuards.isFunction(pick)) {
        expect(TypeResolver.getTypeName(pick.returnType)).toBe("A__B");
        expect(TypeResolver.getTypeName(pick.parameters[0].type)).toBe("A__B");
      }
    });

    it("qualifies the same way when the type is declared BELOW its use", () => {
      // The pre-pass exists so this answer cannot depend on declaration order.
      const code = `
        scope A {
          public B pick(B value) { return value; }
          public enum B { c, d }
        }
      `;
      const symbols = CNextResolver.resolve(parse(code), "test.cnx");

      const pick = typeOf(symbols, "pick");
      if (pick && SymbolGuards.isFunction(pick)) {
        expect(TypeResolver.getTypeName(pick.returnType)).toBe("A__B");
        expect(TypeResolver.getTypeName(pick.parameters[0].type)).toBe("A__B");
      }
    });

    it("qualifies a bare scope-local type on a struct field", () => {
      const code = `
        scope A {
          public enum B { c, d }
          public struct S { u8 x; B kind; }
        }
      `;
      const symbols = CNextResolver.resolve(parse(code), "test.cnx");

      const structSymbol = typeOf(symbols, "S");
      expect(structSymbol && SymbolGuards.isStruct(structSymbol)).toBe(true);
      if (structSymbol && SymbolGuards.isStruct(structSymbol)) {
        const kind = structSymbol.fields.get("kind");
        expect(kind && TypeResolver.getTypeName(kind.type)).toBe("A__B");
      }
    });

    it("leaves an explicit global.Type field UNqualified even when the scope shadows it", () => {
      // Regression guard: a post-pass over resolved names cannot tell
      // `global.Mode` from a bare `Mode`, and rewrote both.
      const code = `
        enum Mode { idle, busy }
        scope A {
          public enum Mode { off, on }
          public struct W { global.Mode mode; u8 v; }
        }
      `;
      const symbols = CNextResolver.resolve(parse(code), "test.cnx");

      const structSymbol = typeOf(symbols, "W");
      if (structSymbol && SymbolGuards.isStruct(structSymbol)) {
        const mode = structSymbol.fields.get("mode");
        expect(mode && TypeResolver.getTypeName(mode.type)).toBe("Mode");
      }
    });

    it("does not let a non-type scope member capture a same-named global type", () => {
      const code = `
        struct Config { u8 x; }
        scope A {
          private u8 Config <- 3;
          public void use(Config cfg) { }
        }
      `;
      const symbols = CNextResolver.resolve(parse(code), "test.cnx");

      const use = typeOf(symbols, "use");
      if (use && SymbolGuards.isFunction(use)) {
        expect(TypeResolver.getTypeName(use.parameters[0].type)).toBe("Config");
      }
    });

    it("leaves a bare global type name alone at top level", () => {
      const code = `
        struct Point { i32 x; }
        void move(Point p) { }
      `;
      const symbols = CNextResolver.resolve(parse(code), "test.cnx");

      const move = typeOf(symbols, "move");
      if (move && SymbolGuards.isFunction(move)) {
        expect(TypeResolver.getTypeName(move.parameters[0].type)).toBe("Point");
      }
    });
  });

  // #1358 DoD: the declare step must be idempotent. This is the shape the real
  // pipeline runs -- Transpiler stages 3 and 5 both resolve every file, and
  // SymbolRegistry.reset() runs once per run, not between them (#1301).
  describe("idempotence of the declare step", () => {
    // Snapshots EVERY mutable collection on IScopeSymbol, not just the one this
    // PR guarded. "Declare runs twice over the same tree" is compensated
    // separately in three places -- `declarationSites` by Set semantics,
    // `members` by the includes-check `ScopeCollector` added for #1334, and
    // `functions` by `SymbolRegistry.isAlreadyRegistered` -- each with only a
    // local test. Nothing asserted the STEP was idempotent, so a collection
    // added without a guard would duplicate silently. `variables` is exactly
    // that shape today: declared on IScopeSymbol and never written.
    const snapshotMotor = () => {
      const scope = SymbolRegistry.getScope("Motor")!;
      return {
        functions: scope.functions.map((f) => f.fullyQualifiedCName),
        members: [...scope.members],
        variables: [...scope.variables],
        declarationSites: [...scope.declarationSites].sort(),
        memberVisibility: [...scope.memberVisibility.entries()].sort(),
      };
    };

    it("resolving the same tree twice leaves registry state unchanged", () => {
      const code = `scope Motor {
        void start() { }
        void stop() { }
      }`;

      // Re-parsed each time, as stage 5 does -- distinct trees, distinct symbol
      // objects. An identity-based guard would not catch the duplication.
      CNextResolver.resolve(parse(code), "motor.cnx");
      const afterFirst = snapshotMotor();

      // Absolute assertion first: before/after equality alone cannot tell
      // "idempotent" from "consistently wrong on both passes".
      expect(afterFirst.functions).toEqual(["Motor__start", "Motor__stop"]);
      expect(afterFirst.members).toEqual(["start", "stop"]);

      CNextResolver.resolve(parse(code), "motor.cnx");

      expect(snapshotMotor()).toEqual(afterFirst);
    });

    // NEGATIVE CONTROL. A scope spanned across two files must still merge
    // (#1333) -- suppressing registration for an already-seen scope would pass
    // the assertion above and break this.
    it("still merges a scope genuinely spanned across two different files", () => {
      CNextResolver.resolve(parse(`scope Motor { void start() { } }`), "a.cnx");
      CNextResolver.resolve(parse(`scope Motor { void stop() { } }`), "b.cnx");

      expect(
        SymbolRegistry.getScope("Motor")?.functions.map((f) => f.name),
      ).toEqual(["start", "stop"]);
    });
  });
});
