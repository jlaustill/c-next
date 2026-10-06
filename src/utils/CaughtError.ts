/**
 * The one reading of a value a `catch` received. JavaScript can throw anything,
 * so an `Error` gives its message and any other value its `String` form (#1896).
 */
class CaughtError {
  static messageOf(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}

export default CaughtError;
