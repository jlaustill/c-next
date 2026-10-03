/**
 * What a failed child process left behind, as `ExecFailure.of` reads it from
 * the value a `catch` receives.
 *
 * The streams and status are `undefined` when the thrown value does not carry
 * them -- a spawn that never started, or a non-Error throw -- rather than `""`,
 * so a caller's `||` or `??` fallback behaves as it did on the raw error.
 */
interface IExecFailure {
  message: string;
  stdout: string | undefined;
  stderr: string | undefined;
  /** The child's exit code, when it ran and exited. */
  status: number | undefined;
}

export default IExecFailure;
