/**
 * Unit tests for InitializationAnalyzer
 * Issue #503: Tests for C++ class initialization handling
 */

import { CharStream, CommonTokenStream } from "antlr4ng";
import { describe, expect, it, beforeEach } from "vitest";
import { CNextLexer } from "../../parser/grammar/CNextLexer";
import { CNextParser } from "../../parser/grammar/CNextParser";
import InitializationAnalyzer from "../InitializationAnalyzer";
import SymbolTable from "../../symbols/SymbolTable";
import CodeGenState from "../../../state/CodeGenState";
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
  // Reset CodeGenState before each test
  beforeEach(() => {
    CodeGenState.reset();
    CodeGenState.symbolTable.clear();
  });

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

      // Set up CodeGenState with C++ class
      CodeGenState.symbolTable.addSymbol({
        name: "CppMessage",
        kind: "class",
        sourceLanguage: ESourceLanguage.Cpp,
        sourceFile: "CppMessage.hpp",
        sourceLine: 1,
        isExported: true,
      });
      // Add the field so the analyzer knows about it
      CodeGenState.symbolTable.addStructField("CppMessage", "pgn", "u16");

      // Build external struct fields from symbol table
      CodeGenState.buildExternalStructFields();

      const analyzer = new InitializationAnalyzer();
      const errors = analyzer.analyze(tree, CodeGenState.symbolTable);

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

      // Set up CodeGenState with C++ struct (not class)
      CodeGenState.symbolTable.addSymbol({
        name: "CppStruct",
        kind: "struct",
        sourceLanguage: ESourceLanguage.Cpp,
        sourceFile: "types.hpp",
        sourceLine: 1,
        isExported: true,
      });
      CodeGenState.symbolTable.addStructField("CppStruct", "value", "u32");

      // Build external struct fields from symbol table
      CodeGenState.buildExternalStructFields();

      const analyzer = new InitializationAnalyzer();
      const errors = analyzer.analyze(tree, CodeGenState.symbolTable);

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

      // Set up CodeGenState with C struct (not C++)
      CodeGenState.symbolTable.addSymbol({
        name: "CStruct",
        kind: "struct",
        sourceLanguage: ESourceLanguage.C,
        sourceFile: "types.h",
        sourceLine: 1,
        isExported: true,
      });
      CodeGenState.symbolTable.addStructField("CStruct", "value", "u32");

      // Build external struct fields from symbol table (as pipeline does)
      CodeGenState.buildExternalStructFields();

      const analyzer = new InitializationAnalyzer();
      const errors = analyzer.analyze(tree, CodeGenState.symbolTable);

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

  // ========================================================================
  // Control Flow: if/else Branch Analysis
  // ========================================================================

  describe("control flow - if/else branches", () => {
    it("should keep initialization when both if and else branches initialize", () => {
      const code = `
        void main() {
          u32 x;
          bool cond <- true;
          if (cond) {
            x <- 5;
          } else {
            x <- 10;
          }
          u32 y <- x;
        }
      `;
      const tree = parse(code);
      const analyzer = new InitializationAnalyzer();
      const errors = analyzer.analyze(tree);

      // Both branches initialize x, so using x after if-else is safe
      expect(errors).toHaveLength(0);
    });

    it("should flag possibly uninitialized after if-without-else", () => {
      const code = `
        void main() {
          u32 x;
          bool cond <- true;
          if (cond) {
            x <- 5;
          }
          u32 y <- x;
        }
      `;
      const tree = parse(code);
      const analyzer = new InitializationAnalyzer();
      const errors = analyzer.analyze(tree);

      // Without else, x might not be initialized
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].code).toBe("E0381");
      expect(errors[0].variable).toBe("x");
    });
  });

  // ========================================================================
  // Control Flow: Deterministic For Loops
  // ========================================================================

  describe("control flow - deterministic for loops", () => {
    it("should preserve initialization in deterministic for loop", () => {
      const code = `
        void main() {
          u32 sum;
          for (u32 i <- 0; i < 4; i <- i + 1) {
            sum <- 42;
          }
          u32 result <- sum;
        }
      `;
      const tree = parse(code);
      const analyzer = new InitializationAnalyzer();
      const errors = analyzer.analyze(tree);

      // Deterministic for-loop (0 to 4) will definitely run
      // so sum is guaranteed initialized
      expect(errors).toHaveLength(0);
    });

    it("should merge struct field state through deterministic for loop", () => {
      const code = `
        struct Point {
          u32 x;
          u32 y;
        }
        void main() {
          Point p;
          p.x <- 1;
          for (u32 i <- 0; i < 3; i <- i + 1) {
            p.y <- i;
          }
          u32 a <- p.x;
          u32 b <- p.y;
        }
      `;
      const tree = parse(code);
      const analyzer = new InitializationAnalyzer();
      const errors = analyzer.analyze(tree);

      // p.x initialized before loop, p.y initialized in deterministic loop
      // mergeInitializationState merges p.x from beforeState
      expect(errors).toHaveLength(0);
    });
  });

  // ========================================================================
  // Write Context Tracking
  // ========================================================================

  describe("write context tracking", () => {
    it("should track write context state correctly", () => {
      const analyzer = new InitializationAnalyzer();

      expect(analyzer.isInWriteContext()).toBe(false);

      analyzer.setWriteContext(true);
      expect(analyzer.isInWriteContext()).toBe(true);

      analyzer.setWriteContext(false);
      expect(analyzer.isInWriteContext()).toBe(false);
    });

    it("should not flag assignment target as uninitialized use", () => {
      const code = `
        void main() {
          u32 x;
          x <- 5;
          u32 y <- x;
        }
      `;
      const tree = parse(code);
      const analyzer = new InitializationAnalyzer();
      const errors = analyzer.analyze(tree);

      // x is assigned (write context) then read - no error
      expect(errors).toHaveLength(0);
    });
  });

  // ========================================================================
  // declareParameter Without Active Scope
  // ========================================================================

  describe("declareParameter edge cases", () => {
    it("should create implicit scope when declaring parameter without active scope", () => {
      const analyzer = new InitializationAnalyzer();

      // Call declareParameter without entering a scope first
      // This should trigger the implicit scope creation guard
      expect(() => {
        analyzer.declareParameter("param1", 1, 0, "u32");
      }).not.toThrow();

      // Verify the parameter is usable - reading it should not trigger E0381
      // since parameters are always considered initialized
      analyzer.checkRead("param1", 2, 0);
      const code = `
        void process(u32 param1) {
          u32 x <- param1;
        }
      `;
      const tree = parse(code);
      const freshAnalyzer = new InitializationAnalyzer();
      const errors = freshAnalyzer.analyze(tree);
      expect(errors).toHaveLength(0);
    });
  });

  // ========================================================================
  // Group A: Struct Field Tracking
  // ========================================================================

  describe("struct field tracking", () => {
    it("should track struct field-by-field initialization", () => {
      const code = `
        struct Point {
          u32 x;
          u32 y;
        }
        void main() {
          Point p;
          p.x <- 10;
          p.y <- 20;
          u32 a <- p.x;
          u32 b <- p.y;
        }
      `;
      const tree = parse(code);
      const analyzer = new InitializationAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(0);
    });

    it("should flag uninitialized struct field read", () => {
      const code = `
        struct Point {
          u32 x;
          u32 y;
        }
        void main() {
          Point p;
          p.x <- 10;
          u32 a <- p.y;
        }
      `;
      const tree = parse(code);
      const analyzer = new InitializationAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0381");
      expect(errors[0].variable).toContain("p.y");
    });

    it("should recognize struct parameter fields as initialized", () => {
      const code = `
        struct Config {
          u32 timeout;
          u32 retries;
        }
        void process(Config cfg) {
          u32 t <- cfg.timeout;
          u32 r <- cfg.retries;
        }
      `;
      const tree = parse(code);
      const analyzer = new InitializationAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(0);
    });

    it("should mark all fields initialized on whole struct assignment", () => {
      const code = `
        struct Point {
          u32 x;
          u32 y;
        }
        void main() {
          Point a <- {x: 1, y: 2};
          Point b;
          b <- a;
          u32 v <- b.x;
          u32 w <- b.y;
        }
      `;
      const tree = parse(code);
      const analyzer = new InitializationAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(0);
    });

    it("should detect partially initialized struct (not all fields assigned)", () => {
      const code = `
        struct Vec3 {
          u32 x;
          u32 y;
          u32 z;
        }
        void main() {
          Vec3 v;
          v.x <- 1;
          v.y <- 2;
          u32 val <- v.z;
        }
      `;
      const tree = parse(code);
      const analyzer = new InitializationAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0381");
      expect(errors[0].variable).toContain("v.z");
    });
  });

  // ========================================================================
  // Group B: Array Element Assignment
  // ========================================================================

  describe("array element assignment", () => {
    it("should track initialization through array element assignment", () => {
      const code = `
        void main() {
          u32 arr[3] <- [0, 0, 0];
          arr[0] <- 10;
        }
      `;
      const tree = parse(code);
      const analyzer = new InitializationAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(0);
    });
  });

  // ========================================================================
  // Group C: While Loop
  // ========================================================================

  describe("control flow - while loop", () => {
    it("should conservatively treat while loop as possibly not executing", () => {
      const code = `
        void main() {
          u32 x;
          u32 count <- 0;
          while (count < 5) {
            x <- 5;
            count <- count + 1;
          }
          u32 y <- x;
        }
      `;
      const tree = parse(code);
      const analyzer = new InitializationAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0381");
      expect(errors[0].variable).toBe("x");
    });
  });

  // ========================================================================
  // Group D: For Loop Variants (isDeterministicForLoop)
  // ========================================================================

  describe("control flow - non-deterministic for loops", () => {
    it("should flag non-deterministic for loop with non-zero init", () => {
      const code = `
        void main() {
          u32 sum;
          for (u32 i <- 1; i < 4; i <- i + 1) {
            sum <- 42;
          }
          u32 r <- sum;
        }
      `;
      const tree = parse(code);
      const analyzer = new InitializationAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0381");
      expect(errors[0].variable).toBe("sum");
    });

    it("should handle deterministic for loop with pre-declared variable (forAssignment)", () => {
      const code = `
        void main() {
          u32 sum;
          u32 i <- 0;
          for (i <- 0; i < 4; i <- i + 1) {
            sum <- 42;
          }
          u32 r <- sum;
        }
      `;
      const tree = parse(code);
      const analyzer = new InitializationAnalyzer();
      const errors = analyzer.analyze(tree);

      // forAssignment path: i already initialized, loop is deterministic (0 < 4)
      expect(errors).toHaveLength(0);
    });

    it("should flag non-deterministic for loop with non-< condition", () => {
      const code = `
        void main() {
          u32 sum;
          for (u32 i <- 0; i != 4; i <- i + 1) {
            sum <- 42;
          }
          u32 r <- sum;
        }
      `;
      const tree = parse(code);
      const analyzer = new InitializationAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0381");
      expect(errors[0].variable).toBe("sum");
    });

    it("should flag non-deterministic for loop with zero bound", () => {
      const code = `
        void main() {
          u32 sum;
          for (u32 i <- 0; i < 0; i <- i + 1) {
            sum <- 42;
          }
          u32 r <- sum;
        }
      `;
      const tree = parse(code);
      const analyzer = new InitializationAnalyzer();
      const errors = analyzer.analyze(tree);

      // bound is 0, so loop never runs — non-deterministic
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0381");
      expect(errors[0].variable).toBe("sum");
    });

    it("should flag non-deterministic forAssignment with non-zero init", () => {
      const code = `
        void main() {
          u32 sum;
          u32 i <- 0;
          for (i <- 1; i < 4; i <- i + 1) {
            sum <- 42;
          }
          u32 r <- sum;
        }
      `;
      const tree = parse(code);
      const analyzer = new InitializationAnalyzer();
      const errors = analyzer.analyze(tree);

      // forAssignment with non-zero init is non-deterministic, sum may not be set
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0381");
      expect(errors[0].variable).toBe("sum");
    });
  });

  // ========================================================================
  // Group E: Function Call Arguments
  // ========================================================================

  describe("function call arguments", () => {
    it("should mark variables passed as function arguments as initialized", () => {
      const code = `
        void fill(u32 result) {
          result <- 42;
        }
        void main() {
          u32 x;
          fill(x);
          u32 y <- x;
        }
      `;
      const tree = parse(code);
      const analyzer = new InitializationAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(0);
    });

    it("should skip struct member init check inside function call arguments", () => {
      const code = `
        struct Point {
          u32 x;
        }
        void consume(u32 val) { }
        void main() {
          Point p;
          consume(p.x);
        }
      `;
      const tree = parse(code);
      const analyzer = new InitializationAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(0);
    });
  });

  // ========================================================================
  // Group F: .length on Non-String Type
  // ========================================================================

  describe(".length on non-string type", () => {
    it("should not flag .length access on array type", () => {
      const code = `
        void main() {
          u32 arr[5] <- [1, 2, 3, 4, 5];
          u32 len <- arr.length;
        }
      `;
      const tree = parse(code);
      const analyzer = new InitializationAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(0);
    });
  });

  // ========================================================================
  // Group G: String Type Properties
  // ========================================================================

  describe("string type properties", () => {
    it("should flag .length on uninitialized string", () => {
      const code = `
        void main() {
          string<32> s;
          u32 len <- s.length;
        }
      `;
      const tree = parse(code);
      const analyzer = new InitializationAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0381");
      expect(errors[0].variable).toBe("s");
    });

    it("should not flag .length on initialized string", () => {
      const code = `
        void main() {
          string<32> s <- "hello";
          u32 len <- s.length;
        }
      `;
      const tree = parse(code);
      const analyzer = new InitializationAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(0);
    });
  });

  // ========================================================================
  // Group H: Global Scope with Scopes
  // ========================================================================

  describe("global scope with scopes", () => {
    it("should handle scope member variables as globally initialized", () => {
      const code = `
        scope LED {
          u32 brightness;
          public void on() {
            brightness <- 100;
          }
        }
        void main() {
          LED.on();
        }
      `;
      const tree = parse(code);
      const analyzer = new InitializationAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(0);
    });

    it("should handle scope member variable with user type", () => {
      const code = `
        struct Config {
          u32 timeout;
        }
        scope System {
          Config settings;
          public void init() {
            settings.timeout <- 100;
          }
        }
        void main() {
          System.init();
        }
      `;
      const tree = parse(code);
      const analyzer = new InitializationAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(0);
    });

    it("should handle global struct-typed variable", () => {
      const code = `
        struct Config {
          u32 timeout;
        }
        Config globalConfig;
        void main() {
          u32 t <- globalConfig.timeout;
        }
      `;
      const tree = parse(code);
      const analyzer = new InitializationAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(0);
    });
  });

  // ========================================================================
  // Group I: C++ Non-Struct Symbol
  // ========================================================================

  describe("C++ non-struct symbol", () => {
    it("should not treat C++ enum as auto-initialized", () => {
      const code = `
        void main() {
          CppEnum e;
          u32 val <- e;
        }
      `;
      const tree = parse(code);

      const symbolTable = new SymbolTable();
      symbolTable.addSymbol({
        name: "CppEnum",
        kind: "enum",
        sourceLanguage: ESourceLanguage.Cpp,
        sourceFile: "types.hpp",
        sourceLine: 1,
        isExported: true,
      });

      const analyzer = new InitializationAnalyzer();
      const errors = analyzer.analyze(tree, symbolTable);

      // C++ enums don't have constructors - should flag as uninitialized
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0381");
      expect(errors[0].variable).toBe("e");
    });
  });
});
