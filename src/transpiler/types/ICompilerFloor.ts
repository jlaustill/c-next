/**
 * Issue #1143: Compiler-version axis of a toolchain requirement.
 *
 * No requirement currently carries a floor -- the last one was removed with the
 * unreachable __builtin_*_overflow calls. This type exists so that adding a
 * construct with a version floor is a data change rather than a redesign, and
 * so RequirementGuardGenerator can emit a guard for it automatically.
 */
interface ICompilerFloor {
  /** Minimum GCC major version, or null if GCC never provides the construct. */
  readonly gcc: number | null;

  /** Minimum Clang version as major.minor, or null if Clang never provides it. */
  readonly clang: number | null;

  /**
   * Preprocessor expression that is true when the floor is met. Emitted
   * negated inside an #if by the guard generator, so it must be valid in a
   * #if with no includes available.
   */
  readonly guardExpression: string;
}

export default ICompilerFloor;
