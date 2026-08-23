import LANGUAGE_STANDARD_FAMILY from "../transpiler/constants/LANGUAGE_STANDARD_FAMILY";
import LANGUAGE_STANDARD_ORDER from "../transpiler/constants/LANGUAGE_STANDARD_ORDER";
import TOOLCHAIN_REQUIREMENTS from "../transpiler/constants/TOOLCHAIN_REQUIREMENTS";
import type ICompilerFloor from "../transpiler/types/ICompilerFloor";
import type IRecordedRequirement from "../transpiler/types/IRecordedRequirement";
import type IToolchainRequirement from "../transpiler/types/IToolchainRequirement";
import type TLanguageStandard from "../transpiler/types/TLanguageStandard";
import type TCompilerExtension from "../transpiler/types/TCompilerExtension";
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

  /**
   * Is this key one of the per-mode baselines?
   *
   * Asked against the baseline keys themselves rather than a `baseline-` name
   * prefix, so renaming a key cannot silently change which entries a consumer
   * treats as free.
   */
  static isBaseline(key: TRequirementKey): boolean {
    return (
      key === ToolchainRequirementUtils.baselineKey("c") ||
      key === ToolchainRequirementUtils.baselineKey("cpp")
    );
  }

  /**
   * Which output mode produced a recorded set.
   *
   * Every file records its mode's baseline, so the answer is in the data. Read
   * it here rather than at each consumer: a consumer that infers the mode from
   * some other property of a requirement gets the right answer only while the
   * registry happens to contain nothing that contradicts it.
   */
  static modeOf(recorded: readonly IRecordedRequirement[]): TOutputMode {
    const cppBaseline = ToolchainRequirementUtils.baselineKey("cpp");
    return recorded.some((entry) => entry.key === cppBaseline) ? "cpp" : "c";
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
   * Extensions the toolchain needs **whatever target is selected**.
   *
   * An extension belonging to a requirement that also names a platform library
   * lives inside one arm of a `#if` chain, so only that arm's targets compile
   * it. Listing it unconditionally tells an AVR user they need ARM inline
   * assembly for code their build never sees.
   *
   * One home for the rule, because the banner and the transpile-time report
   * are the same question asked twice: CLAUDE.md's single-source-of-truth rule
   * is about the *decision*, not just the data behind it.
   */
  static unconditionalExtensions(
    reportable: readonly IRecordedRequirement[],
  ): readonly TCompilerExtension[] {
    const extensions = new Set<TCompilerExtension>();
    for (const entry of reportable) {
      const requirement = TOOLCHAIN_REQUIREMENTS[entry.key];
      if (requirement.platformLib !== null) continue;
      for (const extension of requirement.extensions) extensions.add(extension);
    }
    return Array.from(extensions);
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
   * The `Requires:` lines for a generated file's banner.
   *
   * Empty when nothing exceeds the baseline, so plain C99 output keeps the
   * banner it has always had. Sibling arms of one feature are collapsed into a
   * single "one of" line: a critical section needs ARMv7-M *or* Arduino *or*
   * avr-libc *or* CMSIS, and listing four requirements would misstate what the
   * reader has to provide.
   */
  static describeForBanner(
    recorded: readonly IRecordedRequirement[],
    mode: TOutputMode,
  ): readonly string[] {
    const reportable = ToolchainRequirementUtils.reportable(recorded, mode);
    if (reportable.length === 0) return [];

    const standards = new Set<string>();
    const extensions = new Set<string>(
      ToolchainRequirementUtils.unconditionalExtensions(reportable),
    );
    const platformsByFeature = new Map<string, Set<string>>();

    for (const entry of reportable) {
      const requirement = TOOLCHAIN_REQUIREMENTS[entry.key];
      if (ToolchainRequirementUtils.exceedsBaselineStandard(entry.key, mode)) {
        standards.add(requirement.standard);
      }
      if (requirement.platformLib !== null) {
        const libraries =
          platformsByFeature.get(requirement.feature) ?? new Set<string>();
        libraries.add(requirement.platformLib);
        platformsByFeature.set(requirement.feature, libraries);
      }
    }

    const parts: string[] = [];
    const baseline =
      TOOLCHAIN_REQUIREMENTS[ToolchainRequirementUtils.baselineKey(mode)]
        .standard;
    // The highest standard subsumes the baseline, so listing both would read as
    // needing two standards at once. Seeded with the baseline rather than
    // relying on the array being non-empty.
    const highest = Array.from(standards).reduce(
      (left, right) =>
        LANGUAGE_STANDARD_ORDER[right as TLanguageStandard] >
        LANGUAGE_STANDARD_ORDER[left as TLanguageStandard]
          ? right
          : left,
      baseline as string,
    );
    parts.push(`Requires: ${highest}.`);
    if (extensions.size > 0) {
      parts.push(`GNU/Clang extensions: ${Array.from(extensions).join(", ")}.`);
    }
    for (const [feature, libraries] of platformsByFeature) {
      const list = Array.from(libraries);
      parts.push(
        list.length === 1
          ? `${feature} requires ${list[0]}.`
          : `${feature} requires one of: ${list.join(", ")} (by target).`,
      );
    }
    return parts;
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
