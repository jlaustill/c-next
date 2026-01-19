/**
 * Null Check Analyzer
 * Enforces NULL safety for C library interop (ADR-046)
 *
 * C-Next eliminates null bugs by design. This analyzer provides a controlled
 * exception for C interop: Variables storing nullable C pointer returns must
 * use the c_ prefix to indicate they hold C interop values.
 *
 * Rules:
 * - C functions returning nullable pointers require c_ prefix for storage
 * - NULL keyword only valid in equality comparison context (= or !=)
 * - Dynamic allocation functions (malloc, etc.) remain forbidden (ADR-003)
 */

import { ParseTreeWalker } from "antlr4ng";
import { CNextListener } from "../parser/grammar/CNextListener";
import * as Parser from "../parser/grammar/CNextParser";
import INullCheckError from "./types/INullCheckError";

/**
 * Metadata for C library functions that can return NULL
 */
interface ICLibraryFunction {
  header: string;
  nullMeaning: string;
  docsUrl: string;
}

/**
 * C library functions that return nullable pointers
 * These require the c_ prefix when stored in variables (ADR-046)
 */
const NULLABLE_C_FUNCTIONS: Map<string, ICLibraryFunction> = new Map([
  // Stream I/O
  [
    "fgets",
    {
      header: "stdio.h",
      nullMeaning: "EOF or error",
      docsUrl: "https://en.cppreference.com/w/c/io/fgets",
    },
  ],
  [
    "fputs",
    {
      header: "stdio.h",
      nullMeaning: "Write error (EOF)",
      docsUrl: "https://en.cppreference.com/w/c/io/fputs",
    },
  ],
  [
    "fgetc",
    {
      header: "stdio.h",
      nullMeaning: "EOF or error",
      docsUrl: "https://en.cppreference.com/w/c/io/fgetc",
    },
  ],
  [
    "fputc",
    {
      header: "stdio.h",
      nullMeaning: "Write error (EOF)",
      docsUrl: "https://en.cppreference.com/w/c/io/fputc",
    },
  ],
  [
    "gets",
    {
      header: "stdio.h",
      nullMeaning: "EOF or error (DEPRECATED)",
      docsUrl: "https://en.cppreference.com/w/c/io/gets",
    },
  ],
  // File handling (now allowed with c_ prefix)
  [
    "fopen",
    {
      header: "stdio.h",
      nullMeaning: "Failed to open file",
      docsUrl: "https://en.cppreference.com/w/c/io/fopen",
    },
  ],
  [
    "freopen",
    {
      header: "stdio.h",
      nullMeaning: "Failed to reopen",
      docsUrl: "https://en.cppreference.com/w/c/io/freopen",
    },
  ],
  [
    "tmpfile",
    {
      header: "stdio.h",
      nullMeaning: "Failed to create temp file",
      docsUrl: "https://en.cppreference.com/w/c/io/tmpfile",
    },
  ],
  // String functions
  [
    "strstr",
    {
      header: "string.h",
      nullMeaning: "Substring not found",
      docsUrl: "https://en.cppreference.com/w/c/string/byte/strstr",
    },
  ],
  [
    "strchr",
    {
      header: "string.h",
      nullMeaning: "Character not found",
      docsUrl: "https://en.cppreference.com/w/c/string/byte/strchr",
    },
  ],
  [
    "strrchr",
    {
      header: "string.h",
      nullMeaning: "Character not found",
      docsUrl: "https://en.cppreference.com/w/c/string/byte/strrchr",
    },
  ],
  [
    "memchr",
    {
      header: "string.h",
      nullMeaning: "Byte not found",
      docsUrl: "https://en.cppreference.com/w/c/string/byte/memchr",
    },
  ],
  // Environment
  [
    "getenv",
    {
      header: "stdlib.h",
      nullMeaning: "Variable not found",
      docsUrl: "https://en.cppreference.com/w/c/program/getenv",
    },
  ],
]);

/**
 * Functions that remain forbidden (dynamic allocation - ADR-003)
 */
const FORBIDDEN_FUNCTIONS: Set<string> = new Set([
  "malloc",
  "calloc",
  "realloc",
  "free",
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

  /** Track variable names in the current equality comparison */
  private equalityComparisonVarNames: string[] = [];

  /** Whether we're currently inside a variable declaration (with c_ prefix handling) */
  private inVariableDeclarationWithNullable = false;

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
        // Extract variable names from the comparison
        this.equalityComparisonVarNames = this.extractVariableNames(ctx);
        return;
      }
    }
  };

  /**
   * Extract simple variable names from an equality expression
   */
  private extractVariableNames(
    ctx: Parser.EqualityExpressionContext,
  ): string[] {
    const names: string[] = [];
    // Get relational expressions (left and right sides of comparison)
    const children = ctx.relationalExpression();
    for (const child of children) {
      const text = child.getText();
      // Simple check: if it's a simple identifier and not NULL, add it
      if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(text) && text !== "NULL") {
        names.push(text);
      }
    }
    return names;
  }

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
      this.equalityComparisonVarNames = [];
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
    if (FORBIDDEN_FUNCTIONS.has(funcName)) {
      this.analyzer.reportForbiddenFunction(funcName, line, column);
      return;
    }

    // Check nullable C functions
    if (NULLABLE_C_FUNCTIONS.has(funcName)) {
      if (this.inEqualityComparison) {
        // Track that we found a stream function in this comparison
        this.equalityComparisonFuncName = funcName;
      } else if (this.inVariableDeclarationWithNullable) {
        // Inside a variable declaration - E0905 or valid c_ prefix already handled
        // Don't also report E0901
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
        // Check if any compared variable lacks c_ prefix and is not a nullable C function
        for (const varName of this.equalityComparisonVarNames) {
          if (
            !NullCheckAnalyzer.hasNullablePrefix(varName) &&
            !NULLABLE_C_FUNCTIONS.has(varName)
          ) {
            this.analyzer.reportNullComparisonOnNonNullable(
              varName,
              line,
              column,
            );
          }
        }
        // NULL in comparison context - OK (for c_ prefixed variables or functions)
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
    const expr = ctx.expression();
    if (!expr) return;

    const varName = ctx.IDENTIFIER().getText();
    const funcName = this.extractFunctionCallName(expr);
    const identifierToken = ctx.IDENTIFIER().symbol;
    const line = identifierToken.line;
    const column = (identifierToken.column ?? 0) + 1; // 1-indexed column

    // Check if assigning from a nullable C function
    if (funcName && NULLABLE_C_FUNCTIONS.has(funcName)) {
      // Set flag to suppress E0901 for the function call inside this declaration
      this.inVariableDeclarationWithNullable = true;

      // Must have c_ prefix
      if (!NullCheckAnalyzer.hasNullablePrefix(varName)) {
        const typeName = ctx.type()?.getText() ?? "unknown";
        this.analyzer.reportMissingCPrefix(
          varName,
          typeName,
          funcName,
          line,
          column,
        );
      }
      // If has c_ prefix, storage is allowed (don't report E0904 or E0901)
      return;
    }

    // Check forbidden functions (malloc, etc.) - always error
    if (funcName && FORBIDDEN_FUNCTIONS.has(funcName)) {
      this.analyzer.reportForbiddenFunction(funcName, line, column);
      return;
    }

    // Check for invalid c_ prefix on non-nullable types (E0906)
    if (NullCheckAnalyzer.hasNullablePrefix(varName)) {
      const typeName = ctx.type()?.getText() ?? "unknown";
      // If NOT assigning from nullable function AND type is NOT nullable, c_ prefix is invalid
      if (!funcName || !NULLABLE_C_FUNCTIONS.has(funcName)) {
        if (!NullCheckAnalyzer.isNullableCType(typeName)) {
          this.analyzer.reportInvalidCPrefix(varName, typeName, line, column);
        }
      }
    }
  };

  override exitVariableDeclaration = (): void => {
    // Clear the flag when leaving variable declaration
    this.inVariableDeclarationWithNullable = false;
  };

  override enterAssignmentStatement = (
    ctx: Parser.AssignmentStatementContext,
  ): void => {
    // Check if RHS contains a stream function call
    const expr = ctx.expression();
    const funcName = this.extractFunctionCallName(expr);

    if (funcName && NULLABLE_C_FUNCTIONS.has(funcName)) {
      const target = ctx.assignmentTarget();
      const varName = target.getText();
      const line = ctx.start?.line ?? 0;
      const column = ctx.start?.column ?? 0;

      // ADR-046: Allow reassignment to c_ prefixed variables (e.g., in while loops)
      if (NullCheckAnalyzer.hasNullablePrefix(varName)) {
        // Set flag to suppress E0901 for the function call inside this assignment
        this.inVariableDeclarationWithNullable = true;
        return;
      }

      this.analyzer.reportInvalidStorage(varName, funcName, line, column);
    }
  };

  override exitAssignmentStatement = (): void => {
    // Clear the flag when leaving assignment statement
    this.inVariableDeclarationWithNullable = false;
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

    // Check nullable C functions
    for (const funcName of NULLABLE_C_FUNCTIONS.keys()) {
      if (text.includes(`${funcName}(`)) {
        return funcName;
      }
    }

    // Check forbidden functions
    for (const funcName of FORBIDDEN_FUNCTIONS) {
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
class NullCheckAnalyzer {
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
   * Report error: forbidden function (dynamic allocation - ADR-003)
   */
  public reportForbiddenFunction(
    funcName: string,
    line: number,
    column: number,
  ): void {
    this.errors.push({
      code: "E0902",
      functionName: funcName,
      line,
      column,
      message: `Dynamic allocation function '${funcName}' is forbidden`,
      helpText: "Dynamic allocation is forbidden by ADR-003",
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
   * Report error: missing c_ prefix for nullable C type (E0905)
   */
  public reportMissingCPrefix(
    varName: string,
    typeName: string,
    funcName: string,
    line: number,
    column: number,
  ): void {
    this.errors.push({
      code: "E0905",
      functionName: funcName,
      line,
      column,
      message: `Missing 'c_' prefix for nullable C type '${typeName}'`,
      helpText: `Variable '${varName}' stores nullable pointer from '${funcName}'. Use: ${typeName} c_${varName} <- ${funcName}(...)`,
    });
  }

  /**
   * Report error: c_ prefix on non-nullable type (E0906)
   */
  public reportInvalidCPrefix(
    varName: string,
    typeName: string,
    line: number,
    column: number,
  ): void {
    this.errors.push({
      code: "E0906",
      functionName: varName,
      line,
      column,
      message: `Invalid 'c_' prefix on non-nullable type '${typeName}'`,
      helpText: `The 'c_' prefix is only for nullable C pointer types. Use: ${typeName} ${varName.substring(2)} <- ...`,
    });
  }

  /**
   * Report error: NULL comparison on non-nullable variable (E0907)
   */
  public reportNullComparisonOnNonNullable(
    varName: string,
    line: number,
    column: number,
  ): void {
    this.errors.push({
      code: "E0907",
      functionName: varName,
      line,
      column,
      message: `NULL comparison on non-nullable variable '${varName}'`,
      helpText: `Only variables with 'c_' prefix can be compared to NULL. C-Next variables are never null.`,
    });
  }

  // ========================================================================
  // c_ Prefix Validation Helpers (ADR-046)
  // ========================================================================

  /**
   * Check if variable name has required c_ prefix for nullable C types
   */
  public static hasNullablePrefix(varName: string): boolean {
    return varName.startsWith("c_");
  }

  /**
   * Check if a type is a nullable C pointer type
   * Currently checks for FILE and pointer returns from NULLABLE_C_FUNCTIONS
   */
  public static isNullableCType(typeName: string): boolean {
    // FILE is always nullable
    if (typeName === "FILE") return true;
    // cstring (char*) from C functions is nullable
    if (typeName === "cstring") return true;
    // Pointer types from C headers
    if (typeName.endsWith("*")) return true;
    return false;
  }

  /**
   * Get metadata for a nullable C function (for VS Code tooltips)
   */
  public static getNullableFunctionInfo(
    funcName: string,
  ): ICLibraryFunction | null {
    return NULLABLE_C_FUNCTIONS.get(funcName) ?? null;
  }

  /**
   * Check if a function is a nullable C function
   */
  public static isNullableFunction(funcName: string): boolean {
    return NULLABLE_C_FUNCTIONS.has(funcName);
  }

  /**
   * Check if a function is forbidden (dynamic allocation - ADR-003)
   */
  public static isForbiddenFunction(funcName: string): boolean {
    return FORBIDDEN_FUNCTIONS.has(funcName);
  }

  /**
   * Get nullable C functions that return struct pointers (FILE*, etc.)
   * These need asterisk added to the type in code generation.
   * Excludes char*-returning functions (fgets, strstr, etc.) which use cstring type.
   */
  public static getStructPointerFunctions(): Set<string> {
    return new Set(["fopen", "freopen", "tmpfile"]);
  }
}

export default NullCheckAnalyzer;
