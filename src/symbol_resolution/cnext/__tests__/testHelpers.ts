/**
 * Test helpers for C-Next collector unit tests
 * Provides utilities to parse C-Next code strings into parse trees.
 */

import { CharStream, CommonTokenStream } from "antlr4ng";
import { CNextLexer } from "../../../antlr_parser/grammar/CNextLexer";
import {
  CNextParser,
  ProgramContext,
} from "../../../antlr_parser/grammar/CNextParser";

/**
 * Parse a C-Next code string into a ProgramContext.
 * Throws if there are parse errors.
 */
function parse(code: string): ProgramContext {
  const charStream = CharStream.fromString(code);
  const lexer = new CNextLexer(charStream);
  const tokenStream = new CommonTokenStream(lexer);
  const parser = new CNextParser(tokenStream);

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
