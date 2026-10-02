/**
 * #1668 (R4): a C or C++ spelling's category and width, under every data
 * model the catalog has, and under none. Widths come from the real catalog
 * rows, not hand-typed numbers.
 */
import { describe, it, expect } from "vitest";
import SymbolTable from "../../PARSE/3-Declare/SymbolTable";
import ForeignTypeFacts from "../ForeignTypeFacts";
import ESourceLanguage from "../types/ESourceLanguage";
import TargetCatalogFile from "../../PARSE/1-Discover/TargetCatalogFile";
import NodeFileSystem from "../../PARSE/1-Discover/NodeFileSystem";

const lookup = new SymbolTable();
const models = {
  host: TargetCatalogFile.targets(NodeFileSystem.instance).get("host")!,
  cortex: TargetCatalogFile.targets(NodeFileSystem.instance).get("cortex-m7")!,
  avr: TargetCatalogFile.targets(NodeFileSystem.instance).get("atmega328p")!,
  none: null,
};

/** [spelling, category, width per model: host, cortex, avr, none] */
const ROWS: Array<
  [string, string, number | null, number | null, number | null, number | null]
> = [
  ["int8_t", "signed", 8, 8, 8, 8],
  ["uint16_t", "unsigned", 16, 16, 16, 16],
  ["int_least32_t", "signed", 32, 32, 32, 32],
  ["uint64_t", "unsigned", 64, 64, 64, 64],
  ["int_fast16_t", "signed", null, null, null, null],
  ["uintmax_t", "unsigned", null, null, null, null],
  ["size_t", "unsigned", 64, 32, 16, null],
  ["ptrdiff_t", "signed", 64, 32, 16, null],
  ["uintptr_t", "unsigned", 64, 32, 16, null],
  ["signed char", "signed", 8, 8, 8, 8],
  ["unsigned char", "unsigned", 8, 8, 8, 8],
  ["char", "character", 8, 8, 8, 8],
  ["short", "signed", 16, 16, 16, null],
  ["unsigned short int", "unsigned", 16, 16, 16, null],
  ["int", "signed", 32, 32, 16, null],
  ["signed", "signed", 32, 32, 16, null],
  ["unsigned", "unsigned", 32, 32, 16, null],
  ["long", "signed", 64, 32, 32, null],
  ["unsigned long", "unsigned", 64, 32, 32, null],
  ["long long", "signed", 64, 64, 64, null],
  ["unsigned long long int", "unsigned", 64, 64, 64, null],
  ["_Bool", "boolean", null, null, null, null],
  ["bool", "boolean", null, null, null, null],
  ["const volatile uint8_t", "unsigned", 8, 8, 8, 8],
  ["std::int32_t", "signed", 32, 32, 32, 32],
];

describe("ForeignTypeFacts.operandType (R4)", () => {
  for (const [spelling, category, ...widths] of ROWS) {
    it.each(Object.keys(models).map((model, i) => [model, widths[i]]))(
      `types ${spelling} under %s`,
      (model, width) => {
        const t = ForeignTypeFacts.operandType(
          spelling,
          lookup,
          models[model as keyof typeof models],
        );
        expect(t?.category).toBe(category);
        expect(t?.bitWidth).toBe(width);
      },
    );
  }

  it.each([
    ["float", "host", "f32"],
    ["double", "host", "f64"],
    ["double", "avr", "f32"],
    ["long double", "cortex", "f64"],
    ["long double", "host", null],
  ])("types %s under %s as %s", (spelling, model, typeName) => {
    const t = ForeignTypeFacts.operandType(
      spelling,
      lookup,
      models[model as keyof typeof models],
    );
    expect(t).toMatchObject({ category: "floating", typeName });
  });

  it.each(["uint8_t *", "wchar_t", "char16_t", "__int128", "unknown_t"])(
    "leaves %s untyped",
    (spelling) => {
      expect(
        ForeignTypeFacts.operandType(spelling, lookup, models.host),
      ).toBeNull();
    },
  );
});
// #1760 review: a volatile header value's read is a side effect, whether the
// qualifier is in the value's own spelling or a typedef it names
describe("ForeignTypeFacts.operandType: volatile", () => {
  const table = new SymbolTable();
  table.addCSymbol({
    sourceFile: "registers.h",
    span: { line: 1, column: 0, endLine: 1, endColumn: 1 },
    sourceLanguage: ESourceLanguage.C,
    visibility: "public",
    kind: "type",
    name: "volatile_float_t",
    type: "volatile float",
  });

  it.each([
    ["a volatile spelling", "volatile float", true],
    ["a typedef of a volatile type", "volatile_float_t", true],
    ["a plain spelling", "float", false],
  ])("gives %s a side effect: %s", (_why, spelling, expected) => {
    expect(
      ForeignTypeFacts.operandType(spelling, table, null)?.hasSideEffect,
    ).toBe(expected);
  });
});
