/**
 * Unit tests for runAnalyzers
 * Tests that all 8 analyzers run in sequence with early returns on errors
 */
import { describe, it, expect, beforeEach } from "vitest";
import { CharStream, CommonTokenStream } from "antlr4ng";
import { CNextLexer } from "../../parser/grammar/CNextLexer";
import { CNextParser } from "../../parser/grammar/CNextParser";
import runAnalyzers from "../runAnalyzers";
import SymbolTable from "../../symbols/SymbolTable";
import CodeGenState from "../../../state/CodeGenState";
import ESourceLanguage from "../../../../utils/types/ESourceLanguage";

/**
 * Helper to parse C-Next code and return AST + token stream
 */
function parseWithStream(source: string) {
  const charStream = CharStream.fromString(source);
  const lexer = new CNextLexer(charStream);
  const tokenStream = new CommonTokenStream(lexer);
  const parser = new CNextParser(tokenStream);
  const tree = parser.program();
  return { tree, tokenStream };
}

describe("runAnalyzers", () => {
  // Reset CodeGenState before each test
  beforeEach(() => {
    CodeGenState.reset();
    CodeGenState.symbolTable.clear();
  });

  // ========================================================================
  // Happy Path
  // ========================================================================

  describe("valid code", () => {
    it("should return no errors for valid code", () => {
      const { tree, tokenStream } = parseWithStream(`
        void main() {
          u32 x <- 5;
          u32 y <- x + 3;
        }
      `);
      const errors = runAnalyzers(tree, tokenStream);
      expect(errors).toHaveLength(0);
    });

    it("should return no errors for empty program", () => {
      const { tree, tokenStream } = parseWithStream(``);
      const errors = runAnalyzers(tree, tokenStream);
      expect(errors).toHaveLength(0);
    });
  });

  // ========================================================================
  // Phase 1: Parameter Naming Errors (early return)
  // ========================================================================

  describe("phase 1 - parameter naming", () => {
    it("should return early on parameter naming error", () => {
      const { tree, tokenStream } = parseWithStream(`
        void process(u32 process_data) {
          u32 x <- process_data;
        }
      `);
      const errors = runAnalyzers(tree, tokenStream);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].severity).toBe("error");
      expect(errors[0].message).toContain("process_data");
    });
  });

  // ========================================================================
  // Phase 2: Struct Field Errors (early return)
  // ========================================================================

  describe("phase 2 - struct field naming", () => {
    it("should return early on struct field reserved name", () => {
      const { tree, tokenStream } = parseWithStream(`
        struct MyStruct {
          u32 length;
        }
      `);
      const errors = runAnalyzers(tree, tokenStream);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].severity).toBe("error");
      expect(errors[0].message).toContain("E0355");
    });
  });

  // ========================================================================
  // Phase 3: Initialization Errors (early return)
  // ========================================================================

  describe("phase 3 - initialization", () => {
    it("should return early on use-before-init error", () => {
      const { tree, tokenStream } = parseWithStream(`
        void main() {
          u32 x;
          u32 y <- x;
        }
      `);
      const errors = runAnalyzers(tree, tokenStream);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].severity).toBe("error");
      // InitializationAnalyzer uses E0381 for use-before-init
      expect(errors[0].message).toContain("E0381");
    });
  });

  // ========================================================================
  // Phase 4: Function Call Errors (early return)
  // ========================================================================

  describe("phase 4 - function call", () => {
    it("should return early on call-before-define error", () => {
      const { tree, tokenStream } = parseWithStream(`
        void main() {
          helper();
        }
        void helper() {
          u32 x <- 5;
        }
      `);
      const errors = runAnalyzers(tree, tokenStream);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].severity).toBe("error");
      expect(errors[0].message).toContain("E0422");
    });
  });

  // ========================================================================
  // Phase 5: Null Check Errors (early return)
  // ========================================================================

  describe("phase 5 - null check", () => {
    it("should return early on missing null check", () => {
      const { tree, tokenStream } = parseWithStream(`
        #include <string.h>
        void main() {
          cstring str <- "hello";
          strchr(str, 'x');
        }
      `);
      const errors = runAnalyzers(tree, tokenStream);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].severity).toBe("error");
      expect(errors[0].message).toContain("E0901");
    });
  });

  // ========================================================================
  // Phase 6: Division by Zero Errors (early return)
  // ========================================================================

  describe("phase 6 - division by zero", () => {
    it("should return early on division by zero", () => {
      const { tree, tokenStream } = parseWithStream(`
        void main() {
          u32 x <- 10 / 0;
        }
      `);
      const errors = runAnalyzers(tree, tokenStream);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].severity).toBe("error");
      expect(errors[0].message).toContain("E0800");
    });
  });

  // ========================================================================
  // Phase 7: Float Modulo Errors (early return)
  // ========================================================================

  describe("phase 7 - float modulo", () => {
    it("should return early on float modulo", () => {
      const { tree, tokenStream } = parseWithStream(`
        void main() {
          f32 x <- 10.5;
          f32 result <- x % 3;
        }
      `);
      const errors = runAnalyzers(tree, tokenStream);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].severity).toBe("error");
      expect(errors[0].message).toContain("E0804");
    });
  });

  // ========================================================================
  // Phase 8: Comment Validation
  // ========================================================================

  describe("phase 8 - comment validation", () => {
    it("should return comment errors for nested comment markers", () => {
      // MISRA 3.1: no nested comment start markers inside comments
      const code = "/* outer /* nested */ \nvoid main() { u32 x <- 1; }";
      const { tree, tokenStream } = parseWithStream(code);
      const errors = runAnalyzers(tree, tokenStream);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].severity).toBe("error");
      expect(errors[0].message).toContain("MISRA");
    });
  });

  // ========================================================================
  // Options: CodeGenState integration and symbolTable
  // ========================================================================

  describe("options", () => {
    it("should read externalStructFields from CodeGenState", () => {
      // Code that uses a field from an external struct - externalStructFields
      // are now read from CodeGenState
      const { tree, tokenStream } = parseWithStream(`
        void main() {
          u32 x <- 5;
        }
      `);

      // Set up external struct fields in CodeGenState
      CodeGenState.symbolTable.addStructField(
        "ExternalStruct",
        "field1",
        "u32",
      );
      CodeGenState.symbolTable.addStructField(
        "ExternalStruct",
        "field2",
        "u32",
      );
      CodeGenState.buildExternalStructFields();

      const errors = runAnalyzers(tree, tokenStream);
      expect(errors).toHaveLength(0);
    });

    it("should pass symbolTable to analyzers", () => {
      const { tree, tokenStream } = parseWithStream(`
        void main() {
          u32 x <- 5;
        }
      `);

      const symbolTable = new SymbolTable();
      symbolTable.addCSymbol({
        name: "ExternalFunc",
        kind: "function",
        sourceLanguage: ESourceLanguage.C,
        sourceFile: "external.h",
        sourceLine: 1,
        isExported: true,
        type: "void",
      });

      const errors = runAnalyzers(tree, tokenStream, { symbolTable });
      expect(errors).toHaveLength(0);
    });

    it("should use CodeGenState.symbolTable by default", () => {
      const { tree, tokenStream } = parseWithStream(`
        void main() {
          u32 x <- 5;
        }
      `);

      // Set up C++ class in CodeGenState.symbolTable
      CodeGenState.symbolTable.addCppSymbol({
        name: "CppMessage",
        kind: "class",
        sourceLanguage: ESourceLanguage.Cpp,
        sourceFile: "CppMessage.hpp",
        sourceLine: 1,
        isExported: true,
      });
      CodeGenState.symbolTable.addStructField("CppMessage", "pgn", "u16");
      CodeGenState.buildExternalStructFields();

      // No options passed - should use CodeGenState.symbolTable
      const errors = runAnalyzers(tree, tokenStream);
      expect(errors).toHaveLength(0);
    });
  });

  // ========================================================================
  // Error format validation
  // ========================================================================

  describe("error format", () => {
    it("should include line, column, message, and severity on all errors", () => {
      const { tree, tokenStream } = parseWithStream(`
        void main() {
          u32 x <- 10 / 0;
        }
      `);
      const errors = runAnalyzers(tree, tokenStream);

      for (const error of errors) {
        expect(error).toHaveProperty("line");
        expect(error).toHaveProperty("column");
        expect(error).toHaveProperty("message");
        expect(error).toHaveProperty("severity");
        expect(typeof error.line).toBe("number");
        expect(typeof error.column).toBe("number");
        expect(typeof error.message).toBe("string");
        expect(error.severity).toBe("error");
      }
    });
  });
});
