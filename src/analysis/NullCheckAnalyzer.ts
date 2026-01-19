/**
 * Null Check Analyzer
 * Enforces NULL safety for C library interop (ADR-046, supersedes ADR-047)
 *
 * C-Next eliminates null bugs by design. This analyzer provides controlled
 * support for C interop with nullable pointer returns via the c_ prefix convention:
 *
 * Rules:
 * - c_ prefix REQUIRED for variables storing nullable C pointer returns (E0905)
 * - c_ prefix INVALID on non-nullable types (E0906)
 * - NULL comparisons ONLY allowed for c_ prefixed variables (E0907)
 * - c_ prefixed variables MUST be NULL-checked before use (E0908)
 * - malloc/free remain forbidden (ADR-003)
 * - Stream functions (fgets, etc.) can still use inline NULL check pattern
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
 * Tracks the NULL-check state of a c_ prefixed variable
 */
interface INullableVariableState {
  /** Variable name */
  name: string;
  /** Line where declared */
  line: number;
  /** Column where declared */
  column: number;
  /** Whether NULL check has been performed in current scope */
  isNullChecked: boolean;
  /** Which function's return this stores */
  sourceFunction: string;
}

/**
 * Stream I/O functions that can return NULL (inline check pattern)
 * These are allowed without c_ prefix when used in direct comparison
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
 * C library functions that return nullable pointers - allowed with c_ prefix
 */
const C_NULLABLE_FUNCTIONS: Map<string, ICLibraryFunction> = new Map([
  // File operations
  [
    "fopen",
    {
      header: "stdio.h",
      nullMeaning: "File open failed",
      docsUrl: "https://en.cppreference.com/w/c/io/fopen",
    },
  ],
  [
    "freopen",
    {
      header: "stdio.h",
      nullMeaning: "File reopen failed",
      docsUrl: "https://en.cppreference.com/w/c/io/freopen",
    },
  ],
  [
    "tmpfile",
    {
      header: "stdio.h",
      nullMeaning: "Temporary file creation failed",
      docsUrl: "https://en.cppreference.com/w/c/io/tmpfile",
    },
  ],
  // Environment
  [
    "getenv",
    {
      header: "stdlib.h",
      nullMeaning: "Environment variable not set",
      docsUrl: "https://en.cppreference.com/w/c/program/getenv",
    },
  ],
  // String search functions
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
      nullMeaning: "Character not found (reverse search)",
      docsUrl: "https://en.cppreference.com/w/c/string/byte/strrchr",
    },
  ],
  [
    "strpbrk",
    {
      header: "string.h",
      nullMeaning: "No character from set found",
      docsUrl: "https://en.cppreference.com/w/c/string/byte/strpbrk",
    },
  ],
  [
    "memchr",
    {
      header: "string.h",
      nullMeaning: "Byte not found in memory",
      docsUrl: "https://en.cppreference.com/w/c/string/byte/memchr",
    },
  ],
  // Time functions
  [
    "localtime",
    {
      header: "time.h",
      nullMeaning: "Invalid time value",
      docsUrl: "https://en.cppreference.com/w/c/chrono/localtime",
    },
  ],
  [
    "gmtime",
    {
      header: "time.h",
      nullMeaning: "Invalid time value",
      docsUrl: "https://en.cppreference.com/w/c/chrono/gmtime",
    },
  ],
]);

/**
 * Forbidden functions - dynamic allocation (ADR-003)
 */
const FORBIDDEN_NULLABLE_FUNCTIONS: Map<string, string> = new Map([
  ["malloc", "Dynamic allocation is forbidden by ADR-003"],
  ["calloc", "Dynamic allocation is forbidden by ADR-003"],
  ["realloc", "Dynamic allocation is forbidden by ADR-003"],
  ["free", "Dynamic allocation is forbidden by ADR-003"],
]);

/**
 * Check if a function is a nullable C function (stream or c_-prefixable)
 */
function isNullableCFunction(funcName: string): boolean {
  return C_STREAM_FUNCTIONS.has(funcName) || C_NULLABLE_FUNCTIONS.has(funcName);
}

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

  /** Track the variable being compared in equality expression */
  private equalityComparisonVarName: string | null = null;

  constructor(analyzer: NullCheckAnalyzer) {
    super();
    this.analyzer = analyzer;
  }

  // ========================================================================
  // Scope Management (for flow analysis)
  // ========================================================================

  override enterFunctionDeclaration = (
    _ctx: Parser.FunctionDeclarationContext,
  ): void => {
    this.analyzer.enterScope();
  };

  override exitFunctionDeclaration = (
    _ctx: Parser.FunctionDeclarationContext,
  ): void => {
    this.analyzer.exitScope();
  };

  override enterBlock = (_ctx: Parser.BlockContext): void => {
    this.analyzer.enterScope();
  };

  override exitBlock = (_ctx: Parser.BlockContext): void => {
    this.analyzer.exitScope();
  };

  // ========================================================================
  // Control Flow: If Statements
  // ========================================================================

  override enterIfStatement = (_ctx: Parser.IfStatementContext): void => {
    // Save current NULL-check state before entering if
    this.analyzer.saveState();
  };

  override exitIfStatement = (ctx: Parser.IfStatementContext): void => {
    const hasElse = ctx.ELSE() !== null;
    this.analyzer.restoreState(hasElse);
  };

  // ========================================================================
  // Equality Comparison Context
  // ========================================================================

  override enterEqualityExpression = (
    ctx: Parser.EqualityExpressionContext,
  ): void => {
    const children = ctx.children ?? [];

    for (const child of children) {
      const text = child.getText();
      if (text === "=" || text === "!=") {
        this.inEqualityComparison = true;
        this.equalityComparisonFuncName = null;
        this.equalityComparisonHasNull = false;
        this.equalityComparisonVarName = null;
        return;
      }
    }
  };

  override exitEqualityExpression = (
    ctx: Parser.EqualityExpressionContext,
  ): void => {
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
      // Check if this is a NULL comparison with a non-c_ variable (E0907)
      if (this.equalityComparisonHasNull && this.equalityComparisonVarName) {
        const varName = this.equalityComparisonVarName;
        if (!varName.startsWith("c_") && !this.equalityComparisonFuncName) {
          // Not a c_ variable and not a function call - error
          const line = ctx.start?.line ?? 0;
          const column = ctx.start?.column ?? 0;
          this.analyzer.reportInvalidNullComparison(varName, line, column);
        } else if (varName.startsWith("c_")) {
          // Mark c_ variable as NULL-checked
          this.analyzer.markNullChecked(varName);
        }
      }

      this.inEqualityComparison = false;
      this.equalityComparisonFuncName = null;
      this.equalityComparisonHasNull = false;
      this.equalityComparisonVarName = null;
    }
  };

  // ========================================================================
  // Function Calls
  // ========================================================================

  override enterPostfixExpression = (
    ctx: Parser.PostfixExpressionContext,
  ): void => {
    const primary = ctx.primaryExpression();
    if (!primary) return;

    // Check for simple identifier (could be variable or function)
    const identifier = primary.IDENTIFIER();
    if (!identifier) return;

    const name = identifier.getText();
    const ops = ctx.postfixOp();

    // Check if it's a function call (has argument list or parens)
    const isCall = ops.some((op) => {
      const text = op.getText();
      return text.startsWith("(");
    });

    if (isCall) {
      this.handleFunctionCall(name, ctx);
    } else {
      // It's a variable reference - check if it's a c_ variable being used
      this.handleVariableUse(name, ctx);

      // Track variable name for equality comparison
      if (this.inEqualityComparison && !this.equalityComparisonVarName) {
        this.equalityComparisonVarName = name;
      }
    }
  };

  private handleFunctionCall(
    funcName: string,
    ctx: Parser.PostfixExpressionContext,
  ): void {
    const line = ctx.start?.line ?? 0;
    const column = ctx.start?.column ?? 0;

    // Check forbidden functions (always an error)
    if (FORBIDDEN_NULLABLE_FUNCTIONS.has(funcName)) {
      this.analyzer.reportForbiddenFunction(funcName, line, column);
      return;
    }

    // Note: c_ variable arguments are already checked by handleVariableUse
    // when the postfixExpression for the identifier is visited

    // Check stream functions (inline NULL check pattern)
    if (C_STREAM_FUNCTIONS.has(funcName)) {
      if (this.inEqualityComparison) {
        this.equalityComparisonFuncName = funcName;
      } else {
        // Stream function used outside of NULL comparison - error
        this.analyzer.reportMissingNullCheck(funcName, line, column);
      }
      return;
    }

    // Check nullable functions (c_ prefix pattern)
    if (C_NULLABLE_FUNCTIONS.has(funcName)) {
      if (this.inEqualityComparison) {
        this.equalityComparisonFuncName = funcName;
      }
      // Note: We don't error here - the error will be on variable assignment
      // if the result is stored without c_ prefix
    }
  }

  private handleVariableUse(
    varName: string,
    ctx: Parser.PostfixExpressionContext,
  ): void {
    // If it's a c_ variable being used (not in equality comparison), check NULL state
    if (varName.startsWith("c_") && !this.inEqualityComparison) {
      if (!this.analyzer.isNullChecked(varName)) {
        const line = ctx.start?.line ?? 0;
        const column = ctx.start?.column ?? 0;
        this.analyzer.reportUseBeforeNullCheck(varName, line, column);
      }
    }
  }

  // ========================================================================
  // NULL Literal
  // ========================================================================

  override enterLiteral = (ctx: Parser.LiteralContext): void => {
    const text = ctx.getText();

    if (text === "NULL") {
      const line = ctx.start?.line ?? 0;
      const column = ctx.start?.column ?? 0;

      if (this.inEqualityComparison) {
        this.equalityComparisonHasNull = true;
      } else {
        this.analyzer.reportInvalidNullUsage(line, column);
      }
    }
  };

  // ========================================================================
  // Variable Declaration and Assignment
  // ========================================================================

  override enterVariableDeclaration = (
    ctx: Parser.VariableDeclarationContext,
  ): void => {
    const expr = ctx.expression();
    if (!expr) return;

    const varName = ctx.IDENTIFIER().getText();
    const hasCPrefix = varName.startsWith("c_");
    const line = ctx.start?.line ?? 0;
    const column = ctx.start?.column ?? 0;

    // Check what function (if any) is being called in the expression
    const funcName = this.extractFunctionCallName(expr);

    // E0905: Nullable function return stored without c_ prefix
    if (funcName && C_NULLABLE_FUNCTIONS.has(funcName) && !hasCPrefix) {
      this.analyzer.reportMissingCPrefix(varName, funcName, line, column);
      return;
    }

    // E0904: Stream function return cannot be stored (must use inline check)
    if (funcName && C_STREAM_FUNCTIONS.has(funcName)) {
      this.analyzer.reportInvalidStorage(varName, funcName, line, column);
      return;
    }

    // E0906: c_ prefix on non-nullable type
    if (hasCPrefix) {
      if (!funcName || !isNullableCFunction(funcName)) {
        // Check if it's assignment from another c_ variable
        const exprText = expr.getText();
        const isFromCVar = exprText.startsWith("c_");
        if (!isFromCVar) {
          this.analyzer.reportInvalidCPrefix(varName, line, column);
          return;
        }
      }
    }

    // Track c_ variables for NULL-check flow analysis
    if (hasCPrefix && funcName && C_NULLABLE_FUNCTIONS.has(funcName)) {
      this.analyzer.trackNullableVariable(varName, funcName, line, column);
    }
  };

  override enterAssignmentStatement = (
    ctx: Parser.AssignmentStatementContext,
  ): void => {
    const expr = ctx.expression();
    const target = ctx.assignmentTarget();
    const varName = target.getText();
    const hasCPrefix = varName.startsWith("c_");
    const line = ctx.start?.line ?? 0;
    const column = ctx.start?.column ?? 0;

    const funcName = this.extractFunctionCallName(expr);

    // E0905: Nullable function return stored without c_ prefix
    if (funcName && C_NULLABLE_FUNCTIONS.has(funcName) && !hasCPrefix) {
      this.analyzer.reportMissingCPrefix(varName, funcName, line, column);
      return;
    }

    // E0904: Stream function return cannot be stored
    if (funcName && C_STREAM_FUNCTIONS.has(funcName)) {
      this.analyzer.reportInvalidStorage(varName, funcName, line, column);
      return;
    }

    // Re-assignment to c_ variable resets NULL-check state
    if (hasCPrefix && funcName && C_NULLABLE_FUNCTIONS.has(funcName)) {
      this.analyzer.resetNullCheck(varName);
      this.analyzer.trackNullableVariable(varName, funcName, line, column);
    }
  };

  /**
   * Extract function call name from an expression
   */
  private extractFunctionCallName(
    ctx: Parser.ExpressionContext,
  ): string | null {
    const text = ctx.getText();

    // Check nullable functions
    for (const funcName of C_NULLABLE_FUNCTIONS.keys()) {
      if (text.includes(`${funcName}(`)) {
        return funcName;
      }
    }

    // Check stream functions
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
class NullCheckAnalyzer {
  private errors: INullCheckError[] = [];

  /** Included headers (for context) */
  private includedHeaders: Set<string> = new Set();

  /** Tracked nullable variables (c_ prefixed) */
  private nullableVariables: Map<string, INullableVariableState> = new Map();

  /** Saved states for control flow analysis */
  private savedStates: Map<string, INullableVariableState>[] = [];

  /** Scope depth for tracking */
  private scopeDepth: number = 0;

  /**
   * Analyze a parsed program for NULL safety errors
   * @param tree The parsed program AST
   * @returns Array of NULL check errors
   */
  public analyze(tree: Parser.ProgramContext): INullCheckError[] {
    this.errors = [];
    this.includedHeaders = new Set();
    this.nullableVariables = new Map();
    this.savedStates = [];
    this.scopeDepth = 0;

    this.collectIncludes(tree);

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

  // ========================================================================
  // Scope Management
  // ========================================================================

  public enterScope(): void {
    this.scopeDepth++;
  }

  public exitScope(): void {
    this.scopeDepth--;
  }

  // ========================================================================
  // NULL-Check State Management
  // ========================================================================

  /**
   * Track a nullable variable (c_ prefixed)
   */
  public trackNullableVariable(
    name: string,
    sourceFunction: string,
    line: number,
    column: number,
  ): void {
    this.nullableVariables.set(name, {
      name,
      line,
      column,
      isNullChecked: false,
      sourceFunction,
    });
  }

  /**
   * Mark a c_ variable as NULL-checked
   */
  public markNullChecked(name: string): void {
    const state = this.nullableVariables.get(name);
    if (state) {
      state.isNullChecked = true;
    }
  }

  /**
   * Reset NULL-check state (e.g., on re-assignment)
   */
  public resetNullCheck(name: string): void {
    const state = this.nullableVariables.get(name);
    if (state) {
      state.isNullChecked = false;
    }
  }

  /**
   * Check if a variable has been NULL-checked
   */
  public isNullChecked(name: string): boolean {
    const state = this.nullableVariables.get(name);
    return state?.isNullChecked ?? false;
  }

  /**
   * Save current NULL-check state (for control flow)
   */
  public saveState(): void {
    const clone = new Map<string, INullableVariableState>();
    for (const [name, state] of this.nullableVariables) {
      clone.set(name, { ...state });
    }
    this.savedStates.push(clone);
  }

  /**
   * Restore NULL-check state after control flow
   */
  public restoreState(hasElse: boolean): void {
    const savedState = this.savedStates.pop();
    if (!savedState) return;

    if (hasElse) {
      // With else: both branches executed, keep intersected state
      // (variable is checked only if checked in BOTH branches)
      for (const [name, currentState] of this.nullableVariables) {
        const savedVarState = savedState.get(name);
        if (savedVarState) {
          // If it wasn't checked before the if, and is checked now,
          // that means it was checked inside one branch.
          // With else, we can't be sure which branch ran, so be conservative.
          if (!savedVarState.isNullChecked && currentState.isNullChecked) {
            // It was checked in the if body, but might not have been in else
            // For safety, we keep it checked (optimistic - both branches checked it)
          }
        }
      }
    } else {
      // Without else: if block might not have run, restore pre-if state
      for (const [name, savedVarState] of savedState) {
        const currentState = this.nullableVariables.get(name);
        if (currentState) {
          currentState.isNullChecked = savedVarState.isNullChecked;
        }
      }
    }
  }

  // ========================================================================
  // Error Reporting
  // ========================================================================

  /**
   * E0901: Stream function used without NULL check
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
   * E0902: Forbidden function (malloc, free, etc.)
   */
  public reportForbiddenFunction(
    funcName: string,
    line: number,
    column: number,
  ): void {
    const reason =
      FORBIDDEN_NULLABLE_FUNCTIONS.get(funcName) ?? "Not supported";
    this.errors.push({
      code: "E0902",
      functionName: funcName,
      line,
      column,
      message: `C library function '${funcName}' is not allowed in C-Next`,
      helpText: reason,
    });
  }

  /**
   * E0903: NULL used outside comparison context
   */
  public reportInvalidNullUsage(line: number, column: number): void {
    this.errors.push({
      code: "E0903",
      functionName: "NULL",
      line,
      column,
      message: "NULL can only be used in comparison context",
      helpText: "Use: if (c_var != NULL) or if (c_var = NULL)",
    });
  }

  /**
   * E0904: Stream function result stored in variable (must use inline check)
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
      helpText: `Stream function results must be checked inline: if (${funcName}(...) != NULL)`,
    });
  }

  /**
   * E0905: Missing c_ prefix for nullable C type
   */
  public reportMissingCPrefix(
    varName: string,
    funcName: string,
    line: number,
    column: number,
  ): void {
    const suggestedName = `c_${varName}`;
    this.errors.push({
      code: "E0905",
      functionName: funcName,
      line,
      column,
      message: `Variable '${varName}' stores nullable C pointer from '${funcName}' - must use 'c_' prefix`,
      helpText: `Rename to '${suggestedName}' to indicate this variable may be NULL`,
    });
  }

  /**
   * E0906: Invalid c_ prefix on non-nullable type
   */
  public reportInvalidCPrefix(
    varName: string,
    line: number,
    column: number,
  ): void {
    this.errors.push({
      code: "E0906",
      functionName: varName,
      line,
      column,
      message: `Variable '${varName}' has 'c_' prefix but is not assigned from a nullable C function`,
      helpText:
        "The 'c_' prefix is reserved for variables that store nullable C pointer returns",
    });
  }

  /**
   * E0907: NULL comparison on non-nullable variable
   */
  public reportInvalidNullComparison(
    varName: string,
    line: number,
    column: number,
  ): void {
    this.errors.push({
      code: "E0907",
      functionName: varName,
      line,
      column,
      message: `Cannot compare '${varName}' to NULL - only 'c_' prefixed variables can be NULL`,
      helpText:
        "C-Next variables cannot be NULL. Only c_ prefixed variables (from C library functions) can be NULL.",
    });
  }

  /**
   * E0908: Missing NULL check before use
   */
  public reportUseBeforeNullCheck(
    varName: string,
    line: number,
    column: number,
  ): void {
    this.errors.push({
      code: "E0908",
      functionName: varName,
      line,
      column,
      message: `Variable '${varName}' must be NULL-checked before use`,
      helpText: `Add: if (${varName} != NULL) { ... } before using '${varName}'`,
    });
  }

  // ========================================================================
  // Public API for VS Code integration
  // ========================================================================

  public hasStdioIncluded(): boolean {
    return this.includedHeaders.has("stdio.h");
  }

  public static getStreamFunctionInfo(
    funcName: string,
  ): ICLibraryFunction | null {
    return C_STREAM_FUNCTIONS.get(funcName) ?? null;
  }

  public static getNullableFunctionInfo(
    funcName: string,
  ): ICLibraryFunction | null {
    return C_NULLABLE_FUNCTIONS.get(funcName) ?? null;
  }

  public static isStreamFunction(funcName: string): boolean {
    return C_STREAM_FUNCTIONS.has(funcName);
  }

  public static isNullableFunction(funcName: string): boolean {
    return C_NULLABLE_FUNCTIONS.has(funcName);
  }

  public static isForbiddenFunction(funcName: string): boolean {
    return FORBIDDEN_NULLABLE_FUNCTIONS.has(funcName);
  }
}

export default NullCheckAnalyzer;
