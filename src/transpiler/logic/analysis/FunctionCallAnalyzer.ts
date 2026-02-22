/**
 * Function Call Analyzer
 * Enforces define-before-use for functions (ADR-030)
 *
 * C-Next requires functions to be defined before they can be called.
 * This catches errors at C-Next compile time rather than deferring to
 * the C compiler or runtime.
 */

import { ParseTreeWalker } from "antlr4ng";
import { CNextListener } from "../parser/grammar/CNextListener";
import * as Parser from "../parser/grammar/CNextParser";
import SymbolTable from "../symbols/SymbolTable";
import IFunctionCallError from "./types/IFunctionCallError";
import ParserUtils from "../../../utils/ParserUtils";
import CodeGenState from "../../state/CodeGenState";
import ExpressionUnwrapper from "../../../utils/ExpressionUnwrapper";

/**
 * C-Next built-in functions
 * These are compiler intrinsics that don't need to be defined by the user
 */
const CNEXT_BUILTINS: Set<string> = new Set([
  "safe_div", // ADR-051: Safe division with default value
  "safe_mod", // ADR-051: Safe modulo with default value
]);

/**
 * Standard library functions mapped to their header files.
 * Flat structure: function name → header file.
 * These are considered "external" and don't need to be defined in C-Next.
 */
const STDLIB_FUNCTION_HEADERS: Record<string, string> = {
  // stdio.h
  printf: "stdio.h",
  fprintf: "stdio.h",
  sprintf: "stdio.h",
  snprintf: "stdio.h",
  scanf: "stdio.h",
  fscanf: "stdio.h",
  sscanf: "stdio.h",
  fopen: "stdio.h",
  fclose: "stdio.h",
  fread: "stdio.h",
  fwrite: "stdio.h",
  fgets: "stdio.h",
  fputs: "stdio.h",
  fgetc: "stdio.h",
  fputc: "stdio.h",
  puts: "stdio.h",
  putchar: "stdio.h",
  getchar: "stdio.h",
  gets: "stdio.h",
  perror: "stdio.h",
  fflush: "stdio.h",
  fseek: "stdio.h",
  ftell: "stdio.h",
  rewind: "stdio.h",
  feof: "stdio.h",
  ferror: "stdio.h",
  clearerr: "stdio.h",
  remove: "stdio.h",
  rename: "stdio.h",
  tmpfile: "stdio.h",
  tmpnam: "stdio.h",
  setbuf: "stdio.h",
  setvbuf: "stdio.h",
  // stdlib.h
  malloc: "stdlib.h",
  calloc: "stdlib.h",
  realloc: "stdlib.h",
  free: "stdlib.h",
  atoi: "stdlib.h",
  atof: "stdlib.h",
  atol: "stdlib.h",
  atoll: "stdlib.h",
  strtol: "stdlib.h",
  strtoul: "stdlib.h",
  strtoll: "stdlib.h",
  strtoull: "stdlib.h",
  strtof: "stdlib.h",
  strtod: "stdlib.h",
  strtold: "stdlib.h",
  rand: "stdlib.h",
  srand: "stdlib.h",
  exit: "stdlib.h",
  abort: "stdlib.h",
  atexit: "stdlib.h",
  system: "stdlib.h",
  getenv: "stdlib.h",
  abs: "stdlib.h",
  labs: "stdlib.h",
  llabs: "stdlib.h",
  div: "stdlib.h",
  ldiv: "stdlib.h",
  lldiv: "stdlib.h",
  qsort: "stdlib.h",
  bsearch: "stdlib.h",
  // string.h
  strlen: "string.h",
  strcpy: "string.h",
  strncpy: "string.h",
  strcat: "string.h",
  strncat: "string.h",
  strcmp: "string.h",
  strncmp: "string.h",
  strchr: "string.h",
  strrchr: "string.h",
  strstr: "string.h",
  strtok: "string.h",
  memcpy: "string.h",
  memmove: "string.h",
  memset: "string.h",
  memcmp: "string.h",
  memchr: "string.h",
  // math.h
  sin: "math.h",
  cos: "math.h",
  tan: "math.h",
  asin: "math.h",
  acos: "math.h",
  atan: "math.h",
  atan2: "math.h",
  sinh: "math.h",
  cosh: "math.h",
  tanh: "math.h",
  exp: "math.h",
  log: "math.h",
  log10: "math.h",
  log2: "math.h",
  pow: "math.h",
  sqrt: "math.h",
  cbrt: "math.h",
  ceil: "math.h",
  floor: "math.h",
  round: "math.h",
  trunc: "math.h",
  fabs: "math.h",
  fmod: "math.h",
  remainder: "math.h",
  fmax: "math.h",
  fmin: "math.h",
  hypot: "math.h",
  ldexp: "math.h",
  frexp: "math.h",
  modf: "math.h",
  // C99 classification macros (also functions in C++)
  isnan: "math.h",
  isinf: "math.h",
  isfinite: "math.h",
  isnormal: "math.h",
  signbit: "math.h",
  fpclassify: "math.h",
  nan: "math.h",
  nanf: "math.h",
  nanl: "math.h",
  // ctype.h
  isalnum: "ctype.h",
  isalpha: "ctype.h",
  isdigit: "ctype.h",
  isxdigit: "ctype.h",
  islower: "ctype.h",
  isupper: "ctype.h",
  isspace: "ctype.h",
  ispunct: "ctype.h",
  isprint: "ctype.h",
  isgraph: "ctype.h",
  iscntrl: "ctype.h",
  tolower: "ctype.h",
  toupper: "ctype.h",
  // time.h
  time: "time.h",
  clock: "time.h",
  difftime: "time.h",
  mktime: "time.h",
  strftime: "time.h",
  localtime: "time.h",
  gmtime: "time.h",
  asctime: "time.h",
  ctime: "time.h",
  // assert.h
  assert: "assert.h",
  // Arduino framework
  pinMode: "Arduino.h",
  digitalWrite: "Arduino.h",
  digitalRead: "Arduino.h",
  analogRead: "Arduino.h",
  analogWrite: "Arduino.h",
  delay: "Arduino.h",
  delayMicroseconds: "Arduino.h",
  millis: "Arduino.h",
  micros: "Arduino.h",
  attachInterrupt: "Arduino.h",
  detachInterrupt: "Arduino.h",
  noInterrupts: "Arduino.h",
  interrupts: "Arduino.h",
  Serial: "Arduino.h",
  Wire: "Arduino.h",
  SPI: "Arduino.h",
};

/**
 * Listener that walks the parse tree and checks function calls
 */
class FunctionCallListener extends CNextListener {
  private readonly analyzer: FunctionCallAnalyzer;

  /** Current scope name (for member function resolution) */
  private currentScope: string | null = null;

  constructor(analyzer: FunctionCallAnalyzer) {
    super();
    this.analyzer = analyzer;
  }

  // ========================================================================
  // ISR/Callback Variable Tracking (ADR-040)
  // ========================================================================

  /**
   * Check if a type name represents a callable type (ISR, callback, or C function pointer typedef).
   */
  private isCallableType(typeName: string): boolean {
    return (
      typeName === "ISR" ||
      this.analyzer.isCallbackType(typeName) ||
      this.analyzer.isCFunctionPointerTypedef(typeName)
    );
  }

  /**
   * Track ISR-typed variables from variable declarations
   * e.g., `ISR handler <- myFunction;`
   */
  override enterVariableDeclaration = (
    ctx: Parser.VariableDeclarationContext,
  ): void => {
    const typeName = ctx.type().getText();
    if (this.isCallableType(typeName)) {
      this.analyzer.defineCallableVariable(ctx.IDENTIFIER().getText());
    }
  };

  /**
   * Track ISR-typed parameters in function declarations
   * e.g., `void execute(ISR handler) { handler(); }`
   */
  override enterParameter = (ctx: Parser.ParameterContext): void => {
    const typeName = ctx.type().getText();
    if (this.isCallableType(typeName)) {
      this.analyzer.defineCallableVariable(ctx.IDENTIFIER().getText());
    }
  };

  // ========================================================================
  // Function Definitions
  // ========================================================================

  override enterFunctionDeclaration = (
    ctx: Parser.FunctionDeclarationContext,
  ): void => {
    const name = ctx.IDENTIFIER().getText();

    // If inside a scope, the full name is Scope_functionName
    let fullName: string;
    if (this.currentScope) {
      fullName = `${this.currentScope}_${name}`;
    } else {
      fullName = name;
    }

    // Track that we're currently inside this function (for self-recursion detection)
    this.analyzer.enterFunction(fullName);
    this.analyzer.defineFunction(fullName);
  };

  override exitFunctionDeclaration = (
    _ctx: Parser.FunctionDeclarationContext,
  ): void => {
    // We're leaving the function definition
    this.analyzer.exitFunction();
  };

  // ========================================================================
  // Scope Handling
  // ========================================================================

  override enterScopeDeclaration = (
    ctx: Parser.ScopeDeclarationContext,
  ): void => {
    this.currentScope = ctx.IDENTIFIER().getText();
  };

  override exitScopeDeclaration = (
    _ctx: Parser.ScopeDeclarationContext,
  ): void => {
    this.currentScope = null;
  };

  // ========================================================================
  // Function Calls
  // ========================================================================

  /**
   * SonarCloud S3776: Refactored to use helper method.
   */
  override enterPostfixExpression = (
    ctx: Parser.PostfixExpressionContext,
  ): void => {
    const ops = ctx.postfixOp();
    const primary = ctx.primaryExpression();

    // Determine the base name: could be an identifier or 'this'
    const baseName = this.extractBaseName(primary);
    if (!baseName) return;

    // Walk through postfix ops to find the call and resolve the name
    const { resolvedName, foundCall } = this.resolveCallTarget(ops, baseName);
    if (!foundCall) return;

    // Check if the function is defined
    const { line, column } = ParserUtils.getPosition(ctx);
    this.analyzer.checkFunctionCall(
      resolvedName,
      line,
      column,
      this.currentScope,
    );
  };

  /**
   * Extract base name from primary expression.
   */
  private extractBaseName(
    primary: Parser.PrimaryExpressionContext,
  ): string | null {
    if (primary.IDENTIFIER()) {
      return primary.IDENTIFIER()!.getText();
    }
    if (primary.THIS()) {
      return "this";
    }
    return null;
  }

  /**
   * Resolve call target by walking postfix operations.
   * Returns the resolved function name and whether a call was found.
   * SonarCloud S3776: Extracted from enterPostfixExpression().
   */
  private resolveCallTarget(
    ops: Parser.PostfixOpContext[],
    baseName: string,
  ): { resolvedName: string; foundCall: boolean } {
    let resolvedName = baseName;

    for (const op of ops) {
      // Member access: check if it's Scope.member or this.member pattern
      if (op.IDENTIFIER()) {
        const resolved = this.resolveMemberAccess(resolvedName, op);
        if (resolved === null) {
          return { resolvedName, foundCall: false };
        }
        resolvedName = resolved;
        continue;
      }

      // Function call: () or (args)
      if (op.argumentList() || op.getChildCount() === 2) {
        const text = op.getText();
        if (text.startsWith("(")) {
          return { resolvedName, foundCall: true };
        }
      }
    }

    return { resolvedName, foundCall: false };
  }

  /**
   * Resolve member access pattern. Returns new name or null if not a C-Next function.
   */
  private resolveMemberAccess(
    resolvedName: string,
    op: Parser.PostfixOpContext,
  ): string | null {
    const memberName = op.IDENTIFIER()!.getText();

    // Handle this.member -> CurrentScope_member (when inside a scope)
    if (resolvedName === "this" && this.currentScope) {
      return `${this.currentScope}_${memberName}`;
    }

    // Check if base is a known scope
    if (this.analyzer.isScope(resolvedName)) {
      return `${resolvedName}_${memberName}`;
    }

    // Object.method or chained access - not a C-Next function call
    return null;
  }
}

/**
 * Analyzes C-Next AST for function calls before definition
 */
class FunctionCallAnalyzer {
  private errors: IFunctionCallError[] = [];

  /** Functions that have been defined (in order of appearance) */
  private definedFunctions: Set<string> = new Set();

  /** All functions that will be defined in this file (for distinguishing local vs cross-file) */
  private allLocalFunctions: Set<string> = new Set();

  /** Known scopes (for Scope.member -> Scope_member resolution) */
  private knownScopes: Set<string> = new Set();

  /** External symbol table for C/C++ interop */
  private symbolTable: SymbolTable | null = null;

  /** Included headers (for stdlib function lookup) */
  private includedHeaders: Set<string> = new Set();

  /** Current function being defined (for self-recursion detection) */
  private currentFunctionName: string | null = null;

  /** ADR-040: Variables of type ISR or callback types that can be invoked */
  private callableVariables: Set<string> = new Set();

  /** ADR-029: Callback types (function-as-type pattern) */
  private callbackTypes: Set<string> = new Set();

  /**
   * Analyze a parsed program for function call errors
   * @param tree The parsed program AST
   * @param symbolTable Optional symbol table for external function lookup
   * @returns Array of function call errors
   */
  public analyze(
    tree: Parser.ProgramContext,
    symbolTable?: SymbolTable,
  ): IFunctionCallError[] {
    this.errors = [];
    this.definedFunctions = new Set();
    this.allLocalFunctions = new Set();
    this.knownScopes = new Set();
    this.includedHeaders = new Set();
    this.symbolTable = symbolTable ?? null;
    this.currentFunctionName = null;
    this.callableVariables = new Set();
    this.callbackTypes = new Set();

    // First pass: collect scope names, includes, callback types, and all local functions
    this.collectScopes(tree);
    this.collectIncludes(tree);
    this.collectCallbackTypes(tree);
    this.collectAllLocalFunctions(tree);
    this.collectCallbackCompatibleFunctions(tree);

    // Second pass: walk tree in order, tracking definitions and checking calls
    const listener = new FunctionCallListener(this);
    ParseTreeWalker.DEFAULT.walk(listener, tree);

    return this.errors;
  }

  /**
   * Collect scope names for member function resolution
   */
  private collectScopes(tree: Parser.ProgramContext): void {
    for (const decl of tree.declaration()) {
      if (decl.scopeDeclaration()) {
        const name = decl.scopeDeclaration()!.IDENTIFIER().getText();
        this.knownScopes.add(name);
      }
    }
  }

  /**
   * Collect included headers for stdlib function lookup
   */
  private collectIncludes(tree: Parser.ProgramContext): void {
    for (const include of tree.includeDirective()) {
      // Extract header name from #include <header.h> or #include "header.h"
      const text = include.getText();
      const match = /#include\s*[<"]([^>"]+)[>"]/.exec(text);
      if (match) {
        this.includedHeaders.add(match[1]);
      }
    }
  }

  /**
   * Check if a function is from an included standard library header
   */
  private isStdlibFunction(name: string): boolean {
    const header = STDLIB_FUNCTION_HEADERS[name];
    return header !== undefined && this.includedHeaders.has(header);
  }

  /**
   * Issue #787: Find which header a stdlib function belongs to (if any).
   * Returns the header name if found, or null if not a known stdlib function.
   * Checks ALL stdlib functions, not just from included headers.
   */
  private findStdlibHeader(name: string): string | null {
    return STDLIB_FUNCTION_HEADERS[name] ?? null;
  }

  /**
   * ADR-029: Collect callback types (function-as-type pattern)
   * Any function definition creates a type that can be used for callback fields/parameters
   */
  private collectCallbackTypes(tree: Parser.ProgramContext): void {
    for (const decl of tree.declaration()) {
      if (decl.functionDeclaration()) {
        const name = decl.functionDeclaration()!.IDENTIFIER().getText();
        this.callbackTypes.add(name);
      }
    }
  }

  /**
   * Issue #786: Pre-collect all function names defined in this file.
   * Used to distinguish between local functions (subject to define-before-use)
   * and cross-file functions from includes (allowed without local definition).
   */
  private collectAllLocalFunctions(tree: Parser.ProgramContext): void {
    for (const decl of tree.declaration()) {
      // Standalone functions
      if (decl.functionDeclaration()) {
        const name = decl.functionDeclaration()!.IDENTIFIER().getText();
        this.allLocalFunctions.add(name);
      }
      // Scope member functions
      if (decl.scopeDeclaration()) {
        const scopeDecl = decl.scopeDeclaration()!;
        const scopeName = scopeDecl.IDENTIFIER().getText();
        for (const member of scopeDecl.scopeMember()) {
          if (member.functionDeclaration()) {
            const funcName = member
              .functionDeclaration()!
              .IDENTIFIER()
              .getText();
            this.allLocalFunctions.add(`${scopeName}_${funcName}`);
          }
        }
      }
    }
  }

  /**
   * ADR-029: Check if a type name is a callback type (function-as-type)
   */
  public isCallbackType(name: string): boolean {
    return this.callbackTypes.has(name);
  }

  /**
   * Check if a type name is a C function pointer typedef.
   * Looks up the type in the symbol table and checks if it's a typedef
   * whose underlying type contains "(*)" indicating a function pointer.
   */
  public isCFunctionPointerTypedef(typeName: string): boolean {
    if (!this.symbolTable) return false;
    const sym = this.symbolTable.getCSymbol(typeName);
    if (sym?.kind !== "type") return false;
    // ICTypedefSymbol has a `type` field with the underlying C type string
    return (
      "type" in sym && typeof sym.type === "string" && sym.type.includes("(*)")
    );
  }

  /**
   * Detect functions assigned to C function pointer typedefs.
   * When `PointCallback cb <- my_handler;` is found and PointCallback
   * is a C function pointer typedef, mark my_handler as callback-compatible.
   */
  private collectCallbackCompatibleFunctions(
    tree: Parser.ProgramContext,
  ): void {
    for (const decl of tree.declaration()) {
      const funcDecl = decl.functionDeclaration();
      if (!funcDecl) continue;

      const block = funcDecl.block();
      if (!block) continue;

      this.scanBlockForCallbackAssignments(block);
    }
  }

  /**
   * Recursively scan all statements in a block for callback typedef assignments.
   */
  private scanBlockForCallbackAssignments(block: Parser.BlockContext): void {
    for (const stmt of block.statement()) {
      this.scanStatementForCallbackAssignments(stmt);
    }
  }

  /**
   * Scan a single statement for callback typedef assignments,
   * recursing into nested blocks (if/while/for/do-while/switch/critical).
   */
  private scanStatementForCallbackAssignments(
    stmt: Parser.StatementContext,
  ): void {
    // Check variable declarations for callback assignments
    const varDecl = stmt.variableDeclaration();
    if (varDecl) {
      this.checkVarDeclForCallbackAssignment(varDecl);
      return;
    }

    // Check expression statements for function calls with callback arguments
    const exprStmt = stmt.expressionStatement();
    if (exprStmt) {
      this.checkExpressionForCallbackArgs(exprStmt.expression());
      return;
    }

    // Recurse into nested blocks/statements
    const ifStmt = stmt.ifStatement();
    if (ifStmt) {
      for (const child of ifStmt.statement()) {
        this.scanStatementForCallbackAssignments(child);
      }
      return;
    }

    const whileStmt = stmt.whileStatement();
    if (whileStmt) {
      this.scanStatementForCallbackAssignments(whileStmt.statement());
      return;
    }

    const forStmt = stmt.forStatement();
    if (forStmt) {
      this.scanStatementForCallbackAssignments(forStmt.statement());
      return;
    }

    const doWhileStmt = stmt.doWhileStatement();
    if (doWhileStmt) {
      this.scanBlockForCallbackAssignments(doWhileStmt.block());
      return;
    }

    const switchStmt = stmt.switchStatement();
    if (switchStmt) {
      for (const caseCtx of switchStmt.switchCase()) {
        this.scanBlockForCallbackAssignments(caseCtx.block());
      }
      const defaultCtx = switchStmt.defaultCase();
      if (defaultCtx) {
        this.scanBlockForCallbackAssignments(defaultCtx.block());
      }
      return;
    }

    const criticalStmt = stmt.criticalStatement();
    if (criticalStmt) {
      this.scanBlockForCallbackAssignments(criticalStmt.block());
      return;
    }

    // A statement can itself be a block
    const nestedBlock = stmt.block();
    if (nestedBlock) {
      this.scanBlockForCallbackAssignments(nestedBlock);
    }
  }

  /**
   * Check if a variable declaration assigns a function to a C callback typedef.
   */
  private checkVarDeclForCallbackAssignment(
    varDecl: Parser.VariableDeclarationContext,
  ): void {
    const typeName = varDecl.type().getText();
    if (!this.isCFunctionPointerTypedef(typeName)) return;

    const expr = varDecl.expression();
    if (!expr) return;

    const funcRef = this.extractFunctionReference(expr);
    if (!funcRef) return;

    // Scope-qualified names use dot in source (MyScope.handler) but
    // allLocalFunctions stores them with underscore (MyScope_handler)
    const lookupName = funcRef.includes(".")
      ? funcRef.replace(".", "_")
      : funcRef;

    if (this.allLocalFunctions.has(lookupName)) {
      // Store function name -> typedef name mapping
      CodeGenState.callbackCompatibleFunctions.set(lookupName, typeName);
    }
  }

  /**
   * Extract a function reference from an expression context.
   * Matches bare identifiers (e.g., "my_handler") and qualified scope
   * names (e.g., "MyScope.handler").
   * Returns null if the expression is not a function reference.
   */
  private extractFunctionReference(
    expr: Parser.ExpressionContext,
  ): string | null {
    const text = expr.getText();
    if (/^\w+(\.\w+)?$/.test(text)) {
      return text;
    }
    return null;
  }

  /**
   * Issue #895: Check expression for function calls that pass C-Next functions
   * to C function pointer parameters.
   *
   * Pattern: `global.widget_set_flush_cb(w, my_flush)`
   * Where widget_set_flush_cb's 2nd param is a C function pointer typedef.
   */
  private checkExpressionForCallbackArgs(expr: Parser.ExpressionContext): void {
    // Navigate to the postfix expression (handles assignments, ternaries, etc.)
    const postfix = this.findPostfixExpression(expr);
    if (!postfix) return;

    // Extract function name and argument list
    const callInfo = this.extractCallInfo(postfix);
    if (!callInfo) return;

    // Look up the C function in symbol table
    const cFunc = this.symbolTable?.getCSymbol(callInfo.funcName);
    if (cFunc?.kind !== "function" || !cFunc.parameters) return;

    // Check each argument against the corresponding parameter type
    for (let i = 0; i < callInfo.args.length; i++) {
      const param = cFunc.parameters[i];
      if (!param) continue;

      // Check if parameter type is a function pointer typedef
      if (!this.isCFunctionPointerTypedef(param.type)) continue;

      // Extract function reference from argument
      const funcRef = this.extractFunctionReference(callInfo.args[i]);
      if (!funcRef) continue;

      // Normalize scope-qualified names
      const lookupName = funcRef.includes(".")
        ? funcRef.replace(".", "_")
        : funcRef;

      // Mark as callback-compatible if it's a local C-Next function
      if (this.allLocalFunctions.has(lookupName)) {
        // Store function name -> typedef name mapping
        CodeGenState.callbackCompatibleFunctions.set(lookupName, param.type);
      }
    }
  }

  /**
   * Find the postfix expression within an expression tree.
   * Uses ExpressionUnwrapper which validates that expression is "simple"
   * (single term at each level), returning null for complex expressions.
   */
  private findPostfixExpression(
    expr: Parser.ExpressionContext,
  ): Parser.PostfixExpressionContext | null {
    return ExpressionUnwrapper.getPostfixExpression(expr);
  }

  /**
   * Extract function name and arguments from a postfix expression.
   * Returns null if not a function call.
   */
  private extractCallInfo(
    postfix: Parser.PostfixExpressionContext,
  ): { funcName: string; args: Parser.ExpressionContext[] } | null {
    const primary = postfix.primaryExpression();
    const ops = postfix.postfixOp();

    // Start with primary expression (identifier or 'global')
    const ident = primary.IDENTIFIER();
    const globalKw = primary.GLOBAL();

    // Early return: neither identifier nor global keyword means not a function call
    if (!ident && !globalKw) {
      return null;
    }

    // Build function name from primary + member access ops
    // For 'global' keyword, funcName starts empty and gets built from member access
    let funcName = ident ? ident.getText() : "";
    let argListOp: Parser.PostfixOpContext | null = null;

    // Walk postfix ops to find function name and call
    for (const op of ops) {
      if (op.IDENTIFIER()) {
        // Member access: build qualified name
        const member = op.IDENTIFIER()!.getText();
        funcName = funcName ? `${funcName}_${member}` : member;
      } else if (op.argumentList() || op.getText().startsWith("(")) {
        // Found the call - this op has the arguments
        argListOp = op;
        break;
      }
    }

    if (!argListOp || !funcName) return null;

    // Extract arguments
    const argList = argListOp.argumentList();
    const args = argList?.expression() ?? [];

    return { funcName, args };
  }

  /**
   * ADR-040: Register a variable that holds a callable (ISR or callback)
   */
  public defineCallableVariable(name: string): void {
    this.callableVariables.add(name);
  }

  /**
   * Register a function as defined
   */
  public defineFunction(name: string): void {
    this.definedFunctions.add(name);
  }

  /**
   * Track entering a function definition (for self-recursion detection)
   */
  public enterFunction(name: string): void {
    this.currentFunctionName = name;
  }

  /**
   * Track exiting a function definition
   */
  public exitFunction(): void {
    this.currentFunctionName = null;
  }

  /**
   * Check if a function name is a known scope
   */
  public isScope(name: string): boolean {
    return this.knownScopes.has(name);
  }

  /**
   * Check if a function call is valid (function is defined or external)
   * @param name The function name being called
   * @param line Source line number
   * @param column Source column number
   * @param currentScope The current scope name (if inside a scope)
   */
  public checkFunctionCall(
    name: string,
    line: number,
    column: number,
    currentScope: string | null,
  ): void {
    // Check for self-recursion (MISRA C:2012 Rule 17.2)
    if (this.currentFunctionName && name === this.currentFunctionName) {
      this.errors.push({
        code: "E0423",
        functionName: name,
        line,
        column,
        message: `recursive call to '${name}' is forbidden (MISRA C:2012 Rule 17.2)`,
      });
      return;
    }

    // Check if function is defined in C-Next
    if (this.definedFunctions.has(name)) {
      return; // OK - defined before use
    }

    // Check if function is a C-Next built-in
    if (CNEXT_BUILTINS.has(name)) {
      return; // OK - built-in function
    }

    // Check if function is from an included standard library header
    if (this.isStdlibFunction(name)) {
      return; // OK - standard library function
    }

    // Check if function is external (from symbol table)
    if (this.isExternalFunction(name)) {
      return; // OK - external C/C++ function
    }

    // ADR-040: Check if this is an ISR or callback variable being invoked
    if (this.callableVariables.has(name)) {
      return; // OK - invoking a function pointer variable
    }

    // ADR-057: Allow implicit scope function calls without this. prefix
    // Check if this is an unqualified call to a scope function
    // e.g., calling helper() instead of this.helper() inside a scope
    if (currentScope) {
      const qualifiedName = `${currentScope}_${name}`;
      if (this.definedFunctions.has(qualifiedName)) {
        return; // OK - implicit resolution will handle it
      }
    }

    // Not defined - report error with optional hint
    const header = this.findStdlibHeader(name);
    let message = `function '${name}' called before definition`;
    if (header) {
      message += `; hint: '${name}' is available from ${header} — try global.${name}()`;
    }

    this.errors.push({
      code: "E0422",
      functionName: name,
      line,
      column,
      message,
    });
  }

  /**
   * Check if a function is defined externally (from included files)
   * This includes C/C++ headers AND C-Next includes.
   *
   * Issue #786: Only considers a function "external" if it's NOT defined
   * in the current file. Functions defined locally are subject to
   * define-before-use checking, even if they exist in the SymbolTable.
   */
  private isExternalFunction(name: string): boolean {
    // If the function is defined in this file, it's not external
    // (even if it's also in the SymbolTable from symbol collection)
    if (this.allLocalFunctions.has(name)) {
      return false;
    }

    if (!this.symbolTable) {
      return false;
    }

    const symbols = this.symbolTable.getOverloads(name);
    for (const sym of symbols) {
      // Accept functions from any source language:
      // - C/C++ functions from header includes
      // - C-Next functions from .cnx file includes
      if (sym.kind === "function") {
        return true;
      }
    }

    return false;
  }
}

export default FunctionCallAnalyzer;
