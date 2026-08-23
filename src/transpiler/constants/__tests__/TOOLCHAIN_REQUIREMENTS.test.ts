/**
 * Issue #1143: Self-consistency of the toolchain requirements registry.
 *
 * These are cheap invariants that keep the registry usable as a single source
 * of truth: a mislabelled key or a duplicated reason string would silently
 * corrupt every projection built on it (the report, the generated matrix, the
 * MISRA rows, the banner).
 */
import { describe, it, expect } from "vitest";
import TOOLCHAIN_REQUIREMENTS from "../TOOLCHAIN_REQUIREMENTS";
import LANGUAGE_STANDARD_FAMILY from "../LANGUAGE_STANDARD_FAMILY";
import LANGUAGE_STANDARD_ORDER from "../LANGUAGE_STANDARD_ORDER";

const entries = Object.entries(TOOLCHAIN_REQUIREMENTS);

describe("TOOLCHAIN_REQUIREMENTS", () => {
  it("files every entry under its own key", () => {
    for (const [key, requirement] of entries) {
      expect(requirement.key).toBe(key);
    }
  });

  it("declares at least one output mode per entry", () => {
    for (const [key, requirement] of entries) {
      expect(requirement.modes.length, key).toBeGreaterThan(0);
    }
  });

  it("keeps a requirement's standard in a family it can actually appear in", () => {
    // A C++-family standard in a C-only requirement (or vice versa) would make
    // isAboveBaseline compare across families and silently return false.
    for (const [key, requirement] of entries) {
      const family = LANGUAGE_STANDARD_FAMILY[requirement.standard];
      if (family === "cpp") {
        expect(requirement.modes, key).toContain("cpp");
      }
    }
  });

  it("ranks every standard it uses", () => {
    for (const [key, requirement] of entries) {
      expect(LANGUAGE_STANDARD_ORDER[requirement.standard], key).toBeDefined();
    }
  });

  it("gives every entry a distinct reason string", () => {
    // The reason is shown verbatim to users; duplicates mean two different
    // requirements are indistinguishable in a report.
    const reasons = entries.map(([, requirement]) => requirement.reason);
    expect(new Set(reasons).size).toBe(reasons.length);
  });

  it("states what the user wrote to incur each requirement", () => {
    for (const [key, requirement] of entries) {
      expect(requirement.incurredBy.length, key).toBeGreaterThan(0);
      expect(requirement.incurredBy.endsWith("."), key).toBe(false);
    }
  });

  it("carries no compiler-version floor", () => {
    // Documents the current state deliberately: the only floor C-Next ever had
    // came from the unreachable __builtin_*_overflow calls removed in #1143.
    // If a floor is ever added, this test should be updated with the reason --
    // it exists so that becomes a conscious decision rather than a drift.
    for (const [key, requirement] of entries) {
      expect(requirement.compiler, key).toBeNull();
    }
  });

  it("gives every entry except the baselines a probe", () => {
    for (const [key, requirement] of entries) {
      if (key === "baseline-c" || key === "baseline-cpp") {
        expect(requirement.probe, key).toBeNull();
      } else {
        expect(requirement.probe, key).not.toBeNull();
      }
    }
  });
});
