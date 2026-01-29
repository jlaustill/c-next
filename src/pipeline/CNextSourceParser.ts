/**
 * CNextSourceParser
 * Handles parsing of C-Next source code with error collection.
 *
 * Extracted from Pipeline.ts to reduce duplication and improve testability.
 */

import { CharStream, CommonTokenStream } from "antlr4ng";

import { CNextLexer } from "../antlr_parser/grammar/CNextLexer";
import {
  CNextParser,
  ProgramContext,
} from "../antlr_parser/grammar/CNextParser";
import ITranspileError from "../lib/types/ITranspileError";

/**
 * Result of parsing C-Next source code
 */
interface IParseResult {
  /** The parsed AST */
  tree: ProgramContext;
  /** Token stream for code generation */
  tokenStream: CommonTokenStream;
  /** Any parse errors encountered */
  errors: ITranspileError[];
  /** Number of top-level declarations */
  declarationCount: number;
}

/**
 * Parses C-Next source code and collects errors
 */
class CNextSourceParser {
  /**
   * Parse C-Next source code
   * @param source - The source code string to parse
   * @returns Parse result with tree, token stream, errors, and declaration count
   */
  static parse(source: string): IParseResult {
    const charStream = CharStream.fromString(source);
    const lexer = new CNextLexer(charStream);
    const tokenStream = new CommonTokenStream(lexer);
    const parser = new CNextParser(tokenStream);

    const errors: ITranspileError[] = [];
    parser.removeErrorListeners();
    parser.addErrorListener({
      syntaxError(
        _recognizer,
        _offendingSymbol,
        line,
        charPositionInLine,
        msg,
      ) {
        errors.push({
          line,
          column: charPositionInLine,
          message: msg,
          severity: "error",
        });
      },
      reportAmbiguity() {},
      reportAttemptingFullContext() {},
      reportContextSensitivity() {},
    });

    const tree = parser.program();
    const declarationCount = tree.declaration().length;

    return {
      tree,
      tokenStream,
      errors,
      declarationCount,
    };
  }
}

export default CNextSourceParser;
