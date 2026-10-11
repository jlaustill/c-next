import type ICompilerFloor from "./ICompilerFloor";
import type TCompilerExtension from "./TCompilerExtension";
import type TLanguageStandard from "./TLanguageStandard";
import type TOutputMode from "./TOutputMode";
import type TRequirementKey from "./TRequirementKey";

/**
 * Issue #1143: One conditional toolchain requirement carried by generated
 * output.
 *
 * The three axes are independent, and that independence is the point. A
 * construct may cost a newer language standard while needing no particular
 * compiler (`_Static_assert`), or cost a platform library while being plain
 * C99 (`cli()`), or cost a compiler extension at any standard (inline asm).
 * "Standard C99" is not an answer to any of those questions on its own.
 */
interface IToolchainRequirement {
  /** Stable key. Must equal the key this record is filed under. */
  readonly key: TRequirementKey;

  /**
   * Human grouping shared by sibling arms, e.g. "critical section". Rows with
   * the same feature and a non-null condition are reported as alternatives.
   */
  readonly feature: string;

  /**
   * Output modes this requirement can appear in. A probe is only meaningful
   * within these modes -- see TOutputMode for why text alone is not enough.
   */
  readonly modes: readonly TOutputMode[];

  /** Axis 1: minimum language standard the emitted text conforms to. */
  readonly standard: TLanguageStandard;

  /** Axis 2: minimum compiler versions, or null when any conforming one works. */
  readonly compiler: ICompilerFloor | null;

  /** Axis 2: non-standard compiler features used. Empty when strictly conforming. */
  readonly extensions: readonly TCompilerExtension[];

  /** Axis 3: platform library that must supply the symbols, or null when none. */
  readonly platformLib: string | null;

  /** Preprocessor condition selecting this arm, or null when unconditional. */
  readonly condition: string | null;

  /** The exact emitted token this requirement is about. Shown verbatim to users. */
  readonly reason: string;

  /** What the user wrote in .cnx to incur it. One clause, no trailing period. */
  readonly incurredBy: string;

  /**
   * Regex that must match generated output whenever this key is recorded, and
   * whose match implies the key is recorded. This is the #1143 invariant in
   * machine-checkable form: it is what makes it impossible to ship a guard,
   * banner line or documentation row for a construct the file does not contain.
   *
   * null only where no reliable token exists (the baselines, which have no
   * single distinguishing construct).
   */
  readonly probe: RegExp | null;

  /** ADR this requirement originates from, or null. */
  readonly adr: string | null;

  /** MISRA C:2012 guideline ids this bears on, e.g. ["1.2", "Dir 4.3"]. */
  readonly misra: readonly string[];
}

export default IToolchainRequirement;
