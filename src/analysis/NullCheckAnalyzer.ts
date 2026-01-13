/**
 * Null Check Analyzer
 * Enforces NULL safety for C library interop (ADR-047)
 *
 * C-Next eliminates null bugs by design. This analyzer provides a controlled
 * exception for C interop: NULL comparisons are allowed ONLY for whitelisted
 * stream I/O functions (fgets, fputs, etc.), and the comparison is REQUIRED.
 *
 * Rules:
 * - C stream functions returning nullable pointers must be NULL-checked
 * - NULL keyword only valid in equality comparison context (= or !=)
 * - Cannot store nullable return in C-Next variable
 * - Forbidden functions (fopen, malloc) are not supported in v1
 */

import { ParseTreeWalker } from "antlr4ng";
import { CNextListener } from "../parser/grammar/CNextListener";
import * as Parser from "../parser/grammar/CNextParser";
import { INullCheckError } from "./types/INullCheckError";

export { INullCheckError };

/**
 * Metadata for C library functions that can return NULL
 */
interface ICLibraryFunction {
  header: string;
  nullMeaning: string;
  docsUrl: string;
}

/**
 * Whitelisted stream I/O functions that can return NULL
 * These are the only functions where NULL comparison is allowed
 */
const C_STREAM_FUNCTIONS: Map<string, ICLibraryFunction> = new Map([
  [
    "fgets",
    {
      header: "stdio.h",
      nullMeaning: "EOF reached or read error occurred",
      docsUrl: "https://en.cppreference.com/w/c/io/fgets",
    },
  ],
  [
    "fputs",
    {
      header: "stdio.h",
      nullMeaning: "Write error occurred (returns EOF, not NULL)",
      docsUrl: "https://en.cppreference.com/w/c/io/fputs",
    },
  ],
  [
    "fgetc",
    {
      header: "stdio.h",
      nullMeaning: "EOF reached or read error occurred (returns EOF)",
      docsUrl: "https://en.cppreference.com/w/c/io/fgetc",
    },
  ],
  [
    "fputc",
    {
      header: "stdio.h",
      nullMeaning: "Write error occurred (returns EOF)",
      docsUrl: "https://en.cppreference.com/w/c/io/fputc",
    },
  ],
  [
    "gets",
    {
      header: "stdio.h",
      nullMeaning: "EOF reached or read error (DEPRECATED - use fgets)",
      docsUrl: "https://en.cppreference.com/w/c/io/gets",
    },
  ],
]);

/**
 * Forbidden functions that return pointers but aren't supported in v1
 * These require ADR-103 (stream handling) infrastructure
 */
const FORBIDDEN_NULLABLE_FUNCTIONS: Map<string, string> = new Map([
  ["fopen", "File handling will be available via ADR-103 (stream handling)"],
  ["fclose", "File handling will be available via ADR-103 (stream handling)"],
  ["malloc", "Dynamic allocation is forbidden by ADR-003"],
  ["calloc", "Dynamic allocation is forbidden by ADR-003"],
  ["realloc", "Dynamic allocation is forbidden by ADR-003"],
  ["free", "Dynamic allocation is forbidden by ADR-003"],
  ["getenv", "Environment access requires ADR-103 infrastructure"],
  ["strstr", "Returns pointer into string - use indexOf pattern instead"],
  ["strchr", "Returns pointer into string - use indexOf pattern instead"],
  ["strrchr", "Returns pointer into string - use indexOf pattern instead"],
  ["memchr", "Returns pointer into memory - not supported"],
]);

/**
 * Listener that walks the parse tree and checks NULL usage
 */
class NullCheckListener extends CNextListener {
  private analyzer: NullCheckAnalyzer;

  /** Whether we're currently inside an equality comparison (= or !=) */
  private inEqualityComparison = false;

  /** Track the function name in the current equality comparison (if any) */
  private equalityComparisonFuncName: string | null = null;

  /** Track if the current equality comparison contains NULL */
  private equalityComparisonHasNull = false;

  constructor(analyzer: NullCheckAnalyzer) {
    super();
    this.analyzer = analyzer;
  }

  // ========================================================================
  // Equality Comparison Context
  // ========================================================================

  override enterEqualityExpression = (
    ctx: Parser.EqualityExpressionContext,
  ): void => {
    // Check if this is actually a comparison (has = or !=)
    // The grammar has equalityExpression : relationalExpression (('=' | '!=') relationalExpression)*
    const children = ctx.children ?? [];

    // Look for comparison operators
    for (const child of children) {
      const text = child.getText();
      if (text === "=" || text === "!=") {
        this.inEqualityComparison = true;
        this.equalityComparisonFuncName = null;
        this.equalityComparisonHasNull = false;
        return;
      }
    }
  };

  override exitEqualityExpression = (
    ctx: Parser.EqualityExpressionContext,
  ): void => {
    // Check if this was a comparison (has = or !=)
    const children = ctx.children ?? [];
    let isComparison = false;
    for (const child of children) {
      const text = child.getText();
      if (text === "=" || text === "!=") {
        isComparison = true;
        break;
      }
    }

    if (isComparison) {
      // If we had a stream function in this comparison, it's OK
      // (the function was used correctly in a NULL check)
      this.inEqualityComparison = false;
      this.equalityComparisonFuncName = null;
      this.equalityComparisonHasNull = false;
    }
  };

  // ========================================================================
  // Function Calls
  // ========================================================================

  override enterPostfixExpression = (
    ctx: Parser.PostfixExpressionContext,
  ): void => {
    const primary = ctx.primaryExpression();
    if (!primary?.IDENTIFIER()) return;

    const funcName = primary.IDENTIFIER()!.getText();
    const ops = ctx.postfixOp();

    // Check if it's a function call (has argument list or parens)
    const isCall = ops.some((op) => {
      const text = op.getText();
      return text.startsWith("(");
    });

    if (!isCall) return;

    const line = ctx.start?.line ?? 0;
    const column = ctx.start?.column ?? 0;

    // Check forbidden functions (always an error)
    if (FORBIDDEN_NULLABLE_FUNCTIONS.has(funcName)) {
      this.analyzer.reportForbiddenFunction(funcName, line, column);
      return;
    }

    // Check stream functions
    if (C_STREAM_FUNCTIONS.has(funcName)) {
      if (this.inEqualityComparison) {
        // Track that we found a stream function in this comparison
        this.equalityComparisonFuncName = funcName;
      } else {
        // Stream function used outside of NULL comparison - error
        this.analyzer.reportMissingNullCheck(funcName, line, column);
      }
    }
  };

  // ========================================================================
  // NULL Literal
  // ========================================================================

  override enterLiteral = (ctx: Parser.LiteralContext): void => {
    const text = ctx.getText();

    // Check for uppercase NULL (C library NULL)
    if (text === "NULL") {
      const line = ctx.start?.line ?? 0;
      const column = ctx.start?.column ?? 0;

      if (this.inEqualityComparison) {
        // NULL in comparison context - OK
        this.equalityComparisonHasNull = true;
      } else {
        // NULL outside comparison - error
        this.analyzer.reportInvalidNullUsage(line, column);
      }
    }
  };

  // ========================================================================
  // Variable Assignment (check for storing stream function result)
  // ========================================================================

  override enterVariableDeclaration = (
    ctx: Parser.VariableDeclarationContext,
  ): void => {
    // Check if initialization contains a stream function call
    // Grammar: type IDENTIFIER ('<-' expression)?
    const expr = ctx.expression();
    if (!expr) return;

    const funcName = this.extractFunctionCallName(expr);
    if (funcName && C_STREAM_FUNCTIONS.has(funcName)) {
      const varName = ctx.IDENTIFIER().getText();
      const line = ctx.start?.line ?? 0;
      const column = ctx.start?.column ?? 0;
      this.analyzer.reportInvalidStorage(varName, funcName, line, column);
    }
  };

  override enterAssignmentStatement = (
    ctx: Parser.AssignmentStatementContext,
  ): void => {
    // Check if RHS contains a stream function call
    const expr = ctx.expression();
    const funcName = this.extractFunctionCallName(expr);

    if (funcName && C_STREAM_FUNCTIONS.has(funcName)) {
      const target = ctx.assignmentTarget();
      const varName = target.getText();
      const line = ctx.start?.line ?? 0;
      const column = ctx.start?.column ?? 0;
      this.analyzer.reportInvalidStorage(varName, funcName, line, column);
    }
  };

  /**
   * Extract function call name from an expression (if it's a simple call)
   */
  private extractFunctionCallName(
    ctx: Parser.ExpressionContext,
  ): string | null {
    // Simple heuristic: look for identifier followed by parens in text
    // This could be improved with deeper AST analysis
    const text = ctx.getText();

    for (const funcName of C_STREAM_FUNCTIONS.keys()) {
      if (text.includes(`${funcName}(`)) {
        return funcName;
      }
    }

    return null;
  }
}

/**
 * Analyzes C-Next AST for NULL safety violations
 */
export class NullCheckAnalyzer {
  private errors: INullCheckError[] = [];

  /** Included headers (for context) */
  private includedHeaders: Set<string> = new Set();

  /**
   * Analyze a parsed program for NULL safety errors
   * @param tree The parsed program AST
   * @returns Array of NULL check errors
   */
  public analyze(tree: Parser.ProgramContext): INullCheckError[] {
    this.errors = [];
    this.includedHeaders = new Set();

    // Collect included headers
    this.collectIncludes(tree);

    // Walk tree and check NULL usage
    const listener = new NullCheckListener(this);
    ParseTreeWalker.DEFAULT.walk(listener, tree);

    return this.errors;
  }

  /**
   * Collect included headers for context
   */
  private collectIncludes(tree: Parser.ProgramContext): void {
    for (const include of tree.includeDirective()) {
      const text = include.getText();
      const match = text.match(/#include\s*[<"]([^>"]+)[>"]/);
      if (match) {
        this.includedHeaders.add(match[1]);
      }
    }
  }

  /**
   * Check if stdio.h is included (required for stream functions)
   */
  public hasStdioIncluded(): boolean {
    return this.includedHeaders.has("stdio.h");
  }

  /**
   * Report error: stream function used without NULL check
   */
  public reportMissingNullCheck(
    funcName: string,
    line: number,
    column: number,
  ): void {
    this.errors.push({
      code: "E0901",
      functionName: funcName,
      line,
      column,
      message: `C library function '${funcName}' can return NULL - must check result`,
      helpText: `Use: if (${funcName}(...) != NULL) { ... }`,
    });
  }

  /**
   * Report error: forbidden function not supported in v1
   */
  public reportForbiddenFunction(
    funcName: string,
    line: number,
    column: number,
  ): void {
    const reason =
      FORBIDDEN_NULLABLE_FUNCTIONS.get(funcName) ?? "Not supported in v1";
    this.errors.push({
      code: "E0902",
      functionName: funcName,
      line,
      column,
      message: `C library function '${funcName}' returns a pointer - not supported in C-Next v1`,
      helpText: reason,
    });
  }

  /**
   * Report error: NULL used outside comparison context
   */
  public reportInvalidNullUsage(line: number, column: number): void {
    this.errors.push({
      code: "E0903",
      functionName: "NULL",
      line,
      column,
      message: "NULL can only be used in comparison context",
      helpText: "Use: if (func(...) != NULL) or if (func(...) = NULL)",
    });
  }

  /**
   * Report error: trying to store stream function result in variable
   */
  public reportInvalidStorage(
    varName: string,
    funcName: string,
    line: number,
    column: number,
  ): void {
    this.errors.push({
      code: "E0904",
      functionName: funcName,
      line,
      column,
      message: `Cannot store '${funcName}' return value in variable '${varName}'`,
      helpText: `C library pointer returns cannot be stored. Use direct comparison: if (${funcName}(...) != NULL)`,
    });
  }

  /**
   * Get metadata for a C stream function (for VS Code tooltips)
   */
  public static getStreamFunctionInfo(
    funcName: string,
  ): ICLibraryFunction | null {
    return C_STREAM_FUNCTIONS.get(funcName) ?? null;
  }

  /**
   * Check if a function is a whitelisted stream function
   */
  public static isStreamFunction(funcName: string): boolean {
    return C_STREAM_FUNCTIONS.has(funcName);
  }

  /**
   * Check if a function is forbidden (returns pointer, not supported)
   */
  public static isForbiddenFunction(funcName: string): boolean {
    return FORBIDDEN_NULLABLE_FUNCTIONS.has(funcName);
  }
}

export default NullCheckAnalyzer;
