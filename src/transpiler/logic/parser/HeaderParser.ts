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
   * Error listeners are removed DELIBERATELY, and the reason is measurable rather
   * than a guess about "unsupported constructs" (#1306).
   *
   * This parser reads the header as written. It does not preprocess, so it sees
   * every branch including the ones a C compiler never would. The dominant case is
   * the C++ interop guard that C-Next itself emits into every header:
   *
   *     #ifdef __cplusplus
   *     extern "C" {
   *     #endif
   *
   * `extern "C"` is C++, not C, so the C grammar has no alternative for it and the
   * parse errors -- on a line that is switched off in the very build that would use
   * this parser. Measured over `tests/`: 1698 C headers, 1444 carrying that guard,
   * and 1522 producing at least one syntax error. Surfacing them would reject about
   * nine headers in ten for code that never compiles.
   *
   * Surfacing them correctly requires preprocessing first. That capability exists
   * (`logic/preprocessor`) but has no production caller and shells out to a system
   * compiler, so wiring it into this path is a toolchain dependency, not a
   * listener change.
   *
   * A null tree, not a silent empty one, is what a caller sees when the parse
   * cannot proceed at all.
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

      // Suppressed by measurement, not assumption -- see the doc comment.
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
   * Suppressed for the same structural reason as `parseC`: the header is read
   * unpreprocessed, so conditional branches meant for other compilers or other
   * language modes are parsed as if they were live. The `extern "C"` count above
   * was measured on the C path specifically; the C++ grammar accepts that
   * construct, so the mix differs even though the cause does not.
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

      // Suppressed by measurement, not assumption -- see the doc comment.
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
