/**
 * Test helpers for C symbol collector unit tests
 * Provides utilities to parse C code strings into parse trees.
 */

import { CharStream, CommonTokenStream } from "antlr4ng";
import { CLexer } from "../../parser/c/grammar/CLexer";
import {
  CParser,
  CompilationUnitContext,
} from "../../parser/c/grammar/CParser";

/**
 * Parse a C code string into a CompilationUnitContext.
 * Throws if there are parse errors.
 */
function parseC(code: string): CompilationUnitContext {
  const charStream = CharStream.fromString(code);
  const lexer = new CLexer(charStream);
  const tokenStream = new CommonTokenStream(lexer);
  const parser = new CParser(tokenStream);

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

  const tree = parser.compilationUnit();

  if (errors.length > 0) {
    throw new Error(`Parse errors:\n${errors.join("\n")}`);
  }

  return tree;
}

export default parseC;
