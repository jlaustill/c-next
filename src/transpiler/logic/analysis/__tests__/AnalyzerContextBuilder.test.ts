/**
 * Unit tests for AnalyzerContextBuilder
 * Issue #591: Tests for struct field conversion utility
 */

import { describe, it, expect, beforeEach } from "vitest";

import AnalyzerContextBuilder from "../AnalyzerContextBuilder";
import SymbolTable from "../../symbols/SymbolTable";

describe("AnalyzerContextBuilder", () => {
  let symbolTable: SymbolTable;

  beforeEach(() => {
    symbolTable = new SymbolTable();
  });

  describe("buildExternalStructFields", () => {
    it("returns empty map when no struct fields exist", () => {
      const result =
        AnalyzerContextBuilder.buildExternalStructFields(symbolTable);

      expect(result.size).toBe(0);
    });

    it("includes non-array fields in result", () => {
      // Manually add struct fields to the symbol table
      const structFields = new Map<
        string,
        Map<string, { type: string; arrayDimensions?: number[] }>
      >();
      const pointFields = new Map<
        string,
        { type: string; arrayDimensions?: number[] }
      >();
      pointFields.set("x", { type: "i32" });
      pointFields.set("y", { type: "i32" });
      structFields.set("Point", pointFields);

      // Use restoreStructFields to populate the symbol table
      symbolTable.restoreStructFields(structFields);

      const result =
        AnalyzerContextBuilder.buildExternalStructFields(symbolTable);

      expect(result.has("Point")).toBe(true);
      const fields = result.get("Point");
      expect(fields?.has("x")).toBe(true);
      expect(fields?.has("y")).toBe(true);
    });

    it("excludes array fields from result (Issue #355)", () => {
      const structFields = new Map<
        string,
        Map<string, { type: string; arrayDimensions?: number[] }>
      >();
      const bufferFields = new Map<
        string,
        { type: string; arrayDimensions?: number[] }
      >();
      bufferFields.set("size", { type: "u32" }); // Non-array
      bufferFields.set("data", { type: "u8", arrayDimensions: [256] }); // Array

      structFields.set("Buffer", bufferFields);
      symbolTable.restoreStructFields(structFields);

      const result =
        AnalyzerContextBuilder.buildExternalStructFields(symbolTable);

      expect(result.has("Buffer")).toBe(true);
      const fields = result.get("Buffer");
      expect(fields?.has("size")).toBe(true); // Non-array included
      expect(fields?.has("data")).toBe(false); // Array excluded
    });

    it("excludes structs with only array fields", () => {
      const structFields = new Map<
        string,
        Map<string, { type: string; arrayDimensions?: number[] }>
      >();
      const arrayOnlyFields = new Map<
        string,
        { type: string; arrayDimensions?: number[] }
      >();
      arrayOnlyFields.set("items", { type: "u8", arrayDimensions: [10] });
      arrayOnlyFields.set("values", { type: "i32", arrayDimensions: [5] });

      structFields.set("ArrayOnly", arrayOnlyFields);
      symbolTable.restoreStructFields(structFields);

      const result =
        AnalyzerContextBuilder.buildExternalStructFields(symbolTable);

      // Struct should not be included since all fields are arrays
      expect(result.has("ArrayOnly")).toBe(false);
    });

    it("handles mixed structs correctly", () => {
      const structFields = new Map<
        string,
        Map<string, { type: string; arrayDimensions?: number[] }>
      >();

      // Struct with mixed fields
      const mixedFields = new Map<
        string,
        { type: string; arrayDimensions?: number[] }
      >();
      mixedFields.set("id", { type: "u32" });
      mixedFields.set("name", { type: "string", arrayDimensions: [32] });
      mixedFields.set("count", { type: "u16" });

      // Struct with only non-array
      const simpleFields = new Map<
        string,
        { type: string; arrayDimensions?: number[] }
      >();
      simpleFields.set("value", { type: "f32" });

      structFields.set("Mixed", mixedFields);
      structFields.set("Simple", simpleFields);
      symbolTable.restoreStructFields(structFields);

      const result =
        AnalyzerContextBuilder.buildExternalStructFields(symbolTable);

      // Mixed struct should have only non-array fields
      expect(result.get("Mixed")?.size).toBe(2);
      expect(result.get("Mixed")?.has("id")).toBe(true);
      expect(result.get("Mixed")?.has("count")).toBe(true);
      expect(result.get("Mixed")?.has("name")).toBe(false);

      // Simple struct should have its field
      expect(result.get("Simple")?.has("value")).toBe(true);
    });
  });
});
