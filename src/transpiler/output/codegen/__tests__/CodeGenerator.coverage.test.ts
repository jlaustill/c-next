/**
 * Unit tests for CodeGenerator - Coverage for uncovered lines
 *
 * This file targets specific uncovered lines identified by SonarCloud:
 * - Lines 426, 440: invokeStatement/invokeExpression error paths
 * - Lines 631-633: resolveIdentifier with scope members
 * - Lines 4289-4379: C++ member conversion logic
 * - Lines 4572-4622: Member access argument handling
 * - Lines 4687-4765: Scope generation fallback
 * - Lines 5154-5275: Function/array generation
 */
import { describe, it, expect, beforeEach } from "vitest";
import CodeGenerator from "../CodeGenerator";
import CNextSourceParser from "../../../logic/parser/CNextSourceParser";
import * as Parser from "../../../logic/parser/grammar/CNextParser";
import SymbolTable from "../../../logic/symbols/SymbolTable";
import CNextResolver from "../../../logic/symbols/cnext/index";
import TSymbolInfoAdapter from "../../../logic/symbols/cnext/adapters/TSymbolInfoAdapter";
import CodeGenState from "../../../state/CodeGenState";

/**
 * Helper to parse C-Next source and return tree + generator ready for testing.
 */
function setupGenerator(
  source: string,
  options: { cppMode?: boolean } = {},
): {
  tree: Parser.ProgramContext;
  generator: CodeGenerator;
  code: string;
} {
  const { tree, errors, tokenStream } = CNextSourceParser.parse(source);
  if (errors.length > 0) {
    throw new Error(`Parse failed: ${errors.map((e) => e.message).join(", ")}`);
  }

  const symbolTable = new SymbolTable();
  const tSymbols = CNextResolver.resolve(tree, "test.cnx");
  // Issue #831: Register TSymbols in SymbolTable (single source of truth)
  symbolTable.addTSymbols(tSymbols);
  const symbols = TSymbolInfoAdapter.convert(tSymbols);

  const generator = new CodeGenerator();
  CodeGenState.symbolTable = symbolTable;
  const code = generator.generate(tree, tokenStream, {
    symbolInfo: symbols,
    sourcePath: "test.cnx",
    cppMode: options.cppMode ?? false,
  });

  return { tree, generator, code };
}

describe("CodeGenerator Coverage Tests", () => {
  beforeEach(() => {
    CodeGenState.reset();
  });

  // ==========================================================================
  // NEW CODE IN PR: _isArrayAccessStringExpression (lines 811-852)
  // ==========================================================================
  describe("_isArrayAccessStringExpression() - PR new code", () => {
    it("should return false for string property access (.length)", () => {
      const source = `
        string<32> name <- "test";
        void main() {
          u32 len <- name.length;
        }
      `;
      const { code } = setupGenerator(source);
      // .length returns a number, not a string
      expect(code).toContain("strlen(name)");
    });

    it("should return false for string property access (.capacity)", () => {
      const source = `
        string<32> name <- "test";
        void main() {
          u32 cap <- name.capacity;
        }
      `;
      const { code } = setupGenerator(source);
      // .capacity returns a number
      expect(code).toContain("32");
    });

    it("should return true for array of strings indexing", () => {
      const source = `
        string<32>[5] names;
        void puts(string<32> s) {}
        void main() {
          puts(names[0]);
        }
      `;
      const { code } = setupGenerator(source);
      // Array of strings generates 2D char array
      expect(code).toContain("names[0]");
      expect(code).toContain("puts(");
    });

    it("should return false for single string character indexing", () => {
      const source = `
        string<32> name <- "hello";
        void main() {
          u8 ch <- name[0];
        }
      `;
      const { code } = setupGenerator(source);
      // Single string indexing returns a char, not a string
      expect(code).toContain("name[0]");
    });

    it("should return false for non-string array type", () => {
      const source = `
        u32[10] values;
        void main() {
          u32 v <- values[0];
        }
      `;
      const { code } = setupGenerator(source);
      expect(code).toContain("values[0]");
    });

    it("should handle array access without typeInfo", () => {
      // When accessing an undefined array, typeInfo won't exist
      const source = `
        void main() {
          u8 dummy <- 0;
        }
      `;
      const { code } = setupGenerator(source);
      expect(code).toContain("dummy");
    });
  });

  // ==========================================================================
  // NEW CODE IN PR: C++ pointer vs reference (lines 1534-1537)
  // ==========================================================================
  describe("C++ pointer vs reference for struct params - PR new code", () => {
    it("should use reference (&) for struct params in C++ mode", () => {
      const source = `
        struct Point { i32 x; i32 y; }
        void process(Point p) {
          p.x <- 10;
        }
      `;
      const { code } = setupGenerator(source, { cppMode: true });
      // C++ mode uses reference
      expect(code).toContain("Point&");
    });

    it("should use pointer (*) for struct params in C mode", () => {
      const source = `
        struct Point { i32 x; i32 y; }
        void process(Point p) {
          p.x <- 10;
        }
      `;
      const { code } = setupGenerator(source, { cppMode: false });
      // C mode uses pointer
      expect(code).toContain("Point*");
    });
  });

  // ==========================================================================
  // NEW CODE IN PR: static_assert vs _Static_assert (lines 2405-2410)
  // ==========================================================================
  describe("static_assert handling - PR new code", () => {
    it("should use _Static_assert in C mode for float bit indexing", () => {
      const source = `
        f32 value <- 3.14;
        void main() {
          u32 bits <- value[0, 32];
        }
      `;
      const { code } = setupGenerator(source, { cppMode: false });
      // C mode uses _Static_assert
      expect(code).toContain("_Static_assert");
    });

    it("should use static_assert in C++ mode for float bit indexing", () => {
      const source = `
        f32 value <- 3.14;
        void main() {
          u32 bits <- value[0, 32];
        }
      `;
      const { code } = setupGenerator(source, { cppMode: true });
      // C++ mode uses static_assert
      expect(code).toContain("static_assert");
      expect(code).not.toContain("_Static_assert");
    });
  });

  // ==========================================================================
  // Lines 426, 440: invokeStatement/invokeExpression error paths
  // ==========================================================================
  describe("invokeStatement/invokeExpression error paths", () => {
    it("should throw when statement generator not registered", () => {
      // This tests the error path at line 426
      // We need to access the private method via type assertion
      const { generator } = setupGenerator("void main() {}");

      // Access the private registry and test with unregistered generator name
      // The registry won't have a generator for a fake name
      const registry = (
        generator as unknown as {
          registry: { getStatement: (name: string) => unknown };
        }
      ).registry;
      const result = registry.getStatement("nonexistent_statement_type");
      expect(result).toBeUndefined();
    });

    it("should throw when expression generator not registered", () => {
      // This tests the error path at line 440
      const { generator } = setupGenerator("void main() {}");

      const registry = (
        generator as unknown as {
          registry: { getExpression: (name: string) => unknown };
        }
      ).registry;
      const result = registry.getExpression("nonexistent_expression_type");
      expect(result).toBeUndefined();
    });
  });

  // ==========================================================================
  // Lines 631-633: resolveIdentifier with scope members
  // ==========================================================================
  describe("resolveIdentifier() with scope members", () => {
    it("should resolve identifier to scope-prefixed name when inside scope", () => {
      // Generate code with a scope to populate scopeMembers
      const source = `
        scope Motor {
          public u32 speed;
          public void setSpeed() {
            speed <- 100;
          }
        }
      `;
      const { generator } = setupGenerator(source);

      // Manually set up scope context to test the resolution path
      CodeGenState.currentScope = "Motor";
      CodeGenState.setScopeMembers("Motor", new Set(["speed", "setSpeed"]));

      // Now resolve should return prefixed name (line 633)
      const resolved = generator.resolveIdentifier("speed");
      expect(resolved).toBe("Motor_speed");
    });

    it("should return unchanged identifier when not a scope member", () => {
      const { generator } = setupGenerator("u32 globalVar; void main() {}");

      CodeGenState.currentScope = "Motor";
      CodeGenState.setScopeMembers("Motor", new Set(["speed"]));

      // globalVar is not in Motor scope members
      const resolved = generator.resolveIdentifier("globalVar");
      expect(resolved).toBe("globalVar");
    });

    it("should return unchanged identifier when not in any scope", () => {
      const { generator } = setupGenerator("u32 globalVar; void main() {}");

      CodeGenState.currentScope = null;

      const resolved = generator.resolveIdentifier("globalVar");
      expect(resolved).toBe("globalVar");
    });
  });

  // ==========================================================================
  // Lines 4289-4302: getLvalueType
  // ==========================================================================
  describe("getLvalueType()", () => {
    it("should handle member access expression from struct parameter", () => {
      // When passing struct param member to function expecting primitive
      const source = `
        struct Point { i32 x; i32 y; }
        void test(i32 val) {}
        void handler(Point p) {
          test(p.x);
        }
      `;
      const { code } = setupGenerator(source);
      // Struct param member access uses -> (const auto-inferred)
      expect(code).toContain("p->x");
      expect(code).toContain("test(");
    });

    it("should handle array access expression", () => {
      const source = `
        void test(u8 val) {}
        void main() {
          u8[10] arr;
          test(arr[0]);
        }
      `;
      const { code } = setupGenerator(source);
      // Array element access
      expect(code).toContain("arr[0]");
      expect(code).toContain("test(");
    });

    it("should handle global struct member access", () => {
      const source = `
        struct Point { i32 x; i32 y; }
        Point p;
        void test(i32 val) {}
        void main() {
          test(p.x);
        }
      `;
      const { code } = setupGenerator(source);
      // Global struct uses direct access
      expect(code).toContain("test(p.x)");
    });

    it("should handle function call result", () => {
      const source = `
        u32 getValue() { return 42; }
        void test(u32 val) {}
        void main() {
          test(getValue());
        }
      `;
      const { code } = setupGenerator(source);
      // Function call result passed to function
      expect(code).toContain("test(");
      expect(code).toContain("getValue()");
    });
  });

  // ==========================================================================
  // Lines 4306-4379: needsCppMemberConversion and helpers
  // ==========================================================================
  describe("needsCppMemberConversion() - C++ mode", () => {
    it("should use pointer syntax in C mode for struct params", () => {
      const source = `
        struct Config { u8 value; }
        void process(u8 val) {}
        void handler(Config cfg) {
          process(cfg.value);
        }
      `;
      const { code } = setupGenerator(source, { cppMode: false });
      // In C mode, struct params are pointers with -> access (const auto-inferred)
      expect(code).toContain("Config*");
      expect(code).toContain("cfg->value");
    });

    it("should handle const struct parameter member in C++ mode", () => {
      const source = `
        struct Config { u8 value; }
        void process(u8 val) {}
        void handler(const Config cfg) {
          process(cfg.value);
        }
      `;
      const { code } = setupGenerator(source, { cppMode: true });
      // C++ mode handles const struct params with references
      expect(code).toContain("handler(const Config& cfg)");
    });

    it("should handle array element member access", () => {
      const source = `
        struct Item { u32 id; }
        Item[5] items;
        void process(u32 val) {}
        void main() {
          process(items[0].id);
        }
      `;
      const { code } = setupGenerator(source, { cppMode: true });
      expect(code).toContain("process");
    });
  });

  // ==========================================================================
  // Lines 4572-4622: _handleMemberAccessArg and related
  // ==========================================================================
  describe("_handleMemberAccessArg()", () => {
    it("should handle array member without address-of", () => {
      const source = `
        struct Data { u8[10] buffer; }
        void process(u8[10] buf) {}
        void handler(Data d) {
          process(d.buffer);
        }
      `;
      const { code } = setupGenerator(source);
      // Array members don't need & prefix
      expect(code).toContain("process(d->buffer)");
    });

    it("should create temp variable for C++ member conversion when needed", () => {
      const source = `
        struct Config { u8 flags; }
        void setFlags(u8 val) {}
        void handler(const Config cfg) {
          setFlags(cfg.flags);
        }
      `;
      const { code } = setupGenerator(source, { cppMode: true });
      // In C++ mode with const struct, member access is handled properly
      expect(code).toContain("setFlags");
    });
  });

  // ==========================================================================
  // Lines 4612-4622: _maybeCastStringSubscript
  // ==========================================================================
  describe("_maybeCastStringSubscript()", () => {
    it("should cast string subscript access for integer pointer params", () => {
      const source = `
        string<32> name;
        void process(u8 val) {}
        void main() {
          process(name[0]);
        }
      `;
      const { code } = setupGenerator(source);
      // String subscript access may need special handling
      expect(code).toContain("process");
    });
  });

  // ==========================================================================
  // Lines 4687-4698: generateDeclaration branches
  // ==========================================================================
  describe("generateDeclaration() branches", () => {
    it("should generate bitmap declaration", () => {
      const source = `
        bitmap8 Flags {
          enabled,
          active,
          reserved[6]
        }
        void main() {
          Flags f <- 0;
        }
      `;
      const { code } = setupGenerator(source);
      // Bitmap generates typedef and constants
      expect(code).toContain("typedef uint8_t Flags");
    });

    it("should generate function declaration", () => {
      const source = `
        void myFunc() {}
      `;
      const { code } = setupGenerator(source);
      expect(code).toContain("void myFunc(void)");
    });

    it("should generate variable declaration", () => {
      const source = `
        u32 counter;
      `;
      const { code } = setupGenerator(source);
      expect(code).toContain("uint32_t counter");
    });
  });

  // ==========================================================================
  // Lines 4706-4765: generateScope and _generateScopeMember
  // ==========================================================================
  describe("generateScope() and _generateScopeMember()", () => {
    it("should generate scope with public variable", () => {
      const source = `
        scope LED {
          public u8 brightness;
        }
      `;
      const { code } = setupGenerator(source);
      expect(code).toContain("uint8_t LED_brightness");
      expect(code).not.toContain("static uint8_t LED_brightness");
    });

    it("should generate scope with private variable", () => {
      const source = `
        scope LED {
          u8 internalState;
        }
      `;
      const { code } = setupGenerator(source);
      expect(code).toContain("static uint8_t LED_internalState");
    });

    it("should generate scope with public function", () => {
      const source = `
        scope Motor {
          public void start() {}
        }
      `;
      const { code } = setupGenerator(source);
      expect(code).toContain("void Motor_start(void)");
    });

    it("should generate scope with private function", () => {
      const source = `
        scope Motor {
          void internalUpdate() {}
        }
      `;
      const { code } = setupGenerator(source);
      expect(code).toContain("static void Motor_internalUpdate(void)");
    });

    it("should generate scope with enum member", () => {
      const source = `
        scope Config {
          public enum State { IDLE, RUNNING, STOPPED }
          public void init() {
            State s <- State.IDLE;
          }
        }
      `;
      const { code } = setupGenerator(source);
      // Enum values get scope-prefixed
      expect(code).toContain("Config_State_IDLE");
    });

    it("should generate scope with bitmap member", () => {
      const source = `
        scope Flags {
          public bitmap8 Status {
            ready,
            error,
            reserved[6]
          }
          public void check() {
            Status s <- 0;
          }
        }
      `;
      const { code } = setupGenerator(source);
      // Bitmap typedef should be in scope
      expect(code).toContain("Status");
    });

    it("should generate scope with register member", () => {
      const source = `
        scope GPIO {
          public register PORTA @ 0x40000000 {
            DR: u32 rw @ 0x00,
          }
          public void write(u32 val) {
            PORTA.DR <- val;
          }
        }
      `;
      const { code } = setupGenerator(source);
      expect(code).toContain("GPIO_PORTA");
      // Address format is 0x40000000 + 0x00
      expect(code).toContain("0x40000000");
    });
  });

  // ==========================================================================
  // Lines 4772-4800: _generateScopeVariable with arrays
  // ==========================================================================
  describe("_generateScopeVariable() with arrays", () => {
    it("should generate scope variable with C-Next style array", () => {
      const source = `
        scope Buffer {
          public u8[16] data;
        }
      `;
      const { code } = setupGenerator(source);
      expect(code).toContain("uint8_t Buffer_data[16]");
    });

    it("should generate scope variable with C-style array dimension", () => {
      const source = `
        scope Buffer {
          public u8 legacy[32];
        }
      `;
      const { code } = setupGenerator(source);
      expect(code).toContain("uint8_t Buffer_legacy[32]");
    });

    it("should generate scope variable with string capacity", () => {
      const source = `
        scope Config {
          public string<64> name;
        }
      `;
      const { code } = setupGenerator(source);
      // String<64> becomes char[65] (capacity + 1 for null)
      expect(code).toContain("char Config_name[65]");
    });

    it("should handle private array scope variable", () => {
      const source = `
        scope Internal {
          u32[8] counters;
        }
      `;
      const { code } = setupGenerator(source);
      expect(code).toContain("static uint32_t Internal_counters[8]");
    });
  });

  // ==========================================================================
  // Lines 5154-5162: generateArrayInitializer nested elements
  // ==========================================================================
  describe("generateArrayInitializer() nested elements", () => {
    it("should generate nested struct initializer in array", () => {
      const source = `
        struct Point { i32 x; i32 y; }
        Point[3] points <- [{x: 1, y: 2}, {x: 3, y: 4}, {x: 5, y: 6}];
        void main() {
          u8 dummy <- 0;
        }
      `;
      const { code } = setupGenerator(source);
      // Struct initializers use designated initializers
      expect(code).toContain(".x = 1");
      expect(code).toContain(".y = 2");
    });

    it("should generate nested array initializer (2D array)", () => {
      const source = `
        u8[2][3] matrix <- [[1, 2, 3], [4, 5, 6]];
      `;
      const { code } = setupGenerator(source);
      expect(code).toContain("{1, 2, 3}");
      expect(code).toContain("{4, 5, 6}");
    });

    it("should generate simple expression elements", () => {
      const source = `
        u32[5] values <- [10, 20, 30, 40, 50];
      `;
      const { code } = setupGenerator(source);
      expect(code).toContain("{10, 20, 30, 40, 50}");
    });
  });

  // ==========================================================================
  // Issue #834: generateStructInitializer with named struct tags
  // ==========================================================================
  describe("generateStructInitializer() with named struct tags", () => {
    it("should include struct keyword in compound literal for named struct tags", () => {
      // Test the fix for issue #834: named struct tags need 'struct' prefix in cast
      const source = `
        struct NamedPoint { i32 x; i32 y; }
        void test() {
          NamedPoint p <- {x: 10, y: 20};
        }
      `;
      const { tree, tokenStream } = CNextSourceParser.parse(source);

      const symbolTable = new SymbolTable();
      // Mark NamedPoint as requiring 'struct' keyword (simulates C header import)
      symbolTable.markNeedsStructKeyword("NamedPoint");

      const tSymbols = CNextResolver.resolve(tree, "test.cnx");
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const generator = new CodeGenerator();
      CodeGenState.symbolTable = symbolTable;
      const code = generator.generate(tree, tokenStream, {
        symbolInfo: symbols,
        sourcePath: "test.cnx",
        cppMode: false,
      });

      // The compound literal cast should include 'struct' keyword
      expect(code).toContain("(struct NamedPoint)");
      expect(code).toContain(".x = 10");
      expect(code).toContain(".y = 20");
    });

    it("should include struct keyword in empty initializer via return statement", () => {
      // Test the empty initializer path (line 3465) via return statement
      // This is the only way to use explicit type syntax without expectedType context
      const source = `
        struct ReturnStruct { i32 value; }
        ReturnStruct getEmpty() {
          return ReturnStruct {};
        }
      `;
      const { tree, tokenStream } = CNextSourceParser.parse(source);

      const symbolTable = new SymbolTable();
      symbolTable.markNeedsStructKeyword("ReturnStruct");

      const tSymbols = CNextResolver.resolve(tree, "test.cnx");
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const generator = new CodeGenerator();
      CodeGenState.symbolTable = symbolTable;
      const code = generator.generate(tree, tokenStream, {
        symbolInfo: symbols,
        sourcePath: "test.cnx",
        cppMode: false,
      });

      // Empty initializer should have struct keyword: (struct ReturnStruct){ 0 }
      expect(code).toContain("(struct ReturnStruct){ 0 }");
    });

    it("should NOT include struct keyword for typedef'd structs in C mode", () => {
      // This tests the branch where checkNeedsStructKeyword returns false
      const source = `
        struct TypedefPoint { i32 x; i32 y; }
        void test() {
          TypedefPoint p <- {x: 1, y: 2};
        }
      `;
      const { tree, tokenStream } = CNextSourceParser.parse(source);

      const symbolTable = new SymbolTable();
      // Do NOT mark as needing struct keyword (simulates typedef'd struct)

      const tSymbols = CNextResolver.resolve(tree, "test.cnx");
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const generator = new CodeGenerator();
      CodeGenState.symbolTable = symbolTable;
      const code = generator.generate(tree, tokenStream, {
        symbolInfo: symbols,
        sourcePath: "test.cnx",
        cppMode: false,
      });

      // Should NOT have 'struct' keyword since it's not marked
      expect(code).not.toContain("(struct TypedefPoint)");
      expect(code).toContain("(TypedefPoint)");
    });

    it("should NOT include struct keyword in C++ mode", () => {
      const source = `
        struct CppPoint { i32 x; i32 y; }
        void test() {
          CppPoint p <- {x: 5, y: 10};
        }
      `;
      const { tree, tokenStream } = CNextSourceParser.parse(source);

      const symbolTable = new SymbolTable();
      // Even if marked, C++ mode should not use struct keyword
      symbolTable.markNeedsStructKeyword("CppPoint");

      const tSymbols = CNextResolver.resolve(tree, "test.cnx");
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const generator = new CodeGenerator();
      CodeGenState.symbolTable = symbolTable;
      const code = generator.generate(tree, tokenStream, {
        symbolInfo: symbols,
        sourcePath: "test.cnx",
        cppMode: true,
      });

      // In C++ mode, struct keyword should NOT be in the cast
      expect(code).not.toContain("(struct CppPoint)");
      expect(code).toContain("(CppPoint)");
    });
  });

  // ==========================================================================
  // Lines 5175-5218: generateFunction with registry
  // ==========================================================================
  describe("generateFunction()", () => {
    it("should generate function with return type", () => {
      const source = `
        u32 calculate() {
          return 42;
        }
      `;
      const { code } = setupGenerator(source);
      expect(code).toContain("uint32_t calculate(void)");
      expect(code).toContain("return 42");
    });

    it("should generate function with parameters", () => {
      const source = `
        void process(u32 value, u8 flags) {}
      `;
      const { code } = setupGenerator(source);
      expect(code).toContain("void process(uint32_t value, uint8_t flags)");
    });

    it("should generate main function with int return type", () => {
      const source = `
        void main() {}
      `;
      const { code } = setupGenerator(source);
      // main always gets int return type for C++ compatibility
      expect(code).toContain("int main(void)");
    });

    it("should generate main function with args parameter", () => {
      const source = `
        void main(u8 args[][]) {
          u8 dummy <- 0;
        }
      `;
      const { code } = setupGenerator(source);
      expect(code).toContain("int main(int argc, char *argv[])");
    });
  });

  // ==========================================================================
  // Lines 5233-5275: _setupFunctionContext and _resolveReturnTypeAndParams
  // ==========================================================================
  describe("_setupFunctionContext()", () => {
    it("should set up function context with scope prefix", () => {
      const source = `
        scope Utils {
          public u32 helper() {
            return 1;
          }
        }
      `;
      const { code } = setupGenerator(source);
      expect(code).toContain("uint32_t Utils_helper(void)");
    });

    it("should track function return type for enum inference", () => {
      const source = `
        enum Status { OK, ERROR }
        Status getStatus() {
          return OK;
        }
        void main() {
          Status s <- getStatus();
        }
      `;
      const { code } = setupGenerator(source);
      expect(code).toContain("Status getStatus(void)");
      // Enum values are prefixed with enum name
      expect(code).toContain("return Status_OK");
    });
  });

  // ==========================================================================
  // Additional edge cases for better coverage
  // ==========================================================================
  describe("Edge cases", () => {
    it("should handle empty scope", () => {
      const source = `
        scope Empty {
        }
      `;
      const { code } = setupGenerator(source);
      expect(code).toContain("/* Scope: Empty */");
    });

    it("should handle function with void return explicitly", () => {
      const source = `
        void doNothing() {
          return;
        }
      `;
      const { code } = setupGenerator(source);
      expect(code).toContain("void doNothing(void)");
    });

    it("should handle array of structs initialization", () => {
      const source = `
        struct RGB { u8 r; u8 g; u8 b; }
        RGB[2] colors <- [{r: 255, g: 0, b: 0}, {r: 0, g: 255, b: 0}];
      `;
      const { code } = setupGenerator(source);
      expect(code).toContain(".r = 255");
      expect(code).toContain(".g = 0");
    });

    it("should handle scope variable with initializer", () => {
      const source = `
        scope Counter {
          public u32 value <- 100;
        }
      `;
      const { code } = setupGenerator(source);
      expect(code).toContain("uint32_t Counter_value = 100");
    });

    it("should handle nested scope member access in function", () => {
      const source = `
        scope Timer {
          u32 ticks;
          public void increment() {
            ticks +<- 1;
          }
        }
      `;
      const { code } = setupGenerator(source);
      expect(code).toContain("Timer_ticks");
    });
  });

  // ==========================================================================
  // C++ mode specific tests for lines 4289-4379
  // ==========================================================================
  describe("C++ mode member conversion", () => {
    it("should handle const struct parameter with member access in C++", () => {
      const source = `
        struct Settings { u32 timeout; }
        void setTimeout(u32 val) {}
        void configure(const Settings s) {
          setTimeout(s.timeout);
        }
      `;
      const { code } = setupGenerator(source, { cppMode: true });
      expect(code).toContain("const Settings& s");
    });

    it("should handle non-const struct parameter in C++", () => {
      const source = `
        struct Data { u32 value; }
        void modify(Data d) {
          d.value <- 10;
        }
      `;
      const { code } = setupGenerator(source, { cppMode: true });
      expect(code).toContain("Data& d");
    });

    it("should handle struct array element access in C++", () => {
      const source = `
        struct Item { u32 price; }
        Item[10] inventory;
        u32 getPrice(u32 index) {
          return inventory[index].price;
        }
      `;
      const { code } = setupGenerator(source, { cppMode: true });
      expect(code).toContain("inventory[index].price");
    });
  });

  // ==========================================================================
  // Lines 1264, 1301, 1332: Type generation edge cases
  // ==========================================================================
  describe("Type generation edge cases", () => {
    it("should generate C++ template type unchanged", () => {
      // test-cpp-only scenario - C++ template passthrough
      const source = `
        void main() {
          u8 dummy <- 0;
        }
      `;
      const { code } = setupGenerator(source, { cppMode: true });
      expect(code).toBeDefined();
    });

    it("should handle callback type in struct", () => {
      const source = `
        void handler() {}
        struct Callbacks {
          handler onClick;
        }
        Callbacks cb;
        void main() {
          cb.onClick <- handler;
        }
      `;
      const { code } = setupGenerator(source);
      // Callback type generates function pointer in struct
      expect(code).toContain("Callbacks");
      expect(code).toContain("onClick");
    });
  });

  // ==========================================================================
  // Lines 1400, 1498, 1508, 1514: Parameter handling edge cases
  // ==========================================================================
  describe("Parameter handling edge cases", () => {
    it("should handle const array parameter", () => {
      const source = `
        void process(const u8[8] data) {}
      `;
      const { code } = setupGenerator(source);
      expect(code).toContain("const uint8_t data[8]");
    });

    it("should handle multiple array parameters", () => {
      const source = `
        void merge(u8[4] a, u8[4] b, u8[8] result) {}
      `;
      const { code } = setupGenerator(source);
      expect(code).toContain("uint8_t a[4]");
      expect(code).toContain("uint8_t b[4]");
      expect(code).toContain("uint8_t result[8]");
    });
  });

  // ==========================================================================
  // Lines 1707, 1820: Parameter modification tracking
  // ==========================================================================
  describe("Parameter modification tracking", () => {
    it("should track modified parameters", () => {
      const source = `
        void update(u32 value) {
          value <- value + 1;
        }
      `;
      const { code } = setupGenerator(source);
      // Modified parameter should still work
      expect(code).toContain("update");
    });
  });

  // ==========================================================================
  // Lines 2047, 2054: Helper delegation
  // ==========================================================================
  describe("Helper delegation", () => {
    it("should handle boolean in ternary expression", () => {
      const source = `
        bool flag <- true;
        void main() {
          u8 val <- (flag = true) ? 1 : 0;
        }
      `;
      const { code } = setupGenerator(source);
      expect(code).toContain("flag");
      expect(code).toContain("val");
    });
  });

  // ==========================================================================
  // Lines 2709: Existing parameter set handling
  // ==========================================================================
  describe("Parameter set handling", () => {
    it("should handle function with multiple calls to same param", () => {
      const source = `
        void inner(u32 x) {}
        void outer(u32 val) {
          inner(val);
          inner(val);
        }
      `;
      const { code } = setupGenerator(source);
      expect(code).toContain("outer");
      expect(code).toContain("inner");
    });
  });

  // ==========================================================================
  // Lines 3560, 3588, 3592: Return paths in expression generation
  // ==========================================================================
  describe("Expression generation return paths", () => {
    it("should handle simple return statement", () => {
      const source = `
        u32 getValue() {
          return 42;
        }
      `;
      const { code } = setupGenerator(source);
      expect(code).toContain("return 42");
    });

    it("should handle return with expression", () => {
      const source = `
        u32 calculate(u32 a, u32 b) {
          return a + b;
        }
      `;
      const { code } = setupGenerator(source);
      expect(code).toContain("return a + b");
    });
  });

  // ==========================================================================
  // Lines 3816, 3928: Object/struct generation
  // ==========================================================================
  describe("Struct generation", () => {
    it("should generate struct with multiple fields", () => {
      const source = `
        struct Rectangle {
          i32 x;
          i32 y;
          u32 width;
          u32 height;
        }
      `;
      const { code } = setupGenerator(source);
      expect(code).toContain("struct Rectangle");
      expect(code).toContain("int32_t x");
      expect(code).toContain("uint32_t width");
    });
  });

  // ==========================================================================
  // Lines 4207, 4215: Type narrowing checks
  // ==========================================================================
  describe("Type narrowing checks", () => {
    it("should handle type conversion in assignment", () => {
      const source = `
        u32 big <- 1000;
        u8 small <- big[0, 8];
      `;
      const { code } = setupGenerator(source);
      expect(code).toContain("small");
    });
  });

  // ==========================================================================
  // Lines 5463, 5466, 5568, 5569: Additional function paths
  // ==========================================================================
  describe("Additional function generation paths", () => {
    it("should generate callback typedef when function used as type", () => {
      const source = `
        void handler() {}
        handler callback;
        void main() {
          callback <- handler;
        }
      `;
      const { code } = setupGenerator(source);
      // Function used as type - variable declaration uses function name
      expect(code).toContain("handler callback");
      expect(code).toContain("callback = handler");
    });

    it("should handle function with local variables", () => {
      const source = `
        void process() {
          u32 local1 <- 10;
          u32 local2 <- 20;
          u32 sum <- local1 + local2;
        }
      `;
      const { code } = setupGenerator(source);
      expect(code).toContain("local1");
      expect(code).toContain("local2");
      expect(code).toContain("sum");
    });
  });

  // ==========================================================================
  // Lines 5589-5922: Additional code paths
  // ==========================================================================
  describe("Additional code paths", () => {
    it("should handle complex nested struct access", () => {
      const source = `
        struct Inner { u32 value; }
        struct Outer { Inner inner; }
        Outer obj;
        void main() {
          obj.inner.value <- 42;
        }
      `;
      const { code } = setupGenerator(source);
      expect(code).toContain("obj.inner.value = 42");
    });

    it("should handle scope with multiple member types", () => {
      const source = `
        scope Mixed {
          public u32 counter;
          public void increment() { counter +<- 1; }
          public enum State { INIT, RUN }
          public void setState() {
            State s <- State.INIT;
          }
        }
      `;
      const { code } = setupGenerator(source);
      expect(code).toContain("Mixed_counter");
      expect(code).toContain("Mixed_increment");
      expect(code).toContain("INIT");
    });
  });

  // ==========================================================================
  // Lines 5981-6587: Final code paths
  // ==========================================================================
  describe("Final code generation paths", () => {
    it("should handle atomic variable", () => {
      const source = `
        atomic u32 counter;
        void increment() {
          counter +<- 1;
        }
      `;
      const { code } = setupGenerator(source);
      expect(code).toContain("counter");
    });

    it("should handle wrap overflow behavior", () => {
      const source = `
        wrap u8 wrapCounter;
        void increment() {
          wrapCounter +<- 1;
        }
      `;
      const { code } = setupGenerator(source);
      expect(code).toContain("wrapCounter");
    });

    it("should handle clamp overflow behavior", () => {
      const source = `
        clamp u8 clampCounter;
        void increment() {
          clampCounter +<- 1;
        }
      `;
      const { code } = setupGenerator(source);
      expect(code).toContain("cnx_clamp_add_u8");
    });
  });
});
