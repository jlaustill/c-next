import type ITranspileError from "../types/ITranspileError";
import ErrorLocation from "./ErrorLocation";

/**
 * The one reading of a value a `catch` received. JavaScript can throw anything,
 * so an `Error` gives its message and any other value its `String` form (#1896).
 */
class CaughtError {
  static messageOf(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  /**
   * True for a deliberate C-Next diagnostic rather than an incidental failure.
   *
   * Keyed on the `E<NNNN>: ` prefix -- the SHAPE, not any one code -- because
   * that is already this codebase's identity for a diagnostic: `.expected.error`
   * fixtures assert it and `docs/diagnostic-manifest.md` is generated from it.
   * Reading the existing identity avoids inventing a second one to keep in step.
   * Here rather than on the orchestrator since #1443: 1.3's header recovery and
   * the host's header loop both make the decision, and must make it one way.
   */
  static isDiagnostic(error: unknown): boolean {
    return error instanceof Error && /^E\d{4}: /.test(error.message);
  }

  /**
   * A thrown failure as the diagnostic every pass reports it as, at the
   * location its message carries. One decision for the host and for
   * `TreePasses` (#1932), so changing the wording means editing one place.
   */
  static asTranspileError(error: unknown): ITranspileError {
    const parsed = ErrorLocation.parse(CaughtError.messageOf(error));
    return {
      line: parsed.line,
      column: parsed.column,
      message: `Code generation failed: ${parsed.message}`,
      severity: "error",
    };
  }
}

export default CaughtError;
