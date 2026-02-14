/**
 * Unit tests for parseCHeader edge cases requiring mocks
 * Separate file to avoid mock pollution with main test file
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Create mock resolve function that we can control per test
const mockResolve = vi.fn();

// Mock CResolver before importing parseCHeader
vi.mock("../../transpiler/logic/symbols/c", () => {
  return {
    default: {
      resolve: () => mockResolve(),
    },
  };
});

// Import after mock is set up
import parseCHeader from "../parseCHeader";

describe("parseCHeader mocked scenarios", () => {
  beforeEach(() => {
    mockResolve.mockReset();
    // Default to returning empty result
    mockResolve.mockReturnValue({ symbols: [], warnings: [] });
  });

  describe("mapSymbolKind default case", () => {
    it("maps Namespace kind to variable (default case)", () => {
      // Return a symbol with Namespace kind (not explicitly handled in switch)
      // Use TCSymbol format which then gets converted by CTSymbolAdapter
      mockResolve.mockReturnValue({
        symbols: [
          {
            name: "TestNamespace",
            kind: "namespace",
            sourceFile: "<header>",
            sourceLine: 1,
            sourceLanguage: 0,
            isExported: true,
          },
        ],
        warnings: [],
      });

      const result = parseCHeader("// any valid C");

      expect(result.success).toBe(true);
      expect(result.symbols).toHaveLength(1);
      expect(result.symbols[0].kind).toBe("variable");
      expect(result.symbols[0].name).toBe("TestNamespace");
    });

    it("maps Class kind to variable (default case)", () => {
      mockResolve.mockReturnValue({
        symbols: [
          {
            name: "TestClass",
            kind: "class",
            sourceFile: "<header>",
            sourceLine: 5,
            sourceLanguage: 0,
            isExported: true,
          },
        ],
        warnings: [],
      });

      const result = parseCHeader("// any valid C");

      expect(result.success).toBe(true);
      expect(result.symbols[0].kind).toBe("variable");
    });

    it("maps Bitmap kind to variable (default case)", () => {
      mockResolve.mockReturnValue({
        symbols: [
          {
            name: "TestBitmap",
            kind: "bitmap",
            sourceFile: "<header>",
            sourceLine: 1,
            sourceLanguage: 0,
            isExported: true,
          },
        ],
        warnings: [],
      });

      const result = parseCHeader("// any valid C");

      expect(result.success).toBe(true);
      expect(result.symbols[0].kind).toBe("variable");
    });

    it("defaults line to 0 when sourceLine is undefined", () => {
      mockResolve.mockReturnValue({
        symbols: [
          {
            name: "NoLineSymbol",
            kind: "function",
            type: "void",
            sourceFile: "<header>",
            sourceLine: undefined,
            sourceLanguage: 0,
            isExported: true,
          },
        ],
        warnings: [],
      });

      const result = parseCHeader("// any valid C");

      expect(result.success).toBe(true);
      expect(result.symbols[0].line).toBe(0);
    });
  });

  describe("error handling catch block", () => {
    it("returns error result when resolver throws Error", () => {
      mockResolve.mockImplementation(() => {
        throw new Error("Resolver failed");
      });

      const result = parseCHeader("int x;");

      expect(result.success).toBe(false);
      expect(result.symbols).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe("Resolver failed");
      expect(result.errors[0].severity).toBe("error");
      expect(result.errors[0].line).toBe(1);
      expect(result.errors[0].column).toBe(0);
    });

    it("handles non-Error exceptions (string throw)", () => {
      mockResolve.mockImplementation(() => {
        throw "String error message";
      });

      const result = parseCHeader("int x;");

      expect(result.success).toBe(false);
      expect(result.errors[0].message).toBe("String error message");
    });

    it("handles non-Error exceptions (number throw)", () => {
      mockResolve.mockImplementation(() => {
        throw 42;
      });

      const result = parseCHeader("int x;");

      expect(result.success).toBe(false);
      expect(result.errors[0].message).toBe("42");
    });
  });
});
