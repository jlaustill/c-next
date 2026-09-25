/**
 * Unit tests for runAnalyzers
 * Tests that all analyzers run in sequence with early returns on errors
 */
import { describe, it, expect, beforeEach } from "vitest";
import CNextSourceParser from "../../../PARSE/2-Parse/CNextSourceParser";
import runAnalyzers from "../runAnalyzers";
import SymbolTable from "../../../PARSE/3-Declare/SymbolTable";
import TranspileState from "../../TranspileState";
import ESourceLanguage from "../../../utils/types/ESourceLanguage";
import TestSourceSpan from "../../../transpiler/types/__testUtils__/testSourceSpan";
import Program from "../../../PARSE/4-Resolve/Program";
import testAnalysisContext from "./testAnalysisContext";

/**
 * #1322: what a file under analysis is, for a test that has no file.
 *
 * `runAnalyzers` requires the ADR-010 include context rather than accepting an
 * absent one, so a unit test states it too -- no file on disk, so nothing
 * exists and no angle include has anywhere to search. That makes E0504 and
 * E0506 silent here by construction, and it says so, where an optional
 * parameter would have made them silent by omission.
 */
const NO_INCLUDES = {
  sourcePath: "/unit-test/analyzers.cnx",
  searchPaths: [] as readonly string[],
  fileExists: () => false,
};

/**
 * Helper to parse C-Next code and return the AST plus its comments.
 *
 * #1445: this used to build its own `CharStream`/lexer/`CommonTokenStream`/
 * parser -- a second spelling of `CNextSourceParser.parse` that had to be kept
 * in step with it by hand, and which left ANTLR's DEFAULT error listeners
 * installed, so an unparsable fixture printed to the console instead of being
 * collected. It calls the real parser now, and takes `comments` off 1.2's
 * artifact because that is what `runAnalyzers` asks for.
 */
function parseWithComments(source: string) {
  const { tree, comments } = CNextSourceParser.parse(source);
  return { tree, comments };
}

let state = new TranspileState();

describe("runAnalyzers", () => {
  // Reset TranspileState before each test
  beforeEach(() => {
    state = new TranspileState();
    state.symbolTable = new SymbolTable();
  });

  // ========================================================================
  // Happy Path
  // ========================================================================

  describe("valid code", () => {
    it("should return no errors for valid code", () => {
      const { tree, comments } = parseWithComments(`
        void main() {
          u32 x <- 5;
          u32 y <- x + 3;
        }
      `);
      const errors = runAnalyzers(tree, comments, {
        cppMode: false,
        context: testAnalysisContext(state, { symbolTable: new SymbolTable() }),
        includes: NO_INCLUDES,
      });
      expect(errors).toHaveLength(0);
    });

    it("should return no errors for empty program", () => {
      const { tree, comments } = parseWithComments(``);
      const errors = runAnalyzers(tree, comments, {
        cppMode: false,
        context: testAnalysisContext(state, { symbolTable: new SymbolTable() }),
        includes: NO_INCLUDES,
      });
      expect(errors).toHaveLength(0);
    });
  });

  // ========================================================================
  // Phase 1: Identifier Syntax Errors (early return) - ADR-063
  // ========================================================================

  describe("phase 1 - identifier syntax", () => {
    it("should return early on a trailing-underscore identifier", () => {
      const { tree, comments } = parseWithComments(`u8 value_ <- 1;`);
      const errors = runAnalyzers(tree, comments, {
        cppMode: false,
        context: testAnalysisContext(state, { symbolTable: new SymbolTable() }),
        includes: NO_INCLUDES,
      });

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].severity).toBe("error");
      // Registered WITH formatWithCode, so the code reaches the message
      expect(errors[0].message).toContain("error[E0201]");
      expect(errors[0].message).toContain("value_");
    });

    it("should return early on consecutive underscores", () => {
      const { tree, comments } = parseWithComments(`u8 my__value <- 1;`);
      const errors = runAnalyzers(tree, comments, {
        cppMode: false,
        context: testAnalysisContext(state, { symbolTable: new SymbolTable() }),
        includes: NO_INCLUDES,
      });

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message).toContain("error[E0201]");
    });

    it("should accept a leading underscore (ADR-063)", () => {
      const { tree, comments } = parseWithComments(`
        void fn() {
          u8 _local <- 1;
          u8 x <- _local;
        }
      `);
      const errors = runAnalyzers(tree, comments, {
        cppMode: false,
        context: testAnalysisContext(state, { symbolTable: new SymbolTable() }),
        includes: NO_INCLUDES,
      });

      expect(errors).toHaveLength(0);
    });
  });

  // ========================================================================
  // Phase 2: Parameter Naming Errors (early return)
  // ========================================================================

  describe("phase 2 - parameter naming", () => {
    it("should return early on parameter naming error", () => {
      const { tree, comments } = parseWithComments(`
        void process(u32 process_data) {
          u32 x <- process_data;
        }
      `);
      const errors = runAnalyzers(tree, comments, {
        cppMode: false,
        context: testAnalysisContext(state, { symbolTable: new SymbolTable() }),
        includes: NO_INCLUDES,
      });

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].severity).toBe("error");
      expect(errors[0].message).toContain("process_data");
    });
  });

  // ========================================================================
  // Phase 2: Struct Field Errors (early return)
  // ========================================================================
  // Note: ADR-058 removed all reserved field names (including "length")
  // so there are no struct field naming violations to test.
  // The StructFieldAnalyzer infrastructure remains for future reserved names.

  // ========================================================================
  // Phase 3: Initialization Errors (early return)
  // ========================================================================

  describe("phase 3 - initialization", () => {
    it("should return early on use-before-init error", () => {
      const { tree, comments } = parseWithComments(`
        void main() {
          u32 x;
          u32 y <- x;
        }
      `);
      const errors = runAnalyzers(tree, comments, {
        cppMode: false,
        context: testAnalysisContext(state, { symbolTable: new SymbolTable() }),
        includes: NO_INCLUDES,
      });

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
      const { tree, comments } = parseWithComments(`
        void main() {
          helper();
        }
        void helper() {
          u32 x <- 5;
        }
      `);
      const errors = runAnalyzers(tree, comments, {
        cppMode: false,
        context: testAnalysisContext(state, { symbolTable: new SymbolTable() }),
        includes: NO_INCLUDES,
      });

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
      const { tree, comments } = parseWithComments(`
        #include <string.h>
        void main() {
          cstring str <- "hello";
          strchr(str, 'x');
        }
      `);
      const errors = runAnalyzers(tree, comments, {
        cppMode: false,
        context: testAnalysisContext(state, { symbolTable: new SymbolTable() }),
        includes: NO_INCLUDES,
      });

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
      const { tree, comments } = parseWithComments(`
        void main() {
          u32 x <- 10 / 0;
        }
      `);
      const errors = runAnalyzers(tree, comments, {
        cppMode: false,
        context: testAnalysisContext(state, { symbolTable: new SymbolTable() }),
        includes: NO_INCLUDES,
      });

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
      const { tree, comments } = parseWithComments(`
        void main() {
          f32 x <- 10.5;
          f32 result <- x % 3;
        }
      `);
      const errors = runAnalyzers(tree, comments, {
        cppMode: false,
        context: testAnalysisContext(state, { symbolTable: new SymbolTable() }),
        includes: NO_INCLUDES,
      });

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
      const { tree, comments } = parseWithComments(code);
      const errors = runAnalyzers(tree, comments, {
        cppMode: false,
        context: testAnalysisContext(state, { symbolTable: new SymbolTable() }),
        includes: NO_INCLUDES,
      });

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].severity).toBe("error");
      expect(errors[0].message).toContain("MISRA");
    });
  });

  // ========================================================================
  // Options: TranspileState integration and symbolTable
  // ========================================================================

  describe("options", () => {
    it("should read externalStructFields from TranspileState", () => {
      // Code that uses a field from an external struct - externalStructFields
      // are now read from TranspileState
      const { tree, comments } = parseWithComments(`
        void main() {
          u32 x <- 5;
        }
      `);

      // Set up external struct fields in TranspileState
      state.symbolTable.addStructField("ExternalStruct", "field1", "u32");
      state.symbolTable.addStructField("ExternalStruct", "field2", "u32");
      state.program = Program.build([], {
        headerStructFields: state.symbolTable.getAllStructFields(),
      });

      const errors = runAnalyzers(tree, comments, {
        cppMode: false,
        context: testAnalysisContext(state, { symbolTable: new SymbolTable() }),
        includes: NO_INCLUDES,
      });
      expect(errors).toHaveLength(0);
    });

    it("should pass symbolTable to analyzers", () => {
      const { tree, comments } = parseWithComments(`
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
        span: TestSourceSpan.at(1),
        visibility: "public",
        type: "void",
      });

      const errors = runAnalyzers(tree, comments, {
        context: testAnalysisContext(state, { symbolTable }),
        cppMode: false,
        includes: NO_INCLUDES,
      });
      expect(errors).toHaveLength(0);
    });

    it("consults the table the CALLER passed, not shared state", () => {
      // #1456: this used to be "should use state.symbolTable by
      // default" and covered the `options.symbolTable ?? state.symbolTable`
      // fallback, which is gone. Rewritten rather than deleted, because the
      // property worth keeping is that the table actually reaches the
      // analyzers -- only the route changed.
      //
      // The SOURCE has to consult the table, and this one does not: with
      // `void main() { u32 x <- 5; }`, handing every analyzer a fresh empty
      // table instead of the caller's leaves this green, so it asserts the
      // route rather than proving it. The two neighbors above have the same
      // shape. Making it prove the route needs a fact the caller's table
      // carries and the mock `symbols` view does not -- see #1663, which holds
      // the measurement rather than leaving this comment as the only record.
      const { tree, comments } = parseWithComments(`
        void main() {
          u32 x <- 5;
        }
      `);

      const caller = new SymbolTable();
      caller.addCppSymbol({
        name: "CppMessage",
        kind: "class",
        sourceLanguage: ESourceLanguage.Cpp,
        sourceFile: "CppMessage.hpp",
        span: TestSourceSpan.at(1),
        visibility: "public",
      });
      caller.addStructField("CppMessage", "pgn", "u16");
      state.program = Program.build([], {
        headerStructFields: caller.getAllStructFields(),
      });

      const errors = runAnalyzers(tree, comments, {
        cppMode: false,
        context: testAnalysisContext(state, { symbolTable: caller }),
        includes: NO_INCLUDES,
      });
      expect(errors).toHaveLength(0);
    });
  });

  // ========================================================================
  // Error format validation
  // ========================================================================

  describe("error format", () => {
    it("should include line, column, message, and severity on all errors", () => {
      const { tree, comments } = parseWithComments(`
        void main() {
          u32 x <- 10 / 0;
        }
      `);
      const errors = runAnalyzers(tree, comments, {
        cppMode: false,
        context: testAnalysisContext(state, { symbolTable: new SymbolTable() }),
        includes: NO_INCLUDES,
      });

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
