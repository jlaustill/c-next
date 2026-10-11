/**
 * The message of a coded error: `error[CODE]: message`.
 *
 * `ITranspileError` has no `code` field, so the code is carried in the message,
 * and this is the one place that writes it there. #1542 ruling 3: the spelling
 * was inlined at twelve sites across 1.1, 1.2, 1.4, 2.1 and the orchestrator.
 * Every one of those layers reports a coded error, which is why this lives in
 * `utils/`.
 */
class CodedErrorText {
  static of(
    code: string,
    message: string,
    severity: "error" | "warning" = "error",
  ): string {
    return `${severity}[${code}]: ${message}`;
  }
}

export default CodedErrorText;
