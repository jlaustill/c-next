import { describe, expect, it } from "vitest";
import parse from "./testHelpers";
import BitmapCollector from "../collectors/BitmapCollector";
import ESymbolKind from "../../../../utils/types/ESymbolKind";
import ESourceLanguage from "../../../../utils/types/ESourceLanguage";

describe("BitmapCollector", () => {
  describe("basic bitmap extraction", () => {
    it("collects a simple bitmap8 with single-bit fields", () => {
      const code = `
        bitmap8 Status {
          enabled,
          running,
          error,
          warning,
          reserved[4]
        }
      `;
      const tree = parse(code);
      const bitmapCtx = tree.declaration(0)!.bitmapDeclaration()!;
      const symbol = BitmapCollector.collect(bitmapCtx, "test.cnx");

      expect(symbol.kind).toBe(ESymbolKind.Bitmap);
      expect(symbol.name).toBe("Status");
      expect(symbol.backingType).toBe("uint8_t");
      expect(symbol.bitWidth).toBe(8);
      expect(symbol.sourceFile).toBe("test.cnx");
      expect(symbol.sourceLanguage).toBe(ESourceLanguage.CNext);
      expect(symbol.isExported).toBe(true);

      // Check fields
      expect(symbol.fields.size).toBe(5);
      expect(symbol.fields.get("enabled")).toEqual({ offset: 0, width: 1 });
      expect(symbol.fields.get("running")).toEqual({ offset: 1, width: 1 });
      expect(symbol.fields.get("error")).toEqual({ offset: 2, width: 1 });
      expect(symbol.fields.get("warning")).toEqual({ offset: 3, width: 1 });
      expect(symbol.fields.get("reserved")).toEqual({ offset: 4, width: 4 });
    });

    it("collects a bitmap16 with mixed width fields", () => {
      const code = `
        bitmap16 Control {
          mode[4],
          intensity[8],
          flags[4]
        }
      `;
      const tree = parse(code);
      const bitmapCtx = tree.declaration(0)!.bitmapDeclaration()!;
      const symbol = BitmapCollector.collect(bitmapCtx, "control.cnx");

      expect(symbol.name).toBe("Control");
      expect(symbol.backingType).toBe("uint16_t");
      expect(symbol.bitWidth).toBe(16);

      expect(symbol.fields.get("mode")).toEqual({ offset: 0, width: 4 });
      expect(symbol.fields.get("intensity")).toEqual({ offset: 4, width: 8 });
      expect(symbol.fields.get("flags")).toEqual({ offset: 12, width: 4 });
    });

    it("collects a bitmap32", () => {
      const code = `
        bitmap32 Config {
          version[8],
          options[16],
          checksum[8]
        }
      `;
      const tree = parse(code);
      const bitmapCtx = tree.declaration(0)!.bitmapDeclaration()!;
      const symbol = BitmapCollector.collect(bitmapCtx, "config.cnx");

      expect(symbol.name).toBe("Config");
      expect(symbol.backingType).toBe("uint32_t");
      expect(symbol.bitWidth).toBe(32);
    });

    it("collects a bitmap24 (uses 32-bit backing)", () => {
      const code = `
        bitmap24 RGB {
          red[8],
          green[8],
          blue[8]
        }
      `;
      const tree = parse(code);
      const bitmapCtx = tree.declaration(0)!.bitmapDeclaration()!;
      const symbol = BitmapCollector.collect(bitmapCtx, "rgb.cnx");

      expect(symbol.name).toBe("RGB");
      expect(symbol.backingType).toBe("uint32_t"); // 24-bit uses 32-bit backing
      expect(symbol.bitWidth).toBe(24);
    });
  });

  describe("scoped bitmaps", () => {
    it("prefixes name with scope when scopeName is provided", () => {
      const code = `
        bitmap8 Flags {
          active,
          ready,
          error,
          warning,
          reserved[4]
        }
      `;
      const tree = parse(code);
      const bitmapCtx = tree.declaration(0)!.bitmapDeclaration()!;
      const symbol = BitmapCollector.collect(bitmapCtx, "motor.cnx", "Motor");

      expect(symbol.name).toBe("Motor_Flags");
    });
  });

  describe("validation", () => {
    it("throws error when total bits exceed bitmap size", () => {
      const code = `
        bitmap8 TooMany {
          a[5],
          b[5]
        }
      `;
      const tree = parse(code);
      const bitmapCtx = tree.declaration(0)!.bitmapDeclaration()!;

      expect(() => BitmapCollector.collect(bitmapCtx, "test.cnx")).toThrow(
        "Error: Bitmap 'TooMany' has 10 bits but bitmap8 requires exactly 8 bits",
      );
    });

    it("throws error when total bits are less than bitmap size", () => {
      const code = `
        bitmap8 TooFew {
          a,
          b[3]
        }
      `;
      const tree = parse(code);
      const bitmapCtx = tree.declaration(0)!.bitmapDeclaration()!;

      expect(() => BitmapCollector.collect(bitmapCtx, "test.cnx")).toThrow(
        "Error: Bitmap 'TooFew' has 4 bits but bitmap8 requires exactly 8 bits",
      );
    });
  });

  describe("source line tracking", () => {
    it("captures the source line number", () => {
      const code = `

        bitmap8 OnLine3 {
          a[8]
        }
      `;
      const tree = parse(code);
      const bitmapCtx = tree.declaration(0)!.bitmapDeclaration()!;
      const symbol = BitmapCollector.collect(bitmapCtx, "test.cnx");

      expect(symbol.sourceLine).toBe(3);
    });
  });
});
