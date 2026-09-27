/**
 * Unit tests for ForeignTypeFacts -- what C-Next may read of a C or C++
 * header symbol's type (#978, #1668).
 */
import { describe, it, expect, beforeEach } from "vitest";
import SymbolTable from "../../PARSE/3-Declare/SymbolTable";
import ESourceLanguage from "../types/ESourceLanguage";
import TestSourceSpan from "../../transpiler/types/__testUtils__/testSourceSpan";
import ForeignTypeFacts from "../ForeignTypeFacts";

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
      expect(ForeignTypeFacts.variableType(symbolTable, "probe")).toBe(
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
      expect(ForeignTypeFacts.variableType(symbolTable, "cppScale")).toBe(
        "f32",
      );
    });

    it("answers null for a name no header declares", () => {
      expect(ForeignTypeFacts.variableType(symbolTable, "nowhere")).toBeNull();
    });
  });
});
