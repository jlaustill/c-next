/**
 * Unit tests for parseCHeader
 */

import { describe, it, expect } from "vitest";
import parseCHeader from "../parseCHeader";

describe("parseCHeader", () => {
  describe("function declarations", () => {
    it("parses function prototypes", () => {
      const result = parseCHeader("int myFunction(void);");

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.symbols).toContainEqual(
        expect.objectContaining({
          name: "myFunction",
          kind: "function",
        }),
      );
    });

    it("parses function with parameters", () => {
      const result = parseCHeader("void process(int value, char* name);");

      expect(result.success).toBe(true);
      expect(result.symbols).toContainEqual(
        expect.objectContaining({
          name: "process",
          kind: "function",
        }),
      );
    });

    it("parses function definitions", () => {
      const result = parseCHeader("int add(int a, int b) { return a + b; }");

      expect(result.success).toBe(true);
      expect(result.symbols).toContainEqual(
        expect.objectContaining({
          name: "add",
          kind: "function",
          type: "int",
        }),
      );
    });
  });

  describe("struct definitions", () => {
    it("parses typedef struct", () => {
      const result = parseCHeader("typedef struct { int x; int y; } Point;");

      expect(result.success).toBe(true);
      expect(result.symbols).toContainEqual(
        expect.objectContaining({
          name: "Point",
          kind: "struct",
        }),
      );
    });

    it("parses named struct", () => {
      const result = parseCHeader("struct Config { int value; };");

      expect(result.success).toBe(true);
      expect(result.symbols).toContainEqual(
        expect.objectContaining({
          name: "Config",
          kind: "struct",
        }),
      );
    });
  });

  describe("enum definitions", () => {
    it("parses enum with members", () => {
      const result = parseCHeader("enum Status { OK, ERROR, PENDING };");

      expect(result.success).toBe(true);
      expect(result.symbols).toContainEqual(
        expect.objectContaining({
          name: "Status",
          kind: "enum",
        }),
      );
      expect(result.symbols).toContainEqual(
        expect.objectContaining({
          name: "OK",
          kind: "enumMember",
        }),
      );
    });
  });

  describe("variable declarations", () => {
    it("parses extern variable", () => {
      const result = parseCHeader("extern int globalCounter;");

      expect(result.success).toBe(true);
      expect(result.symbols).toContainEqual(
        expect.objectContaining({
          name: "globalCounter",
          kind: "variable",
        }),
      );
    });
  });

  describe("typedef declarations", () => {
    it("parses simple typedef", () => {
      const result = parseCHeader("typedef unsigned int uint32;");

      expect(result.success).toBe(true);
      expect(result.symbols).toContainEqual(
        expect.objectContaining({
          name: "uint32",
          kind: "type",
        }),
      );
    });
  });

  describe("file path tracking", () => {
    it("includes file path in symbols when provided", () => {
      const result = parseCHeader("int foo(void);", "/path/to/header.h");

      expect(result.success).toBe(true);
      expect(result.symbols[0].sourceFile).toBe("/path/to/header.h");
    });

    it("omits file path when not provided", () => {
      const result = parseCHeader("int bar(void);");

      expect(result.success).toBe(true);
      // sourceFile is undefined when not provided
      expect(result.symbols[0].sourceFile).toBeUndefined();
    });
  });

  describe("multiple symbols", () => {
    it("parses header with multiple symbol types", () => {
      const source = `
        typedef struct { int x; } Point;
        enum Status { OK, ERROR };
        extern int counter;
        void init(void);
      `;
      const result = parseCHeader(source);

      expect(result.success).toBe(true);
      expect(result.symbols.length).toBeGreaterThanOrEqual(4);
      expect(result.symbols.map((s) => s.kind)).toContain("struct");
      expect(result.symbols.map((s) => s.kind)).toContain("enum");
      expect(result.symbols.map((s) => s.kind)).toContain("variable");
      expect(result.symbols.map((s) => s.kind)).toContain("function");
    });
  });

  describe("edge cases", () => {
    it("handles empty source", () => {
      const result = parseCHeader("");

      expect(result.success).toBe(true);
      expect(result.symbols).toHaveLength(0);
    });

    it("handles whitespace-only source", () => {
      const result = parseCHeader("   \n\t  \n  ");

      expect(result.success).toBe(true);
      expect(result.symbols).toHaveLength(0);
    });

    it("handles malformed C syntax gracefully", () => {
      // This should not throw, just return empty or partial results
      const result = parseCHeader("this is not valid C code @#$%");

      // Should not throw, result structure should be valid
      expect(result).toHaveProperty("success");
      expect(result).toHaveProperty("symbols");
      expect(result).toHaveProperty("errors");
    });
  });

  describe("symbol fullName", () => {
    it("includes parent in fullName for enum members", () => {
      const result = parseCHeader("enum Color { RED, GREEN, BLUE };");

      const redSymbol = result.symbols.find((s) => s.name === "RED");
      expect(redSymbol?.fullName).toBe("Color.RED");
      expect(redSymbol?.parent).toBe("Color");
    });
  });
});
