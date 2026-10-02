import IExecFailure from "./types/IExecFailure";

/**
 * Reads a failed `execFileSync` / `execSync` / promisified `execFile` from the
 * `unknown` its `catch` receives.
 *
 * Every caller needs the same three facts -- the captured streams and the exit
 * status -- and each used to assert them into existence with its own inline
 * cast (`error as { stderr?: string; ... }`), in three different shapes, or
 * reach them through `any`. This narrows instead of asserting: a field is read
 * only if the value has it, as text, so a non-Error throw or a Buffer stream
 * is handled rather than assumed away (#1489).
 *
 * Which stream a caller reports first stays with the caller. That is the tool's
 * policy -- flawfinder writes findings to stdout, cppcheck to stderr -- not a
 * fact about the failure.
 */
class ExecFailure {
  static of(error: unknown): IExecFailure {
    const message = error instanceof Error ? error.message : String(error);
    if (typeof error !== "object" || error === null) {
      return {
        message,
        stdout: undefined,
        stderr: undefined,
        status: undefined,
      };
    }
    return {
      message,
      stdout: ExecFailure.text("stdout" in error ? error.stdout : undefined),
      stderr: ExecFailure.text("stderr" in error ? error.stderr : undefined),
      status:
        "status" in error && typeof error.status === "number"
          ? error.status
          : undefined,
    };
  }

  /** A captured stream is a string, or a Buffer when no `encoding` was set. */
  private static text(stream: unknown): string | undefined {
    if (typeof stream === "string") return stream;
    return Buffer.isBuffer(stream) ? stream.toString("utf-8") : undefined;
  }
}

export default ExecFailure;
