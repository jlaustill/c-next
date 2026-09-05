/**
 * Why a fixture's generated binary was not executed.
 *
 * Issue #1397: the harness printed `(exec skipped: ARM)` for every skip, but
 * only one of the three places that skip execution is about ARM. The other two
 * are transpile-only -- the `--transpile-only` flag and the per-file
 * `test-transpile-only` marker -- so the stated cause was wrong in the common
 * case, including the default local `npm test -- <path> --transpile-only`.
 *
 * The fact was never recorded, only guessed at the point of printing. It is
 * recorded now, because a report that names a cause has to know it.
 */
type TExecSkipReason =
  /** Generated code needs an ARM runtime this host cannot execute. */
  | "arm"
  /** Compilation and execution were skipped, so there was nothing to run. */
  | "transpile-only"
  /**
   * Execution was skipped and the reason was not recorded. Renders without a
   * cause rather than inventing one -- the failure mode this type exists to
   * end.
   */
  | "unspecified";

export default TExecSkipReason;
