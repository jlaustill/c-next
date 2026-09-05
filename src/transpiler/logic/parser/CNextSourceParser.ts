/**
 * CNextSourceParser
 * Handles parsing of C-Next source code with error collection.
 *
 * Extracted from Pipeline.ts to reduce duplication and improve testability.
 */

import { CharStream, CommonTokenStream, Parser, Token } from "antlr4ng";

import { CNextLexer } from "./grammar/CNextLexer";
import { CNextParser, ProgramContext } from "./grammar/CNextParser";
import ITranspileError from "../../../lib/types/ITranspileError";

/**
 * ADR-016 rejects a scope declared inside another scope, permanently. C99 5.2.4.1
 * guarantees only 31 significant initial characters in an external identifier and
 * MISRA C:2012 Rule 5.1 is scored inside that budget, so a depth-4 member name
 * stops being distinct. It is not a simplification awaiting a later release.
 *
 * The rule is expressed in two places -- the grammar omits `scopeDeclaration` from
 * `scopeMember`, and this recognizer names the parse failure that omission causes.
 * They are welded by `tests/scope/nested-scope-error`: widening the grammar would
 * make the file parse, produce no error, and redden that fixture. Neither half can
 * change alone.
 *
 * The advice belongs in the message rather than in `helpText`, which no renderer
 * reads.
 */
const NESTED_SCOPE_MESSAGE =
  "error[E0430]: nested scopes are not allowed (ADR-016); use a flat scope such as Hardware_GPIO";

/**
 * The innermost rule ANTLR reports when `scope` appears where a scope member was
 * expected. The bare form lands in `scopeDeclaration` -- the `scopeMember*` loop's
 * sync -- while a `private`/`public` prefix lands in `scopeMember`. Both spellings
 * are load-bearing.
 *
 * The exception object is NOT part of the predicate: it is null for the bare form
 * and a NoViableAltException for the prefixed one, so keying on it would match one
 * case and miss the other. A `scope` keyword inside a struct, register or function
 * body reports that construct's own rule and is correctly not matched.
 */
const NESTED_SCOPE_RULES: ReadonlySet<string> = new Set([
  "scopeDeclaration",
  "scopeMember",
]);

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
   * Whether this syntax error is a nested scope declaration.
   *
   * Reads the parser's own state rather than re-deriving "inside a scope body"
   * from the token stream, which would be a second encoding of the grammar's
   * structure and free to drift from it.
   */
  private static isNestedScope(
    recognizer: unknown,
    offendingSymbol: Token | null,
  ): boolean {
    if (!(recognizer instanceof Parser)) return false;
    if (offendingSymbol?.type !== CNextParser.SCOPE) return false;
    return NESTED_SCOPE_RULES.has(recognizer.getRuleInvocationStack()[0]);
  }

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
    let nestedScopeReported = false;

    const errorListener = {
      syntaxError(
        recognizer: unknown,
        offendingSymbol: Token | null,
        line: number,
        charPositionInLine: number,
        msg: string,
      ): void {
        if (CNextSourceParser.isNestedScope(recognizer, offendingSymbol)) {
          nestedScopeReported = true;
          errors.push({
            line,
            column: charPositionInLine,
            message: NESTED_SCOPE_MESSAGE,
            severity: "error" as const,
          });
          return;
        }

        // Once a nested scope is rejected, ANTLR's recovery moves the inner
        // block out and reports the outer `}` as extraneous -- noise about a tree that
        // is already known to be wrong. Suppressing it is what lets the fixture
        // assert the RULE instead of the parser's token set, which is the whole
        // point of #1306. Only PARSER errors are dropped: lexer errors describe
        // the input rather than the recovery, and a further nested scope is
        // reported by the branch above rather than swallowed here.
        if (nestedScopeReported && recognizer instanceof Parser) return;

        errors.push({
          line,
          column: charPositionInLine,
          message: msg,
          severity: "error" as const,
        });
      },
      reportAmbiguity() {},
      reportAttemptingFullContext() {},
      reportContextSensitivity() {},
    };

    // Add error listener to both lexer and parser
    lexer.removeErrorListeners();
    lexer.addErrorListener(errorListener);
    parser.removeErrorListeners();
    parser.addErrorListener(errorListener);

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
