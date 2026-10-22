import { CharStream, Token } from "antlr4ng";
import type { ANTLRErrorListener } from "antlr4ng";
import { CnxLexer } from "./grammar/CnxLexer";

/**
 * How a node is spelled for a message or an emitted value (#1991 review): its
 * tokens in source order, with every gap between two of them -- spaces, line
 * breaks or comments -- read as one space. A comment never reaches generated C
 * or a diagnostic, and tokens the source kept apart stay apart, which a plain
 * token join loses (`1 - -1` reads back `1--1`).
 *
 * The lexer decides what a comment is, so the slice is lexed again with it
 * rather than scanned by a second set of rules. A slice with no `/` and no run
 * of spaces holds no gap to change and is returned as it is.
 */
class SourceSpelling {
  static of(stream: CharStream, start: number, stop: number): string {
    const slice = stream.getTextFromRange(start, stop);
    if (!SourceSpelling.mayHoldGap(slice)) return slice;
    const lexer = new CnxLexer(CharStream.fromString(slice));
    let failed = false;
    const listener: ANTLRErrorListener = {
      syntaxError: () => {
        failed = true;
      },
      reportAmbiguity: () => {},
      reportAttemptingFullContext: () => {},
      reportContextSensitivity: () => {},
    };
    lexer.removeErrorListeners();
    lexer.addErrorListener(listener);
    const tokens = lexer
      .getAllTokens()
      .filter((token) => token.channel === Token.DEFAULT_CHANNEL);
    if (failed || tokens.length === 0) return slice;
    let spelled = tokens[0].text ?? "";
    for (let i = 1; i < tokens.length; i++) {
      const gap = tokens[i].start > tokens[i - 1].stop + 1;
      spelled += (gap ? " " : "") + (tokens[i].text ?? "");
    }
    return spelled;
  }

  private static mayHoldGap(slice: string): boolean {
    return slice.includes("/") || /\s{2}|[\t\r\n]/.test(slice);
  }
}

export default SourceSpelling;
