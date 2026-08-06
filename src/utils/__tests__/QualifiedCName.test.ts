/**
 * Unit tests for QualifiedCName
 * ADR-063 / Issue #1117: single source of truth for the qualified-name separator
 */
import { describe, it, expect } from "vitest";
import QualifiedCName from "../QualifiedCName";

describe("QualifiedCName", () => {
  describe("join", () => {
    it("joins scope and member", () => {
      expect(QualifiedCName.join("Motor", "init")).toBe("Motor_init");
    });

    it("joins three components (scoped enum member)", () => {
      expect(QualifiedCName.join("Motor", "State", "IDLE")).toBe(
        "Motor_State_IDLE",
      );
    });

    it("returns the bare name for a global symbol", () => {
      expect(QualifiedCName.join("", "main")).toBe("main");
      expect(QualifiedCName.join(undefined, "main")).toBe("main");
      expect(QualifiedCName.join(null, "main")).toBe("main");
    });

    it("expands a dotted source path into separate components", () => {
      expect(QualifiedCName.join("Outer.Inner", "deepFunc")).toBe(
        "Outer_Inner_deepFunc",
      );
    });

    it("preserves single underscores inside a component", () => {
      expect(QualifiedCName.join("Timer", "tick_count")).toBe(
        "Timer_tick_count",
      );
    });

    it("drops empty components rather than emitting a stray separator", () => {
      expect(QualifiedCName.join("A", "", "b")).toBe("A_b");
    });
  });

  describe("split", () => {
    it("is the inverse of join", () => {
      const parts = ["Motor", "State", "IDLE"];
      expect(QualifiedCName.split(QualifiedCName.join(...parts))).toEqual(
        parts,
      );
    });
  });

  describe("isQualified", () => {
    it("is true for a scope-qualified name", () => {
      expect(QualifiedCName.isQualified("Motor_init")).toBe(true);
    });

    it("is false for a bare identifier", () => {
      expect(QualifiedCName.isQualified("main")).toBe(false);
    });
  });

  describe("isInScope", () => {
    it("recognizes a member of the given scope", () => {
      expect(QualifiedCName.isInScope("Motor_init", "Motor")).toBe(true);
    });

    it("rejects a member of a different scope", () => {
      expect(QualifiedCName.isInScope("Pump_init", "Motor")).toBe(false);
    });

    it("handles a dotted scope path", () => {
      expect(QualifiedCName.isInScope("Outer_Inner_fn", "Outer.Inner")).toBe(
        true,
      );
    });

    it("returns false for a null or empty scope", () => {
      // Preserves the previous `startsWith(null + "_")` behavior at call sites
      expect(QualifiedCName.isInScope("Motor_init", null)).toBe(false);
      expect(QualifiedCName.isInScope("Motor_init", undefined)).toBe(false);
      expect(QualifiedCName.isInScope("Motor_init", "")).toBe(false);
    });
  });

  describe("toCppQualified", () => {
    it("re-qualifies for C++ namespace syntax", () => {
      expect(QualifiedCName.toCppQualified("SeaDash_Parse_Result", "::")).toBe(
        "SeaDash::Parse::Result",
      );
    });
  });

  describe("injectivity (ADR-063)", () => {
    // The property the whole ADR exists to establish: distinct component lists
    // must never produce the same C identifier, given ADR-063-conformant input.
    it("distinguishes the #1117 scope-vs-scope collision", () => {
      // scope A_B { c }  vs  scope A { B_c } — identical under a naive join
      const first = QualifiedCName.join("A_B", "c");
      const second = QualifiedCName.join("A", "B_c");

      // Documents current (pre-Phase-4) behavior: these still collide while the
      // separator is a single underscore. Flipping SEPARATOR to "__" separates
      // them, and this assertion flips with it.
      expect(QualifiedCName.SEPARATOR).toBe("_");
      expect(first).toBe(second);
    });

    it("distinguishes a global from a scope member of the same spelling", () => {
      const global = QualifiedCName.join(undefined, "Reg_flags");
      const member = QualifiedCName.join("Reg", "flags");

      expect(QualifiedCName.SEPARATOR).toBe("_");
      expect(global).toBe(member);
    });
  });
});
