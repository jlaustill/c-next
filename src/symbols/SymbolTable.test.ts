/**
 * Unit tests for SymbolTable conflict detection
 * Issue #221: Function parameters should not cause conflicts
 */
import { describe, it, expect, beforeEach } from "vitest";
import SymbolTable from "./SymbolTable";
import ESymbolKind from "../types/ESymbolKind";
import ESourceLanguage from "../types/ESourceLanguage";

describe("SymbolTable", () => {
  let symbolTable: SymbolTable;

  beforeEach(() => {
    symbolTable = new SymbolTable();
  });

  describe("conflict detection", () => {
    it("should detect conflicts between two global variables with same name", () => {
      // Two global variables with same name = conflict
      symbolTable.addSymbol({
        name: "counter",
        kind: ESymbolKind.Variable,
        sourceFile: "file1.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
      });

      symbolTable.addSymbol({
        name: "counter",
        kind: ESymbolKind.Variable,
        sourceFile: "file2.cnx",
        sourceLine: 5,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
      });

      const conflicts = symbolTable.getConflicts();
      expect(conflicts.length).toBe(1);
      expect(conflicts[0].symbolName).toBe("counter");
    });

    it("should NOT detect conflicts between function parameters with same name (Issue #221)", () => {
      // This is the bug: parameters 'x' in different functions should NOT conflict

      // Add function Math_add
      symbolTable.addSymbol({
        name: "Math_add",
        kind: ESymbolKind.Function,
        type: "f32",
        sourceFile: "math.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        parent: "Math",
      });

      // Add parameter 'x' for Math_add
      symbolTable.addSymbol({
        name: "x",
        kind: ESymbolKind.Variable,
        type: "f32",
        sourceFile: "math.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        parent: "Math_add", // Parent is the function
        isExported: false,
      });

      // Add parameter 'y' for Math_add
      symbolTable.addSymbol({
        name: "y",
        kind: ESymbolKind.Variable,
        type: "f32",
        sourceFile: "math.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        parent: "Math_add",
        isExported: false,
      });

      // Add function Math_multiply
      symbolTable.addSymbol({
        name: "Math_multiply",
        kind: ESymbolKind.Function,
        type: "f32",
        sourceFile: "math.cnx",
        sourceLine: 5,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        parent: "Math",
      });

      // Add parameter 'x' for Math_multiply - same name as Math_add's x
      symbolTable.addSymbol({
        name: "x",
        kind: ESymbolKind.Variable,
        type: "f32",
        sourceFile: "math.cnx",
        sourceLine: 5,
        sourceLanguage: ESourceLanguage.CNext,
        parent: "Math_multiply", // Different parent function
        isExported: false,
      });

      // Add parameter 'y' for Math_multiply
      symbolTable.addSymbol({
        name: "y",
        kind: ESymbolKind.Variable,
        type: "f32",
        sourceFile: "math.cnx",
        sourceLine: 5,
        sourceLanguage: ESourceLanguage.CNext,
        parent: "Math_multiply",
        isExported: false,
      });

      // There should be NO conflicts - parameters are scoped to their functions
      const conflicts = symbolTable.getConflicts();
      expect(conflicts.length).toBe(0);
    });

    it("should still detect conflicts for scope-level variables with same qualified name", () => {
      // Two scope-level variables with same qualified name = conflict
      symbolTable.addSymbol({
        name: "Math_counter",
        kind: ESymbolKind.Variable,
        sourceFile: "file1.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        parent: "Math",
      });

      symbolTable.addSymbol({
        name: "Math_counter",
        kind: ESymbolKind.Variable,
        sourceFile: "file2.cnx",
        sourceLine: 5,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        parent: "Math",
      });

      const conflicts = symbolTable.getConflicts();
      expect(conflicts.length).toBe(1);
      expect(conflicts[0].symbolName).toBe("Math_counter");
    });

    it("should not conflict when a global function and scope function have same parameter names", () => {
      // Global function 'divide' with parameter 'x'
      symbolTable.addSymbol({
        name: "divide",
        kind: ESymbolKind.Function,
        type: "f32",
        sourceFile: "math.cnx",
        sourceLine: 10,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
      });

      symbolTable.addSymbol({
        name: "x",
        kind: ESymbolKind.Variable,
        type: "f32",
        sourceFile: "math.cnx",
        sourceLine: 10,
        sourceLanguage: ESourceLanguage.CNext,
        parent: "divide",
        isExported: false,
      });

      // Scope function 'Math_add' with parameter 'x'
      symbolTable.addSymbol({
        name: "Math_add",
        kind: ESymbolKind.Function,
        type: "f32",
        sourceFile: "math.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        parent: "Math",
      });

      symbolTable.addSymbol({
        name: "x",
        kind: ESymbolKind.Variable,
        type: "f32",
        sourceFile: "math.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        parent: "Math_add",
        isExported: false,
      });

      // No conflicts - both 'x' are function parameters with different parents
      const conflicts = symbolTable.getConflicts();
      expect(conflicts.length).toBe(0);
    });
  });
});
