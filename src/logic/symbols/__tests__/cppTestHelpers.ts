/**
 * Test helpers for C++ symbol collector unit tests
 * Provides utilities to parse C++ code strings into parse trees.
 */

import { CharStream, CommonTokenStream } from "antlr4ng";
import { CPP14Lexer } from "../../parser/cpp/grammar/CPP14Lexer";
import { CPP14Parser } from "../../parser/cpp/grammar/CPP14Parser";

/**
 * Parse a C++ code string into a TranslationUnitContext.
 * Throws if there are parse errors.
 */
function parseCpp(code: string): ReturnType<CPP14Parser["translationUnit"]> {
  const charStream = CharStream.fromString(code);
  const lexer = new CPP14Lexer(charStream);
  const tokenStream = new CommonTokenStream(lexer);
  const parser = new CPP14Parser(tokenStream);

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

  const tree = parser.translationUnit();

  if (errors.length > 0) {
    throw new Error(`Parse errors:\n${errors.join("\n")}`);
  }

  return tree;
}

export default parseCpp;
