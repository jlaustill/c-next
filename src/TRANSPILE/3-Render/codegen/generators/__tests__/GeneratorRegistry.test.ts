import { describe, it, expect, beforeEach } from "vitest";
import { ParserRuleContext } from "antlr4ng";
import GeneratorRegistry from "../GeneratorRegistry";
import TGeneratorFn from "../TGeneratorFn";

// Mock generator function for testing
const mockGenerator: TGeneratorFn<ParserRuleContext> = () => ({
  code: "mock",
  effects: [],
});

describe("GeneratorRegistry", () => {
  let registry: GeneratorRegistry;

  beforeEach(() => {
    registry = new GeneratorRegistry();
  });

  describe("hasDeclaration", () => {
    it("returns false for unregistered kind", () => {
      expect(registry.hasDeclaration("struct")).toBe(false);
    });

    it("returns true for registered kind", () => {
      registry.registerDeclaration("struct", mockGenerator);
      expect(registry.hasDeclaration("struct")).toBe(true);
    });
  });

  describe("hasStatement", () => {
    it("returns false for unregistered kind", () => {
      expect(registry.hasStatement("if")).toBe(false);
    });

    it("returns true for registered kind", () => {
      registry.registerStatement("if", mockGenerator);
      expect(registry.hasStatement("if")).toBe(true);
    });
  });

  describe("hasExpression", () => {
    it("returns false for unregistered kind", () => {
      expect(registry.hasExpression("ternary")).toBe(false);
    });

    it("returns true for registered kind", () => {
      registry.registerExpression("ternary", mockGenerator);
      expect(registry.hasExpression("ternary")).toBe(true);
    });
  });

  describe("unregisterDeclaration", () => {
    it("removes a registered declaration", () => {
      registry.registerDeclaration("struct", mockGenerator);
      expect(registry.hasDeclaration("struct")).toBe(true);

      registry.unregisterDeclaration("struct");
      expect(registry.hasDeclaration("struct")).toBe(false);
    });

    it("is a no-op for non-existent kind", () => {
      expect(registry.hasDeclaration("unknown")).toBe(false);
      registry.unregisterDeclaration("unknown");
      expect(registry.hasDeclaration("unknown")).toBe(false);
    });
  });

  describe("getDeclaration", () => {
    it("returns undefined for unregistered kind", () => {
      expect(registry.getDeclaration("struct")).toBeUndefined();
    });

    it("returns generator for registered kind", () => {
      registry.registerDeclaration("struct", mockGenerator);
      expect(registry.getDeclaration("struct")).toBe(mockGenerator);
    });
  });
});
