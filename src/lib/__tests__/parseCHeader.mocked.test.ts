/**
 * Unit tests for parseCHeader edge cases requiring mocks
 * Separate file to avoid mock pollution with main test file
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Create mock collect function that we can control per test
const mockCollect = vi.fn();

// Mock CSymbolCollector before importing parseCHeader
vi.mock("../../transpiler/logic/symbols/CSymbolCollector", () => {
  return {
    default: class MockCSymbolCollector {
      collect() {
        return mockCollect();
      }
    },
  };
});

// Import after mock is set up
import parseCHeader from "../parseCHeader";

describe("parseCHeader mocked scenarios", () => {
  beforeEach(() => {
    mockCollect.mockReset();
    // Default to returning empty array
    mockCollect.mockReturnValue([]);
  });

  describe("mapSymbolKind default case", () => {
    it("maps Namespace kind to variable (default case)", () => {
      // Return a symbol with Namespace kind (not explicitly handled in switch)
      mockCollect.mockReturnValue([
        {
          name: "TestNamespace",
          kind: "namespace",
          type: undefined,
          parent: undefined,
          sourceLine: 1,
        },
      ]);

      const result = parseCHeader("// any valid C");

      expect(result.success).toBe(true);
      expect(result.symbols).toHaveLength(1);
      expect(result.symbols[0].kind).toBe("variable");
      expect(result.symbols[0].name).toBe("TestNamespace");
    });

    it("maps Class kind to variable (default case)", () => {
      mockCollect.mockReturnValue([
        {
          name: "TestClass",
          kind: "class",
          type: "class",
          parent: undefined,
          sourceLine: 5,
        },
      ]);

      const result = parseCHeader("// any valid C");

      expect(result.success).toBe(true);
      expect(result.symbols[0].kind).toBe("variable");
    });

    it("maps Bitmap kind to variable (default case)", () => {
      mockCollect.mockReturnValue([
        {
          name: "TestBitmap",
          kind: "bitmap",
          type: undefined,
          parent: undefined,
          sourceLine: 1,
        },
      ]);

      const result = parseCHeader("// any valid C");

      expect(result.success).toBe(true);
      expect(result.symbols[0].kind).toBe("variable");
    });

    it("defaults line to 0 when sourceLine is undefined", () => {
      mockCollect.mockReturnValue([
        {
          name: "NoLineSymbol",
          kind: "function",
          type: "void",
          parent: undefined,
          sourceLine: undefined, // No source line info
        },
      ]);

      const result = parseCHeader("// any valid C");

      expect(result.success).toBe(true);
      expect(result.symbols[0].line).toBe(0);
    });
  });

  describe("error handling catch block", () => {
    it("returns error result when collector throws Error", () => {
      mockCollect.mockImplementation(() => {
        throw new Error("Collector failed");
      });

      const result = parseCHeader("int x;");

      expect(result.success).toBe(false);
      expect(result.symbols).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe("Collector failed");
      expect(result.errors[0].severity).toBe("error");
      expect(result.errors[0].line).toBe(1);
      expect(result.errors[0].column).toBe(0);
    });

    it("handles non-Error exceptions (string throw)", () => {
      mockCollect.mockImplementation(() => {
        throw "String error message";
      });

      const result = parseCHeader("int x;");

      expect(result.success).toBe(false);
      expect(result.errors[0].message).toBe("String error message");
    });

    it("handles non-Error exceptions (number throw)", () => {
      mockCollect.mockImplementation(() => {
        throw 42;
      });

      const result = parseCHeader("int x;");

      expect(result.success).toBe(false);
      expect(result.errors[0].message).toBe("42");
    });
  });
});
