/**
 * Issue #1143: The shared reasoning every requirements consumer asks its
 * questions through.
 *
 * Kept in one place deliberately: if the transpile-time report, the per-file
 * banner and the generated matrix each decided for themselves what counts as
 * "worth mentioning", they would drift apart -- which is the failure the whole
 * registry exists to prevent.
 */
import { describe, it, expect } from "vitest";
import ToolchainRequirementUtils from "../ToolchainRequirementUtils";
import TOOLCHAIN_REQUIREMENTS from "../../transpiler/constants/TOOLCHAIN_REQUIREMENTS";
import type IRecordedRequirement from "../../transpiler/types/IRecordedRequirement";
import type TRequirementKey from "../../transpiler/types/TRequirementKey";

const recorded = (...keys: TRequirementKey[]): IRecordedRequirement[] =>
  keys.map((key) => ({ key, sites: [] }));

describe("ToolchainRequirementUtils", () => {
  describe("baselineKey", () => {
    it("picks the baseline for each mode", () => {
      expect(ToolchainRequirementUtils.baselineKey("c")).toBe("baseline-c");
      expect(ToolchainRequirementUtils.baselineKey("cpp")).toBe("baseline-cpp");
    });
  });

  describe("isBaseline", () => {
    it("recognizes both baselines and nothing else", () => {
      // Asked against the baseline keys, not a `baseline-` name prefix, so a
      // rename cannot silently change what a consumer treats as free.
      expect(ToolchainRequirementUtils.isBaseline("baseline-c")).toBe(true);
      expect(ToolchainRequirementUtils.isBaseline("baseline-cpp")).toBe(true);
      expect(ToolchainRequirementUtils.isBaseline("float-assert-c11")).toBe(
        false,
      );
    });
  });

  describe("modeOf", () => {
    it("reads the mode from the recorded baseline", () => {
      expect(
        ToolchainRequirementUtils.modeOf(
          recorded("baseline-cpp", "cpp-compound-literal"),
        ),
      ).toBe("cpp");
      expect(
        ToolchainRequirementUtils.modeOf(
          recorded("baseline-c", "float-assert-c11"),
        ),
      ).toBe("c");
    });

    it("defaults to C when nothing was recorded", () => {
      expect(ToolchainRequirementUtils.modeOf([])).toBe("c");
    });

    it("is not fooled by a requirement that is merely valid in C++", () => {
      // `critical-arm-gnu` has modes ["c", "cpp"]. Inferring the mode from a
      // requirement's `modes` rather than the recorded baseline would call
      // this a C++ transpile.
      expect(
        ToolchainRequirementUtils.modeOf(
          recorded("baseline-c", "critical-arm-gnu"),
        ),
      ).toBe("c");
    });
  });

  describe("isAboveBaseline", () => {
    it("is false for the mode's own baseline", () => {
      expect(ToolchainRequirementUtils.isAboveBaseline("baseline-c", "c")).toBe(
        false,
      );
      expect(
        ToolchainRequirementUtils.isAboveBaseline("baseline-cpp", "cpp"),
      ).toBe(false);
    });

    it("is true for a later language standard", () => {
      // C11 _Static_assert against a C99 baseline.
      expect(
        ToolchainRequirementUtils.isAboveBaseline("float-assert-c11", "c"),
      ).toBe(true);
    });

    it("is true for a platform library even at the baseline standard", () => {
      // critical-avr-libc is C99, so only the platform axis makes it cost.
      expect(TOOLCHAIN_REQUIREMENTS["critical-avr-libc"].standard).toBe("C99");
      expect(
        ToolchainRequirementUtils.isAboveBaseline("critical-avr-libc", "c"),
      ).toBe(true);
    });

    it("is true for a compiler extension even at the baseline standard", () => {
      expect(
        ToolchainRequirementUtils.isAboveBaseline("critical-arm-gnu", "c"),
      ).toBe(true);
    });

    it("does not compare standards across language families", () => {
      // "C11 > C++11" is not a meaningful statement; float-assert-cpp11 is at
      // the C++ baseline and must not read as exceeding it.
      expect(
        ToolchainRequirementUtils.isAboveBaseline("float-assert-cpp11", "cpp"),
      ).toBe(false);
    });
  });

  describe("exceedsBaselineStandard", () => {
    it("separates a standard cost from an extension cost", () => {
      // Designated initializers in C++ need C++20 OR an extension; compound
      // literals are not ISO C++ at any version, so no standard fixes them.
      expect(
        ToolchainRequirementUtils.exceedsBaselineStandard(
          "cpp-designated-initializer",
          "cpp",
        ),
      ).toBe(true);
      expect(
        ToolchainRequirementUtils.exceedsBaselineStandard(
          "cpp-compound-literal",
          "cpp",
        ),
      ).toBe(false);
    });
  });

  describe("unconditionalExtensions", () => {
    it("excludes an extension confined to one platform arm", () => {
      expect(
        ToolchainRequirementUtils.unconditionalExtensions(
          recorded("critical-arm-gnu"),
        ),
      ).toEqual([]);
    });

    it("includes an extension with no platform arm", () => {
      expect(
        ToolchainRequirementUtils.unconditionalExtensions(
          recorded("cpp-compound-literal"),
        ),
      ).toEqual(["compound literals in C++"]);
    });

    it("is the one rule both the banner and the report ask", () => {
      const mixed = recorded("critical-arm-gnu", "cpp-compound-literal");
      expect(ToolchainRequirementUtils.unconditionalExtensions(mixed)).toEqual([
        "compound literals in C++",
      ]);
    });
  });

  describe("distinctCompilerFloors", () => {
    it("reports no floor for anything in the registry today", () => {
      // The only floor C-Next ever had came from the unreachable
      // __builtin_*_overflow calls removed in #1143. If one is ever added this
      // fails, which is the point: a version floor should be a deliberate act.
      const everyKey = Object.keys(TOOLCHAIN_REQUIREMENTS) as TRequirementKey[];
      expect(
        ToolchainRequirementUtils.distinctCompilerFloors(recorded(...everyKey)),
      ).toEqual([]);
    });

    it("reports nothing for an empty set", () => {
      expect(ToolchainRequirementUtils.distinctCompilerFloors([])).toEqual([]);
    });
  });

  describe("reportable", () => {
    it("drops the baseline and keeps what costs something", () => {
      const result = ToolchainRequirementUtils.reportable(
        recorded("baseline-c", "float-assert-c11"),
        "c",
      );
      expect(result.map((entry) => entry.key)).toEqual(["float-assert-c11"]);
    });

    it("is empty when a project needs only the baseline", () => {
      expect(
        ToolchainRequirementUtils.reportable(recorded("baseline-c"), "c"),
      ).toEqual([]);
    });

    it("groups sibling arms of one feature together", () => {
      // The four critical-section arms must sort adjacently so the report can
      // present them as alternatives rather than four separate costs.
      const result = ToolchainRequirementUtils.reportable(
        recorded(
          "baseline-c",
          "critical-cmsis-fallback",
          "atomic-ldrex-cmsis",
          "critical-arm-gnu",
        ),
        "c",
      );
      const features = result.map(
        (entry) => TOOLCHAIN_REQUIREMENTS[entry.key].feature,
      );
      expect(features).toEqual([
        "atomic read-modify-write",
        "critical section",
        "critical section",
      ]);
    });
  });

  describe("describeForBanner", () => {
    it("says nothing when only the baseline is needed", () => {
      expect(
        ToolchainRequirementUtils.describeForBanner(
          recorded("baseline-c"),
          "c",
        ),
      ).toEqual([]);
    });

    it("names the highest standard, not every one on the way to it", () => {
      // "Requires: C++11, C++20" would read as needing both.
      const lines = ToolchainRequirementUtils.describeForBanner(
        recorded("baseline-cpp", "cpp-designated-initializer"),
        "cpp",
      );
      expect(lines[0]).toBe("Requires: C++20.");
    });

    it("collapses sibling platform arms into one alternatives line", () => {
      const lines = ToolchainRequirementUtils.describeForBanner(
        recorded(
          "baseline-c",
          "critical-arm-gnu",
          "critical-arduino",
          "critical-avr-libc",
          "critical-cmsis-fallback",
        ),
        "c",
      );
      const alternatives = lines.find((line) => line.includes("one of"));
      expect(alternatives).toContain("critical section requires one of:");
      expect(alternatives).toContain("avr-libc");
    });

    it("states a single platform requirement without the alternatives wording", () => {
      const lines = ToolchainRequirementUtils.describeForBanner(
        recorded("baseline-c", "atomic-primask-cmsis"),
        "c",
      );
      expect(lines).toContain("atomic read-modify-write requires CMSIS.");
    });

    it("does not claim an extension that only one platform arm needs", () => {
      // critical-arm-gnu's inline assembly lives inside the
      // `#if defined(__arm__)` arm, so an AVR or CMSIS build compiles none of
      // it. Reported in review of #1153, where the banner and the
      // transpile-time report answered this question differently.
      const lines = ToolchainRequirementUtils.describeForBanner(
        recorded("baseline-c", "critical-arm-gnu"),
        "c",
      );
      expect(
        lines.some((line) => line.startsWith("GNU/Clang extensions:")),
      ).toBe(false);
    });

    it("does list an extension every target needs", () => {
      // Compound literals in C++ are not tied to a platform arm.
      const lines = ToolchainRequirementUtils.describeForBanner(
        recorded("baseline-cpp", "cpp-compound-literal"),
        "cpp",
      );
      expect(
        lines.some((line) => line.startsWith("GNU/Clang extensions:")),
      ).toBe(true);
    });
  });
});
