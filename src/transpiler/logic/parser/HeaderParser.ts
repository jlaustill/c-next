/**
 * HeaderParser
 * Parses C and C++ header files for symbol extraction.
 *
 * Encapsulates ANTLR lexer/parser setup for header files,
 * providing a clean interface for the Transpiler to use.
 */

import { CharStream, CommonTokenStream } from "antlr4ng";

import { CLexer } from "./c/grammar/CLexer";
import { CParser, CompilationUnitContext } from "./c/grammar/CParser";
import { CPP14Lexer } from "./cpp/grammar/CPP14Lexer";
import { CPP14Parser, TranslationUnitContext } from "./cpp/grammar/CPP14Parser";

/**
 * Result of parsing a C header
 */
interface ICParseResult {
  /** The parsed AST, or null if parsing failed */
  tree: CompilationUnitContext | null;
}

/**
 * Result of parsing a C++ header
 */
interface ICppParseResult {
  /** The parsed AST, or null if parsing failed */
  tree: TranslationUnitContext | null;
}

/**
 * Parses C and C++ header files
 */
class HeaderParser {
  /**
   * Parse a C header file
   *
   * Error listeners are removed to suppress parse errors, as headers
   * may contain constructs that the C parser doesn't fully support.
   *
   * @param content - The header file content
   * @returns Parse result with tree (null if parsing failed)
   */
  static parseC(content: string): ICParseResult {
    try {
      const charStream = CharStream.fromString(content);
      const lexer = new CLexer(charStream);
      const tokenStream = new CommonTokenStream(lexer);
      const parser = new CParser(tokenStream);

      // Suppress parse errors - headers may have unsupported constructs
      parser.removeErrorListeners();

      const tree = parser.compilationUnit();
      return { tree };
    } catch {
      // Return null tree on parse failure
      return { tree: null };
    }
  }

  /**
   * Parse a C++ header file
   *
   * Error listeners are removed to suppress parse errors, as headers
   * may contain complex C++ features that aren't fully supported.
   *
   * @param content - The header file content
   * @returns Parse result with tree (null if parsing failed)
   */
  static parseCpp(content: string): ICppParseResult {
    try {
      const charStream = CharStream.fromString(content);
      const lexer = new CPP14Lexer(charStream);
      const tokenStream = new CommonTokenStream(lexer);
      const parser = new CPP14Parser(tokenStream);

      // Suppress parse errors - headers may have complex C++ features
      parser.removeErrorListeners();

      const tree = parser.translationUnit();
      return { tree };
    } catch {
      // Return null tree on parse failure
      return { tree: null };
    }
  }
}

export default HeaderParser;
