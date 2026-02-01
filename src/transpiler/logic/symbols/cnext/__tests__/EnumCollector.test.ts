import { describe, expect, it } from "vitest";
import parse from "./testHelpers";
import EnumCollector from "../collectors/EnumCollector";
import ESymbolKind from "../../../../../utils/types/ESymbolKind";
import ESourceLanguage from "../../../../../utils/types/ESourceLanguage";

describe("EnumCollector", () => {
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
      const symbol = EnumCollector.collect(enumCtx, "test.cnx");

      expect(symbol.kind).toBe(ESymbolKind.Enum);
      expect(symbol.name).toBe("Color");
      expect(symbol.sourceFile).toBe("test.cnx");
      expect(symbol.sourceLanguage).toBe(ESourceLanguage.CNext);
      expect(symbol.isExported).toBe(true);

      // Check members
      expect(symbol.members.size).toBe(3);
      expect(symbol.members.get("Red")).toBe(0);
      expect(symbol.members.get("Green")).toBe(1);
      expect(symbol.members.get("Blue")).toBe(2);
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
      const symbol = EnumCollector.collect(enumCtx, "test.cnx");

      expect(symbol.members.get("Low")).toBe(10);
      expect(symbol.members.get("Medium")).toBe(20);
      expect(symbol.members.get("High")).toBe(30);
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
      const symbol = EnumCollector.collect(enumCtx, "test.cnx");

      expect(symbol.members.get("Idle")).toBe(0);
      expect(symbol.members.get("Running")).toBe(5);
      expect(symbol.members.get("Paused")).toBe(6); // Auto-increment from 5
      expect(symbol.members.get("Stopped")).toBe(10);
      expect(symbol.members.get("Error")).toBe(11); // Auto-increment from 10
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
      const symbol = EnumCollector.collect(enumCtx, "test.cnx");

      expect(symbol.members.get("A")).toBe(1);
      expect(symbol.members.get("B")).toBe(2);
      expect(symbol.members.get("C")).toBe(16);
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
      const symbol = EnumCollector.collect(enumCtx, "test.cnx");

      expect(symbol.members.get("Bit0")).toBe(1);
      expect(symbol.members.get("Bit1")).toBe(2);
      expect(symbol.members.get("Bit2")).toBe(4);
      expect(symbol.members.get("Bit3")).toBe(8);
    });
  });

  describe("scoped enums", () => {
    it("prefixes name with scope when scopeName is provided", () => {
      const code = `
        enum State {
          Off,
          On
        }
      `;
      const tree = parse(code);
      const enumCtx = tree.declaration(0)!.enumDeclaration()!;
      const symbol = EnumCollector.collect(enumCtx, "motor.cnx", "Motor");

      expect(symbol.name).toBe("Motor_State");
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

      expect(() => EnumCollector.collect(enumCtx, "test.cnx")).toThrow(
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
      const symbol = EnumCollector.collect(enumCtx, "test.cnx");

      expect(symbol.sourceLine).toBe(3);
    });
  });
});
