import LANGUAGE_STANDARD_FAMILY from "../transpiler/constants/LANGUAGE_STANDARD_FAMILY";
import LANGUAGE_STANDARD_ORDER from "../transpiler/constants/LANGUAGE_STANDARD_ORDER";
import TOOLCHAIN_REQUIREMENTS from "../transpiler/constants/TOOLCHAIN_REQUIREMENTS";
import type ICompilerFloor from "../transpiler/types/ICompilerFloor";
import type IRecordedRequirement from "../transpiler/types/IRecordedRequirement";
import type IToolchainRequirement from "../transpiler/types/IToolchainRequirement";
import type TOutputMode from "../transpiler/types/TOutputMode";
import type TRequirementKey from "../transpiler/types/TRequirementKey";

/**
 * Issue #1143: Shared reasoning over recorded toolchain requirements.
 *
 * Every consumer -- the transpile-time report, the per-file banner,
 * docs/compatibility.md, the MISRA rows, the guard emitter -- asks its
 * questions here. That is deliberate: if each consumer decided for itself what
 * counts as "worth mentioning", they would drift apart, which is the failure
 * this issue exists to fix.
 */
class ToolchainRequirementUtils {
  /** The requirement every file in a given mode already carries. */
  static baselineKey(mode: TOutputMode): TRequirementKey {
    return mode === "cpp" ? "baseline-cpp" : "baseline-c";
  }

  /** Look up a registry entry by key. */
  static lookup(key: TRequirementKey): IToolchainRequirement {
    return TOOLCHAIN_REQUIREMENTS[key];
  }

  /**
   * Does this requirement cost the user anything beyond the mode's baseline?
   *
   * True when it needs a later language standard than the baseline, or a
   * compiler extension, or a compiler version, or a platform library. A
   * requirement that costs nothing on all four axes is not worth reporting --
   * it is what the baseline already promised.
   */
  static isAboveBaseline(key: TRequirementKey, mode: TOutputMode): boolean {
    const baseline =
      TOOLCHAIN_REQUIREMENTS[ToolchainRequirementUtils.baselineKey(mode)];
    const requirement = TOOLCHAIN_REQUIREMENTS[key];
    if (requirement.key === baseline.key) return false;

    if (
      requirement.compiler !== null ||
      requirement.extensions.length > 0 ||
      requirement.platformLib !== null
    ) {
      return true;
    }
    return ToolchainRequirementUtils.exceedsStandard(requirement, baseline);
  }

  /**
   * Is `requirement`'s standard later than `baseline`'s?
   *
   * Cross-family comparisons are meaningless (C11 vs C++11), so a requirement
   * from another family never counts as exceeding this baseline; `modes` is
   * what keeps such a pairing from arising in the first place.
   */
  private static exceedsStandard(
    requirement: IToolchainRequirement,
    baseline: IToolchainRequirement,
  ): boolean {
    if (
      LANGUAGE_STANDARD_FAMILY[requirement.standard] !==
      LANGUAGE_STANDARD_FAMILY[baseline.standard]
    ) {
      return false;
    }
    return (
      LANGUAGE_STANDARD_ORDER[requirement.standard] >
      LANGUAGE_STANDARD_ORDER[baseline.standard]
    );
  }

  /**
   * Does this requirement need a later language standard than the baseline?
   *
   * Distinct from isAboveBaseline, which is true if the requirement costs
   * anything on any axis. A construct can need a newer standard *or* a
   * compiler extension as a fallback -- designated initializers in C++ are
   * C++20, but GCC and Clang accept them earlier -- and a report that shows
   * only the extension tells a C++20 user they need something they do not.
   */
  static exceedsBaselineStandard(
    key: TRequirementKey,
    mode: TOutputMode,
  ): boolean {
    return ToolchainRequirementUtils.exceedsStandard(
      TOOLCHAIN_REQUIREMENTS[key],
      TOOLCHAIN_REQUIREMENTS[ToolchainRequirementUtils.baselineKey(mode)],
    );
  }

  /**
   * Distinct compiler-version floors across the recorded set, for the guard
   * emitter. Returns an empty array when nothing recorded carries a floor,
   * which is the current state of the registry.
   */
  static distinctCompilerFloors(
    recorded: readonly IRecordedRequirement[],
  ): readonly ICompilerFloor[] {
    const seen = new Map<string, ICompilerFloor>();
    for (const entry of recorded) {
      const floor = TOOLCHAIN_REQUIREMENTS[entry.key].compiler;
      if (floor !== null) seen.set(floor.guardExpression, floor);
    }
    return Array.from(seen.values());
  }

  /**
   * Recorded requirements worth showing the user, sorted for stable output.
   * Ordering is by feature then key so the report and the generated docs list
   * sibling platform arms together.
   */
  static reportable(
    recorded: readonly IRecordedRequirement[],
    mode: TOutputMode,
  ): readonly IRecordedRequirement[] {
    return recorded
      .filter((entry) =>
        ToolchainRequirementUtils.isAboveBaseline(entry.key, mode),
      )
      .slice()
      .sort((left, right) => {
        const leftRequirement = TOOLCHAIN_REQUIREMENTS[left.key];
        const rightRequirement = TOOLCHAIN_REQUIREMENTS[right.key];
        const byFeature = leftRequirement.feature.localeCompare(
          rightRequirement.feature,
        );
        return byFeature !== 0 ? byFeature : left.key.localeCompare(right.key);
      });
  }
}

export default ToolchainRequirementUtils;
