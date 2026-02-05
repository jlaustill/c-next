/**
 * Unit tests for FunctionCallAnalyzer
 * Tests define-before-use enforcement for functions (ADR-030)
 */
import { describe, it, expect } from "vitest";
import { CharStream, CommonTokenStream } from "antlr4ng";
import { CNextLexer } from "../../parser/grammar/CNextLexer";
import { CNextParser } from "../../parser/grammar/CNextParser";
import FunctionCallAnalyzer from "../FunctionCallAnalyzer";
import SymbolTable from "../../symbols/SymbolTable";
import ESourceLanguage from "../../../../utils/types/ESourceLanguage";
import ESymbolKind from "../../../../utils/types/ESymbolKind";

/**
 * Helper to parse C-Next code and return the AST
 */
function parse(source: string) {
  const charStream = CharStream.fromString(source);
  const lexer = new CNextLexer(charStream);
  const tokenStream = new CommonTokenStream(lexer);
  const parser = new CNextParser(tokenStream);
  return parser.program();
}

describe("FunctionCallAnalyzer", () => {
  // ========================================================================
  // Define Before Use
  // ========================================================================

  describe("define before use", () => {
    it("should allow calling defined before use", () => {
      const code = `
        void helper() {
          u32 x <- 5;
        }
        void main() {
          helper();
        }
      `;
      const tree = parse(code);
      const analyzer = new FunctionCallAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(0);
    });

    it("should detect called before definition", () => {
      const code = `
        void main() {
          helper();
        }
        void helper() {
          u32 x <- 5;
        }
      `;
      const tree = parse(code);
      const analyzer = new FunctionCallAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0422");
      expect(errors[0].message).toContain("called before definition");
    });

    it("should detect undefined", () => {
      const code = `
        void main() {
          unknownFunc();
        }
      `;
      const tree = parse(code);
      const analyzer = new FunctionCallAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0422");
    });
  });

  // ========================================================================
  // Self-Recursion Detection (MISRA C:2012 Rule 17.2)
  // ========================================================================

  describe("self-recursion detection", () => {
    it("should detect direct self-recursion", () => {
      const code = `
        void factorial(u32 n) {
          factorial(n - 1);
        }
      `;
      const tree = parse(code);
      const analyzer = new FunctionCallAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0423");
      expect(errors[0].message).toContain("recursive call");
      expect(errors[0].message).toContain("MISRA");
    });

    it("should allow calling other procedures with similar names", () => {
      const code = `
        void helper() {
          u32 x <- 5;
        }
        void process() {
          helper();
        }
      `;
      const tree = parse(code);
      const analyzer = new FunctionCallAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(0);
    });
  });

  // ========================================================================
  // Scope Handling
  // ========================================================================

  describe("scope handling", () => {
    it("should resolve scope member calls", () => {
      const code = `
        scope LED {
          public void on() {
            u32 x <- 1;
          }
        }
        void main() {
          LED.on();
        }
      `;
      const tree = parse(code);
      const analyzer = new FunctionCallAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(0);
    });

    it("should detect undefined scope member", () => {
      const code = `
        scope LED {
          public void on() {
            u32 x <- 1;
          }
        }
        void main() {
          LED.off();
        }
      `;
      const tree = parse(code);
      const analyzer = new FunctionCallAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0422");
    });

    it("should allow this.name() qualified calls within scope", () => {
      const code = `
        scope Test {
          void helper() {
            u32 x <- 1;
          }

          public void callsHelper() {
            this.helper();
          }
        }
      `;
      const tree = parse(code);
      const analyzer = new FunctionCallAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(0);
    });

    it("should detect undefined method via this.methodName()", () => {
      const code = `
        scope Test {
          void helper() {
            u32 x <- 1;
          }

          public void callsUndefined() {
            this.undefinedMethod();
          }
        }
      `;
      const tree = parse(code);
      const analyzer = new FunctionCallAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0422");
      expect(errors[0].message).toContain("called before definition");
    });

    // ADR-057: With implicit scope resolution, bare function calls to scope functions
    // are now allowed (resolve automatically). This test verifies no error is thrown.
    it("should allow unqualified scope function calls (ADR-057 implicit resolution)", () => {
      const code = `
        scope Test {
          void helper() {
            u32 x <- 1;
          }

          public void callsHelper() {
            helper();
          }
        }
      `;
      const tree = parse(code);
      const analyzer = new FunctionCallAnalyzer();
      const errors = analyzer.analyze(tree);

      // ADR-057: Implicit resolution allows bare scope function calls
      expect(errors).toHaveLength(0);
    });

    it("should not suggest this. for truly undefined in scope", () => {
      const code = `
        scope Test {
          public void callsUnknown() {
            unknownFunc();
          }
        }
      `;
      const tree = parse(code);
      const analyzer = new FunctionCallAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0422");
      expect(errors[0].message).toContain("called before definition");
      expect(errors[0].message).not.toContain("this.");
    });

    it("should not suggest this. for calls outside scope", () => {
      const code = `
        scope Test {
          public void helper() {
            u32 x <- 1;
          }
        }

        void main() {
          helper();
        }
      `;
      const tree = parse(code);
      const analyzer = new FunctionCallAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain("called before definition");
      expect(errors[0].message).not.toContain("this.");
    });
  });

  // ========================================================================
  // Built-in Procedures
  // ========================================================================

  describe("built-in procedures", () => {
    it("should allow safe_div built-in", () => {
      const code = `
        void main() {
          u32 result;
          safe_div(result, 10, 0, 0);
        }
      `;
      const tree = parse(code);
      const analyzer = new FunctionCallAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(0);
    });

    it("should allow safe_mod built-in", () => {
      const code = `
        void main() {
          u32 result;
          safe_mod(result, 10, 0, 0);
        }
      `;
      const tree = parse(code);
      const analyzer = new FunctionCallAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(0);
    });
  });

  // ========================================================================
  // Standard Library
  // ========================================================================

  describe("standard library", () => {
    it("should allow printf with stdio.h included", () => {
      const code = `
        #include <stdio.h>
        void main() {
          printf("Hello");
        }
      `;
      const tree = parse(code);
      const analyzer = new FunctionCallAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(0);
    });

    it("should detect printf without stdio.h", () => {
      const code = `
        void main() {
          printf("Hello");
        }
      `;
      const tree = parse(code);
      const analyzer = new FunctionCallAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(1);
    });

    it("should allow strlen with string.h included", () => {
      const code = `
        #include <string.h>
        void main() {
          u32 len <- strlen("test");
        }
      `;
      const tree = parse(code);
      const analyzer = new FunctionCallAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(0);
    });

    it("should allow math operations with math.h included", () => {
      const code = `
        #include <math.h>
        void main() {
          f64 x <- sin(3.14);
        }
      `;
      const tree = parse(code);
      const analyzer = new FunctionCallAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(0);
    });
  });

  // ========================================================================
  // External C/C++ (Symbol Table)
  // ========================================================================

  describe("external via symbol table", () => {
    it("should allow external C from symbol table", () => {
      const code = `
        void main() {
          myExternalFunc();
        }
      `;
      const tree = parse(code);
      const symbolTable = new SymbolTable();
      symbolTable.addSymbol({
        name: "myExternalFunc",
        kind: ESymbolKind.Function,
        sourceLanguage: ESourceLanguage.C,
        sourceFile: "external.h",
        sourceLine: 1,
        isExported: true,
        type: "void",
      });

      const analyzer = new FunctionCallAnalyzer();
      const errors = analyzer.analyze(tree, symbolTable);

      expect(errors).toHaveLength(0);
    });

    it("should allow external C++ from symbol table", () => {
      const code = `
        void main() {
          cppHelper();
        }
      `;
      const tree = parse(code);
      const symbolTable = new SymbolTable();
      symbolTable.addSymbol({
        name: "cppHelper",
        kind: ESymbolKind.Function,
        sourceLanguage: ESourceLanguage.Cpp,
        sourceFile: "helper.hpp",
        sourceLine: 1,
        isExported: true,
        type: "void",
      });

      const analyzer = new FunctionCallAnalyzer();
      const errors = analyzer.analyze(tree, symbolTable);

      expect(errors).toHaveLength(0);
    });
  });

  // ========================================================================
  // ISR and Callback Variables (ADR-040)
  // ========================================================================

  describe("ISR and callback variables", () => {
    it("should allow invoking ISR-typed variable", () => {
      const code = `
        void myHandler() {
          u32 x <- 1;
        }
        void main() {
          ISR handler <- myHandler;
          handler();
        }
      `;
      const tree = parse(code);
      const analyzer = new FunctionCallAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(0);
    });

    it("should allow invoking ISR-typed parameter", () => {
      const code = `
        void myHandler() {
          u32 x <- 1;
        }
        void execute(ISR callback) {
          callback();
        }
      `;
      const tree = parse(code);
      const analyzer = new FunctionCallAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(0);
    });
  });

  // ========================================================================
  // Multiple Errors
  // ========================================================================

  describe("multiple errors", () => {
    it("should detect multiple undefined", () => {
      const code = `
        void main() {
          foo();
          bar();
          baz();
        }
      `;
      const tree = parse(code);
      const analyzer = new FunctionCallAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(3);
    });
  });

  // ========================================================================
  // Error Details
  // ========================================================================

  describe("error details", () => {
    it("should report correct line and column", () => {
      const code = `void main() {
  unknownFunc();
}`;
      const tree = parse(code);
      const analyzer = new FunctionCallAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors[0].line).toBe(2);
      expect(errors[0].column).toBeGreaterThan(0);
    });
  });

  // ========================================================================
  // Edge Cases
  // ========================================================================

  describe("edge cases", () => {
    it("should handle empty program", () => {
      const code = ``;
      const tree = parse(code);
      const analyzer = new FunctionCallAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(0);
    });

    it("should handle program with only declarations", () => {
      const code = `
        u32 globalVar <- 5;
        void helper() {
          u32 x <- globalVar;
        }
      `;
      const tree = parse(code);
      const analyzer = new FunctionCallAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(0);
    });

    it("should ignore non-scope member access calls", () => {
      const code = `
        struct Obj {
          u32 value;
        }
        void main() {
          Obj myObj;
          myObj.doSomething();
        }
      `;
      const tree = parse(code);
      const analyzer = new FunctionCallAnalyzer();
      const errors = analyzer.analyze(tree);

      // myObj is not a scope, so myObj.doSomething() is treated as
      // object method access and skipped - no E0422 for doSomething
      const doSomethingErrors = errors.filter(
        (e) => e.functionName === "doSomething",
      );
      expect(doSomethingErrors).toHaveLength(0);
    });

    it("should return false from isExternalFunction when symbol has non-C/C++ language", () => {
      const code = `
        void main() {
          cnextFunc();
        }
      `;
      const tree = parse(code);
      const symbolTable = new SymbolTable();
      symbolTable.addSymbol({
        name: "cnextFunc",
        kind: ESymbolKind.Function,
        sourceLanguage: ESourceLanguage.CNext,
        sourceFile: "module.cnx",
        sourceLine: 1,
        isExported: true,
        type: "void",
      });

      const analyzer = new FunctionCallAnalyzer();
      const errors = analyzer.analyze(tree, symbolTable);

      // C-Next function in symbol table is not treated as external C/C++
      // so it still gets E0422
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0422");
    });
  });
});
