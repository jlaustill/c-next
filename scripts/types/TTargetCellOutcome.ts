/**
 * How one target cell of a fixture ended (#1668 box 15).
 *
 * - `executed`: compiled for the host and, being a `test-execution` fixture,
 *   run there
 * - `compiled`: compile-checked for its target, and not run
 * - `xfail`: failed, as a `test-target-xfail` marker says it must until its
 *   issue is fixed
 * - `not-compiled`: the target names no toolchain (an inline description, or a
 *   catalog row such as `esp32`), so nothing could compile for it
 * - `failed`
 */
type TTargetCellOutcome =
  | "executed"
  | "compiled"
  | "xfail"
  | "not-compiled"
  | "failed";

export default TTargetCellOutcome;
