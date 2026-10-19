import DeclarationSite from "../cnx/utils/DeclarationSite";
import type ITranspileError from "../cnx/types/ITranspileError";

/**
 * How the CLI writes one diagnostic: `file:line:col message`, with the advice
 * indented beneath it.
 *
 * #2165: errors (`ResultPrinter`) and 2.1's warnings (`Transpiler`) each spelled
 * this out, so the two could drift; the config load's E0918 is a third
 * printer. Error fixtures are generated from this output, so what a user reads
 * and what the corpus asserts are the same text.
 */
class DiagnosticText {
  /**
   * @param sourcePath - Where the diagnostic is placed; a warning is placed at
   *   the file it was collected for
   */
  static of(
    diagnostic: ITranspileError,
    sourcePath: string | undefined = diagnostic.sourcePath,
  ): string {
    const position = `${diagnostic.line}:${diagnostic.column}`;
    const location = sourcePath
      ? `${DeclarationSite.displayPath(sourcePath)}:${position}`
      : position;
    const help = diagnostic.helpText
      ? `\n       help: ${diagnostic.helpText}`
      : "";
    return `${location} ${diagnostic.message}${help}`;
  }
}

export default DiagnosticText;
