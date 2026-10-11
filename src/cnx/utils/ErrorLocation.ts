/**
 * The location a thrown message carries, if any. Plain text in, plain data
 * out: separate from `ParserUtils` so a module that holds no parse tree can
 * read one without importing a grammar helper (#1932).
 */
class ErrorLocation {
  /**
   * Parse a "line:column message" prefix from an error message.
   *
   * CodeGenerator validation errors embed location as "line:col message".
   * This extracts the location and returns the clean message, or defaults
   * to line 1, column 0 if no prefix is found.
   */
  static parse(message: string): {
    line: number;
    column: number;
    message: string;
  } {
    const colonIdx = message.indexOf(":");
    if (colonIdx < 1) {
      return { line: 1, column: 0, message };
    }

    const lineStr = message.substring(0, colonIdx);
    if (!/^\d+$/.test(lineStr)) {
      return { line: 1, column: 0, message };
    }

    const afterColon = message.substring(colonIdx + 1);
    const spaceIdx = afterColon.indexOf(" ");
    if (spaceIdx < 1) {
      return { line: 1, column: 0, message };
    }

    const colStr = afterColon.substring(0, spaceIdx);
    if (!/^\d+$/.test(colStr)) {
      return { line: 1, column: 0, message };
    }

    return {
      line: Number.parseInt(lineStr, 10),
      column: Number.parseInt(colStr, 10),
      message: afterColon.substring(spaceIdx + 1),
    };
  }
}

export default ErrorLocation;
