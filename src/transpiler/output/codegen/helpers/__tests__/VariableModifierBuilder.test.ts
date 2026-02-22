import { describe, expect, it } from "vitest";
import VariableModifierBuilder from "../VariableModifierBuilder";

describe("VariableModifierBuilder", () => {
  describe("build", () => {
    it("returns empty modifiers when no modifiers present", () => {
      const ctx = {
        constModifier: () => null,
        atomicModifier: () => null,
        volatileModifier: () => null,
      };

      const result = VariableModifierBuilder.build(ctx, true);

      expect(result.const).toBe("");
      expect(result.atomic).toBe("");
      expect(result.volatile).toBe("");
      expect(result.extern).toBe("");
    });

    it("returns const modifier when present", () => {
      const ctx = {
        constModifier: () => ({}),
        atomicModifier: () => null,
        volatileModifier: () => null,
      };

      const result = VariableModifierBuilder.build(ctx, true);

      expect(result.const).toBe("const ");
    });

    it("returns atomic as volatile when present", () => {
      const ctx = {
        constModifier: () => null,
        atomicModifier: () => ({}),
        volatileModifier: () => null,
      };

      const result = VariableModifierBuilder.build(ctx, true);

      expect(result.atomic).toBe("volatile ");
    });

    it("returns volatile modifier when present", () => {
      const ctx = {
        constModifier: () => null,
        atomicModifier: () => null,
        volatileModifier: () => ({}),
      };

      const result = VariableModifierBuilder.build(ctx, true);

      expect(result.volatile).toBe("volatile ");
    });

    it("returns extern for const at file scope (declaration without initializer, C mode)", () => {
      const ctx = {
        constModifier: () => ({}),
        atomicModifier: () => null,
        volatileModifier: () => null,
      };

      // Declaration (no initializer) in C mode - should have extern
      const result = VariableModifierBuilder.build(ctx, false, false, false);

      expect(result.extern).toBe("extern ");
    });

    it("does not return extern for const at file scope with initializer in C mode (MISRA 8.5)", () => {
      // MISRA Rule 8.5: External object/function shall be declared once in one file only.
      // When a variable has an initializer, it's a DEFINITION, not a declaration.
      // The extern declaration comes from the header; the .c file should not duplicate it.
      const ctx = {
        constModifier: () => ({}),
        atomicModifier: () => null,
        volatileModifier: () => null,
      };

      // Definition (has initializer) in C mode - should NOT have extern
      const result = VariableModifierBuilder.build(ctx, false, true, false);

      expect(result.extern).toBe("");
    });

    it("returns extern for const at file scope with initializer in C++ mode (Issue #525)", () => {
      // In C++, const at file scope has internal linkage by default.
      // extern is needed for cross-file access, even for definitions.
      const ctx = {
        constModifier: () => ({}),
        atomicModifier: () => null,
        volatileModifier: () => null,
      };

      // Definition (has initializer) in C++ mode - SHOULD have extern for external linkage
      const result = VariableModifierBuilder.build(ctx, false, true, true);

      expect(result.extern).toBe("extern ");
    });

    it("does not return extern for const inside function body", () => {
      const ctx = {
        constModifier: () => ({}),
        atomicModifier: () => null,
        volatileModifier: () => null,
      };

      const result = VariableModifierBuilder.build(ctx, true);

      expect(result.extern).toBe("");
    });

    it("throws error when both atomic and volatile are specified", () => {
      const ctx = {
        constModifier: () => null,
        atomicModifier: () => ({}),
        volatileModifier: () => ({}),
        start: { line: 42 },
      };

      expect(() => VariableModifierBuilder.build(ctx, true)).toThrow(
        "Cannot use both 'atomic' and 'volatile' modifiers",
      );
    });

    it("includes line number in error when both modifiers specified", () => {
      const ctx = {
        constModifier: () => null,
        atomicModifier: () => ({}),
        volatileModifier: () => ({}),
        start: { line: 42 },
      };

      expect(() => VariableModifierBuilder.build(ctx, true)).toThrow(
        "Error at line 42",
      );
    });

    it("handles missing start in error case", () => {
      const ctx = {
        constModifier: () => null,
        atomicModifier: () => ({}),
        volatileModifier: () => ({}),
      };

      expect(() => VariableModifierBuilder.build(ctx, true)).toThrow(
        "Error at line 0",
      );
    });
  });

  describe("buildSimple", () => {
    it("returns only atomic and volatile modifiers", () => {
      const ctx = {
        constModifier: () => ({}),
        atomicModifier: () => ({}),
        volatileModifier: () => null,
      };

      const result = VariableModifierBuilder.buildSimple(ctx);

      expect(result.atomic).toBe("volatile ");
      expect(result.volatile).toBe("");
      expect(result).not.toHaveProperty("const");
      expect(result).not.toHaveProperty("extern");
    });
  });

  describe("toPrefix", () => {
    it("combines all modifiers into prefix string", () => {
      const modifiers = {
        const: "const ",
        atomic: "volatile ",
        volatile: "",
        extern: "extern ",
      };

      const result = VariableModifierBuilder.toPrefix(modifiers);

      expect(result).toBe("extern const volatile ");
    });

    it("returns empty string for empty modifiers", () => {
      const modifiers = {
        const: "",
        atomic: "",
        volatile: "",
        extern: "",
      };

      const result = VariableModifierBuilder.toPrefix(modifiers);

      expect(result).toBe("");
    });
  });
});
