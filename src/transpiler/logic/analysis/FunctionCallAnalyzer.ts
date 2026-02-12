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
import ESymbolKind from "../../../utils/types/ESymbolKind";
import IFunctionCallError from "./types/IFunctionCallError";
import ParserUtils from "../../../utils/ParserUtils";

/**
 * C-Next built-in functions
 * These are compiler intrinsics that don't need to be defined by the user
 */
const CNEXT_BUILTINS: Set<string> = new Set([
  "safe_div", // ADR-051: Safe division with default value
  "safe_mod", // ADR-051: Safe modulo with default value
]);

/**
 * Standard library functions from common C headers
 * These are considered "external" and don't need to be defined in C-Next
 */
const STDLIB_FUNCTIONS: Map<string, Set<string>> = new Map([
  [
    "stdio.h",
    new Set([
      "printf",
      "fprintf",
      "sprintf",
      "snprintf",
      "scanf",
      "fscanf",
      "sscanf",
      "fopen",
      "fclose",
      "fread",
      "fwrite",
      "fgets",
      "fputs",
      "fgetc",
      "fputc",
      "puts",
      "putchar",
      "getchar",
      "gets",
      "perror",
      "fflush",
      "fseek",
      "ftell",
      "rewind",
      "feof",
      "ferror",
      "clearerr",
      "remove",
      "rename",
      "tmpfile",
      "tmpnam",
      "setbuf",
      "setvbuf",
    ]),
  ],
  [
    "stdlib.h",
    new Set([
      "malloc",
      "calloc",
      "realloc",
      "free",
      "atoi",
      "atof",
      "atol",
      "atoll",
      "strtol",
      "strtoul",
      "strtoll",
      "strtoull",
      "strtof",
      "strtod",
      "strtold",
      "rand",
      "srand",
      "exit",
      "abort",
      "atexit",
      "system",
      "getenv",
      "abs",
      "labs",
      "llabs",
      "div",
      "ldiv",
      "lldiv",
      "qsort",
      "bsearch",
    ]),
  ],
  [
    "string.h",
    new Set([
      "strlen",
      "strcpy",
      "strncpy",
      "strcat",
      "strncat",
      "strcmp",
      "strncmp",
      "strchr",
      "strrchr",
      "strstr",
      "strtok",
      "memcpy",
      "memmove",
      "memset",
      "memcmp",
      "memchr",
    ]),
  ],
  [
    "math.h",
    new Set([
      "sin",
      "cos",
      "tan",
      "asin",
      "acos",
      "atan",
      "atan2",
      "sinh",
      "cosh",
      "tanh",
      "exp",
      "log",
      "log10",
      "log2",
      "pow",
      "sqrt",
      "cbrt",
      "ceil",
      "floor",
      "round",
      "trunc",
      "fabs",
      "fmod",
      "remainder",
      "fmax",
      "fmin",
      "hypot",
      "ldexp",
      "frexp",
      "modf",
      // C99 classification macros (also functions in C++)
      "isnan",
      "isinf",
      "isfinite",
      "isnormal",
      "signbit",
      "fpclassify",
      "nan",
      "nanf",
      "nanl",
    ]),
  ],
  [
    "ctype.h",
    new Set([
      "isalnum",
      "isalpha",
      "isdigit",
      "isxdigit",
      "islower",
      "isupper",
      "isspace",
      "ispunct",
      "isprint",
      "isgraph",
      "iscntrl",
      "tolower",
      "toupper",
    ]),
  ],
  [
    "time.h",
    new Set([
      "time",
      "clock",
      "difftime",
      "mktime",
      "strftime",
      "localtime",
      "gmtime",
      "asctime",
      "ctime",
    ]),
  ],
  ["assert.h", new Set(["assert"])],
  // Arduino framework
  [
    "Arduino.h",
    new Set([
      "pinMode",
      "digitalWrite",
      "digitalRead",
      "analogRead",
      "analogWrite",
      "delay",
      "delayMicroseconds",
      "millis",
      "micros",
      "attachInterrupt",
      "detachInterrupt",
      "noInterrupts",
      "interrupts",
      "Serial",
      "Wire",
      "SPI",
    ]),
  ],
]);

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
   * Track ISR-typed variables from variable declarations
   * e.g., `ISR handler <- myFunction;`
   */
  override enterVariableDeclaration = (
    ctx: Parser.VariableDeclarationContext,
  ): void => {
    const typeCtx = ctx.type();
    const typeName = typeCtx.getText();

    // Check if this is an ISR type or a callback type (function-as-type)
    if (typeName === "ISR" || this.analyzer.isCallbackType(typeName)) {
      const varName = ctx.IDENTIFIER().getText();
      this.analyzer.defineCallableVariable(varName);
    }
  };

  /**
   * Track ISR-typed parameters in function declarations
   * e.g., `void execute(ISR handler) { handler(); }`
   */
  override enterParameter = (ctx: Parser.ParameterContext): void => {
    const typeCtx = ctx.type();
    const typeName = typeCtx.getText();

    // Check if this is an ISR type or a callback type (function-as-type)
    if (typeName === "ISR" || this.analyzer.isCallbackType(typeName)) {
      const paramName = ctx.IDENTIFIER().getText();
      this.analyzer.defineCallableVariable(paramName);
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
    for (const header of this.includedHeaders) {
      const funcs = STDLIB_FUNCTIONS.get(header);
      if (funcs?.has(name)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Issue #787: Find which header a stdlib function belongs to (if any).
   * Returns the header name if found, or null if not a known stdlib function.
   * Checks ALL stdlib functions, not just from included headers.
   */
  private findStdlibHeader(name: string): string | null {
    for (const [header, funcs] of STDLIB_FUNCTIONS) {
      if (funcs.has(name)) {
        return header;
      }
    }
    return null;
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
      if (sym.kind === ESymbolKind.Function) {
        return true;
      }
    }

    return false;
  }
}

export default FunctionCallAnalyzer;
