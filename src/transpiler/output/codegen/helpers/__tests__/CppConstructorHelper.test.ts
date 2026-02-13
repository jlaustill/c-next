import { describe, it, expect } from "vitest";
import CppConstructorHelper from "../CppConstructorHelper.js";

describe("CppConstructorHelper", () => {
  describe("toQualifiedName", () => {
    it("converts underscore format to :: notation", () => {
      expect(CppConstructorHelper.toQualifiedName("TestNS_MyClass")).toBe(
        "TestNS::MyClass",
      );
    });

    it("handles multiple underscores", () => {
      expect(CppConstructorHelper.toQualifiedName("Outer_Inner_MyClass")).toBe(
        "Outer::Inner::MyClass",
      );
    });

    it("leaves :: notation unchanged", () => {
      expect(CppConstructorHelper.toQualifiedName("TestNS::MyClass")).toBe(
        "TestNS::MyClass",
      );
    });

    it("leaves simple names unchanged", () => {
      expect(CppConstructorHelper.toQualifiedName("MyClass")).toBe("MyClass");
    });

    it("does not convert if :: already present", () => {
      expect(CppConstructorHelper.toQualifiedName("Test_NS::MyClass")).toBe(
        "Test_NS::MyClass",
      );
    });
  });

  describe("extractClassName", () => {
    it("extracts class name from qualified name", () => {
      expect(CppConstructorHelper.extractClassName("TestNS::MyClass")).toBe(
        "MyClass",
      );
    });

    it("handles deeply nested namespaces", () => {
      expect(
        CppConstructorHelper.extractClassName("Outer::Inner::MyClass"),
      ).toBe("MyClass");
    });

    it("returns the name for unqualified types", () => {
      expect(CppConstructorHelper.extractClassName("MyClass")).toBe("MyClass");
    });
  });

  describe("buildConstructorName", () => {
    it("builds constructor name pattern", () => {
      expect(
        CppConstructorHelper.buildConstructorName("TestNS::MyClass", "MyClass"),
      ).toBe("TestNS::MyClass::MyClass");
    });

    it("handles simple class names", () => {
      expect(
        CppConstructorHelper.buildConstructorName("MyClass", "MyClass"),
      ).toBe("MyClass::MyClass");
    });
  });

  describe("hasConstructor", () => {
    it("returns false when symbolTable is null", () => {
      expect(CppConstructorHelper.hasConstructor("MyClass", null)).toBe(false);
    });

    it("returns false when symbolTable is undefined", () => {
      expect(CppConstructorHelper.hasConstructor("MyClass", undefined)).toBe(
        false,
      );
    });

    it("returns false when constructor symbol not found", () => {
      const mockSymbolTable = {
        getSymbol: () => undefined,
      };
      expect(
        CppConstructorHelper.hasConstructor("MyClass", mockSymbolTable),
      ).toBe(false);
    });

    it("returns false when symbol is not a function", () => {
      const mockSymbolTable = {
        getSymbol: () => ({ kind: "variable" }),
      };
      expect(
        CppConstructorHelper.hasConstructor("MyClass", mockSymbolTable),
      ).toBe(false);
    });

    it("returns true when constructor function found", () => {
      const mockSymbolTable = {
        getSymbol: (name: string) => {
          if (name === "MyClass::MyClass") {
            return { kind: "function" };
          }
          return undefined;
        },
      };
      expect(
        CppConstructorHelper.hasConstructor("MyClass", mockSymbolTable),
      ).toBe(true);
    });

    it("handles namespaced types with underscore format", () => {
      const mockSymbolTable = {
        getSymbol: (name: string) => {
          if (name === "TestNS::MyClass::MyClass") {
            return { kind: "function" };
          }
          return undefined;
        },
      };
      expect(
        CppConstructorHelper.hasConstructor("TestNS_MyClass", mockSymbolTable),
      ).toBe(true);
    });

    it("handles namespaced types with :: format", () => {
      const mockSymbolTable = {
        getSymbol: (name: string) => {
          if (name === "TestNS::MyClass::MyClass") {
            return { kind: "function" };
          }
          return undefined;
        },
      };
      expect(
        CppConstructorHelper.hasConstructor("TestNS::MyClass", mockSymbolTable),
      ).toBe(true);
    });
  });
});
