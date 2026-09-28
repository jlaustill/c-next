/**
 * How one target cell of a fixture ended (#1668 box 15).
 *
 * - `executed`: compiled for the host and, being a `test-execution` fixture,
 *   run there
 * - `compiled`: compile-checked for its target, and not run
 * - `xfail`: failed, as a `test-target-xfail` marker says it must until its
 *   issue is fixed
 * - `failed`, which includes a cell nothing compiles for (#1760 second
 *   review): an inline description compiles with the toolchain of the
 *   catalog row sharing its facts, and a fixture that must not be compiled
 *   is `test-transpile-only`
 */
type TTargetCellOutcome = "executed" | "compiled" | "xfail" | "failed";

export default TTargetCellOutcome;
