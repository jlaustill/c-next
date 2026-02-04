/**
 * Unit tests for InitializationAnalyzer
 * Issue #503: Tests for C++ class initialization handling
 */

import { CharStream, CommonTokenStream } from "antlr4ng";
import { describe, expect, it } from "vitest";
import { CNextLexer } from "../../parser/grammar/CNextLexer";
import { CNextParser } from "../../parser/grammar/CNextParser";
import InitializationAnalyzer from "../InitializationAnalyzer";
import SymbolTable from "../../symbols/SymbolTable";
import ESymbolKind from "../../../../utils/types/ESymbolKind";
import ESourceLanguage from "../../../../utils/types/ESourceLanguage";

/**
 * Parse C-Next source code into an AST
 */
function parse(source: string) {
  const charStream = CharStream.fromString(source);
  const lexer = new CNextLexer(charStream);
  const tokenStream = new CommonTokenStream(lexer);
  const parser = new CNextParser(tokenStream);
  return parser.program();
}

describe("InitializationAnalyzer", () => {
  // ========================================================================
  // Issue #503: C++ Class Initialization
  // ========================================================================

  describe("C++ class initialization (Issue #503)", () => {
    it("should not flag C++ class variables as uninitialized", () => {
      const code = `
        void main() {
          CppMessage msg;
          u16 pgn <- msg.pgn;
        }
      `;
      const tree = parse(code);

      // Create symbol table with C++ class
      const symbolTable = new SymbolTable();
      symbolTable.addSymbol({
        name: "CppMessage",
        kind: ESymbolKind.Class,
        sourceLanguage: ESourceLanguage.Cpp,
        sourceFile: "CppMessage.hpp",
        sourceLine: 1,
        isExported: true,
      });
      // Add the field so the analyzer knows about it
      symbolTable.addStructField("CppMessage", "pgn", "u16");

      const analyzer = new InitializationAnalyzer();
      analyzer.registerExternalStructFields(
        new Map([["CppMessage", new Set(["pgn"])]]),
      );

      const errors = analyzer.analyze(tree, symbolTable);

      // Should have NO errors - C++ class is initialized by constructor
      expect(errors).toHaveLength(0);
    });

    it("should still flag C-Next structs as uninitialized", () => {
      const code = `
        struct MyStruct {
          u16 value;
        }
        void main() {
          MyStruct s;
          u16 v <- s.value;
        }
      `;
      const tree = parse(code);

      // No C++ symbols in symbol table - MyStruct is a C-Next struct
      const symbolTable = new SymbolTable();

      const analyzer = new InitializationAnalyzer();
      const errors = analyzer.analyze(tree, symbolTable);

      // SHOULD have an error - C-Next struct is NOT initialized
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].code).toBe("E0381");
      expect(errors[0].variable).toContain("value");
    });

    it("should not flag C++ struct variables as uninitialized", () => {
      const code = `
        void main() {
          CppStruct data;
          u32 val <- data.value;
        }
      `;
      const tree = parse(code);

      // Create symbol table with C++ struct (not class)
      const symbolTable = new SymbolTable();
      symbolTable.addSymbol({
        name: "CppStruct",
        kind: ESymbolKind.Struct,
        sourceLanguage: ESourceLanguage.Cpp,
        sourceFile: "types.hpp",
        sourceLine: 1,
        isExported: true,
      });
      symbolTable.addStructField("CppStruct", "value", "u32");

      const analyzer = new InitializationAnalyzer();
      analyzer.registerExternalStructFields(
        new Map([["CppStruct", new Set(["value"])]]),
      );

      const errors = analyzer.analyze(tree, symbolTable);

      // Should have NO errors - C++ structs also have default constructors
      expect(errors).toHaveLength(0);
    });

    it("should still flag C struct variables as uninitialized", () => {
      const code = `
        void main() {
          CStruct data;
          u32 val <- data.value;
        }
      `;
      const tree = parse(code);

      // Create symbol table with C struct (not C++)
      const symbolTable = new SymbolTable();
      symbolTable.addSymbol({
        name: "CStruct",
        kind: ESymbolKind.Struct,
        sourceLanguage: ESourceLanguage.C,
        sourceFile: "types.h",
        sourceLine: 1,
        isExported: true,
      });
      symbolTable.addStructField("CStruct", "value", "u32");

      const analyzer = new InitializationAnalyzer();
      analyzer.registerExternalStructFields(
        new Map([["CStruct", new Set(["value"])]]),
      );

      const errors = analyzer.analyze(tree, symbolTable);

      // SHOULD have an error - C structs don't have constructors
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].code).toBe("E0381");
    });

    it("should work without symbol table (backward compatibility)", () => {
      const code = `
        struct LocalStruct {
          u16 field;
        }
        void main() {
          LocalStruct s;
          u16 f <- s.field;
        }
      `;
      const tree = parse(code);

      // No symbol table passed - should still work
      const analyzer = new InitializationAnalyzer();
      const errors = analyzer.analyze(tree);

      // Should have an error for uninitialized local struct
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].code).toBe("E0381");
    });
  });

  // ========================================================================
  // Basic Initialization Checks
  // ========================================================================

  describe("basic initialization", () => {
    it("should not flag initialized variables", () => {
      const code = `
        void main() {
          u32 x <- 5;
          u32 y <- x;
        }
      `;
      const tree = parse(code);
      const analyzer = new InitializationAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(0);
    });

    it("should flag uninitialized primitive variables", () => {
      const code = `
        void main() {
          u32 x;
          u32 y <- x;
        }
      `;
      const tree = parse(code);
      const analyzer = new InitializationAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].code).toBe("E0381");
      expect(errors[0].variable).toBe("x");
    });

    it("should not flag global variables (zero-initialized)", () => {
      const code = `
        u32 globalVar;
        void main() {
          u32 x <- globalVar;
        }
      `;
      const tree = parse(code);
      const analyzer = new InitializationAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(0);
    });

    it("should not flag function parameters", () => {
      const code = `
        void process(u32 param) {
          u32 x <- param;
        }
      `;
      const tree = parse(code);
      const analyzer = new InitializationAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(0);
    });
  });
});
