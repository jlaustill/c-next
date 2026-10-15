import { describe, expect, it } from "vitest";
import VariableModifierBuilder from "../VariableModifierBuilder";

/** #1428: each test states the run's mode; the builder has no default. */
const C_RUN = { cppMode: false };
const CPP_RUN = { cppMode: true };

describe("VariableModifierBuilder", () => {
  describe("build", () => {
    it("returns empty modifiers when no modifiers present", () => {
      const ctx = {
        mut: true,
        atomic: false,
        volatile: false,
      };

      const result = VariableModifierBuilder.build(ctx, true, C_RUN);

      expect(result.const).toBe("");
      expect(result.atomic).toBe("");
      expect(result.volatile).toBe("");
      expect(result.extern).toBe("");
    });

    it("returns const modifier when present", () => {
      const ctx = {
        mut: false,
        atomic: false,
        volatile: false,
      };

      const result = VariableModifierBuilder.build(ctx, true, C_RUN);

      expect(result.const).toBe("const ");
    });

    it("returns atomic as volatile when present", () => {
      const ctx = {
        mut: true,
        atomic: true,
        volatile: false,
      };

      const result = VariableModifierBuilder.build(ctx, true, C_RUN);

      expect(result.atomic).toBe("volatile ");
    });

    it("returns volatile modifier when present", () => {
      const ctx = {
        mut: true,
        atomic: false,
        volatile: true,
      };

      const result = VariableModifierBuilder.build(ctx, true, C_RUN);

      expect(result.volatile).toBe("volatile ");
    });

    it("does not return extern for const at file scope in C mode (MISRA 8.5)", () => {
      // MISRA Rule 8.5: External object/function shall be declared once in one file only.
      // A file-scope declaration is always a DEFINITION -- one written with no
      // initializer is zero-initialized -- so the extern declaration comes from
      // the header and the .c file must not duplicate it.
      const ctx = {
        mut: false,
        atomic: false,
        volatile: false,
      };

      const result = VariableModifierBuilder.build(ctx, false, C_RUN);

      expect(result.extern).toBe("");
    });

    it("returns extern for const at file scope in C++ mode (Issue #525)", () => {
      // In C++, const at file scope has internal linkage by default.
      // extern is needed for cross-file access, even for definitions.
      const ctx = {
        mut: false,
        atomic: false,
        volatile: false,
      };

      // A definition in C++ mode SHOULD have extern for external linkage
      const result = VariableModifierBuilder.build(ctx, false, CPP_RUN);

      expect(result.extern).toBe("extern ");
    });

    it("does not return extern for const inside function body", () => {
      const ctx = {
        mut: false,
        atomic: false,
        volatile: false,
      };

      const result = VariableModifierBuilder.build(ctx, true, C_RUN);

      expect(result.extern).toBe("");
    });

    it("throws error when both atomic and volatile are specified", () => {
      const ctx = {
        mut: true,
        atomic: true,
        volatile: true,
      };

      expect(() => VariableModifierBuilder.build(ctx, true, C_RUN)).toThrow(
        "E0889 rejects this in pass 2.1",
      );
    });

    // #1322: "includes line number in error when both modifiers specified" is
    // deleted, not re-pointed. It asserted that the message carried a POSITION
    // in its text -- which is exactly what the relocation removes. E0889 has a
    // real line and column, and the assertion that survives here says only
    // that the rule ran.

    // #1322: "handles missing start in error case" went with it -- it asserted
    // the `?? 0` fallback for a context with no position, which existed only
    // because the message had to name a line. Nothing falls back now.
  });

  describe("buildSimple", () => {
    it("returns const, atomic and volatile modifiers, never extern", () => {
      const ctx = {
        mut: false,
        atomic: true,
        volatile: false,
      };

      const result = VariableModifierBuilder.buildSimple(ctx);

      // ADR-071: a read-only binding is C's `const`
      expect(result.const).toBe("const ");
      expect(result.atomic).toBe("volatile ");
      expect(result.volatile).toBe("");
      expect(result).not.toHaveProperty("extern");
    });

    it("gives a `mut` binding no const", () => {
      const result = VariableModifierBuilder.buildSimple({
        mut: true,
        atomic: false,
        volatile: false,
      });

      expect(result.const).toBe("");
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
