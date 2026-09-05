import { describe, expect, it } from "vitest";
import parse from "./testHelpers";
import BitmapCollector from "../collectors/BitmapCollector";
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
      const symbol = BitmapCollector.collect(
        bitmapCtx,
        "test.cnx",
        "",
        "public",
      );

      expect(symbol.kind).toBe("bitmap");
      expect(symbol.name).toBe("Status");
      expect(symbol.backingType).toBe("uint8_t");
      expect(symbol.bitWidth).toBe(8);
      expect(symbol.sourceFile).toBe("test.cnx");
      expect(symbol.sourceLanguage).toBe(ESourceLanguage.CNext);
      expect(symbol.visibility).toBe("public");

      // Check fields
      expect(symbol.fields.size).toBe(5);
      expect(symbol.fields.get("enabled")).toMatchObject({
        offset: 0,
        width: 1,
      });
      expect(symbol.fields.get("running")).toMatchObject({
        offset: 1,
        width: 1,
      });
      expect(symbol.fields.get("error")).toMatchObject({ offset: 2, width: 1 });
      expect(symbol.fields.get("warning")).toMatchObject({
        offset: 3,
        width: 1,
      });
      expect(symbol.fields.get("reserved")).toMatchObject({
        offset: 4,
        width: 4,
      });
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
      const symbol = BitmapCollector.collect(
        bitmapCtx,
        "control.cnx",
        "",
        "public",
      );

      expect(symbol.name).toBe("Control");
      expect(symbol.backingType).toBe("uint16_t");
      expect(symbol.bitWidth).toBe(16);

      expect(symbol.fields.get("mode")).toMatchObject({ offset: 0, width: 4 });
      expect(symbol.fields.get("intensity")).toMatchObject({
        offset: 4,
        width: 8,
      });
      expect(symbol.fields.get("flags")).toMatchObject({
        offset: 12,
        width: 4,
      });
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
      const symbol = BitmapCollector.collect(
        bitmapCtx,
        "config.cnx",
        "",
        "public",
      );

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
      const symbol = BitmapCollector.collect(
        bitmapCtx,
        "rgb.cnx",
        "",
        "public",
      );

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
      const symbol = BitmapCollector.collect(
        bitmapCtx,
        "motor.cnx",
        "Motor",
        "public",
      );

      // With the new IScopeSymbol-based design, name is just "Flags" (not prefixed)
      // The prefixing happens in TSymbolAdapter for backwards compatibility
      expect(symbol.name).toBe("Flags");
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

      expect(() =>
        BitmapCollector.collect(bitmapCtx, "test.cnx", "", "public"),
      ).toThrow(
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

      expect(() =>
        BitmapCollector.collect(bitmapCtx, "test.cnx", "", "public"),
      ).toThrow(
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
      const symbol = BitmapCollector.collect(
        bitmapCtx,
        "test.cnx",
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
        bitmap8 Hidden {
          A,
          Rest[7]
        }
      `);
      const symbol = BitmapCollector.collect(
        tree.declaration(0)!.bitmapDeclaration()!,
        "test.cnx",
        "",
        "private",
      );

      expect(symbol.visibility).toBe("private");
    });
  });

  describe("fields carry their own position and identity (#1318)", () => {
    const collect = (code: string, scopePath = "", visibility = "public") =>
      BitmapCollector.collect(
        parse(code).declaration(0)!.bitmapDeclaration()!,
        "test.cnx",
        scopePath,
        visibility as "public" | "private",
      );

    it("gives each field a DISTINCT line, not the bitmap's", () => {
      // Distinctness, not fixed numbers: a collector that hands every field the
      // bitmap's span produces equal lines whatever the fixture's layout is,
      // so this fails on a revert rather than on a change of indentation.
      const symbol = collect(`
        bitmap8 Status {
          a,
          b,
          c,
          d,
          e,
          f,
          g,
          h
        }
      `);
      const lines = [...symbol.fields.values()].map((f) => f.span.line);
      expect(new Set(lines).size).toBe(8);
      expect(lines).not.toContain(symbol.span.line);
    });

    it("names the field, which the old record could not", () => {
      // IBitmapFieldInfo had offset and width and NO name -- it lived only as
      // the Map key, so a field passed to a helper arrived anonymous.
      const symbol = collect(`bitmap8 Status { a, b[7] }`);
      expect(symbol.fields.get("a")!.name).toBe("a");
      expect(symbol.fields.get("b")!.name).toBe("b");
    });

    it("keys a field by its owner, and inherits the owner's visibility", () => {
      const global = collect(`bitmap8 Status { a, b[7] }`);
      expect(global.fields.get("a")!.fullyQualifiedCName).toBe("Status__a");

      const scoped = collect(`bitmap8 Status { a, b[7] }`, "Motor", "private");
      expect(scoped.fields.get("a")!.fullyQualifiedCName).toBe(
        "Motor__Status__a",
      );
      expect(scoped.fields.get("a")!.visibility).toBe("private");
    });
  });
});
