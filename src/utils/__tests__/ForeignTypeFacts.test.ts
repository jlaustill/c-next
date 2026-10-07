/**
 * Unit tests for ForeignTypeFacts -- what C-Next may read of a C or C++
 * header symbol's type (#978, #1668).
 */
import { describe, it, expect, beforeEach } from "vitest";
import SymbolTable from "../../PARSE/3-Declare/SymbolTable";
import ESourceLanguage from "../types/ESourceLanguage";
import TestSourceSpan from "../../types/__testUtils__/testSourceSpan";
import ForeignTypeFacts from "../ForeignTypeFacts";
import TargetCatalogFile from "../../cli/TargetCatalogFile";
import NodeFileSystem from "../../PARSE/1-Discover/NodeFileSystem";

const C_HEADER = {
  sourceFile: "api.h",
  span: TestSourceSpan.at(1),
  sourceLanguage: ESourceLanguage.C,
  visibility: "public",
} as const;

let symbolTable: SymbolTable;

function cVariable(name: string, type: string, isArray = false): void {
  symbolTable.addCSymbol({
    ...C_HEADER,
    kind: "variable",
    name,
    type,
    isArray,
  });
}

describe("ForeignTypeFacts", () => {
  beforeEach(() => {
    symbolTable = new SymbolTable();
    symbolTable.addCSymbol({
      ...C_HEADER,
      kind: "type",
      name: "float32_t",
      type: "float",
    });
    symbolTable.addCSymbol({
      ...C_HEADER,
      kind: "type",
      name: "scale_t",
      type: "float32_t",
    });
    symbolTable.addStructField("ApiSample", "v", "float");
    symbolTable.addStructField("ApiSample", "count", "uint32_t");
    symbolTable.addStructField("ApiSample", "samples", "float", [4]);
  });

  // #1760 review: the spelling a write casts back to, where the typer has no
  // C-Next name for the type
  describe("operandType's cType", () => {
    it.each([
      ["an integer of unfixed width", "int_fast16_t", "int_fast16_t", null],
      ["a typedef of a float, at its element", "scale_t", "float", "f32"],
      // A fixed width is said by `typeName` the same way on every target
      ["a fixed-width integer", "uint32_t", null, "u32"],
      ["a target-sized integer, with no target", "size_t", "size_t", null],
    ])("spells %s", (_label, type, cType, typeName) => {
      expect(
        ForeignTypeFacts.operandType(type as string, symbolTable, null),
      ).toMatchObject({ cType, typeName });
    });
  });

  describe("variableType", () => {
    it.each([
      ["a float", "float", false, "f32"],
      ["a double", "double", false, "f64"],
      ["a const float", "const float", false, "f32"],
      ["a typedef of float", "float32_t", false, "f32"],
      ["a typedef of a typedef of float", "scale_t", false, "f32"],
      ["a struct global", "ApiSample", false, "ApiSample"],
      ["a struct array", "ApiSample", true, "ApiSample"],
      ["an integer", "uint32_t", false, null],
      ["a float array", "float", true, null],
      ["a float pointer", "float*", false, null],
    ])("types %s as %s", (_label, type, isArray, expected) => {
      cVariable("probe", type as string, isArray as boolean);
      expect(ForeignTypeFacts.variableType(symbolTable, "probe", null)).toBe(
        expected,
      );
    });

    it("types a C++ header variable when no C symbol has the name", () => {
      symbolTable.addCppSymbol({
        sourceFile: "api.hpp",
        span: TestSourceSpan.at(1),
        sourceLanguage: ESourceLanguage.Cpp,
        visibility: "public",
        kind: "variable",
        name: "cppScale",
        type: "float",
      });
      expect(ForeignTypeFacts.variableType(symbolTable, "cppScale", null)).toBe(
        "f32",
      );
    });

    // #1760 review: one answer for a header value's floating type, the typer's
    it("types a double by the target's data model", () => {
      cVariable("probe", "double");
      const avr = TargetCatalogFile.targets(NodeFileSystem.instance).get(
        "atmega328p",
      )!;
      expect(ForeignTypeFacts.variableType(symbolTable, "probe", avr)).toBe(
        "f32",
      );
    });

    it("answers null for a name no header declares", () => {
      expect(
        ForeignTypeFacts.variableType(symbolTable, "nowhere", null),
      ).toBeNull();
    });
  });

  describe("variableTypeInfo", () => {
    it("types a C header's floating global", () => {
      cVariable("probe", "float");
      expect(
        ForeignTypeFacts.variableTypeInfo(symbolTable, "probe", null),
      ).toMatchObject({ baseType: "f32", isArray: false, isPointer: false });
    });

    // #1760 review: the reader this replaced asked C alone
    it("types a C++ header's variable too", () => {
      symbolTable.addCppSymbol({
        sourceFile: "api.hpp",
        span: TestSourceSpan.at(1),
        sourceLanguage: ESourceLanguage.Cpp,
        visibility: "public",
        kind: "variable",
        name: "cppLevel",
        type: "double",
      });
      expect(
        ForeignTypeFacts.variableTypeInfo(symbolTable, "cppLevel", null),
      ).toMatchObject({ baseType: "f64" });
    });

    it("gives an integer global no type info", () => {
      cVariable("probe", "uint32_t");
      expect(
        ForeignTypeFacts.variableTypeInfo(symbolTable, "probe", null),
      ).toBeUndefined();
    });
  });
});
