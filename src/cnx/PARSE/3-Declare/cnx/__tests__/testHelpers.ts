/**
 * Test helpers for cnx collector unit tests
 * Provides utilities to parse cnx code strings into parse trees.
 */

import { CharStream, CommonTokenStream } from "antlr4ng";
import { CnxLexer } from "../../../2-Parse/grammar/CnxLexer";
import { CnxParser, ProgramContext } from "../../../2-Parse/grammar/CnxParser";

/**
 * Parse a cnx code string into a ProgramContext.
 * Throws if there are parse errors.
 */
function parse(code: string): ProgramContext {
  const charStream = CharStream.fromString(code);
  const lexer = new CnxLexer(charStream);
  const tokenStream = new CommonTokenStream(lexer);
  const parser = new CnxParser(tokenStream);

  const errors: string[] = [];
  parser.removeErrorListeners();
  parser.addErrorListener({
    syntaxError: (_recognizer, _offendingSymbol, line, charPos, msg) => {
      errors.push(`${line}:${charPos} ${msg}`);
    },
    reportAmbiguity: () => {},
    reportAttemptingFullContext: () => {},
    reportContextSensitivity: () => {},
  });

  const tree = parser.program();

  if (errors.length > 0) {
    throw new Error(`Parse errors:\n${errors.join("\n")}`);
  }

  return tree;
}

export default parse;
