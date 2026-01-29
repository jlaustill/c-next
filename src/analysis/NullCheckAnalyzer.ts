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
import { CNextListener } from "../antlr_parser/grammar/CNextListener";
import * as Parser from "../antlr_parser/grammar/CNextParser";
import INullCheckError from "./types/INullCheckError";
import ParserUtils from "../utils/ParserUtils";

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

// ============================================================================
// Flow Analysis Data Structures (E0908)
// ============================================================================

/**
 * State of a nullable variable with respect to NULL checking
 */
enum NullCheckState {
  /** Variable has not been checked for NULL */
  Unchecked = "unchecked",
  /** Variable has been verified as not NULL */
  CheckedNotNull = "checked_not_null",
}

/**
 * Tracks the NULL check state of a single nullable variable
 */
interface INullableVariableState {
  /** Variable name (with c_ prefix) */
  name: string;
  /** Line where the variable was declared */
  declarationLine: number;
  /** Type name (e.g., FILE, cstring) */
  typeName: string;
  /** Current NULL check state */
  state: NullCheckState;
}

/**
 * A scope for tracking nullable variable states.
 * Scopes form a stack: function body -> if body -> nested if body, etc.
 */
interface INullCheckScope {
  /** Map of variable name to state within this scope */
  variables: Map<string, INullableVariableState>;
  /** Parent scope (null for function-level scope) */
  parent: INullCheckScope | null;
  /** If this scope is from an if-statement, tracks if it's a guard clause */
  isGuardClause: boolean;
  /** Variable being checked in the if condition (for guard clause detection) */
  guardVariable: string | null;
  /** Whether the condition was == NULL (true) or != NULL (false) */
  isNullEqualityCheck: boolean;
}

/**
 * Listener that walks the parse tree and checks NULL usage
 */
class NullCheckListener extends CNextListener {
  private readonly analyzer: NullCheckAnalyzer;

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

  // ========================================================================
  // Flow Analysis State (E0908)
  // ========================================================================

  /** Current scope for tracking nullable variable states */
  private currentScope: INullCheckScope | null = null;

  /** Stack of if-statement info for tracking nested conditions */
  private readonly ifStack: Array<{
    varName: string | null;
    isNullCheck: boolean;
    hasReturn: boolean;
  }> = [];

  /** Track if we're in the body of an if statement (first statement) */
  private readonly inIfBody = false;

  /** Track the current if-statement context for body detection */
  private currentIfCtx: Parser.IfStatementContext | null = null;

  /** Stack of while-statement info for tracking nested while conditions */
  private readonly whileStack: Array<{
    varName: string | null;
    isNotNullCheck: boolean;
  }> = [];

  /** Track the current while-statement context for body detection */
  private currentWhileCtx: Parser.WhileStatementContext | null = null;

  constructor(analyzer: NullCheckAnalyzer) {
    super();
    this.analyzer = analyzer;
  }

  // ========================================================================
  // Scope Management (E0908)
  // ========================================================================

  /**
   * Create a new scope (e.g., entering a function or if-body)
   */
  private pushScope(): void {
    const newScope: INullCheckScope = {
      variables: new Map(),
      parent: this.currentScope,
      isGuardClause: false,
      guardVariable: null,
      isNullEqualityCheck: false,
    };
    this.currentScope = newScope;
  }

  /**
   * Exit the current scope and return to parent
   */
  private popScope(): INullCheckScope | null {
    const oldScope = this.currentScope;
    if (this.currentScope) {
      this.currentScope = this.currentScope.parent;
    }
    return oldScope;
  }

  /**
   * Look up a variable's state in the current scope chain
   */
  private lookupVariable(name: string): INullableVariableState | null {
    let scope = this.currentScope;
    while (scope) {
      const state = scope.variables.get(name);
      if (state) return state;
      scope = scope.parent;
    }
    return null;
  }

  /**
   * Update a variable's state in the scope where it's defined
   */
  private updateVariableState(name: string, newState: NullCheckState): void {
    let scope = this.currentScope;
    while (scope) {
      if (scope.variables.has(name)) {
        const varState = scope.variables.get(name)!;
        varState.state = newState;
        return;
      }
      scope = scope.parent;
    }
  }

  /**
   * Register a c_ prefixed variable in the current scope
   */
  private registerNullableVariable(
    name: string,
    typeName: string,
    line: number,
  ): void {
    if (!this.currentScope) return;
    this.currentScope.variables.set(name, {
      name,
      declarationLine: line,
      typeName,
      state: NullCheckState.Unchecked,
    });
  }

  // ========================================================================
  // Function Scope Management (E0908)
  // ========================================================================

  override enterFunctionDeclaration = (
    _ctx: Parser.FunctionDeclarationContext,
  ): void => {
    // Create a new scope for the function body
    this.pushScope();
  };

  override exitFunctionDeclaration = (
    _ctx: Parser.FunctionDeclarationContext,
  ): void => {
    // Exit the function scope
    this.popScope();
  };

  // ========================================================================
  // If-Statement Flow Analysis (E0908)
  // ========================================================================

  override enterIfStatement = (ctx: Parser.IfStatementContext): void => {
    // Parse the condition to detect NULL checks
    const condition = ctx.expression();
    const conditionText = condition?.getText() ?? "";

    // Check for patterns like "c_var != NULL" or "c_var = NULL"
    const nullCheckMatch = /^(c_[a-zA-Z_]\w*)\s*(!?=)\s*NULL$/.exec(
      conditionText,
    );

    if (nullCheckMatch) {
      const varName = nullCheckMatch[1];
      const operator = nullCheckMatch[2];
      const isNotNullCheck = operator === "!=";

      // Push info onto the if-stack for tracking
      this.ifStack.push({
        varName,
        isNullCheck: !isNotNullCheck, // true if checking == NULL
        hasReturn: false,
      });

      // For != NULL check, mark the variable as checked in the if-body
      if (isNotNullCheck) {
        // We'll set state to CheckedNotNull when entering the if-body
        this.currentIfCtx = ctx;
      }
    } else {
      // Not a null check, just track for nesting
      this.ifStack.push({
        varName: null,
        isNullCheck: false,
        hasReturn: false,
      });
    }
  };

  override exitIfStatement = (ctx: Parser.IfStatementContext): void => {
    const ifInfo = this.ifStack.pop();
    if (!ifInfo) return;

    // Handle guard clause pattern: if (c_var == NULL) { return; }
    // After such a guard, the variable is known to be not null
    if (ifInfo.varName && ifInfo.isNullCheck && ifInfo.hasReturn) {
      // This was a guard clause - the variable is checked after the if
      const hasElse = ctx.ELSE() !== null;
      if (!hasElse) {
        this.updateVariableState(ifInfo.varName, NullCheckState.CheckedNotNull);
      }
    }

    this.currentIfCtx = null;
  };

  /**
   * Detect when we enter the body of an if or while statement
   * For "if (c_var != NULL)" or "while (c_var != NULL)" the body has the variable checked
   */
  override enterStatement = (ctx: Parser.StatementContext): void => {
    // Check if this is the "then" branch of a null-check if
    if (
      this.currentIfCtx &&
      this.ifStack.length > 0 &&
      !this.ifStack.at(-1)!.isNullCheck
    ) {
      const ifInfo = this.ifStack.at(-1)!;
      if (ifInfo.varName) {
        // Get the statements from the if
        const statements = this.currentIfCtx.statement();
        // Check if this is the "then" branch (first statement)
        if (statements.length > 0 && ctx === statements[0]) {
          // Mark variable as checked within this branch
          this.updateVariableState(
            ifInfo.varName,
            NullCheckState.CheckedNotNull,
          );
        }
      }
    }

    // Check if this is the body of a null-check while
    if (this.currentWhileCtx && this.whileStack.length > 0) {
      const whileInfo = this.whileStack.at(-1)!;
      if (whileInfo.varName && whileInfo.isNotNullCheck) {
        // Get the statement from the while (body)
        const whileBody = this.currentWhileCtx.statement();
        // Check if this is the while body
        if (whileBody === ctx) {
          // Mark variable as checked within this body
          this.updateVariableState(
            whileInfo.varName,
            NullCheckState.CheckedNotNull,
          );
        }
      }
    }
  };

  override enterReturnStatement = (
    _ctx: Parser.ReturnStatementContext,
  ): void => {
    // Mark current if-statement (if any) as having a return
    if (this.ifStack.length > 0) {
      this.ifStack.at(-1)!.hasReturn = true;
    }
  };

  // ========================================================================
  // While-Statement Flow Analysis (E0908)
  // ========================================================================

  override enterWhileStatement = (ctx: Parser.WhileStatementContext): void => {
    // Parse the condition to detect NULL checks
    const condition = ctx.expression();
    const conditionText = condition?.getText() ?? "";

    // Check for patterns like "c_var != NULL"
    const nullCheckMatch = /^(c_[a-zA-Z_]\w*)\s*!=\s*NULL$/.exec(conditionText);

    if (nullCheckMatch) {
      const varName = nullCheckMatch[1];

      // Push info onto the while-stack for tracking
      this.whileStack.push({
        varName,
        isNotNullCheck: true,
      });

      // For != NULL check, mark the variable as checked in the while-body
      this.currentWhileCtx = ctx;
    } else {
      // Not a null check, just track for nesting
      this.whileStack.push({
        varName: null,
        isNotNullCheck: false,
      });
    }
  };

  override exitWhileStatement = (_ctx: Parser.WhileStatementContext): void => {
    this.whileStack.pop();
    this.currentWhileCtx = null;
  };

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
      if (/^[a-zA-Z_]\w*$/.test(text) && text !== "NULL") {
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

    const { line, column } = ParserUtils.getPosition(ctx);

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

    // E0908: Check for unchecked c_ variables passed as function arguments
    this.checkFunctionArgumentsForUncheckedVariables(ctx, ops, line);
  };

  /**
   * Check if any c_ prefixed variables in function arguments are unchecked (E0908)
   */
  private checkFunctionArgumentsForUncheckedVariables(
    ctx: Parser.PostfixExpressionContext,
    ops: Parser.PostfixOpContext[],
    line: number,
  ): void {
    // Skip if we're in a NULL comparison context (the check itself)
    if (this.inEqualityComparison) return;

    for (const op of ops) {
      const argList = op.argumentList();
      if (!argList) continue;

      // Get all expressions in the argument list
      const args = argList.expression();
      for (const arg of args) {
        const argText = arg.getText();
        // Check if argument is a simple c_ prefixed variable
        if (/^c_[a-zA-Z_]\w*$/.test(argText)) {
          const varState = this.lookupVariable(argText);
          if (varState?.state === NullCheckState.Unchecked) {
            const argLine = arg.start?.line ?? line;
            const argColumn = arg.start?.column ?? 0;
            this.analyzer.reportMissingNullCheckBeforeUse(
              argText,
              varState.typeName,
              argLine,
              argColumn,
            );
          }
        }
      }
    }
  }

  // ========================================================================
  // NULL Literal
  // ========================================================================

  override enterLiteral = (ctx: Parser.LiteralContext): void => {
    const text = ctx.getText();

    // Check for uppercase NULL (C library NULL)
    if (text === "NULL") {
      const { line, column } = ParserUtils.getPosition(ctx);

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
    const varName = ctx.IDENTIFIER().getText();
    const typeName = ctx.type()?.getText() ?? "unknown";
    const identifierToken = ctx.IDENTIFIER().symbol;
    const line = identifierToken.line;
    const column = (identifierToken.column ?? 0) + 1; // 1-indexed column

    // E0908: Register c_ prefixed variables for flow tracking
    if (NullCheckAnalyzer.hasNullablePrefix(varName)) {
      this.registerNullableVariable(varName, typeName, line);
    }

    if (!expr) return;

    const funcName = this.extractFunctionCallName(expr);

    // Check if assigning from a nullable C function
    if (funcName && NULLABLE_C_FUNCTIONS.has(funcName)) {
      // Set flag to suppress E0901 for the function call inside this declaration
      this.inVariableDeclarationWithNullable = true;

      // Must have c_ prefix
      if (!NullCheckAnalyzer.hasNullablePrefix(varName)) {
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
    const target = ctx.assignmentTarget();
    const varName = target.getText();
    const { line, column } = ParserUtils.getPosition(ctx);

    if (funcName && NULLABLE_C_FUNCTIONS.has(funcName)) {
      // ADR-046: Allow reassignment to c_ prefixed variables (e.g., in while loops)
      if (NullCheckAnalyzer.hasNullablePrefix(varName)) {
        // Set flag to suppress E0901 for the function call inside this assignment
        this.inVariableDeclarationWithNullable = true;
        // E0908: Reset state to Unchecked on reassignment from nullable function
        this.updateVariableState(varName, NullCheckState.Unchecked);
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
      const match = /#include\s*[<"]([^>"]+)[>"]/.exec(text);
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

  /**
   * Report error: c_ variable used without prior NULL check (E0908)
   */
  public reportMissingNullCheckBeforeUse(
    varName: string,
    typeName: string,
    line: number,
    column: number,
  ): void {
    this.errors.push({
      code: "E0908",
      functionName: varName,
      line,
      column,
      message: `Nullable variable '${varName}' used without NULL check`,
      helpText: `Check for NULL before use: if (${varName} != NULL) { ... }`,
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
