/**
 * ADR-049: the target catalog and the one validator that judges it.
 *
 * The negatives edit the SHIPPED catalog's text, one defect at a time, so each
 * case differs from a catalog known to validate by exactly the defect named.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

import TargetDescriptions from "../TargetDescriptions";
import TargetCatalogParser from "../../2-Parse/TargetCatalogParser";
import TargetCatalogFile from "../../../transpiler/data/TargetCatalogFile";

const SHIPPED = readFileSync(TargetCatalogFile.locate(), "utf8");

/** The shipped catalog with its first `from` replaced by `to` */
function catalogWith(from: string, to: string): string {
  expect(SHIPPED).toContain(from);
  return SHIPPED.replace(from, to);
}

function validate(text: string) {
  return TargetDescriptions.catalog(TargetCatalogParser.parse(text), "test");
}

describe("the shipped target catalog", () => {
  it("validates", () => {
    const targets = TargetCatalogFile.targets();
    expect([...targets.keys()]).toEqual(
      expect.arrayContaining(["cortex-m7", "teensy41", "cortex-m0+", "host"]),
    );
  });
});

describe("TargetDescriptions.catalog", () => {
  it.each([
    ["an expression", "word_size: 32,", "word_size: 16 + 16,"],
    ["an identifier", "word_size: 32,", "word_size: TARGET_SCHEMA_VERSION,"],
    ["a negation", "ldrex_strex: true,", "ldrex_strex: !false,"],
    ["a negative number", "char_bits: 8,", "char_bits: -1,"],
    ["a parenthesized literal", "basepri: true,", "basepri: (true),"],
    ["a suffixed literal", "int_bits: 32,", "int_bits: 32u8,"],
    ["a hex literal", "int_bits: 32,", "int_bits: 0x20,"],
  ])("refuses %s as a value", (_why, from, to) => {
    expect(() => validate(catalogWith(from, to))).toThrow(/is not a literal/);
  });

  it.each([
    [
      "a missing field",
      "    basepri: true,\n",
      "",
      /CORTEX_M7: missing: basepri/,
    ],
    [
      "an unknown field",
      "    basepri: true,\n",
      "    basepri: true,\n    fpu: true,\n",
      /unknown field 'fpu'/,
    ],
    [
      "a value of the wrong kind",
      "ldrex_strex: true,",
      "ldrex_strex: 1,",
      /ldrex_strex must be a boolean/,
    ],
    [
      "a value the schema does not allow",
      "word_size: 32,",
      "word_size: 12,",
      /word_size must be one of 8, 16, 32, 64/,
    ],
    [
      "a value under the schema's minimum",
      "external_identifier_chars: 31,",
      "external_identifier_chars: 5,",
      /external_identifier_chars must be at least 6/,
    ],
    [
      "a broken C relation",
      "long_double_bits: 64,",
      "long_double_bits: 32,",
      /double_bits is wider than long_double_bits/,
    ],
    [
      "a name that is not one pragma word",
      'name: "cortex-m7",',
      'name: "cortex m7",',
      /'cortex m7' is not one pragma word/,
    ],
    [
      "a duplicate name",
      'name: "cortex-m4",',
      'name: "cortex-m7",',
      /'cortex-m7' is defined twice/,
    ],
    [
      "an alias of a missing target",
      'target: "cortex-m7" };',
      'target: "cortex-m9" };',
      /alias 'teensy41' names 'cortex-m9'/,
    ],
    [
      "an alias of an alias",
      '{ name: "teensy40", target: "cortex-m7" }',
      '{ name: "teensy40", target: "teensy41" }',
      /alias 'teensy40' names 'teensy41', which is not a TargetDescription/,
    ],
    [
      "an unknown schema version",
      "TARGET_SCHEMA_VERSION <- 1;",
      "TARGET_SCHEMA_VERSION <- 2;",
      /TARGET_SCHEMA_VERSION must be 1/,
    ],
    [
      "a struct member the schema lacks",
      "    bool big_endian;\n",
      "    bool big_endian;\n    bool fpu;\n",
      /struct TargetDescription has 'fpu'/,
    ],
    [
      "a struct member of the wrong kind",
      "    bool big_endian;\n",
      "    u8 big_endian;\n",
      /'big_endian' must hold a boolean, not u8/,
    ],
    [
      "a struct missing a schema field",
      "    bool big_endian;\n",
      "",
      /struct TargetDescription lacks 'big_endian'/,
    ],
    [
      "a constant of another type",
      "const u8 TARGET_SCHEMA_VERSION <- 1;",
      "const u8 TARGET_SCHEMA_VERSION <- 1;\nconst u8 EXTRA <- 2;",
      /'EXTRA' is neither a TargetDescription nor a TargetAlias/,
    ],
    [
      "a function",
      "const u8 TARGET_SCHEMA_VERSION <- 1;",
      "const u8 TARGET_SCHEMA_VERSION <- 1;\nvoid f() { }",
      /only structs and constants are allowed/,
    ],
  ])("refuses %s", (_why, from, to, message) => {
    expect(() => validate(catalogWith(from, to))).toThrow(message);
  });

  it("names the catalog and every defect in one error", () => {
    const text = catalogWith("word_size: 32,", "word_size: 12,").replace(
      "char_bits: 8,",
      "char_bits: 9,",
    );
    expect(() => validate(text)).toThrow(
      /test is invalid[\s\S]*word_size must be one of[\s\S]*char_bits must be one of 8/,
    );
  });
});

describe("TargetDescriptions.check", () => {
  it("accepts a complete description and returns it", () => {
    const host = TargetCatalogFile.targets().get("host")!;
    const result = TargetDescriptions.check(new Map(Object.entries(host)));
    expect(result).toEqual({ description: host });
  });

  it("lets the toolchain fields be left out", () => {
    const fields = new Map(
      Object.entries(TargetCatalogFile.targets().get("cortex-m7")!),
    );
    expect(fields.delete("toolchain_triple")).toBe(true);
    expect(fields.delete("toolchain_cpu")).toBe(true);
    expect(TargetDescriptions.check(fields)).toEqual({
      description: Object.fromEntries(fields),
    });
  });
});
