import { describe, expect, it, beforeEach } from "vitest";
import parse from "./testHelpers";
import TestScopeUtils from "./testUtils";
import EnumCollector from "../collectors/EnumCollector";
import ESourceLanguage from "../../../../../utils/types/ESourceLanguage";

describe("EnumCollector", () => {
  beforeEach(() => {
    TestScopeUtils.resetGlobalScope();
  });

  describe("basic enum extraction", () => {
    it("collects a simple enum with auto-increment values", () => {
      const code = `
        enum Color {
          Red,
          Green,
          Blue
        }
      `;
      const tree = parse(code);
      const enumCtx = tree.declaration(0)!.enumDeclaration()!;
      const symbol = EnumCollector.collect(enumCtx, "test.cnx", "", "public");

      expect(symbol.kind).toBe("enum");
      expect(symbol.name).toBe("Color");
      expect(symbol.sourceFile).toBe("test.cnx");
      expect(symbol.sourceLanguage).toBe(ESourceLanguage.CNext);
      expect(symbol.visibility).toBe("public");
      expect(symbol.scopePath).toBe("");

      // Check members
      expect(symbol.members.size).toBe(3);
      expect(symbol.members.get("Red")?.value).toBe(0);
      expect(symbol.members.get("Green")?.value).toBe(1);
      expect(symbol.members.get("Blue")?.value).toBe(2);
    });

    it("collects an enum with explicit values", () => {
      const code = `
        enum Priority {
          Low <- 10,
          Medium <- 20,
          High <- 30
        }
      `;
      const tree = parse(code);
      const enumCtx = tree.declaration(0)!.enumDeclaration()!;
      const symbol = EnumCollector.collect(enumCtx, "test.cnx", "", "public");

      expect(symbol.members.get("Low")?.value).toBe(10);
      expect(symbol.members.get("Medium")?.value).toBe(20);
      expect(symbol.members.get("High")?.value).toBe(30);
    });

    it("supports mixed explicit and auto-increment values", () => {
      const code = `
        enum Status {
          Idle,
          Running <- 5,
          Paused,
          Stopped <- 10,
          Error
        }
      `;
      const tree = parse(code);
      const enumCtx = tree.declaration(0)!.enumDeclaration()!;
      const symbol = EnumCollector.collect(enumCtx, "test.cnx", "", "public");

      expect(symbol.members.get("Idle")?.value).toBe(0);
      expect(symbol.members.get("Running")?.value).toBe(5);
      expect(symbol.members.get("Paused")?.value).toBe(6); // Auto-increment from 5
      expect(symbol.members.get("Stopped")?.value).toBe(10);
      expect(symbol.members.get("Error")?.value).toBe(11); // Auto-increment from 10
    });
  });

  describe("hex and binary literals", () => {
    it("supports hexadecimal values", () => {
      const code = `
        enum Flags {
          A <- 0x01,
          B <- 0x02,
          C <- 0x10
        }
      `;
      const tree = parse(code);
      const enumCtx = tree.declaration(0)!.enumDeclaration()!;
      const symbol = EnumCollector.collect(enumCtx, "test.cnx", "", "public");

      expect(symbol.members.get("A")?.value).toBe(1);
      expect(symbol.members.get("B")?.value).toBe(2);
      expect(symbol.members.get("C")?.value).toBe(16);
    });

    it("supports binary values", () => {
      const code = `
        enum Bits {
          Bit0 <- 0b0001,
          Bit1 <- 0b0010,
          Bit2 <- 0b0100,
          Bit3 <- 0b1000
        }
      `;
      const tree = parse(code);
      const enumCtx = tree.declaration(0)!.enumDeclaration()!;
      const symbol = EnumCollector.collect(enumCtx, "test.cnx", "", "public");

      expect(symbol.members.get("Bit0")?.value).toBe(1);
      expect(symbol.members.get("Bit1")?.value).toBe(2);
      expect(symbol.members.get("Bit2")?.value).toBe(4);
      expect(symbol.members.get("Bit3")?.value).toBe(8);
    });
  });

  describe("scoped enums", () => {
    it("uses scope reference properly", () => {
      const code = `
        enum State {
          Off,
          On
        }
      `;
      const tree = parse(code);
      const enumCtx = tree.declaration(0)!.enumDeclaration()!;
      const symbol = EnumCollector.collect(
        enumCtx,
        "motor.cnx",
        "Motor",
        "public",
      );

      expect(symbol.name).toBe("State");
      expect(symbol.scopePath).toBe("Motor");
      expect(symbol.scopePath).toBe("Motor");
    });
  });

  describe("validation", () => {
    it("throws error for negative values", () => {
      const code = `
        enum Invalid {
          Bad <- -1
        }
      `;
      const tree = parse(code);
      const enumCtx = tree.declaration(0)!.enumDeclaration()!;

      expect(() =>
        EnumCollector.collect(enumCtx, "test.cnx", "", "public"),
      ).toThrow(
        "Error: Negative values not allowed in enum (found -1 in Invalid.Bad)",
      );
    });
  });

  describe("source line tracking", () => {
    it("captures the source line number", () => {
      const code = `

        enum OnLine3 {
          Value
        }
      `;
      const tree = parse(code);
      const enumCtx = tree.declaration(0)!.enumDeclaration()!;
      const symbol = EnumCollector.collect(enumCtx, "test.cnx", "", "public");

      expect(symbol.span.line).toBe(3);
    });
  });

  // #1300 review: every other test in this file passes "public", so the defect
  // class this parameter exists for -- a collector reporting a private
  // declaration as public -- was invisible at the unit level.
  describe("visibility (#1300)", () => {
    it("records a private declaration as private", () => {
      const tree = parse(`
        enum Hidden {
          A,
          B
        }
      `);
      const symbol = EnumCollector.collect(
        tree.declaration(0)!.enumDeclaration()!,
        "test.cnx",
        "",
        "private",
      );

      expect(symbol.visibility).toBe("private");
    });
  });

  describe("members carry their own position and identity (#1318)", () => {
    it("gives each member a DISTINCT line, not the enum's", () => {
      // The defect this card exists to remove. `parseWithSymbols` reported
      // `enumSym.span.line` for every member, so an IDE jumping to
      // `Color.Blue` landed on `enum Color`. Asserting DISTINCTNESS rather
      // than three fixed numbers is what makes this fail on a revert: a
      // collector that hands every member the enum's span produces three
      // equal lines, whatever the fixture's indentation happens to be.
      const code = `
        enum Color {
          Red,
          Green,
          Blue
        }
      `;
      const tree = parse(code);
      const symbol = EnumCollector.collect(
        tree.declaration(0)!.enumDeclaration()!,
        "test.cnx",
        "",
        "public",
      );

      const lines = [...symbol.members.values()].map((m) => m.span.line);
      expect(new Set(lines).size).toBe(3);
      expect(lines).toEqual([...lines].sort((a, b) => a - b));
      // and none of them is the enum's own line
      expect(lines).not.toContain(symbol.span.line);
    });

    it("points at the member's own column, not the start of the line", () => {
      const code = `
        enum Color {
          Red
        }
      `;
      const tree = parse(code);
      const symbol = EnumCollector.collect(
        tree.declaration(0)!.enumDeclaration()!,
        "test.cnx",
        "",
        "public",
      );

      const red = symbol.members.get("Red")!;
      expect(red.span.column).toBeGreaterThan(0);
      // The span is a RANGE: `Red` is three characters wide.
      expect(red.span.endColumn - red.span.column).toBe(3);
    });

    it("spells a member the way codegen already emits it", () => {
      // `EColor__RED` and `Motor__EMode__HIGH` are what the committed
      // .expected.h fixtures contain. Identity comes from ScopeUtils, so this
      // cannot drift from the encoder -- it can only drift from the FIXTURES,
      // which is the thing worth asserting.
      const tree = parse(`enum EColor { RED }`);
      const global = EnumCollector.collect(
        tree.declaration(0)!.enumDeclaration()!,
        "test.cnx",
        "",
        "public",
      );
      expect(global.members.get("RED")!.fullyQualifiedCName).toBe(
        "EColor__RED",
      );
      expect(global.members.get("RED")!.cnxScopedName).toBe("EColor.RED");

      const scoped = EnumCollector.collect(
        parse(`enum EMode { HIGH }`).declaration(0)!.enumDeclaration()!,
        "test.cnx",
        "Motor",
        "public",
      );
      expect(scoped.members.get("HIGH")!.fullyQualifiedCName).toBe(
        "Motor__EMode__HIGH",
      );
    });

    it("inherits the enum's visibility rather than hardcoding public", () => {
      // #1300: four kinds hardcoded an exported flag beside a collector that
      // recorded the real answer, and every private type reached the header.
      const tree = parse(`enum EHidden { A }`);
      const symbol = EnumCollector.collect(
        tree.declaration(0)!.enumDeclaration()!,
        "test.cnx",
        "",
        "private",
      );
      expect(symbol.members.get("A")!.visibility).toBe("private");
    });
  });
});
