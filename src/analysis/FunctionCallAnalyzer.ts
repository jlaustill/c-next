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
import ESourceLanguage from "../types/ESourceLanguage";
import ESymbolKind from "../types/ESymbolKind";
import { IFunctionCallError } from "./types/IFunctionCallError";

export { IFunctionCallError };

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
  private analyzer: FunctionCallAnalyzer;

  /** Current scope name (for member function resolution) */
  private currentScope: string | null = null;

  constructor(analyzer: FunctionCallAnalyzer) {
    super();
    this.analyzer = analyzer;
  }

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

  override enterPostfixExpression = (
    ctx: Parser.PostfixExpressionContext,
  ): void => {
    const ops = ctx.postfixOp();

    // Find function call pattern: identifier followed by () or (args)
    // This could be:
    // 1. Simple call: foo()
    // 2. Scope member call: Scope.member() -> Scope_member
    // 3. Method-style call: obj.method() - not a C-Next function

    const primary = ctx.primaryExpression();
    if (!primary.IDENTIFIER()) {
      return; // Not a simple identifier-based call
    }

    const baseName = primary.IDENTIFIER()!.getText();
    let resolvedName = baseName;
    let callOpIndex = -1;

    // Walk through postfix ops to find the call and resolve the name
    for (let i = 0; i < ops.length; i++) {
      const op = ops[i];

      // Member access: check if it's Scope.member pattern
      if (op.IDENTIFIER()) {
        const memberName = op.IDENTIFIER()!.getText();

        // Check if base is a known scope
        if (this.analyzer.isScope(resolvedName)) {
          // Scope.member -> Scope_member
          resolvedName = `${resolvedName}_${memberName}`;
        } else {
          // Object.method or chained access - not a C-Next function call
          // The method belongs to the object, not a standalone function
          return;
        }
      }
      // Function call: () or (args)
      else if (op.argumentList() || op.getChildCount() === 2) {
        // Check if this looks like a function call (has parens)
        const text = op.getText();
        if (text.startsWith("(")) {
          callOpIndex = i;
          break;
        }
      }
    }

    // If we found a call, check if the function is defined
    if (callOpIndex >= 0) {
      const line = ctx.start?.line ?? 0;
      const column = ctx.start?.column ?? 0;
      this.analyzer.checkFunctionCall(resolvedName, line, column);
    }
  };
}

/**
 * Analyzes C-Next AST for function calls before definition
 */
export class FunctionCallAnalyzer {
  private errors: IFunctionCallError[] = [];

  /** Functions that have been defined (in order of appearance) */
  private definedFunctions: Set<string> = new Set();

  /** Known scopes (for Scope.member -> Scope_member resolution) */
  private knownScopes: Set<string> = new Set();

  /** External symbol table for C/C++ interop */
  private symbolTable: SymbolTable | null = null;

  /** Included headers (for stdlib function lookup) */
  private includedHeaders: Set<string> = new Set();

  /** Current function being defined (for self-recursion detection) */
  private currentFunctionName: string | null = null;

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
    this.knownScopes = new Set();
    this.includedHeaders = new Set();
    this.symbolTable = symbolTable ?? null;
    this.currentFunctionName = null;

    // First pass: collect scope names and included headers
    this.collectScopes(tree);
    this.collectIncludes(tree);

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
      const match = text.match(/#include\s*[<"]([^>"]+)[>"]/);
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
      if (funcs && funcs.has(name)) {
        return true;
      }
    }
    return false;
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
   */
  public checkFunctionCall(name: string, line: number, column: number): void {
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

    // Not defined - report error
    this.errors.push({
      code: "E0422",
      functionName: name,
      line,
      column,
      message: `function '${name}' called before definition`,
    });
  }

  /**
   * Check if a function is defined externally (C/C++ interop)
   */
  private isExternalFunction(name: string): boolean {
    if (!this.symbolTable) {
      return false;
    }

    const symbols = this.symbolTable.getOverloads(name);
    for (const sym of symbols) {
      if (
        (sym.sourceLanguage === ESourceLanguage.C ||
          sym.sourceLanguage === ESourceLanguage.Cpp) &&
        sym.kind === ESymbolKind.Function
      ) {
        return true;
      }
    }

    return false;
  }
}

export default FunctionCallAnalyzer;
