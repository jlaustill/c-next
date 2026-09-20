/**
 * RegisterAccessMode — what a register member's access modifier means.
 *
 * ADR-004 gives a register member one of `rw`, `ro`, `wo`, `w1c`, `w1s`. Three
 * of those — `wo`, `w1s`, `w1c` — share a property that decides how a write is
 * emitted and whether a zero-bit write means anything: the hardware cannot be
 * read back to build a read-modify-write, so the value must be composed from
 * nothing.
 *
 * That membership was written out THREE times, in two passes that cannot import
 * each other:
 *
 *   1-Analyze/RegisterAccessAnalyzer   `new Set(["wo", "w1s", "w1c"])`
 *   3-Render/.../RegisterUtils          `=== "wo" || === "w1s" || === "w1c"`
 *   3-Render/.../BitmapHandlers         the same expression again
 *
 * 2.1 Analyze used it to decide a DIAGNOSTIC — a zero written to a write-1 bit
 * is meaningless — and 2.3 Render used it to decide WHICH C to emit. All three
 * agreed, which is the whole problem: nothing fails when they agree, and the
 * first edit that adds a fourth modifier has to find all three. `output/` may
 * not import `1-Analyze` (depcruise makes that an error), so the only home both
 * can reach is here, the same reason `PrimitiveKindUtils.widestIntegerOf` lives
 * in `utils/` (#1450).
 */
class RegisterAccessMode {
  /**
   * Modifiers whose bits are written rather than read-modify-written.
   *
   * `wo` cannot be read at all; `w1s` and `w1c` act on a 1 and ignore a 0, so
   * a read-modify-write would be both wrong and pointless.
   */
  private static readonly WRITE_ONE: ReadonlySet<string> = new Set([
    "wo",
    "w1s",
    "w1c",
  ]);

  /**
   * True when writing this member composes the value instead of reading it
   * back first.
   */
  static isWriteOne(accessMod: string | undefined): boolean {
    return (
      accessMod !== undefined && RegisterAccessMode.WRITE_ONE.has(accessMod)
    );
  }
}

export default RegisterAccessMode;
