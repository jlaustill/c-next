/**
 * C-Next Code Generator
 * Transforms C-Next AST to clean, readable C code
 */

import { CommonTokenStream, ParserRuleContext, TerminalNode } from "antlr4ng";
import * as Parser from "../parser/grammar/CNextParser";
import SymbolTable from "../symbols/SymbolTable";
import ESourceLanguage from "../types/ESourceLanguage";
import ESymbolKind from "../types/ESymbolKind";
import CommentExtractor from "./CommentExtractor";
import CommentFormatter from "./CommentFormatter";
import IComment from "./types/IComment";
import TYPE_WIDTH from "./types/TYPE_WIDTH";
import C_TYPE_WIDTH from "./types/C_TYPE_WIDTH";
import BITMAP_SIZE from "./types/BITMAP_SIZE";
// Issue #60: BITMAP_BACKING_TYPE moved to SymbolCollector
import TTypeInfo from "./types/TTypeInfo";
import TParameterInfo from "./types/TParameterInfo";
import TOverflowBehavior from "./types/TOverflowBehavior";
import ICodeGeneratorOptions from "./types/ICodeGeneratorOptions";
import TypeResolver from "./TypeResolver";
import SymbolCollector from "./SymbolCollector";
import TypeValidator from "./TypeValidator";
import * as fs from "fs";
import * as path from "path";

/**
 * Maps C-Next types to C types
 */
const TYPE_MAP: Record<string, string> = {
  u8: "uint8_t",
  u16: "uint16_t",
  u32: "uint32_t",
  u64: "uint64_t",
  i8: "int8_t",
  i16: "int16_t",
  i32: "int32_t",
  i64: "int64_t",
  f32: "float",
  f64: "double",
  bool: "bool",
  void: "void",
  ISR: "ISR", // ADR-040: Interrupt Service Routine function pointer
};

/**
 * Maps C-Next types to wider C types for clamp helper operands
 * Issue #94: Prevents silent truncation when operand exceeds target type range
 */
const WIDER_TYPE_MAP: Record<string, string> = {
  u8: "uint32_t",
  u16: "uint32_t",
  u32: "uint64_t",
  u64: "uint64_t", // Already widest
  i8: "int32_t",
  i16: "int32_t",
  i32: "int64_t",
  i64: "int64_t", // Already widest
};

/**
 * Maps C-Next assignment operators to C assignment operators
 */
const ASSIGNMENT_OPERATOR_MAP: Record<string, string> = {
  "<-": "=",
  "+<-": "+=",
  "-<-": "-=",
  "*<-": "*=",
  "/<-": "/=",
  "%<-": "%=",
  "&<-": "&=",
  "|<-": "|=",
  "^<-": "^=",
  "<<<-": "<<=",
  ">><-": ">>=",
};

/**
 * ADR-013: Function signature for const parameter tracking
 * Used to validate const-to-non-const errors at call sites
 */
interface FunctionSignature {
  name: string;
  parameters: Array<{
    name: string;
    baseType: string; // The C-Next type (e.g., 'u32', 'f32')
    isConst: boolean;
    isArray: boolean;
  }>;
}

/**
 * ADR-029: Callback type info for Function-as-Type pattern
 * Each function definition creates both a callable function AND a type
 */
interface CallbackTypeInfo {
  functionName: string; // The original function name (also the type name)
  returnType: string; // Return type for typedef (C type)
  parameters: Array<{
    // Parameter info for typedef
    name: string;
    type: string; // C type
    isConst: boolean;
    isPointer: boolean; // ADR-006: Non-array params become pointers
    isArray: boolean; // Array parameters pass naturally as pointers
    arrayDims: string; // Array dimensions if applicable
  }>;
  typedefName: string; // e.g., "onReceive_fp"
}

/**
 * ADR-049: Target platform capabilities for code generation
 */
interface TargetCapabilities {
  wordSize: 8 | 16 | 32;
  hasLdrexStrex: boolean;
  hasBasepri: boolean;
}

/**
 * ADR-049: Target platform capability map
 */
const TARGET_CAPABILITIES: Record<string, TargetCapabilities> = {
  teensy41: { wordSize: 32, hasLdrexStrex: true, hasBasepri: true },
  teensy40: { wordSize: 32, hasLdrexStrex: true, hasBasepri: true },
  "cortex-m7": { wordSize: 32, hasLdrexStrex: true, hasBasepri: true },
  "cortex-m4": { wordSize: 32, hasLdrexStrex: true, hasBasepri: true },
  "cortex-m3": { wordSize: 32, hasLdrexStrex: true, hasBasepri: true },
  "cortex-m0+": { wordSize: 32, hasLdrexStrex: true, hasBasepri: false },
  "cortex-m0": { wordSize: 32, hasLdrexStrex: false, hasBasepri: false },
  avr: { wordSize: 8, hasLdrexStrex: false, hasBasepri: false },
};

/**
 * ADR-049: Default target capabilities (safe fallback)
 */
const DEFAULT_TARGET: TargetCapabilities = {
  wordSize: 32,
  hasLdrexStrex: false,
  hasBasepri: false,
};

/**
 * ADR-049: LDREX/STREX intrinsic map for atomic operations
 */
const LDREX_MAP: Record<string, string> = {
  u8: "__LDREXB",
  i8: "__LDREXB",
  u16: "__LDREXH",
  i16: "__LDREXH",
  u32: "__LDREXW",
  i32: "__LDREXW",
};

/**
 * ADR-049: STREX intrinsic map for atomic operations
 */
const STREX_MAP: Record<string, string> = {
  u8: "__STREXB",
  i8: "__STREXB",
  u16: "__STREXH",
  i16: "__STREXH",
  u32: "__STREXW",
  i32: "__STREXW",
};

/**
 * ADR-044: Assignment context for overflow behavior tracking
 */
interface AssignmentContext {
  targetName: string | null;
  targetType: string | null;
  overflowBehavior: TOverflowBehavior;
}

/**
 * Context for tracking current scope during code generation
 */
interface GeneratorContext {
  currentScope: string | null; // ADR-016: renamed from currentNamespace
  indentLevel: number;
  scopeMembers: Map<string, Set<string>>; // scope -> member names (ADR-016)
  currentParameters: Map<string, TParameterInfo>; // ADR-006: track params for pointer semantics
  localArrays: Set<string>; // ADR-006: track local array variables (no & needed)
  localVariables: Set<string>; // ADR-016: track local variables (allowed as bare identifiers)
  inFunctionBody: boolean; // ADR-016: track if we're inside a function body
  typeRegistry: Map<string, TTypeInfo>; // Track variable types for bit access and .length
  expectedType: string | null; // For inferred struct initializers
  mainArgsName: string | null; // Track the args parameter name for main() translation
  assignmentContext: AssignmentContext; // ADR-044: Track current assignment for overflow
  lastArrayInitCount: number; // ADR-035: Track element count for size inference
  lastArrayFillValue: string | undefined; // ADR-035: Track fill-all value
  lengthCache: Map<string, string> | null; // Cache: variable name -> temp variable name for strlen optimization
  targetCapabilities: TargetCapabilities; // ADR-049: Target platform for atomic code generation
}

/**
 * Code Generator - Transpiles C-Next to C
 */
export default class CodeGenerator {
  /** ADR-044: Debug mode generates panic-on-overflow helpers */
  private debugMode: boolean = false;

  private context: GeneratorContext = {
    currentScope: null, // ADR-016: renamed from currentNamespace
    indentLevel: 0,
    scopeMembers: new Map(), // ADR-016: renamed from namespaceMembers
    currentParameters: new Map(),
    localArrays: new Set(),
    localVariables: new Set(), // ADR-016: track local variables
    inFunctionBody: false, // ADR-016: track if inside function body
    typeRegistry: new Map(),
    expectedType: null,
    mainArgsName: null, // Track the args parameter name for main() translation
    assignmentContext: {
      targetName: null,
      targetType: null,
      overflowBehavior: "clamp",
    }, // ADR-044
    lastArrayInitCount: 0, // ADR-035: Track element count for size inference
    lastArrayFillValue: undefined, // ADR-035: Track fill-all value
    lengthCache: null, // strlen optimization: variable -> temp var name
    targetCapabilities: DEFAULT_TARGET, // ADR-049: Target platform capabilities
  };

  // Issue #60: Symbol fields moved to SymbolCollector
  // Remaining fields not yet extracted:

  private inAssignmentTarget: boolean = false;

  private knownFunctions: Set<string> = new Set(); // Track C-Next defined functions

  private functionSignatures: Map<string, FunctionSignature> = new Map(); // ADR-013: Track function parameter const-ness

  // Bug #8: Track compile-time const values for array size resolution at file scope
  private constValues: Map<string, number> = new Map(); // constName -> numeric value

  // ADR-029: Callback types registry
  private callbackTypes: Map<string, CallbackTypeInfo> = new Map(); // funcName -> CallbackTypeInfo

  private callbackFieldTypes: Map<string, string> = new Map(); // "Struct.field" -> callbackTypeName

  // ADR-044: Track which overflow helper types and operations are needed
  private usedClampOps: Set<string> = new Set(); // Format: "add_u8", "sub_u16", "mul_u32"

  private usedSafeDivOps: Set<string> = new Set(); // ADR-051: Format: "div_u32", "mod_i16"

  // Track required standard library includes
  private needsStdint: boolean = false; // For u8, u16, u32, u64, i8, i16, i32, i64

  private needsStdbool: boolean = false; // For bool type

  private needsString: boolean = false; // ADR-045: For strlen, strncpy, etc.

  private needsISR: boolean = false; // ADR-040: For ISR function pointer type

  private needsCMSIS: boolean = false; // ADR-049/050: For atomic intrinsics and critical sections

  /** External symbol table for cross-language interop */
  private symbolTable: SymbolTable | null = null;

  /** ADR-010: Source file path for validating includes */
  private sourcePath: string | null = null;

  /** Token stream for comment extraction (ADR-043) */
  private tokenStream: CommonTokenStream | null = null;

  private commentExtractor: CommentExtractor | null = null;

  private commentFormatter: CommentFormatter = new CommentFormatter();

  /** Type resolution and classification */
  private typeResolver: TypeResolver | null = null;

  /** Symbol collection - Issue #60: Extracted from CodeGenerator */
  public symbols: SymbolCollector | null = null;

  /** Type validation - Issue #63: Extracted from CodeGenerator */
  private typeValidator: TypeValidator | null = null;

  /**
   * Get struct field type and dimensions, checking SymbolTable first (for C headers),
   * then falling back to local structFields (for C-Next structs).
   *
   * @param structName Name of the struct
   * @param fieldName Name of the field
   * @returns Object with type and optional dimensions, or undefined if not found
   */
  private getStructFieldInfo(
    structName: string,
    fieldName: string,
  ): { type: string; dimensions?: number[] } | undefined {
    // First check SymbolTable (C header structs)
    if (this.symbolTable) {
      const fieldInfo = this.symbolTable.getStructFieldInfo(
        structName,
        fieldName,
      );
      if (fieldInfo) {
        return {
          type: fieldInfo.type,
          dimensions: fieldInfo.arrayDimensions,
        };
      }
    }

    // Fall back to local C-Next struct fields
    const localFields = this.symbols!.structFields.get(structName);
    if (localFields) {
      const fieldType = localFields.get(fieldName);
      if (fieldType) {
        // Get dimensions from structFieldDimensions
        const fieldDimensions =
          this.symbols!.structFieldDimensions.get(structName);
        const dimensions = fieldDimensions?.get(fieldName);
        return {
          type: fieldType,
          dimensions: dimensions,
        };
      }
    }

    return undefined;
  }

  /**
   * Check if a type name is a known struct (C-Next or C header).
   * Issue #103: Must check both local knownStructs AND SymbolTable
   * for proper type chain tracking through nested C header structs.
   */
  private isKnownStruct(typeName: string): boolean {
    // Check C-Next structs first (local definitions)
    if (this.symbols!.knownStructs.has(typeName)) {
      return true;
    }
    // Check SymbolTable for C header structs
    if (this.symbolTable?.getStructFields(typeName)) {
      return true;
    }
    return false;
  }

  /**
   * Check if a function is a C-Next function (uses pass-by-reference semantics).
   * Checks both internal tracking and external symbol table.
   */
  private isCNextFunction(name: string): boolean {
    // First check internal tracking (for current file)
    if (this.knownFunctions.has(name)) {
      return true;
    }

    // Then check symbol table for cross-file C-Next functions
    if (this.symbolTable) {
      const symbols = this.symbolTable.getOverloads(name);
      for (const sym of symbols) {
        if (
          sym.sourceLanguage === ESourceLanguage.CNext &&
          sym.kind === ESymbolKind.Function
        ) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Check if a function is an external C/C++ function (uses pass-by-value semantics).
   * Returns true if the function is found in symbol table as C or C++.
   */
  private isExternalCFunction(name: string): boolean {
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

  /**
   * Generate C code from a C-Next program
   * @param tree The parsed C-Next program
   * @param symbolTable Optional symbol table for cross-language interop
   * @param tokenStream Optional token stream for comment preservation (ADR-043)
   * @param options Optional code generator options (e.g., debugMode)
   */
  generate(
    tree: Parser.ProgramContext,
    symbolTable?: SymbolTable,
    tokenStream?: CommonTokenStream,
    options?: ICodeGeneratorOptions,
  ): string {
    // Store symbol table for function lookup
    this.symbolTable = symbolTable ?? null;

    // ADR-044: Store debug mode for panic helper generation
    this.debugMode = options?.debugMode ?? false;

    // ADR-010: Store source path for include validation
    this.sourcePath = options?.sourcePath ?? null;

    // Initialize comment extraction (ADR-043)
    this.tokenStream = tokenStream ?? null;
    if (this.tokenStream) {
      this.commentExtractor = new CommentExtractor(this.tokenStream);
    } else {
      this.commentExtractor = null;
    }

    // ADR-049: Determine target capabilities with priority: CLI > pragma > default
    const targetCapabilities = this.resolveTargetCapabilities(
      tree,
      options?.target,
    );

    // Reset state
    this.context = {
      currentScope: null, // ADR-016
      indentLevel: 0,
      scopeMembers: new Map(), // ADR-016
      currentParameters: new Map(),
      localArrays: new Set(),
      localVariables: new Set(), // ADR-016
      inFunctionBody: false, // ADR-016
      typeRegistry: new Map(),
      expectedType: null,
      mainArgsName: null, // Track the args parameter name for main() translation
      assignmentContext: {
        targetName: null,
        targetType: null,
        overflowBehavior: "clamp",
      }, // ADR-044
      lastArrayInitCount: 0, // ADR-035: Track element count for size inference
      lastArrayFillValue: undefined as string | undefined, // ADR-035: Track fill-all value
      lengthCache: null, // strlen optimization: variable -> temp var name
      targetCapabilities, // ADR-049: Target platform capabilities
    };
    // Issue #60: Symbol field resets removed - now handled by SymbolCollector
    this.knownFunctions = new Set();
    this.functionSignatures = new Map();
    this.callbackTypes = new Map(); // ADR-029: Reset callback types
    this.callbackFieldTypes = new Map(); // ADR-029: Reset callback field tracking
    this.usedClampOps = new Set(); // ADR-044: Reset overflow helpers
    this.usedSafeDivOps = new Set(); // ADR-051: Reset safe division helpers
    this.needsStdint = false;
    this.needsStdbool = false;
    this.needsString = false; // ADR-045: Reset string header tracking
    this.needsISR = false; // ADR-040: Reset ISR typedef tracking
    this.needsCMSIS = false; // ADR-049/050: Reset CMSIS include tracking

    // First pass: collect namespace and class members
    // Issue #60: Create SymbolCollector (extracted from CodeGenerator)
    this.symbols = new SymbolCollector(tree);

    // Copy symbol data to context.scopeMembers (used by code generation)
    for (const [scopeName, members] of this.symbols.scopeMembers) {
      this.context.scopeMembers.set(scopeName, members);
    }

    // Issue #61: Initialize type resolver with clean dependencies
    this.typeResolver = new TypeResolver({
      symbols: this.symbols,
      symbolTable: this.symbolTable,
      typeRegistry: this.context.typeRegistry,
      resolveIdentifier: (name: string) => this.resolveIdentifier(name),
    });

    // Collect function/callback information (not yet extracted to SymbolCollector)
    this.collectFunctionsAndCallbacks(tree);

    // Issue #63: Initialize type validator with clean dependencies
    this.typeValidator = new TypeValidator({
      symbols: this.symbols,
      symbolTable: this.symbolTable,
      typeRegistry: this.context.typeRegistry,
      typeResolver: this.typeResolver,
      callbackTypes: this.callbackTypes,
      knownFunctions: this.knownFunctions,
      knownGlobals: new Set(), // TODO: Extract known globals if needed
      getCurrentScope: () => this.context.currentScope,
      getScopeMembers: () => this.context.scopeMembers,
      getCurrentParameters: () => this.context.currentParameters,
      getLocalVariables: () => this.context.localVariables,
      resolveIdentifier: (name: string) => this.resolveIdentifier(name),
      getExpressionType: (ctx: unknown) =>
        this.getExpressionType(ctx as Parser.ExpressionContext),
    });

    // Second pass: register all variable types in the type registry
    // This ensures .length and other type-dependent operations can resolve
    // variables regardless of declaration order
    this.registerAllVariableTypes(tree);

    const output: string[] = [];

    // Add header comment
    output.push("/**");
    output.push(" * Generated by C-Next Transpiler");
    output.push(" * A safer C for embedded systems");
    output.push(" */");
    output.push("");

    // Pass through #include directives from source
    // C-Next does NOT hardcode any libraries - all includes must be explicit
    // ADR-043: Comments before first include become file-level comments
    // ADR-010: Transform .cnx includes to .h, reject implementation files
    for (const includeDir of tree.includeDirective()) {
      const leadingComments = this.getLeadingComments(includeDir);
      output.push(...this.formatLeadingComments(leadingComments));

      // ADR-010: Validate no implementation files are included
      const lineNumber = includeDir.start?.line ?? 0;
      this.typeValidator!.validateIncludeNotImplementationFile(
        includeDir.getText(),
        lineNumber,
      );

      const transformedInclude = this.transformIncludeDirective(
        includeDir.getText(),
      );
      output.push(transformedInclude);
    }

    // Add blank line after includes if there were any
    if (tree.includeDirective().length > 0) {
      output.push("");
    }

    // ADR-037: Process preprocessor directives (defines and conditionals)
    for (const ppDir of tree.preprocessorDirective()) {
      const leadingComments = this.getLeadingComments(ppDir);
      output.push(...this.formatLeadingComments(leadingComments));
      const result = this.processPreprocessorDirective(ppDir);
      if (result) {
        output.push(result);
      }
    }

    // Add blank line after preprocessor directives if there were any
    if (tree.preprocessorDirective().length > 0) {
      output.push("");
    }

    // Visit all declarations (first generate to collect helper usage)
    const declarations: string[] = [];
    for (const decl of tree.declaration()) {
      // ADR-043: Get comments before this declaration
      const leadingComments = this.getLeadingComments(decl);
      declarations.push(...this.formatLeadingComments(leadingComments));

      const code = this.generateDeclaration(decl);
      if (code) {
        declarations.push(code);
      }
    }

    // Add required standard library includes (after user includes, before helpers)
    const autoIncludes: string[] = [];
    if (this.needsStdint) {
      autoIncludes.push("#include <stdint.h>");
    }
    if (this.needsStdbool) {
      autoIncludes.push("#include <stdbool.h>");
    }
    if (this.needsString) {
      autoIncludes.push("#include <string.h>"); // ADR-045: For strlen, strncpy, etc.
    }
    if (this.needsCMSIS) {
      // ADR-049/050: CMSIS intrinsics for atomic operations and critical sections
      // Note: For Arduino/Teensy, these are typically included via Arduino.h
      // For standalone ARM targets, cmsis_gcc.h provides __LDREX/__STREX/__get_PRIMASK etc.
      autoIncludes.push("#include <cmsis_gcc.h>");
    }
    if (autoIncludes.length > 0) {
      output.push(...autoIncludes);
      output.push("");
    }

    // ADR-040: Add ISR typedef if needed
    if (this.needsISR) {
      output.push("/* ADR-040: ISR function pointer type */");
      output.push("typedef void (*ISR)(void);");
      output.push("");
    }

    // ADR-044: Insert overflow helpers before declarations (if any are needed)
    const helpers = this.generateOverflowHelpers();
    if (helpers.length > 0) {
      output.push(...helpers);
    }

    // ADR-051: Insert safe division helpers
    const safeDivHelpers = this.generateSafeDivHelpers();
    if (safeDivHelpers.length > 0) {
      output.push(...safeDivHelpers);
    }

    // Add the declarations
    output.push(...declarations);

    return output.join("\n");
  }

  /**
   * ADR-049: Resolve target capabilities with priority: CLI > pragma > default
   * @param tree - The parsed program tree
   * @param cliTarget - Optional target from CLI --target flag
   */
  private resolveTargetCapabilities(
    tree: Parser.ProgramContext,
    cliTarget?: string,
  ): TargetCapabilities {
    // Priority 1: CLI --target flag
    if (cliTarget) {
      const targetName = cliTarget.toLowerCase();
      if (TARGET_CAPABILITIES[targetName]) {
        return TARGET_CAPABILITIES[targetName];
      }
      // Warn about unknown CLI target but continue with pragma/default
      console.warn(
        `Warning: Unknown target '${cliTarget}', falling back to pragma or default`,
      );
    }

    // Priority 2: #pragma target in source
    const pragmaTarget = this.parseTargetPragma(tree);
    if (pragmaTarget !== DEFAULT_TARGET) {
      return pragmaTarget;
    }

    // Priority 3: Default (safe fallback - no LDREX/STREX)
    return DEFAULT_TARGET;
  }

  /**
   * ADR-049: Parse #pragma target directive from source
   * Returns capabilities for the specified platform, or DEFAULT_TARGET if none found
   */
  private parseTargetPragma(tree: Parser.ProgramContext): TargetCapabilities {
    // pragmaDirective is accessed through preprocessorDirective
    const preprocessorDirs = tree.preprocessorDirective();
    for (const ppDir of preprocessorDirs) {
      const pragmaDir = ppDir.pragmaDirective();
      if (pragmaDir) {
        // PRAGMA_TARGET captures the whole "#pragma target <name>" as one token
        const text = pragmaDir.getText();
        // Extract target name: "#pragma target teensy41" -> "teensy41"
        const match = text.match(/#\s*pragma\s+target\s+(\S+)/i);
        if (match) {
          const targetName = match[1].toLowerCase();
          if (TARGET_CAPABILITIES[targetName]) {
            return TARGET_CAPABILITIES[targetName];
          }
        }
      }
    }
    return DEFAULT_TARGET;
  }

  /**
   * ADR-010: Transform #include directives, converting .cnx to .h
   * Validates that .cnx files exist if sourcePath is available
   * Supports both <file.cnx> and "file.cnx" forms
   */
  private transformIncludeDirective(includeText: string): string {
    // Match: #include <file.cnx> or #include "file.cnx"
    const angleMatch = includeText.match(/#\s*include\s*<([^>]+)\.cnx>/);
    const quoteMatch = includeText.match(/#\s*include\s*"([^"]+)\.cnx"/);

    if (angleMatch) {
      const filename = angleMatch[1];
      // Angle brackets: system/library includes - no validation needed
      return includeText.replace(`<${filename}.cnx>`, `<${filename}.h>`);
    } else if (quoteMatch) {
      const filepath = quoteMatch[1];

      // Validate .cnx file exists if we have source path
      if (this.sourcePath) {
        const sourceDir = path.dirname(this.sourcePath);
        const cnxPath = path.resolve(sourceDir, `${filepath}.cnx`);

        if (!fs.existsSync(cnxPath)) {
          throw new Error(
            `Error: Included C-Next file not found: ${filepath}.cnx\n` +
              `  Searched at: ${cnxPath}\n` +
              `  Referenced in: ${this.sourcePath}`,
          );
        }
      }

      // Transform to .h
      return includeText.replace(`"${filepath}.cnx"`, `"${filepath}.h"`);
    }

    // Not a .cnx include - pass through unchanged
    return includeText;
  }

  // Issue #63: validateIncludeNotImplementationFile moved to TypeValidator

  /**
   * Collect function and callback information.
   * Issue #60: Symbol collection extracted to SymbolCollector.
   * This method handles function signatures and callback types (not yet extracted).
   */
  private collectFunctionsAndCallbacks(tree: Parser.ProgramContext): void {
    for (const decl of tree.declaration()) {
      // ADR-016: Handle scope declarations for function tracking
      if (decl.scopeDeclaration()) {
        const scopeDecl = decl.scopeDeclaration()!;
        const scopeName = scopeDecl.IDENTIFIER().getText();

        for (const member of scopeDecl.scopeMember()) {
          if (member.functionDeclaration()) {
            const funcDecl = member.functionDeclaration()!;
            const funcName = funcDecl.IDENTIFIER().getText();
            // Track fully qualified function name: Scope_function
            const fullName = `${scopeName}_${funcName}`;
            this.knownFunctions.add(fullName);
            // ADR-013: Track function signature for const checking
            const sig = this.extractFunctionSignature(
              fullName,
              funcDecl.parameterList() ?? null,
            );
            this.functionSignatures.set(fullName, sig);
            // ADR-029: Register scoped function as callback type
            this.registerCallbackType(fullName, funcDecl);
          }
        }
      }

      // ADR-029: Track callback field types in structs
      if (decl.structDeclaration()) {
        const structDecl = decl.structDeclaration()!;
        const structName = structDecl.IDENTIFIER().getText();

        for (const member of structDecl.structMember()) {
          const fieldName = member.IDENTIFIER().getText();
          const fieldType = this.getTypeName(member.type());

          // Track callback field types (needed for typedef generation)
          if (this.callbackTypes.has(fieldType)) {
            this.callbackFieldTypes.set(
              `${structName}.${fieldName}`,
              fieldType,
            );
          }
        }
      }

      // Track top-level functions
      if (decl.functionDeclaration()) {
        const funcDecl = decl.functionDeclaration()!;
        const name = funcDecl.IDENTIFIER().getText();
        this.knownFunctions.add(name);
        // ADR-013: Track function signature for const checking
        const sig = this.extractFunctionSignature(
          name,
          funcDecl.parameterList() ?? null,
        );
        this.functionSignatures.set(name, sig);
        // ADR-029: Register function as callback type
        this.registerCallbackType(name, funcDecl);
      }
    }
  }

  /**
   * Second pass: register all variable types in the type registry
   * This ensures type information is available before generating any code,
   * allowing .length and other type-dependent operations to work regardless
   * of declaration order (e.g., scope functions can reference globals declared later)
   */
  private registerAllVariableTypes(tree: Parser.ProgramContext): void {
    for (const decl of tree.declaration()) {
      // Register global variable types
      if (decl.variableDeclaration()) {
        const varDecl = decl.variableDeclaration()!;
        this.trackVariableType(varDecl);

        // Bug #8: Track const values for array size resolution at file scope
        if (varDecl.constModifier() && varDecl.expression()) {
          const constName = varDecl.IDENTIFIER().getText();
          const constValue = this.tryEvaluateConstant(varDecl.expression()!);
          if (constValue !== undefined) {
            this.constValues.set(constName, constValue);
          }
        }
      }

      // Register scope member variable types
      if (decl.scopeDeclaration()) {
        const scopeDecl = decl.scopeDeclaration()!;
        const scopeName = scopeDecl.IDENTIFIER().getText();

        // Set currentScope so that this.Type references resolve correctly
        const savedScope = this.context.currentScope;
        this.context.currentScope = scopeName;

        for (const member of scopeDecl.scopeMember()) {
          if (member.variableDeclaration()) {
            const varDecl = member.variableDeclaration()!;
            const varName = varDecl.IDENTIFIER().getText();
            const fullName = `${scopeName}_${varName}`;
            // Register with mangled name (Scope_variable)
            this.trackVariableTypeWithName(varDecl, fullName);
          }
        }

        // Restore previous scope
        this.context.currentScope = savedScope;
      }

      // Note: Function parameters are registered per-function during generation
      // since they're scoped to the function body
    }
  }

  // Issue #60: collectEnum and collectBitmap methods removed - now in SymbolCollector

  // Issue #63: validateBitmapFieldLiteral moved to TypeValidator
  // Issue #60: evaluateConstantExpression method removed - now in SymbolCollector

  /**
   * ADR-036: Try to evaluate an expression as a compile-time constant.
   * Returns the numeric value if constant, undefined if not evaluable.
   * Bug #8: Extended to resolve const variable references for file-scope array sizes.
   */
  private tryEvaluateConstant(
    ctx: Parser.ExpressionContext,
  ): number | undefined {
    // Get the expression text and try to parse it as a simple integer literal
    const text = ctx.getText().trim();

    // Check if it's a simple integer literal
    if (/^-?\d+$/.test(text)) {
      return parseInt(text, 10);
    }
    // Check if it's a hex literal
    if (/^0[xX][0-9a-fA-F]+$/.test(text)) {
      return parseInt(text, 16);
    }
    // Check if it's a binary literal
    if (/^0[bB][01]+$/.test(text)) {
      return parseInt(text.substring(2), 2);
    }

    // Bug #8: Check if it's a known const value (identifier)
    if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(text)) {
      const constValue = this.constValues.get(text);
      if (constValue !== undefined) {
        return constValue;
      }
    }

    // Bug #8: Handle simple binary expressions with const values (e.g., INDEX_1 + INDEX_1)
    const addMatch = text.match(
      /^([a-zA-Z_][a-zA-Z0-9_]*)\+([a-zA-Z_][a-zA-Z0-9_]*)$/,
    );
    if (addMatch) {
      const left = this.constValues.get(addMatch[1]);
      const right = this.constValues.get(addMatch[2]);
      if (left !== undefined && right !== undefined) {
        return left + right;
      }
    }

    // Handle sizeof(type) expressions for primitive types
    const sizeofMatch = text.match(/^sizeof\(([a-zA-Z_][a-zA-Z0-9_]*)\)$/);
    if (sizeofMatch) {
      const typeName = sizeofMatch[1];
      const bitWidth = TYPE_WIDTH[typeName];
      if (bitWidth) {
        return bitWidth / 8; // Convert bits to bytes
      }
      // Check if it's a known struct
      if (this.isKnownStruct(typeName)) {
        // For structs, we can't easily compute size at this point
        // Just return undefined and let the array work without dimension tracking
        // The generated C will still work because sizeof() is evaluated at C compile time
        return undefined;
      }
    }

    // Handle sizeof(type) * N expressions
    const sizeofMulMatch = text.match(
      /^sizeof\(([a-zA-Z_][a-zA-Z0-9_]*)\)\*(\d+)$/,
    );
    if (sizeofMulMatch) {
      const typeName = sizeofMulMatch[1];
      const multiplier = parseInt(sizeofMulMatch[2], 10);
      const bitWidth = TYPE_WIDTH[typeName];
      if (bitWidth && !isNaN(multiplier)) {
        return (bitWidth / 8) * multiplier;
      }
    }

    // Handle sizeof(type) + N expressions
    const sizeofAddMatch = text.match(
      /^sizeof\(([a-zA-Z_][a-zA-Z0-9_]*)\)\+(\d+)$/,
    );
    if (sizeofAddMatch) {
      const typeName = sizeofAddMatch[1];
      const addend = parseInt(sizeofAddMatch[2], 10);
      const bitWidth = TYPE_WIDTH[typeName];
      if (bitWidth && !isNaN(addend)) {
        return bitWidth / 8 + addend;
      }
    }

    // For more complex expressions, we can't evaluate at compile time
    return undefined;
  }

  // Issue #63: checkArrayBounds moved to TypeValidator

  /**
   * Extract type info from a variable declaration and register it
   */
  private trackVariableType(varDecl: Parser.VariableDeclarationContext): void {
    const name = varDecl.IDENTIFIER().getText();
    const typeCtx = varDecl.type();
    const arrayDim = varDecl.arrayDimension();
    const isConst = varDecl.constModifier() !== null; // ADR-013: Track const modifier

    // ADR-044: Extract overflow modifier (clamp is default)
    const overflowMod = varDecl.overflowModifier();
    const overflowBehavior: TOverflowBehavior =
      overflowMod?.getText() === "wrap" ? "wrap" : "clamp";

    // ADR-049: Extract atomic modifier
    const isAtomic = varDecl.atomicModifier() !== null;

    let baseType = "";
    let bitWidth = 0;
    let isArray = false;
    const arrayDimensions: number[] = []; // ADR-036: Track all dimensions

    if (typeCtx.primitiveType()) {
      baseType = typeCtx.primitiveType()!.getText();
      bitWidth = TYPE_WIDTH[baseType] || 0;
    } else if (typeCtx.stringType()) {
      // ADR-045: Handle bounded string type
      const stringCtx = typeCtx.stringType()!;
      const intLiteral = stringCtx.INTEGER_LITERAL();

      if (intLiteral) {
        const capacity = parseInt(intLiteral.getText(), 10);
        this.needsString = true;
        const stringDim = capacity + 1; // String capacity dimension (last)

        // Check if there are additional array dimensions (e.g., [4] in string<64> arr[4])
        if (arrayDim && arrayDim.length > 0) {
          // Process array dimensions (they come BEFORE string capacity)
          const dims: number[] = [];
          for (const dim of arrayDim) {
            const sizeExpr = dim.expression();
            if (sizeExpr) {
              const size = parseInt(sizeExpr.getText(), 10);
              if (!isNaN(size) && size > 0) {
                dims.push(size);
              }
            }
          }
          // Append string capacity as final dimension
          dims.push(stringDim);

          this.context.typeRegistry.set(name, {
            baseType: "char",
            bitWidth: 8,
            isArray: true,
            arrayDimensions: dims, // [4, 65] for string<64> arr[4]
            isConst,
            isString: true,
            stringCapacity: capacity,
            overflowBehavior,
            isAtomic,
          });
        } else {
          // Single string: string<64> s
          this.context.typeRegistry.set(name, {
            baseType: "char",
            bitWidth: 8,
            isArray: true,
            arrayDimensions: [stringDim], // [65]
            isConst,
            isString: true,
            stringCapacity: capacity,
            overflowBehavior,
            isAtomic,
          });
        }
        return; // Early return, we've handled this case
      } else {
        // Unsized string - for const inference (handled in generateVariableDecl)
        baseType = "string";
        bitWidth = 0;
      }
    } else if (typeCtx.scopedType()) {
      // ADR-016: Handle this.Type for scoped types (e.g., this.State -> Motor_State)
      const typeName = typeCtx.scopedType()!.IDENTIFIER().getText();
      if (this.context.currentScope) {
        baseType = `${this.context.currentScope}_${typeName}`;
      } else {
        baseType = typeName;
      }
      bitWidth = 0;

      // ADR-017: Check if this is an enum type
      if (this.symbols!.knownEnums.has(baseType)) {
        this.context.typeRegistry.set(name, {
          baseType,
          bitWidth: 0,
          isArray: false,
          isConst,
          isEnum: true,
          enumTypeName: baseType,
          overflowBehavior, // ADR-044
          isAtomic, // ADR-049
        });
        return; // Early return, we've handled this case
      }

      // ADR-034: Check if this is a bitmap type
      if (this.symbols!.knownBitmaps.has(baseType)) {
        this.context.typeRegistry.set(name, {
          baseType,
          bitWidth: 0,
          isArray: false,
          isConst,
          isBitmap: true,
          bitmapTypeName: baseType,
          overflowBehavior, // ADR-044
          isAtomic, // ADR-049
        });
        return; // Early return, we've handled this case
      }
    } else if (typeCtx.qualifiedType()) {
      // ADR-016: Handle Scope.Type from outside scope (e.g., Motor.State -> Motor_State)
      const identifiers = typeCtx.qualifiedType()!.IDENTIFIER();
      const scopeName = identifiers[0].getText();
      const typeName = identifiers[1].getText();
      baseType = `${scopeName}_${typeName}`;
      bitWidth = 0;

      // ADR-017: Check if this is an enum type
      if (this.symbols!.knownEnums.has(baseType)) {
        this.context.typeRegistry.set(name, {
          baseType,
          bitWidth: 0,
          isArray: false,
          isConst,
          isEnum: true,
          enumTypeName: baseType,
          overflowBehavior, // ADR-044
          isAtomic, // ADR-049
        });
        return; // Early return, we've handled this case
      }

      // ADR-034: Check if this is a bitmap type
      if (this.symbols!.knownBitmaps.has(baseType)) {
        this.context.typeRegistry.set(name, {
          baseType,
          bitWidth: 0,
          isArray: false,
          isConst,
          isBitmap: true,
          bitmapTypeName: baseType,
          overflowBehavior, // ADR-044
          isAtomic, // ADR-049
        });
        return; // Early return, we've handled this case
      }
    } else if (typeCtx.userType()) {
      // Track struct/class/enum/bitmap types for inferred struct initializers and type safety
      baseType = typeCtx.userType()!.getText();
      bitWidth = 0; // User types don't have fixed bit width

      // ADR-017: Check if this is an enum type
      if (this.symbols!.knownEnums.has(baseType)) {
        this.context.typeRegistry.set(name, {
          baseType,
          bitWidth: 0,
          isArray: false,
          isConst,
          isEnum: true,
          enumTypeName: baseType,
          overflowBehavior, // ADR-044
          isAtomic, // ADR-049
        });
        return; // Early return, we've handled this case
      }

      // ADR-034: Check if this is a bitmap type
      if (this.symbols!.knownBitmaps.has(baseType)) {
        this.context.typeRegistry.set(name, {
          baseType,
          bitWidth: 0,
          isArray: false,
          isConst,
          isBitmap: true,
          bitmapTypeName: baseType,
          overflowBehavior, // ADR-044
          isAtomic, // ADR-049
        });
        return; // Early return, we've handled this case
      }
    } else if (typeCtx.arrayType()) {
      isArray = true;
      const arrayTypeCtx = typeCtx.arrayType()!;
      if (arrayTypeCtx.primitiveType()) {
        baseType = arrayTypeCtx.primitiveType()!.getText();
        bitWidth = TYPE_WIDTH[baseType] || 0;
      }
      // Try to get array length from type
      const sizeExpr = arrayTypeCtx.expression();
      if (sizeExpr) {
        const sizeText = sizeExpr.getText();
        const size = parseInt(sizeText, 10);
        if (!isNaN(size)) {
          arrayDimensions.push(size);
        }
      }
    }

    // ADR-036: Check for array dimensions like: u8 buffer[16] or u8 matrix[4][8]
    // arrayDim is now an array of ArrayDimensionContext
    // Bug #8: Use tryEvaluateConstant to resolve const identifiers in array sizes
    if (arrayDim && arrayDim.length > 0) {
      isArray = true;
      for (const dim of arrayDim) {
        const sizeExpr = dim.expression();
        if (sizeExpr) {
          const size = this.tryEvaluateConstant(sizeExpr);
          if (size !== undefined && size > 0) {
            arrayDimensions.push(size);
          }
        }
      }
    }

    if (baseType) {
      this.context.typeRegistry.set(name, {
        baseType,
        bitWidth,
        isArray,
        arrayDimensions:
          arrayDimensions.length > 0 ? arrayDimensions : undefined,
        isConst, // ADR-013: Store const status
        overflowBehavior, // ADR-044: Store overflow behavior
        isAtomic, // ADR-049: Store atomic status
      });
    }
  }

  /**
   * Track variable type with a specific name (for namespace/class members)
   * This allows tracking with mangled names for proper scope resolution
   */
  private trackVariableTypeWithName(
    varDecl: Parser.VariableDeclarationContext,
    registryName: string,
  ): void {
    const typeCtx = varDecl.type();
    const arrayDim = varDecl.arrayDimension();
    const isConst = varDecl.constModifier() !== null;

    // ADR-044: Extract overflow modifier (clamp is default)
    const overflowMod = varDecl.overflowModifier();
    const overflowBehavior: TOverflowBehavior =
      overflowMod?.getText() === "wrap" ? "wrap" : "clamp";

    // ADR-049: Extract atomic modifier
    const isAtomic = varDecl.atomicModifier() !== null;

    let baseType = "";
    let bitWidth = 0;
    let isArray = false;
    const arrayDimensions: number[] = []; // ADR-036: Track all dimensions

    if (typeCtx.primitiveType()) {
      baseType = typeCtx.primitiveType()!.getText();
      bitWidth = TYPE_WIDTH[baseType] || 0;
    } else if (typeCtx.scopedType()) {
      // ADR-016: Handle this.Type for scoped types (e.g., this.State -> Motor_State)
      const typeName = typeCtx.scopedType()!.IDENTIFIER().getText();
      if (this.context.currentScope) {
        baseType = `${this.context.currentScope}_${typeName}`;
      } else {
        baseType = typeName;
      }
      bitWidth = 0;

      // ADR-017: Check if this is an enum type
      if (this.symbols!.knownEnums.has(baseType)) {
        this.context.typeRegistry.set(registryName, {
          baseType,
          bitWidth: 0,
          isArray: false,
          isConst,
          isEnum: true,
          enumTypeName: baseType,
          overflowBehavior, // ADR-044
          isAtomic, // ADR-049
        });
        return; // Early return, we've handled this case
      }
    } else if (typeCtx.qualifiedType()) {
      // ADR-016: Handle Scope.Type from outside scope (e.g., Motor.State -> Motor_State)
      const identifiers = typeCtx.qualifiedType()!.IDENTIFIER();
      const scopeName = identifiers[0].getText();
      const typeName = identifiers[1].getText();
      baseType = `${scopeName}_${typeName}`;
      bitWidth = 0;

      // ADR-017: Check if this is an enum type
      if (this.symbols!.knownEnums.has(baseType)) {
        this.context.typeRegistry.set(registryName, {
          baseType,
          bitWidth: 0,
          isArray: false,
          isConst,
          isEnum: true,
          enumTypeName: baseType,
          overflowBehavior, // ADR-044
          isAtomic, // ADR-049
        });
        return; // Early return, we've handled this case
      }
    } else if (typeCtx.userType()) {
      baseType = typeCtx.userType()!.getText();
      bitWidth = 0;

      // ADR-017: Check if this is an enum type
      if (this.symbols!.knownEnums.has(baseType)) {
        this.context.typeRegistry.set(registryName, {
          baseType,
          bitWidth: 0,
          isArray: false,
          isConst,
          isEnum: true,
          enumTypeName: baseType,
          overflowBehavior, // ADR-044
          isAtomic, // ADR-049
        });
        return; // Early return, we've handled this case
      }
    } else if (typeCtx.stringType()) {
      // ADR-045: Handle bounded string type
      const stringCtx = typeCtx.stringType()!;
      const intLiteral = stringCtx.INTEGER_LITERAL();

      if (intLiteral) {
        const capacity = parseInt(intLiteral.getText(), 10);
        this.needsString = true;
        const stringDim = capacity + 1;

        // Check if there are additional array dimensions (e.g., [4] in string<64> arr[4])
        if (arrayDim && arrayDim.length > 0) {
          const stringArrayDims: number[] = [];
          for (const dim of arrayDim) {
            const sizeExpr = dim.expression();
            if (sizeExpr) {
              const size = parseInt(sizeExpr.getText(), 10);
              if (!isNaN(size) && size > 0) {
                stringArrayDims.push(size);
              }
            }
          }
          stringArrayDims.push(stringDim);

          this.context.typeRegistry.set(registryName, {
            baseType: "char",
            bitWidth: 8,
            isArray: true,
            arrayDimensions: stringArrayDims,
            isConst,
            isString: true,
            stringCapacity: capacity,
            overflowBehavior,
            isAtomic,
          });
        } else {
          // Single string: string<64> s
          this.context.typeRegistry.set(registryName, {
            baseType: "char",
            bitWidth: 8,
            isArray: true,
            arrayDimensions: [stringDim],
            isConst,
            isString: true,
            stringCapacity: capacity,
            overflowBehavior,
            isAtomic,
          });
        }
        return; // Early return, we've handled this case
      }
    } else if (typeCtx.arrayType()) {
      isArray = true;
      const arrayTypeCtx = typeCtx.arrayType()!;
      if (arrayTypeCtx.primitiveType()) {
        baseType = arrayTypeCtx.primitiveType()!.getText();
        bitWidth = TYPE_WIDTH[baseType] || 0;
      }
      const sizeExpr = arrayTypeCtx.expression();
      if (sizeExpr) {
        const sizeText = sizeExpr.getText();
        const size = parseInt(sizeText, 10);
        if (!isNaN(size)) {
          arrayDimensions.push(size);
        }
      }
    }

    // ADR-036: Check for array dimensions like: u8 buffer[16] or u8 matrix[4][8]
    // arrayDim is now an array of ArrayDimensionContext
    // Bug #8: Use tryEvaluateConstant to resolve const identifiers in array sizes
    if (arrayDim && arrayDim.length > 0) {
      isArray = true;
      for (const dim of arrayDim) {
        const sizeExpr = dim.expression();
        if (sizeExpr) {
          const size = this.tryEvaluateConstant(sizeExpr);
          if (size !== undefined && size > 0) {
            arrayDimensions.push(size);
          }
        }
      }
    }

    if (baseType) {
      this.context.typeRegistry.set(registryName, {
        baseType,
        bitWidth,
        isArray,
        arrayDimensions:
          arrayDimensions.length > 0 ? arrayDimensions : undefined,
        isConst,
        overflowBehavior, // ADR-044: Store overflow behavior
        isAtomic, // ADR-049: Store atomic status
      });
    }
  }

  /**
   * Check if a type name is a user-defined struct
   */
  private isStructType(typeName: string): boolean {
    return this.typeResolver!.isStructType(typeName);
  }

  /**
   * Set up parameter tracking for a function
   */
  private setParameters(params: Parser.ParameterListContext | null): void {
    this.context.currentParameters.clear();

    if (!params) return;

    for (const param of params.parameter()) {
      const name = param.IDENTIFIER().getText();
      // arrayDimension() returns an array (due to grammar's *), so check length
      const isArray = param.arrayDimension().length > 0;
      const isConst = param.constModifier() !== null; // ADR-013: Track const modifier
      const typeCtx = param.type();

      // Determine if it's a struct type, callback type, or string type
      let isStruct = false;
      let isCallback = false;
      let isString = false;
      let typeName = typeCtx.getText();
      if (typeCtx.primitiveType()) {
        // Primitive type (u8, i32, etc.)
        typeName = typeCtx.primitiveType()!.getText();
      } else if (typeCtx.userType()) {
        typeName = typeCtx.userType()!.getText();
        isStruct = this.isStructType(typeName);
        // ADR-029: Check if this is a callback type
        isCallback = this.callbackTypes.has(typeName);
      } else if (typeCtx.qualifiedType()) {
        // ADR-016: Handle qualified enum types like Scope.EnumType
        typeName = typeCtx
          .qualifiedType()!
          .IDENTIFIER()
          .map((id) => id.getText())
          .join("_");
      } else if (typeCtx.stringType()) {
        // ADR-045: String parameter
        isString = true;
        typeName = "string";
      }

      this.context.currentParameters.set(name, {
        name,
        baseType: typeName,
        isArray,
        isStruct,
        isConst,
        isCallback,
        isString,
      });

      // ADR-025: Register parameter type for switch exhaustiveness checking
      const isEnum = this.symbols!.knownEnums.has(typeName);
      const isBitmap = this.symbols!.knownBitmaps.has(typeName);

      // Extract array dimensions if this is an array parameter
      const arrayDimensions: number[] = [];
      if (isArray) {
        const arrayDims = param.arrayDimension();
        for (const dim of arrayDims) {
          const sizeExpr = dim.expression();
          if (sizeExpr) {
            const sizeText = sizeExpr.getText();
            const size = parseInt(sizeText, 10);
            if (!isNaN(size)) {
              arrayDimensions.push(size);
            }
          }
        }
      }

      // ADR-045: Get string capacity if this is a string parameter
      let stringCapacity: number | undefined;
      if (isString && typeCtx.stringType()) {
        const intLiteral = typeCtx.stringType()!.INTEGER_LITERAL();
        if (intLiteral) {
          stringCapacity = parseInt(intLiteral.getText(), 10);
          // For string arrays, add capacity+1 as second dimension for proper .length handling
          if (isArray && stringCapacity !== undefined) {
            arrayDimensions.push(stringCapacity + 1);
          }
        }
      }

      this.context.typeRegistry.set(name, {
        baseType: typeName,
        bitWidth: isBitmap
          ? BITMAP_SIZE[typeName] || 0
          : TYPE_WIDTH[typeName] || 0,
        isArray: isArray,
        arrayDimensions:
          arrayDimensions.length > 0 ? arrayDimensions : undefined,
        isConst: isConst,
        isEnum: isEnum,
        enumTypeName: isEnum ? typeName : undefined,
        isBitmap: isBitmap,
        bitmapTypeName: isBitmap ? typeName : undefined,
        isString: isString,
        stringCapacity: stringCapacity,
      });
    }
  }

  /**
   * Clear parameter tracking when leaving a function
   */
  private clearParameters(): void {
    // ADR-025: Remove parameter types from typeRegistry
    for (const name of this.context.currentParameters.keys()) {
      this.context.typeRegistry.delete(name);
    }
    this.context.currentParameters.clear();
    this.context.localArrays.clear();
  }

  /**
   * ADR-013: Extract function signature from parameter list
   */
  private extractFunctionSignature(
    name: string,
    params: Parser.ParameterListContext | null,
  ): FunctionSignature {
    const parameters: Array<{
      name: string;
      baseType: string;
      isConst: boolean;
      isArray: boolean;
    }> = [];

    if (params) {
      for (const param of params.parameter()) {
        const paramName = param.IDENTIFIER().getText();
        const isConst = param.constModifier() !== null;
        // arrayDimension() returns an array (due to grammar's *), so check length
        const isArray = param.arrayDimension().length > 0;
        const baseType = this.getTypeName(param.type());
        parameters.push({ name: paramName, baseType, isConst, isArray });
      }
    }

    return { name, parameters };
  }

  /**
   * ADR-029: Register a function as a callback type
   * The function name becomes both a callable function and a type for callback fields
   */
  private registerCallbackType(
    name: string,
    funcDecl: Parser.FunctionDeclarationContext,
  ): void {
    const returnType = this.generateType(funcDecl.type());
    const parameters: Array<{
      name: string;
      type: string;
      isConst: boolean;
      isPointer: boolean;
      isArray: boolean;
      arrayDims: string;
    }> = [];

    if (funcDecl.parameterList()) {
      for (const param of funcDecl.parameterList()!.parameter()) {
        const paramName = param.IDENTIFIER().getText();
        const typeName = this.getTypeName(param.type());
        const isConst = param.constModifier() !== null;
        const dims = param.arrayDimension();
        const isArray = dims.length > 0;

        // ADR-029: Check if parameter type is itself a callback type
        const isCallbackParam = this.callbackTypes.has(typeName);

        let paramType: string;
        let isPointer: boolean;

        if (isCallbackParam) {
          // Use the callback typedef name
          const cbInfo = this.callbackTypes.get(typeName)!;
          paramType = cbInfo.typedefName;
          isPointer = false; // Function pointers are already pointers
        } else {
          paramType = this.generateType(param.type());
          // ADR-006: Non-array parameters become pointers
          isPointer = !isArray;
        }

        const arrayDims = isArray
          ? dims.map((d) => this.generateArrayDimension(d)).join("")
          : "";
        parameters.push({
          name: paramName,
          type: paramType,
          isConst,
          isPointer,
          isArray,
          arrayDims,
        });
      }
    }

    this.callbackTypes.set(name, {
      functionName: name,
      returnType,
      parameters,
      typedefName: `${name}_fp`,
    });
  }

  /**
   * ADR-029: Check if a function is used as a callback type (field type in a struct)
   */
  private isCallbackTypeUsedAsFieldType(funcName: string): boolean {
    // A function is a "callback type definer" if it's used as a field type somewhere
    for (const callbackType of this.callbackFieldTypes.values()) {
      if (callbackType === funcName) {
        return true;
      }
    }
    return false;
  }

  // Issue #63: validateCallbackAssignment, callbackSignaturesMatch, isConstValue,
  //            and validateBareIdentifierInScope moved to TypeValidator

  /**
   * ADR-017: Extract enum type from an expression.
   * Returns the enum type name if the expression is an enum value, null otherwise.
   *
   * Handles:
   * - Variable of enum type: `currentState` -> 'State'
   * - Enum member access: `State.IDLE` -> 'State'
   * - Scoped enum member: `Motor.State.IDLE` -> 'Motor_State'
   * - ADR-016: this.State.IDLE -> 'CurrentScope_State'
   * - ADR-016: this.variable -> enum type if variable is of enum type
   */
  private getExpressionEnumType(
    ctx: Parser.ExpressionContext | Parser.RelationalExpressionContext,
  ): string | null {
    // Get the text representation to analyze
    const text = ctx.getText();

    // Check if it's a simple identifier that's an enum variable
    if (text.match(/^[a-zA-Z_][a-zA-Z0-9_]*$/)) {
      const typeInfo = this.context.typeRegistry.get(text);
      if (typeInfo?.isEnum && typeInfo.enumTypeName) {
        return typeInfo.enumTypeName;
      }
    }

    // Check if it's an enum member access: EnumType.MEMBER or Scope.EnumType.MEMBER
    const parts = text.split(".");

    if (parts.length >= 2) {
      // ADR-016: Check this.State.IDLE pattern (this.Enum.Member inside scope)
      if (
        parts[0] === "this" &&
        this.context.currentScope &&
        parts.length >= 3
      ) {
        const enumName = parts[1];
        const scopedEnumName = `${this.context.currentScope}_${enumName}`;
        if (this.symbols!.knownEnums.has(scopedEnumName)) {
          return scopedEnumName;
        }
      }

      // ADR-016: Check this.variable pattern (this.varName where varName is enum type)
      if (
        parts[0] === "this" &&
        this.context.currentScope &&
        parts.length === 2
      ) {
        const varName = parts[1];
        const scopedVarName = `${this.context.currentScope}_${varName}`;
        const typeInfo = this.context.typeRegistry.get(scopedVarName);
        if (typeInfo?.isEnum && typeInfo.enumTypeName) {
          return typeInfo.enumTypeName;
        }
      }

      // Check simple enum: State.IDLE
      const possibleEnum = parts[0];
      if (this.symbols!.knownEnums.has(possibleEnum)) {
        return possibleEnum;
      }

      // Check scoped enum: Motor.State.IDLE -> Motor_State
      if (parts.length >= 3) {
        const scopeName = parts[0];
        const enumName = parts[1];
        const scopedEnumName = `${scopeName}_${enumName}`;
        if (this.symbols!.knownEnums.has(scopedEnumName)) {
          return scopedEnumName;
        }
      }
    }

    return null;
  }

  /**
   * ADR-017: Check if an expression represents an integer literal or numeric type.
   * Used to detect comparisons between enums and integers.
   */
  private isIntegerExpression(
    ctx: Parser.ExpressionContext | Parser.RelationalExpressionContext,
  ): boolean {
    const text = ctx.getText();

    // Check for integer literals
    if (
      text.match(/^-?\d+$/) ||
      text.match(/^0[xX][0-9a-fA-F]+$/) ||
      text.match(/^0[bB][01]+$/)
    ) {
      return true;
    }

    // Check if it's a variable of primitive integer type
    if (text.match(/^[a-zA-Z_][a-zA-Z0-9_]*$/)) {
      const typeInfo = this.context.typeRegistry.get(text);
      if (
        typeInfo &&
        !typeInfo.isEnum &&
        ["u8", "u16", "u32", "u64", "i8", "i16", "i32", "i64"].includes(
          typeInfo.baseType,
        )
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * ADR-045: Check if an expression represents a string type.
   * Used to detect string comparisons and generate strcmp().
   * Issue #137: Extended to handle array element access (e.g., names[0])
   */
  private isStringExpression(ctx: Parser.RelationalExpressionContext): boolean {
    const text = ctx.getText();

    // Check for string literals
    if (text.startsWith('"') && text.endsWith('"')) {
      return true;
    }

    // Check if it's a simple variable of string type
    if (text.match(/^[a-zA-Z_][a-zA-Z0-9_]*$/)) {
      const typeInfo = this.context.typeRegistry.get(text);
      if (typeInfo?.isString) {
        return true;
      }
    }

    // Issue #137: Check for array element access (e.g., names[0], arr[i])
    // Pattern: identifier[expression] or identifier[expression][expression]...
    // BUT NOT if accessing .length/.capacity/.size (those return numbers, not strings)
    const arrayAccessMatch = text.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\[/);
    if (arrayAccessMatch) {
      // ADR-045: String properties return numeric values, not strings
      if (
        text.endsWith(".length") ||
        text.endsWith(".capacity") ||
        text.endsWith(".size")
      ) {
        return false;
      }
      const arrayName = arrayAccessMatch[1];
      const typeInfo = this.context.typeRegistry.get(arrayName);
      // Check if base type is a string type
      if (typeInfo?.isString || typeInfo?.baseType?.startsWith("string<")) {
        return true;
      }
    }

    return false;
  }

  /**
   * ADR-045: Check if an expression is a string concatenation (contains + with string operands).
   * Returns the operand expressions if it is, null otherwise.
   */
  private getStringConcatOperands(ctx: Parser.ExpressionContext): {
    left: string;
    right: string;
    leftCapacity: number;
    rightCapacity: number;
  } | null {
    // Navigate to the additive expression level
    const ternary = ctx.ternaryExpression();
    if (!ternary) return null;

    const orExprs = ternary.orExpression();
    if (orExprs.length !== 1) return null;

    const or = orExprs[0];
    if (or.andExpression().length !== 1) return null;

    const and = or.andExpression()[0];
    if (and.equalityExpression().length !== 1) return null;

    const eq = and.equalityExpression()[0];
    if (eq.relationalExpression().length !== 1) return null;

    const rel = eq.relationalExpression()[0];
    if (rel.bitwiseOrExpression().length !== 1) return null;

    const bor = rel.bitwiseOrExpression()[0];
    if (bor.bitwiseXorExpression().length !== 1) return null;

    const bxor = bor.bitwiseXorExpression()[0];
    if (bxor.bitwiseAndExpression().length !== 1) return null;

    const band = bxor.bitwiseAndExpression()[0];
    if (band.shiftExpression().length !== 1) return null;

    const shift = band.shiftExpression()[0];
    if (shift.additiveExpression().length !== 1) return null;

    const add = shift.additiveExpression()[0];
    const multExprs = add.multiplicativeExpression();

    // Need exactly 2 operands for simple concatenation
    if (multExprs.length !== 2) return null;

    // Check if this is addition (not subtraction)
    const text = add.getText();
    if (text.includes("-")) return null;

    // Get the operand texts
    const leftText = multExprs[0].getText();
    const rightText = multExprs[1].getText();

    // Check if at least one operand is a string
    const leftCapacity = this.getStringExprCapacity(leftText);
    const rightCapacity = this.getStringExprCapacity(rightText);

    if (leftCapacity === null && rightCapacity === null) {
      return null; // Neither is a string
    }

    // If one is null, it's not a valid string concatenation
    if (leftCapacity === null || rightCapacity === null) {
      return null;
    }

    return {
      left: leftText,
      right: rightText,
      leftCapacity,
      rightCapacity,
    };
  }

  /**
   * ADR-045: Get the capacity of a string expression.
   * For string literals, capacity is the literal length.
   * For string variables, capacity is from the type registry.
   */
  private getStringExprCapacity(expr: string): number | null {
    // String literal - capacity equals content length
    if (expr.startsWith('"') && expr.endsWith('"')) {
      return this.getStringLiteralLength(expr);
    }

    // Variable - check type registry
    if (expr.match(/^[a-zA-Z_][a-zA-Z0-9_]*$/)) {
      const typeInfo = this.context.typeRegistry.get(expr);
      if (typeInfo?.isString && typeInfo.stringCapacity !== undefined) {
        return typeInfo.stringCapacity;
      }
    }

    return null;
  }

  /**
   * ADR-045: Check if an expression is a substring extraction (string[start, length]).
   * Returns the source string, start, length, and source capacity if it is.
   */
  private getSubstringOperands(ctx: Parser.ExpressionContext): {
    source: string;
    start: string;
    length: string;
    sourceCapacity: number;
  } | null {
    // Navigate to the postfix expression level
    const ternary = ctx.ternaryExpression();
    if (!ternary) return null;

    const orExprs = ternary.orExpression();
    if (orExprs.length !== 1) return null;

    const or = orExprs[0];
    if (or.andExpression().length !== 1) return null;

    const and = or.andExpression()[0];
    if (and.equalityExpression().length !== 1) return null;

    const eq = and.equalityExpression()[0];
    if (eq.relationalExpression().length !== 1) return null;

    const rel = eq.relationalExpression()[0];
    if (rel.bitwiseOrExpression().length !== 1) return null;

    const bor = rel.bitwiseOrExpression()[0];
    if (bor.bitwiseXorExpression().length !== 1) return null;

    const bxor = bor.bitwiseXorExpression()[0];
    if (bxor.bitwiseAndExpression().length !== 1) return null;

    const band = bxor.bitwiseAndExpression()[0];
    if (band.shiftExpression().length !== 1) return null;

    const shift = band.shiftExpression()[0];
    if (shift.additiveExpression().length !== 1) return null;

    const add = shift.additiveExpression()[0];
    if (add.multiplicativeExpression().length !== 1) return null;

    const mult = add.multiplicativeExpression()[0];
    if (mult.unaryExpression().length !== 1) return null;

    const unary = mult.unaryExpression()[0];
    const postfix = unary.postfixExpression();
    if (!postfix) return null;

    const primary = postfix.primaryExpression();
    const ops = postfix.postfixOp();

    // Need exactly one postfix operation (the [start, length])
    if (ops.length !== 1) return null;

    const op = ops[0];
    const exprs = op.expression();

    // Get the source variable name first
    const sourceId = primary.IDENTIFIER();
    if (!sourceId) return null;

    const sourceName = sourceId.getText();

    // Check if source is a string type
    const typeInfo = this.context.typeRegistry.get(sourceName);
    if (!typeInfo?.isString || typeInfo.stringCapacity === undefined) {
      return null;
    }

    // Issue #140: Handle both [start, length] pattern (2 expressions)
    // and single-character access [index] pattern (1 expression, treated as [index, 1])
    if (exprs.length === 2) {
      return {
        source: sourceName,
        start: this.generateExpression(exprs[0]),
        length: this.generateExpression(exprs[1]),
        sourceCapacity: typeInfo.stringCapacity,
      };
    } else if (exprs.length === 1) {
      // Single-character access: source[i] is sugar for source[i, 1]
      return {
        source: sourceName,
        start: this.generateExpression(exprs[0]),
        length: "1",
        sourceCapacity: typeInfo.stringCapacity,
      };
    }

    return null;
  }

  // ========================================================================
  // ADR-024: Type Classification and Validation Helpers
  // ========================================================================

  /**
   * ADR-024: Check if a type is an unsigned integer
   */
  private isUnsignedType(typeName: string): boolean {
    return this.typeResolver!.isUnsignedType(typeName);
  }

  /**
   * ADR-024: Check if a type is a signed integer
   */
  private isSignedType(typeName: string): boolean {
    return this.typeResolver!.isSignedType(typeName);
  }

  /**
   * ADR-024: Check if a type is any integer (signed or unsigned)
   */
  private isIntegerType(typeName: string): boolean {
    return this.typeResolver!.isIntegerType(typeName);
  }

  /**
   * ADR-024: Check if a type is a floating point type
   */
  private isFloatType(typeName: string): boolean {
    return this.typeResolver!.isFloatType(typeName);
  }

  /**
   * Get type info for a struct member field
   * Used to track types through member access chains like buf.data[0]
   */
  private getMemberTypeInfo(
    structType: string,
    memberName: string,
  ): { isArray: boolean; baseType: string } | undefined {
    return this.typeResolver!.getMemberTypeInfo(structType, memberName);
  }

  /**
   * ADR-024: Check if conversion from sourceType to targetType is narrowing
   * Narrowing occurs when target type has fewer bits than source type
   */
  private isNarrowingConversion(
    sourceType: string,
    targetType: string,
  ): boolean {
    return this.typeResolver!.isNarrowingConversion(sourceType, targetType);
  }

  /**
   * ADR-024: Check if conversion involves a sign change
   * Sign change occurs when converting between signed and unsigned types
   */
  private isSignConversion(sourceType: string, targetType: string): boolean {
    return this.typeResolver!.isSignConversion(sourceType, targetType);
  }

  /**
   * ADR-024: Validate that a literal value fits within the target type's range.
   * Throws an error if the value doesn't fit.
   * @param literalText The literal text (e.g., "256", "-1", "0xFF")
   * @param targetType The target type (e.g., "u8", "i32")
   */
  private validateLiteralFitsType(
    literalText: string,
    targetType: string,
  ): void {
    this.typeResolver!.validateLiteralFitsType(literalText, targetType);
  }

  /**
   * ADR-024: Get the type of an expression for type checking.
   * Returns the inferred type or null if type cannot be determined.
   */
  private getExpressionType(ctx: Parser.ExpressionContext): string | null {
    return this.typeResolver!.getExpressionType(ctx);
  }

  /**
   * ADR-024: Get the type of a postfix expression.
   */
  private getPostfixExpressionType(
    ctx: Parser.PostfixExpressionContext,
  ): string | null {
    return this.typeResolver!.getPostfixExpressionType(ctx);
  }

  /**
   * ADR-024: Get the type of a primary expression.
   */
  private getPrimaryExpressionType(
    ctx: Parser.PrimaryExpressionContext,
  ): string | null {
    return this.typeResolver!.getPrimaryExpressionType(ctx);
  }

  /**
   * ADR-024: Get the type of a unary expression (for cast validation).
   */
  private getUnaryExpressionType(
    ctx: Parser.UnaryExpressionContext,
  ): string | null {
    return this.typeResolver!.getUnaryExpressionType(ctx);
  }

  /**
   * ADR-024: Get the type from a literal (suffixed or unsuffixed).
   * Returns the explicit suffix type, or null for unsuffixed literals.
   */
  private getLiteralType(ctx: Parser.LiteralContext): string | null {
    return this.typeResolver!.getLiteralType(ctx);
  }

  /**
   * ADR-024: Validate that a type conversion is allowed.
   * Throws error for narrowing or sign-changing conversions.
   */
  private validateTypeConversion(
    targetType: string,
    sourceType: string | null,
  ): void {
    this.typeResolver!.validateTypeConversion(targetType, sourceType);
  }

  /**
   * Resolve an identifier to its scoped name.
   * Inside a scope, checks if the identifier is a scope member first.
   * Otherwise returns the identifier unchanged (global scope).
   * ADR-016: Renamed from namespace-based resolution
   */
  private resolveIdentifier(identifier: string): string {
    // Check current scope first (inner scope shadows outer)
    if (this.context.currentScope) {
      const members = this.context.scopeMembers.get(this.context.currentScope);
      if (members && members.has(identifier)) {
        return `${this.context.currentScope}_${identifier}`;
      }
    }

    // Fall back to global scope
    return identifier;
  }

  // Issue #63: checkConstAssignment moved to TypeValidator

  /**
   * Navigate through expression layers to get to the postfix expression.
   * Returns null if the expression has multiple terms at any level.
   */
  private getPostfixExpression(
    ctx: Parser.ExpressionContext,
  ): Parser.PostfixExpressionContext | null {
    const ternary = ctx.ternaryExpression();
    const orExprs = ternary.orExpression();
    // If it's a ternary (3 orExpressions), we can't get a single postfix
    if (orExprs.length !== 1) return null;

    const or = orExprs[0];
    if (or.andExpression().length !== 1) return null;

    const and = or.andExpression()[0];
    if (and.equalityExpression().length !== 1) return null;

    const eq = and.equalityExpression()[0];
    if (eq.relationalExpression().length !== 1) return null;

    const rel = eq.relationalExpression()[0];
    if (rel.bitwiseOrExpression().length !== 1) return null;

    const bor = rel.bitwiseOrExpression()[0];
    if (bor.bitwiseXorExpression().length !== 1) return null;

    const bxor = bor.bitwiseXorExpression()[0];
    if (bxor.bitwiseAndExpression().length !== 1) return null;

    const band = bxor.bitwiseAndExpression()[0];
    if (band.shiftExpression().length !== 1) return null;

    const shift = band.shiftExpression()[0];
    if (shift.additiveExpression().length !== 1) return null;

    const add = shift.additiveExpression()[0];
    if (add.multiplicativeExpression().length !== 1) return null;

    const mult = add.multiplicativeExpression()[0];
    if (mult.unaryExpression().length !== 1) return null;

    const unary = mult.unaryExpression()[0];
    if (!unary.postfixExpression()) return null;

    return unary.postfixExpression()!;
  }

  /**
   * Extract a simple identifier from an expression, if it is one.
   * Returns null for complex expressions.
   */
  private getSimpleIdentifier(ctx: Parser.ExpressionContext): string | null {
    const postfix = this.getPostfixExpression(ctx);
    if (!postfix) return null;

    if (postfix.postfixOp().length !== 0) return null; // Has operators like . or []

    const primary = postfix.primaryExpression();
    if (!primary.IDENTIFIER()) return null;

    return primary.IDENTIFIER()!.getText();
  }

  /**
   * ADR-045: Get the actual character length of a string literal,
   * accounting for escape sequences like \n, \t, \\, etc.
   */
  private getStringLiteralLength(literal: string): number {
    // Remove surrounding quotes
    const content = literal.slice(1, -1);

    let length = 0;
    let i = 0;
    while (i < content.length) {
      if (content[i] === "\\" && i + 1 < content.length) {
        // Escape sequence counts as 1 character
        i += 2;
      } else {
        i += 1;
      }
      length += 1;
    }
    return length;
  }

  /**
   * Check if an expression is an lvalue that needs & when passed to functions.
   * This includes member access (cursor.x) and array access (arr[i]).
   * Returns the type of lvalue or null if not an lvalue.
   */
  private getLvalueType(
    ctx: Parser.ExpressionContext,
  ): "member" | "array" | null {
    const postfix = this.getPostfixExpression(ctx);
    if (!postfix) return null;

    const ops = postfix.postfixOp();
    if (ops.length === 0) return null;

    // Check the last operator to determine lvalue type
    const lastOp = ops[ops.length - 1];

    // Member access: .identifier
    if (lastOp.IDENTIFIER()) {
      return "member";
    }

    // Array access: [expression]
    if (lastOp.expression()) {
      return "array";
    }

    return null;
  }

  /**
   * Check if an expression is a simple literal (number, bool, etc.)
   * Navigates: expression -> ternaryExpression -> orExpression -> ... -> primaryExpression -> literal
   */
  private isLiteralExpression(ctx: Parser.ExpressionContext): boolean {
    try {
      // expression -> ternaryExpression
      const ternaryExpr = ctx.ternaryExpression();
      if (!ternaryExpr) return false;

      // Check it's not a ternary (no COLON token)
      if (ternaryExpr.COLON()) return false;

      // ternaryExpression -> orExpression (single)
      const orExprs = ternaryExpr.orExpression();
      if (orExprs.length !== 1) return false;
      const orExpr = orExprs[0];

      // orExpression -> andExpression (single, no || operators)
      const andExprs = orExpr.andExpression();
      if (andExprs.length !== 1) return false;
      const andExpr = andExprs[0];

      // andExpression -> equalityExpression (single, no && operators)
      const eqExprs = andExpr.equalityExpression();
      if (eqExprs.length !== 1) return false;
      const eqExpr = eqExprs[0];

      // equalityExpression -> relationalExpression (single, no = or != operators)
      const relExprs = eqExpr.relationalExpression();
      if (relExprs.length !== 1) return false;
      const relExpr = relExprs[0];

      // relationalExpression -> bitwiseOrExpression (single, no comparison operators)
      const bitOrExprs = relExpr.bitwiseOrExpression();
      if (bitOrExprs.length !== 1) return false;
      const bitOrExpr = bitOrExprs[0];

      // bitwiseOrExpression -> bitwiseXorExpression (single)
      const xorExprs = bitOrExpr.bitwiseXorExpression();
      if (xorExprs.length !== 1) return false;
      const xorExpr = xorExprs[0];

      // bitwiseXorExpression -> bitwiseAndExpression (single)
      const bitAndExprs = xorExpr.bitwiseAndExpression();
      if (bitAndExprs.length !== 1) return false;
      const bitAndExpr = bitAndExprs[0];

      // bitwiseAndExpression -> shiftExpression (single)
      const shiftExprs = bitAndExpr.shiftExpression();
      if (shiftExprs.length !== 1) return false;
      const shiftExpr = shiftExprs[0];

      // shiftExpression -> additiveExpression (single)
      const addExprs = shiftExpr.additiveExpression();
      if (addExprs.length !== 1) return false;
      const addExpr = addExprs[0];

      // additiveExpression -> multiplicativeExpression (single)
      const mulExprs = addExpr.multiplicativeExpression();
      if (mulExprs.length !== 1) return false;
      const mulExpr = mulExprs[0];

      // multiplicativeExpression -> unaryExpression (single)
      const unaryExprs = mulExpr.unaryExpression();
      if (unaryExprs.length !== 1) return false;
      const unaryExpr = unaryExprs[0];

      // unaryExpression -> postfixExpression (no unary operators)
      // OR unaryExpression -> '-' unaryExpression (negated literal)
      const postfixExpr = unaryExpr.postfixExpression();

      // Handle negated literals: -50, -3.14, etc.
      if (!postfixExpr) {
        // Check if it's a unary minus with a nested literal
        const nestedUnary = unaryExpr.unaryExpression();
        if (nestedUnary && unaryExpr.getText().startsWith("-")) {
          // Recursively check if the nested expression is a literal
          const nestedPostfix = nestedUnary.postfixExpression();
          if (nestedPostfix) {
            const nestedPrimary = nestedPostfix.primaryExpression();
            if (nestedPrimary) {
              const nestedLiteral = nestedPrimary.literal();
              if (nestedLiteral && !nestedLiteral.STRING_LITERAL()) {
                return true; // Negated numeric literal
              }
            }
          }
        }
        return false;
      }

      // postfixExpression -> primaryExpression (no postfix ops)
      const postfixOps = postfixExpr.postfixOp();
      if (postfixOps.length > 0) return false;

      const primaryExpr = postfixExpr.primaryExpression();
      if (!primaryExpr) return false;

      // Check if it's a literal (but not a string literal)
      const literal = primaryExpr.literal();
      if (literal && !literal.STRING_LITERAL()) {
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Generate a function argument with proper ADR-006 semantics.
   * - Local variables get & (address-of)
   * - Member access (cursor.x) gets & (address-of)
   * - Array access (arr[i]) gets & (address-of)
   * - Parameters are passed as-is (already pointers)
   * - Arrays are passed as-is (naturally decay to pointers)
   * - Literals use compound literals for pointer params: &(type){value}
   * - Complex expressions are passed as-is
   *
   * @param ctx The expression context
   * @param targetParamBaseType Optional: the C-Next type of the target parameter (e.g., 'u32')
   */
  private generateFunctionArg(
    ctx: Parser.ExpressionContext,
    targetParamBaseType?: string,
  ): string {
    const id = this.getSimpleIdentifier(ctx);

    if (id) {
      // Check if it's a parameter (already a pointer for non-floats)
      const paramInfo = this.context.currentParameters.get(id);
      if (paramInfo) {
        // Arrays are passed as-is, non-arrays are already pointers
        return id;
      }

      // Check if it's a local array (passed as-is, naturally decays to pointer)
      if (this.context.localArrays.has(id)) {
        return id;
      }

      // Check if it's a scope member (ADR-016)
      if (this.context.currentScope) {
        const members = this.context.scopeMembers.get(
          this.context.currentScope,
        );
        if (members && members.has(id)) {
          return `&${this.context.currentScope}_${id}`;
        }
      }

      // Local variable - add &
      return `&${id}`;
    }

    // Check if it's a member access or array access (lvalue) - needs &
    const lvalueType = this.getLvalueType(ctx);
    if (lvalueType) {
      // Generate the expression and wrap with &
      return `&${this.generateExpression(ctx)}`;
    }

    // Check if it's a literal being passed to a pointer parameter
    // Use C99 compound literal syntax: &(type){value}
    if (targetParamBaseType && this.isLiteralExpression(ctx)) {
      const cType = TYPE_MAP[targetParamBaseType];
      if (cType && cType !== "void") {
        const value = this.generateExpression(ctx);
        return `&(${cType}){${value}}`;
      }
    }

    // Complex expression or literal (for non-pointer targets) - generate normally
    return this.generateExpression(ctx);
  }

  // ========================================================================
  // Declarations
  // ========================================================================

  private generateDeclaration(ctx: Parser.DeclarationContext): string {
    // ADR-016: Handle scope declarations (renamed from namespace)
    if (ctx.scopeDeclaration()) {
      return this.generateScope(ctx.scopeDeclaration()!);
    }
    if (ctx.registerDeclaration()) {
      return this.generateRegister(ctx.registerDeclaration()!);
    }
    if (ctx.structDeclaration()) {
      return this.generateStruct(ctx.structDeclaration()!);
    }
    // ADR-017: Handle enum declarations
    if (ctx.enumDeclaration()) {
      return this.generateEnum(ctx.enumDeclaration()!);
    }
    // ADR-034: Handle bitmap declarations
    if (ctx.bitmapDeclaration()) {
      return this.generateBitmap(ctx.bitmapDeclaration()!);
    }
    if (ctx.functionDeclaration()) {
      return this.generateFunction(ctx.functionDeclaration()!);
    }
    if (ctx.variableDeclaration()) {
      return this.generateVariableDecl(ctx.variableDeclaration()!) + "\n";
    }
    return "";
  }

  // ========================================================================
  // Scope (ADR-016: Organization with visibility control)
  // ========================================================================

  private generateScope(ctx: Parser.ScopeDeclarationContext): string {
    const name = ctx.IDENTIFIER().getText();
    this.context.currentScope = name;

    const lines: string[] = [];
    lines.push(`/* Scope: ${name} */`);

    for (const member of ctx.scopeMember()) {
      const visibility = member.visibilityModifier()?.getText() || "public";
      const isPrivate = visibility === "private";

      if (member.variableDeclaration()) {
        const varDecl = member.variableDeclaration()!;
        const type = this.generateType(varDecl.type());
        const varName = varDecl.IDENTIFIER().getText();
        const fullName = `${name}_${varName}`;
        const prefix = isPrivate ? "static " : "";

        // Note: Type already registered in registerAllVariableTypes() pass

        // ADR-036: arrayDimension() now returns an array
        const arrayDims = varDecl.arrayDimension();
        const isArray = arrayDims.length > 0;
        let decl = `${prefix}${type} ${fullName}`;
        if (isArray) {
          decl += this.generateArrayDimensions(arrayDims);
        }
        // ADR-045: Add string capacity dimension for string arrays
        if (varDecl.type().stringType()) {
          const stringCtx = varDecl.type().stringType()!;
          const intLiteral = stringCtx.INTEGER_LITERAL();
          if (intLiteral) {
            const capacity = parseInt(intLiteral.getText(), 10);
            decl += `[${capacity + 1}]`;
          }
        }
        if (varDecl.expression()) {
          decl += ` = ${this.generateExpression(varDecl.expression()!)}`;
        } else {
          // ADR-015: Zero initialization for uninitialized scope variables
          decl += ` = ${this.getZeroInitializer(varDecl.type(), isArray)}`;
        }
        lines.push(decl + ";");
      }

      if (member.functionDeclaration()) {
        const funcDecl = member.functionDeclaration()!;
        const returnType = this.generateType(funcDecl.type());
        const funcName = funcDecl.IDENTIFIER().getText();
        const fullName = `${name}_${funcName}`;
        const prefix = isPrivate ? "static " : "";

        // Track parameters for ADR-006 pointer semantics
        this.setParameters(funcDecl.parameterList() ?? null);

        // ADR-016: Clear local variables and mark that we're in a function body
        this.context.localVariables.clear();
        this.context.inFunctionBody = true;

        const params = funcDecl.parameterList()
          ? this.generateParameterList(funcDecl.parameterList()!)
          : "void";

        const body = this.generateBlock(funcDecl.block());

        // ADR-016: Clear local variables and mark that we're no longer in a function body
        this.context.inFunctionBody = false;
        this.context.localVariables.clear();
        this.clearParameters();

        lines.push("");
        lines.push(`${prefix}${returnType} ${fullName}(${params}) ${body}`);

        // ADR-029: Generate callback typedef only if used as a type
        if (this.isCallbackTypeUsedAsFieldType(fullName)) {
          const typedef = this.generateCallbackTypedef(fullName);
          if (typedef) {
            lines.push(typedef);
          }
        }
      }

      // ADR-017: Handle enum declarations inside scopes
      // Issue #60: Symbol collection done by SymbolCollector
      if (member.enumDeclaration()) {
        const enumDecl = member.enumDeclaration()!;
        const enumCode = this.generateEnum(enumDecl);
        lines.push("");
        lines.push(enumCode);
      }

      // ADR-034: Handle bitmap declarations inside scopes
      // Issue #60: Symbol collection done by SymbolCollector
      if (member.bitmapDeclaration()) {
        const bitmapDecl = member.bitmapDeclaration()!;
        const bitmapCode = this.generateBitmap(bitmapDecl);
        lines.push("");
        lines.push(bitmapCode);
      }

      // Handle register declarations inside scopes
      if (member.registerDeclaration()) {
        const regDecl = member.registerDeclaration()!;
        const regCode = this.generateScopedRegister(regDecl, name);
        lines.push("");
        lines.push(regCode);
      }
    }

    lines.push("");
    this.context.currentScope = null;
    return lines.join("\n");
  }

  // ========================================================================
  // Register Bindings (ADR-004)
  // ========================================================================

  private generateRegister(ctx: Parser.RegisterDeclarationContext): string {
    const name = ctx.IDENTIFIER().getText();
    const baseAddress = this.generateExpression(ctx.expression());

    const lines: string[] = [];
    lines.push(`/* Register: ${name} @ ${baseAddress} */`);

    // Generate individual #define for each register member with its offset
    // This handles non-contiguous register layouts correctly (like i.MX RT1062)
    for (const member of ctx.registerMember()) {
      const regName = member.IDENTIFIER().getText();
      const regType = this.generateType(member.type());
      const access = member.accessModifier().getText();
      const offset = this.generateExpression(member.expression());

      // Determine qualifiers based on access mode
      let cast = `volatile ${regType}*`;
      if (access === "ro") {
        cast = `volatile ${regType} const *`;
      }

      // Generate: #define GPIO7_DR (*(volatile uint32_t*)(0x42004000 + 0x00))
      lines.push(
        `#define ${name}_${regName} (*(${cast})(${baseAddress} + ${offset}))`,
      );
    }

    lines.push("");
    return lines.join("\n");
  }

  /**
   * Generate register macros with scope prefix
   * scope Teensy4 { register GPIO7 @ ... } generates Teensy4_GPIO7_* macros
   */
  private generateScopedRegister(
    ctx: Parser.RegisterDeclarationContext,
    scopeName: string,
  ): string {
    const name = ctx.IDENTIFIER().getText();
    const fullName = `${scopeName}_${name}`; // Teensy4_GPIO7
    const baseAddress = this.generateExpression(ctx.expression());

    const lines: string[] = [];
    lines.push(`/* Register: ${fullName} @ ${baseAddress} */`);

    // Generate individual #define for each register member with its offset
    for (const member of ctx.registerMember()) {
      const regName = member.IDENTIFIER().getText();
      let regType = this.generateType(member.type());
      const access = member.accessModifier().getText();
      const offset = this.generateExpression(member.expression());

      // Check if the type is a scoped bitmap (e.g., GPIO7Pins -> Teensy4_GPIO7Pins)
      const scopedTypeName = `${scopeName}_${regType}`;
      if (this.symbols!.knownBitmaps.has(scopedTypeName)) {
        regType = scopedTypeName;
      }

      // Determine qualifiers based on access mode
      let cast = `volatile ${regType}*`;
      if (access === "ro") {
        cast = `volatile ${regType} const *`;
      }

      // Generate: #define Teensy4_GPIO7_DR (*(volatile uint32_t*)(0x42004000 + 0x00))
      lines.push(
        `#define ${fullName}_${regName} (*(${cast})(${baseAddress} + ${offset}))`,
      );
    }

    lines.push("");
    return lines.join("\n");
  }

  // ========================================================================
  // Struct
  // ========================================================================

  private generateStruct(ctx: Parser.StructDeclarationContext): string {
    const name = ctx.IDENTIFIER().getText();
    const callbackFields: Array<{ fieldName: string; callbackType: string }> =
      [];

    const lines: string[] = [];
    lines.push(`typedef struct {`);

    for (const member of ctx.structMember()) {
      const fieldName = member.IDENTIFIER().getText();
      const typeName = this.getTypeName(member.type());
      // ADR-036: arrayDimension() now returns an array for multi-dimensional support
      const arrayDims = member.arrayDimension();
      const isArray = arrayDims.length > 0;

      // ADR-029: Check if this is a callback type field
      if (this.callbackTypes.has(typeName)) {
        const callbackInfo = this.callbackTypes.get(typeName)!;
        callbackFields.push({ fieldName, callbackType: typeName });

        // Track callback field for assignment validation
        this.callbackFieldTypes.set(`${name}.${fieldName}`, typeName);

        if (isArray) {
          const dims = this.generateArrayDimensions(arrayDims);
          lines.push(`    ${callbackInfo.typedefName} ${fieldName}${dims};`);
        } else {
          lines.push(`    ${callbackInfo.typedefName} ${fieldName};`);
        }
      } else {
        // Regular field handling
        const type = this.generateType(member.type());

        // Check if we have tracked dimensions for this field (includes string capacity for string arrays)
        const trackedDimensions = this.symbols!.structFieldDimensions.get(name);
        const fieldDims = trackedDimensions?.get(fieldName);

        if (fieldDims && fieldDims.length > 0) {
          // Use tracked dimensions (includes string capacity for string arrays)
          const dimsStr = fieldDims.map((d) => `[${d}]`).join("");
          lines.push(`    ${type} ${fieldName}${dimsStr};`);
        } else if (isArray) {
          // Fall back to AST dimensions for non-string arrays
          const dims = this.generateArrayDimensions(arrayDims);
          lines.push(`    ${type} ${fieldName}${dims};`);
        } else {
          lines.push(`    ${type} ${fieldName};`);
        }
      }
    }

    lines.push(`} ${name};`);
    lines.push("");

    // ADR-029: Generate init function if struct has callback fields
    if (callbackFields.length > 0) {
      lines.push(this.generateStructInitFunction(name, callbackFields));
    }

    return lines.join("\n");
  }

  /**
   * ADR-029: Generate init function for structs with callback fields
   * Sets all callback fields to their default functions
   */
  private generateStructInitFunction(
    structName: string,
    callbackFields: Array<{ fieldName: string; callbackType: string }>,
  ): string {
    const lines: string[] = [];
    lines.push(`${structName} ${structName}_init(void) {`);
    lines.push(`    return (${structName}){`);

    for (let i = 0; i < callbackFields.length; i++) {
      const field = callbackFields[i];
      const comma = i < callbackFields.length - 1 ? "," : "";
      lines.push(`        .${field.fieldName} = ${field.callbackType}${comma}`);
    }

    lines.push(`    };`);
    lines.push(`}`);
    lines.push("");

    return lines.join("\n");
  }

  // ========================================================================
  // Enum (ADR-017: Type-safe enums)
  // ========================================================================

  /**
   * ADR-017: Generate enum declaration
   * enum State { IDLE, RUNNING, ERROR <- 255 }
   * -> typedef enum { State_IDLE = 0, State_RUNNING = 1, State_ERROR = 255 } State;
   */
  private generateEnum(ctx: Parser.EnumDeclarationContext): string {
    const name = ctx.IDENTIFIER().getText();
    const prefix = this.context.currentScope
      ? `${this.context.currentScope}_`
      : "";
    const fullName = `${prefix}${name}`;

    const lines: string[] = [];
    lines.push(`typedef enum {`);

    const members = this.symbols!.enumMembers.get(fullName);
    if (!members) {
      throw new Error(`Error: Enum ${fullName} not found in registry`);
    }

    const memberEntries = Array.from(members.entries());

    for (let i = 0; i < memberEntries.length; i++) {
      const [memberName, value] = memberEntries[i];
      const fullMemberName = `${fullName}_${memberName}`;
      const comma = i < memberEntries.length - 1 ? "," : "";
      lines.push(`    ${fullMemberName} = ${value}${comma}`);
    }

    lines.push(`} ${fullName};`);
    lines.push("");

    return lines.join("\n");
  }

  /**
   * ADR-034: Generate bitmap declaration
   * bitmap8 MotorFlags { Running, Direction, Mode[3], Reserved[2] }
   * -> typedef uint8_t MotorFlags; (with field layout comment)
   */
  private generateBitmap(ctx: Parser.BitmapDeclarationContext): string {
    const name = ctx.IDENTIFIER().getText();
    const prefix = this.context.currentScope
      ? `${this.context.currentScope}_`
      : "";
    const fullName = `${prefix}${name}`;

    const backingType = this.symbols!.bitmapBackingType.get(fullName);
    if (!backingType) {
      throw new Error(`Error: Bitmap ${fullName} not found in registry`);
    }

    this.needsStdint = true;

    const lines: string[] = [];

    // Generate comment with field layout
    lines.push(`/* Bitmap: ${fullName} */`);

    const fields = this.symbols!.bitmapFields.get(fullName);
    if (fields) {
      lines.push("/* Fields:");
      for (const [fieldName, info] of fields.entries()) {
        const endBit = info.offset + info.width - 1;
        const bitRange =
          info.width === 1
            ? `bit ${info.offset}`
            : `bits ${info.offset}-${endBit}`;
        lines.push(
          ` *   ${fieldName}: ${bitRange} (${info.width} bit${info.width > 1 ? "s" : ""})`,
        );
      }
      lines.push(" */");
    }

    lines.push(`typedef ${backingType} ${fullName};`);
    lines.push("");

    return lines.join("\n");
  }

  /**
   * ADR-014: Generate struct initializer
   * { x: 10, y: 20 } -> (Point){ .x = 10, .y = 20 } (type inferred from context)
   *
   * Note: Explicit type syntax (Point { x: 10 }) is rejected as redundant
   * when type is already declared on the left side of assignment.
   */
  private generateStructInitializer(
    ctx: Parser.StructInitializerContext,
  ): string {
    // Reject redundant type in struct initializer
    // Wrong: const Point p <- Point { x: 0 };
    // Right: const Point p <- { x: 0 };
    if (ctx.IDENTIFIER() && this.context.expectedType) {
      const explicitType = ctx.IDENTIFIER()!.getText();
      throw new Error(
        `Redundant type '${explicitType}' in struct initializer. ` +
          `Use '{ field: value }' syntax when type is already declared.`,
      );
    }

    // Get type name - either explicit or inferred from context
    let typeName: string;
    if (ctx.IDENTIFIER()) {
      typeName = ctx.IDENTIFIER()!.getText();
    } else if (this.context.expectedType) {
      typeName = this.context.expectedType;
    } else {
      // This should not happen in valid code
      throw new Error(
        "Cannot infer struct type - no explicit type and no context",
      );
    }

    const fieldList = ctx.fieldInitializerList();

    if (!fieldList) {
      // Empty initializer: Point {} -> (Point){ 0 }
      return `(${typeName}){ 0 }`;
    }

    // Get field type info for nested initializers
    const structFieldTypes = this.symbols!.structFields.get(typeName);

    const fields = fieldList.fieldInitializer().map((field) => {
      const fieldName = field.IDENTIFIER().getText();

      // Set expected type for nested initializers
      const savedExpectedType = this.context.expectedType;
      if (structFieldTypes && structFieldTypes.has(fieldName)) {
        this.context.expectedType = structFieldTypes.get(fieldName)!;
      }

      const value = this.generateExpression(field.expression());

      // Restore expected type
      this.context.expectedType = savedExpectedType;

      return `.${fieldName} = ${value}`;
    });

    return `(${typeName}){ ${fields.join(", ")} }`;
  }

  /**
   * ADR-035: Generate array initializer
   * [1, 2, 3] -> {1, 2, 3}
   * [0*] -> {0} (fill-all syntax)
   * Returns: { elements: string, count: number } for size inference
   */
  private generateArrayInitializer(
    ctx: Parser.ArrayInitializerContext,
  ): string {
    // Check for fill-all syntax: [value*]
    if (ctx.expression() && ctx.getChild(2)?.getText() === "*") {
      // Fill-all: [0*] -> {0}
      const fillValue = this.generateExpression(ctx.expression()!);
      // Store element count as 0 to signal fill-all (size comes from declaration)
      this.context.lastArrayInitCount = 0;
      this.context.lastArrayFillValue = fillValue;
      return `{${fillValue}}`;
    }

    // Regular list: [1, 2, 3] -> {1, 2, 3}
    const elements = ctx.arrayInitializerElement();
    const generatedElements: string[] = [];

    for (const elem of elements) {
      if (elem.expression()) {
        generatedElements.push(this.generateExpression(elem.expression()!));
      } else if (elem.structInitializer()) {
        generatedElements.push(
          this.generateStructInitializer(elem.structInitializer()!),
        );
      } else if (elem.arrayInitializer()) {
        // Nested array for multi-dimensional
        generatedElements.push(
          this.generateArrayInitializer(elem.arrayInitializer()!),
        );
      }
    }

    // Store element count for size inference
    this.context.lastArrayInitCount = generatedElements.length;
    this.context.lastArrayFillValue = undefined;

    return `{${generatedElements.join(", ")}}`;
  }

  // ========================================================================
  // Functions
  // ========================================================================

  private generateFunction(ctx: Parser.FunctionDeclarationContext): string {
    const returnType = this.generateType(ctx.type());
    const name = ctx.IDENTIFIER().getText();

    // Track parameters for ADR-006 pointer semantics
    this.setParameters(ctx.parameterList() ?? null);

    // ADR-016: Clear local variables and mark that we're in a function body
    this.context.localVariables.clear();
    this.context.inFunctionBody = true;

    // Check for main function with args parameter (u8 args[][])
    const isMainWithArgs = this.isMainFunctionWithArgs(
      name,
      ctx.parameterList(),
    );

    let params: string;
    let actualReturnType: string;

    if (isMainWithArgs) {
      // Special case: main(u8 args[][]) -> int main(int argc, char *argv[])
      actualReturnType = "int";
      params = "int argc, char *argv[]";
      // Store the args parameter name for translation in the body
      // We know there's exactly one parameter from isMainFunctionWithArgs check
      const argsParam = ctx.parameterList()!.parameter()[0];
      this.context.mainArgsName = argsParam.IDENTIFIER().getText();
    } else {
      // For main() without args, always use int return type for C++ compatibility
      actualReturnType = name === "main" ? "int" : returnType;
      params = ctx.parameterList()
        ? this.generateParameterList(ctx.parameterList()!)
        : "void";
    }

    const body = this.generateBlock(ctx.block());

    // ADR-016: Clear local variables and mark that we're no longer in a function body
    this.context.inFunctionBody = false;
    this.context.localVariables.clear();
    this.context.mainArgsName = null;
    this.clearParameters();

    const functionCode = `${actualReturnType} ${name}(${params}) ${body}\n`;

    // ADR-029: Generate callback typedef only if this function is used as a type
    if (name !== "main" && this.isCallbackTypeUsedAsFieldType(name)) {
      const typedef = this.generateCallbackTypedef(name);
      if (typedef) {
        return functionCode + typedef;
      }
    }

    return functionCode;
  }

  /**
   * ADR-029: Generate typedef for callback type
   */
  private generateCallbackTypedef(funcName: string): string | null {
    const callbackInfo = this.callbackTypes.get(funcName);
    if (!callbackInfo) {
      return null;
    }

    const paramList =
      callbackInfo.parameters.length > 0
        ? callbackInfo.parameters
            .map((p) => {
              const constMod = p.isConst ? "const " : "";
              if (p.isArray) {
                // Array parameters: type name[]
                return `${constMod}${p.type} ${p.name}${p.arrayDims}`;
              } else if (p.isPointer) {
                // ADR-006: Non-array, non-callback parameters become pointers
                return `${constMod}${p.type}*`;
              } else {
                // ADR-029: Callback parameters are already function pointers
                return `${p.type}`;
              }
            })
            .join(", ")
        : "void";

    return `\ntypedef ${callbackInfo.returnType} (*${callbackInfo.typedefName})(${paramList});\n`;
  }

  /**
   * Check if this is the main function with command-line args parameter
   * Supports: u8 args[][] (legacy) or string args[] (preferred)
   */
  private isMainFunctionWithArgs(
    name: string,
    paramList: Parser.ParameterListContext | null,
  ): boolean {
    if (name !== "main" || !paramList) {
      return false;
    }

    const params = paramList.parameter();
    if (params.length !== 1) {
      return false;
    }

    const param = params[0];
    const typeCtx = param.type();
    const dims = param.arrayDimension();

    // Check for string args[] (preferred - array of strings)
    if (typeCtx.stringType() && dims.length === 1) {
      return true;
    }

    // Check for u8 args[][] (legacy - 2D array of bytes)
    const type = typeCtx.getText();
    return (type === "u8" || type === "i8") && dims.length === 2;
  }

  private generateParameterList(ctx: Parser.ParameterListContext): string {
    return ctx
      .parameter()
      .map((p) => this.generateParameter(p))
      .join(", ");
  }

  private generateParameter(ctx: Parser.ParameterContext): string {
    const constMod = ctx.constModifier() ? "const " : "";
    const typeName = this.getTypeName(ctx.type());
    const name = ctx.IDENTIFIER().getText();
    const dims = ctx.arrayDimension();

    // ADR-029: Check if this is a callback type parameter
    if (this.callbackTypes.has(typeName)) {
      const callbackInfo = this.callbackTypes.get(typeName)!;
      // Callback types are already function pointers, no additional pointer needed
      return `${callbackInfo.typedefName} ${name}`;
    }

    const type = this.generateType(ctx.type());

    // ADR-045: Handle string<N>[] - array of bounded strings becomes 2D char array
    // string<32> arr[5] -> char arr[5][33] (5 elements, each is capacity + 1 chars)
    if (ctx.type().stringType() && dims.length > 0) {
      const stringType = ctx.type().stringType()!;
      const capacity = stringType.INTEGER_LITERAL()
        ? parseInt(stringType.INTEGER_LITERAL()!.getText(), 10)
        : 256; // Default capacity
      const dimStr = dims.map((d) => this.generateArrayDimension(d)).join("");
      return `${constMod}char ${name}${dimStr}[${capacity + 1}]`;
    }

    // Arrays pass naturally as pointers
    if (dims.length > 0) {
      const dimStr = dims.map((d) => this.generateArrayDimension(d)).join("");
      return `${constMod}${type} ${name}${dimStr}`;
    }

    // ADR-040: ISR is already a function pointer typedef, no additional pointer needed
    if (typeName === "ISR") {
      return `${constMod}${type} ${name}`;
    }

    // Float types (f32, f64) use standard C pass-by-value semantics
    if (this.isFloatType(typeName)) {
      return `${constMod}${type} ${name}`;
    }

    // ADR-017: Enum types use standard C pass-by-value semantics
    if (this.symbols!.knownEnums.has(typeName)) {
      return `${constMod}${type} ${name}`;
    }

    // ADR-006: Pass by reference for non-array types
    // Add pointer for primitive types to enable pass-by-reference semantics
    return `${constMod}${type}* ${name}`;
  }

  private generateArrayDimension(ctx: Parser.ArrayDimensionContext): string {
    if (ctx.expression()) {
      // Bug #8: At file scope, resolve const values to numeric literals
      // because C doesn't allow const variables as array sizes at file scope
      if (!this.context.inFunctionBody) {
        const constValue = this.tryEvaluateConstant(ctx.expression()!);
        if (constValue !== undefined) {
          return `[${constValue}]`;
        }
      }
      return `[${this.generateExpression(ctx.expression()!)}]`;
    }
    return "[]";
  }

  /**
   * ADR-036: Generate all array dimensions for multi-dimensional arrays
   * Converts array of ArrayDimensionContext to string like "[4][8]"
   */
  private generateArrayDimensions(
    dims: Parser.ArrayDimensionContext[],
  ): string {
    return dims.map((d) => this.generateArrayDimension(d)).join("");
  }

  // ========================================================================
  // Variables
  // ========================================================================

  private generateVariableDecl(ctx: Parser.VariableDeclarationContext): string {
    const constMod = ctx.constModifier() ? "const " : "";
    // ADR-049: Add volatile for atomic variables
    const atomicMod = ctx.atomicModifier() ? "volatile " : "";
    // Explicit volatile modifier
    const volatileMod = ctx.volatileModifier() ? "volatile " : "";

    // Error if both atomic and volatile are specified
    if (ctx.atomicModifier() && ctx.volatileModifier()) {
      const line = ctx.start?.line ?? 0;
      throw new Error(
        `Error at line ${line}: Cannot use both 'atomic' and 'volatile' modifiers. ` +
          `Use 'atomic' for ISR-shared variables (includes volatile + atomicity), ` +
          `or 'volatile' for hardware registers and delay loops.`,
      );
    }

    const type = this.generateType(ctx.type());
    const name = ctx.IDENTIFIER().getText();
    const typeCtx = ctx.type();

    // Track type for bit access and .length support
    // Note: Global variables already registered in registerAllVariableTypes() pass
    // Only track local variables here (declared inside function bodies)
    if (this.context.inFunctionBody) {
      this.trackVariableType(ctx);
      // ADR-016: Track local variables (allowed as bare identifiers inside scopes)
      this.context.localVariables.add(name);

      // Bug #8: Track local const values for array size and bit index resolution
      if (ctx.constModifier() && ctx.expression()) {
        const constValue = this.tryEvaluateConstant(ctx.expression()!);
        if (constValue !== undefined) {
          this.constValues.set(name, constValue);
        }
      }
    }

    // ADR-045: Handle bounded string type specially
    if (typeCtx.stringType()) {
      const stringCtx = typeCtx.stringType()!;
      const intLiteral = stringCtx.INTEGER_LITERAL();

      if (intLiteral) {
        const capacity = parseInt(intLiteral.getText(), 10);
        const arrayDims = ctx.arrayDimension();

        // Check for string arrays: string<64> arr[4] -> char arr[4][65] = {0};
        if (arrayDims.length > 0) {
          let decl = `${constMod}${atomicMod}${volatileMod}char ${name}`;
          decl += this.generateArrayDimensions(arrayDims); // [4]
          decl += `[${capacity + 1}]`; // [65]

          if (ctx.expression()) {
            throw new Error(
              `Error: Array initializers for string arrays not yet supported`,
            );
          }

          return `${decl} = {0};`;
        }

        if (ctx.expression()) {
          const exprText = ctx.expression()!.getText();

          // ADR-045: Check for string concatenation
          const concatOps = this.getStringConcatOperands(ctx.expression()!);
          if (concatOps) {
            // String concatenation requires runtime function calls (strncpy, strncat)
            // which cannot exist at global scope in C
            if (!this.context.inFunctionBody) {
              throw new Error(
                `Error: String concatenation cannot be used at global scope. ` +
                  `Move the declaration inside a function.`,
              );
            }

            // Validate capacity: dest >= left + right
            const requiredCapacity =
              concatOps.leftCapacity + concatOps.rightCapacity;
            if (requiredCapacity > capacity) {
              throw new Error(
                `Error: String concatenation requires capacity ${requiredCapacity}, but string<${capacity}> only has ${capacity}`,
              );
            }

            // Generate safe concatenation code
            const indent = this.context.inFunctionBody
              ? "    ".repeat(this.context.indentLevel)
              : "";
            const lines: string[] = [];
            lines.push(`${constMod}char ${name}[${capacity + 1}] = "";`);
            lines.push(
              `${indent}strncpy(${name}, ${concatOps.left}, ${capacity});`,
            );
            lines.push(
              `${indent}strncat(${name}, ${concatOps.right}, ${capacity} - strlen(${name}));`,
            );
            lines.push(`${indent}${name}[${capacity}] = '\\0';`);
            return lines.join("\n");
          }

          // ADR-045: Check for substring extraction
          const substringOps = this.getSubstringOperands(ctx.expression()!);
          if (substringOps) {
            // Substring extraction requires runtime function calls (strncpy)
            // which cannot exist at global scope in C
            if (!this.context.inFunctionBody) {
              throw new Error(
                `Error: Substring extraction cannot be used at global scope. ` +
                  `Move the declaration inside a function.`,
              );
            }

            // For compile-time validation, we need numeric literals
            const startNum = parseInt(substringOps.start, 10);
            const lengthNum = parseInt(substringOps.length, 10);

            // Only validate bounds if both start and length are compile-time constants
            if (!isNaN(startNum) && !isNaN(lengthNum)) {
              // Bounds check: start + length <= sourceCapacity
              if (startNum + lengthNum > substringOps.sourceCapacity) {
                throw new Error(
                  `Error: Substring bounds [${startNum}, ${lengthNum}] exceed source string<${substringOps.sourceCapacity}> capacity`,
                );
              }
            }

            // Validate destination capacity can hold the substring
            if (!isNaN(lengthNum) && lengthNum > capacity) {
              throw new Error(
                `Error: Substring length ${lengthNum} exceeds destination string<${capacity}> capacity`,
              );
            }

            // Generate safe substring extraction code
            const indent = this.context.inFunctionBody
              ? "    ".repeat(this.context.indentLevel)
              : "";
            const lines: string[] = [];
            lines.push(`${constMod}char ${name}[${capacity + 1}] = "";`);
            lines.push(
              `${indent}strncpy(${name}, ${substringOps.source} + ${substringOps.start}, ${substringOps.length});`,
            );
            lines.push(`${indent}${name}[${substringOps.length}] = '\\0';`);
            return lines.join("\n");
          }

          // Validate string literal fits capacity
          if (exprText.startsWith('"') && exprText.endsWith('"')) {
            // Extract content without quotes, accounting for escape sequences
            const content = this.getStringLiteralLength(exprText);
            if (content > capacity) {
              throw new Error(
                `Error: String literal (${content} chars) exceeds string<${capacity}> capacity`,
              );
            }
          }

          // Check for string variable assignment
          const srcCapacity = this.getStringExprCapacity(exprText);
          if (srcCapacity !== null && srcCapacity > capacity) {
            throw new Error(
              `Error: Cannot assign string<${srcCapacity}> to string<${capacity}> (potential truncation)`,
            );
          }

          return `${constMod}char ${name}[${capacity + 1}] = ${this.generateExpression(ctx.expression()!)};`;
        } else {
          // Empty string initialization
          return `${constMod}char ${name}[${capacity + 1}] = "";`;
        }
      } else {
        // ADR-045: Unsized string - requires const and string literal for inference
        const isConst = ctx.constModifier() !== null;

        if (!isConst) {
          throw new Error(
            "Error: Non-const string requires explicit capacity, e.g., string<64>",
          );
        }

        if (!ctx.expression()) {
          throw new Error(
            "Error: const string requires initializer for capacity inference",
          );
        }

        const exprText = ctx.expression()!.getText();
        if (!exprText.startsWith('"') || !exprText.endsWith('"')) {
          throw new Error(
            "Error: const string requires string literal for capacity inference",
          );
        }

        // Infer capacity from literal length
        const inferredCapacity = this.getStringLiteralLength(exprText);
        this.needsString = true;

        // Register in type registry with inferred capacity
        this.context.typeRegistry.set(name, {
          baseType: "char",
          bitWidth: 8,
          isArray: true,
          arrayDimensions: [inferredCapacity + 1],
          isConst: true,
          isString: true,
          stringCapacity: inferredCapacity,
        });

        return `const char ${name}[${inferredCapacity + 1}] = ${exprText};`;
      }
    }

    let decl = `${constMod}${atomicMod}${volatileMod}${type} ${name}`;
    // ADR-036: arrayDimension() now returns an array for multi-dimensional support
    const arrayDims = ctx.arrayDimension();
    const isArray = arrayDims.length > 0;
    const hasEmptyArrayDim =
      isArray && arrayDims.some((dim) => !dim.expression());
    let declaredSize: number | null = null;

    // Get first dimension size for simple validation (multi-dim validation is more complex)
    if (isArray && arrayDims[0].expression()) {
      const sizeText = arrayDims[0].expression()!.getText();
      if (sizeText.match(/^\d+$/)) {
        declaredSize = parseInt(sizeText, 10);
      }
    }

    // ADR-035: Handle array initializers with size inference
    if (isArray && ctx.expression()) {
      // Reset array init tracking
      this.context.lastArrayInitCount = 0;
      this.context.lastArrayFillValue = undefined;

      // Generate the initializer expression (may be array initializer)
      const typeName = this.getTypeName(typeCtx);
      const savedExpectedType = this.context.expectedType;
      this.context.expectedType = typeName;

      const initValue = this.generateExpression(ctx.expression()!);

      this.context.expectedType = savedExpectedType;

      // Check if it was an array initializer
      if (
        this.context.lastArrayInitCount > 0 ||
        this.context.lastArrayFillValue !== undefined
      ) {
        // ADR-006: Track local arrays
        this.context.localArrays.add(name);

        if (hasEmptyArrayDim) {
          // Size inference: u8 data[] <- [1, 2, 3]
          if (this.context.lastArrayFillValue !== undefined) {
            throw new Error(
              `Error: Fill-all syntax [${this.context.lastArrayFillValue}*] requires explicit array size`,
            );
          }
          decl += `[${this.context.lastArrayInitCount}]`;

          // Update type registry with inferred size for .length support
          const existingType = this.context.typeRegistry.get(name);
          if (existingType) {
            existingType.arrayDimensions = [this.context.lastArrayInitCount];
          }
        } else {
          // ADR-036: Generate all explicit dimensions
          decl += this.generateArrayDimensions(arrayDims);

          if (
            declaredSize !== null &&
            this.context.lastArrayFillValue === undefined
          ) {
            if (this.context.lastArrayInitCount !== declaredSize) {
              throw new Error(
                `Error: Array size mismatch - declared [${declaredSize}] but got ${this.context.lastArrayInitCount} elements`,
              );
            }
          }
        }

        // ADR-035: For fill-all syntax with non-zero values, generate full initializer
        // [0*] -> {0} is fine (C zero-initializes remaining elements)
        // [1*] -> {1, 1, 1, ...} (must repeat value for all elements)
        let finalInitValue = initValue;
        if (
          this.context.lastArrayFillValue !== undefined &&
          declaredSize !== null
        ) {
          const fillVal = this.context.lastArrayFillValue;
          // Only expand if the fill value is not "0" (C handles {0} correctly)
          if (fillVal !== "0") {
            const elements = Array(declaredSize).fill(fillVal);
            finalInitValue = `{${elements.join(", ")}}`;
          }
        }

        return `${decl} = ${finalInitValue};`;
      }
    }

    if (isArray) {
      // ADR-036: Generate all dimensions
      decl += this.generateArrayDimensions(arrayDims);
      // ADR-006: Track local arrays (they don't need & when passed to functions)
      this.context.localArrays.add(name);
    }

    if (ctx.expression()) {
      // Explicit initializer provided
      // Set expected type for inferred struct initializers
      const typeName = this.getTypeName(typeCtx);
      const savedExpectedType = this.context.expectedType;
      this.context.expectedType = typeName;

      // ADR-017: Validate enum type for initialization
      if (this.symbols!.knownEnums.has(typeName)) {
        const valueEnumType = this.getExpressionEnumType(ctx.expression()!);

        // Check if assigning from a different enum type
        if (valueEnumType && valueEnumType !== typeName) {
          throw new Error(
            `Error: Cannot assign ${valueEnumType} enum to ${typeName} enum`,
          );
        }

        // Check if assigning integer to enum
        if (this.isIntegerExpression(ctx.expression()!)) {
          throw new Error(`Error: Cannot assign integer to ${typeName} enum`);
        }

        // Check if assigning a non-enum, non-integer expression
        if (!valueEnumType) {
          const exprText = ctx.expression()!.getText();
          const parts = exprText.split(".");

          // ADR-016: Handle this.State.MEMBER pattern
          if (
            parts[0] === "this" &&
            this.context.currentScope &&
            parts.length >= 3
          ) {
            const scopedEnumName = `${this.context.currentScope}_${parts[1]}`;
            if (scopedEnumName === typeName) {
              // Valid this.Enum.Member access
            } else {
              throw new Error(
                `Error: Cannot assign non-enum value to ${typeName} enum`,
              );
            }
          }
          // Allow if it's an enum member access of the correct type
          else if (!exprText.startsWith(typeName + ".")) {
            // Check for scoped enum
            if (parts.length >= 3) {
              const scopedEnumName = `${parts[0]}_${parts[1]}`;
              if (scopedEnumName !== typeName) {
                throw new Error(
                  `Error: Cannot assign non-enum value to ${typeName} enum`,
                );
              }
            } else if (parts.length === 2 && parts[0] !== typeName) {
              throw new Error(
                `Error: Cannot assign non-enum value to ${typeName} enum`,
              );
            }
          }
        }
      }

      // ADR-024: Validate literal values fit in target type
      // Only validate for integer types and literal expressions
      if (this.isIntegerType(typeName)) {
        const exprText = ctx.expression()!.getText().trim();
        // Check if it's a direct literal (not a variable or expression)
        if (
          exprText.match(/^-?\d+$/) ||
          exprText.match(/^0[xX][0-9a-fA-F]+$/) ||
          exprText.match(/^0[bB][01]+$/)
        ) {
          this.validateLiteralFitsType(exprText, typeName);
        } else {
          // Not a literal - check for narrowing/sign conversions
          const sourceType = this.getExpressionType(ctx.expression()!);
          this.validateTypeConversion(typeName, sourceType);
        }
      }

      decl += ` = ${this.generateExpression(ctx.expression()!)}`;

      // Restore expected type
      this.context.expectedType = savedExpectedType;
    } else {
      // ADR-015: Zero initialization for uninitialized variables
      decl += ` = ${this.getZeroInitializer(typeCtx, isArray)}`;
    }

    return decl + ";";
  }

  /**
   * ADR-015: Get the appropriate zero initializer for a type
   * ADR-017: Handle enum types by initializing to first member
   */
  private getZeroInitializer(
    typeCtx: Parser.TypeContext,
    isArray: boolean,
  ): string {
    // Arrays and structs/classes use {0}
    if (isArray) {
      return "{0}";
    }

    // Check for user-defined types (structs/classes/enums)
    if (typeCtx.userType()) {
      const typeName = typeCtx.userType()!.getText();

      // ADR-017: Check if this is an enum type
      if (this.symbols!.knownEnums.has(typeName)) {
        // Return the first member of the enum (which has value 0)
        const members = this.symbols!.enumMembers.get(typeName);
        if (members) {
          // Find the member with value 0
          for (const [memberName, value] of members.entries()) {
            if (value === 0) {
              return `${typeName}_${memberName}`;
            }
          }
          // If no member has value 0, use the first member
          const firstMember = members.keys().next().value;
          if (firstMember) {
            return `${typeName}_${firstMember}`;
          }
        }
        // Fallback to casting 0 to the enum type
        return `(${typeName})0`;
      }

      return "{0}";
    }

    // Primitive types
    if (typeCtx.primitiveType()) {
      const primType = typeCtx.primitiveType()!.getText();
      if (primType === "bool") {
        return "false";
      }
      if (primType === "f32") {
        return "0.0f";
      }
      if (primType === "f64") {
        return "0.0";
      }
      // All integer types
      return "0";
    }

    // Default fallback
    return "0";
  }

  /**
   * Generate a safe bit mask expression.
   * Avoids undefined behavior when width >= 32 for 32-bit integers.
   * @param width The width expression (may be a literal or expression)
   */
  private generateBitMask(width: string): string {
    // Check if width is a compile-time constant
    const widthNum = parseInt(width, 10);
    if (!isNaN(widthNum)) {
      // Use explicit hex masks for common widths to avoid UB
      if (widthNum === 32) {
        return "0xFFFFFFFFU";
      }
      if (widthNum === 64) {
        return "0xFFFFFFFFFFFFFFFFULL";
      }
      if (widthNum === 16) {
        return "0xFFFFU";
      }
      if (widthNum === 8) {
        return "0xFFU";
      }
    }
    // For non-constant or other widths, use the shift expression
    // (safe as long as width < 32 for 32-bit operations)
    return `((1U << ${width}) - 1)`;
  }

  // ========================================================================
  // Statements
  // ========================================================================

  private generateBlock(ctx: Parser.BlockContext): string {
    const lines: string[] = ["{"];
    const innerIndent = "    "; // One level of relative indentation

    for (const stmt of ctx.statement()) {
      // Temporarily increment for any nested context that needs absolute level
      this.context.indentLevel++;
      const stmtCode = this.generateStatement(stmt);
      this.context.indentLevel--;

      if (stmtCode) {
        // Add one level of indent to each line (relative indentation)
        const indentedLines = stmtCode
          .split("\n")
          .map((line) => innerIndent + line);
        lines.push(indentedLines.join("\n"));
      }
    }

    lines.push("}");

    return lines.join("\n");
  }

  private generateStatement(ctx: Parser.StatementContext): string {
    if (ctx.variableDeclaration()) {
      return this.generateVariableDecl(ctx.variableDeclaration()!);
    }
    if (ctx.assignmentStatement()) {
      return this.generateAssignment(ctx.assignmentStatement()!);
    }
    if (ctx.expressionStatement()) {
      return (
        this.generateExpression(ctx.expressionStatement()!.expression()) + ";"
      );
    }
    if (ctx.ifStatement()) {
      return this.generateIf(ctx.ifStatement()!);
    }
    if (ctx.whileStatement()) {
      return this.generateWhile(ctx.whileStatement()!);
    }
    if (ctx.doWhileStatement()) {
      return this.generateDoWhile(ctx.doWhileStatement()!);
    }
    if (ctx.forStatement()) {
      return this.generateFor(ctx.forStatement()!);
    }
    if (ctx.switchStatement()) {
      return this.generateSwitch(ctx.switchStatement()!);
    }
    if (ctx.returnStatement()) {
      return this.generateReturn(ctx.returnStatement()!);
    }
    // ADR-050: Critical statement for atomic multi-variable operations
    if (ctx.criticalStatement()) {
      return this.generateCriticalStatement(ctx.criticalStatement()!);
    }
    if (ctx.block()) {
      return this.generateBlock(ctx.block()!);
    }
    return "";
  }

  // ADR-001: <- becomes = in C, with compound assignment operators
  private generateAssignment(ctx: Parser.AssignmentStatementContext): string {
    const targetCtx = ctx.assignmentTarget();

    // Set expected type for inferred struct initializers
    const savedExpectedType = this.context.expectedType;
    // ADR-044: Save and set assignment context for overflow behavior
    const savedAssignmentContext = { ...this.context.assignmentContext };

    if (
      targetCtx.IDENTIFIER() &&
      !targetCtx.memberAccess() &&
      !targetCtx.arrayAccess()
    ) {
      const id = targetCtx.IDENTIFIER()!.getText();
      const typeInfo = this.context.typeRegistry.get(id);
      if (typeInfo) {
        this.context.expectedType = typeInfo.baseType;
        // ADR-044: Set overflow context for expression generation
        this.context.assignmentContext = {
          targetName: id,
          targetType: typeInfo.baseType,
          overflowBehavior: typeInfo.overflowBehavior || "clamp",
        };
      }
    }

    const value = this.generateExpression(ctx.expression());

    // Restore expected type and assignment context
    this.context.expectedType = savedExpectedType;
    this.context.assignmentContext = savedAssignmentContext;

    // Get the assignment operator and map to C equivalent
    const operatorCtx = ctx.assignmentOperator();
    const cnextOp = operatorCtx.getText();
    const cOp = ASSIGNMENT_OPERATOR_MAP[cnextOp] || "=";
    const isCompound = cOp !== "=";

    // ADR-013: Validate const before generating assignment
    // Check simple identifier assignment
    if (
      targetCtx.IDENTIFIER() &&
      !targetCtx.memberAccess() &&
      !targetCtx.arrayAccess()
    ) {
      const id = targetCtx.IDENTIFIER()!.getText();
      const constError = this.typeValidator!.checkConstAssignment(id);
      if (constError) {
        throw new Error(constError);
      }

      // ADR-017: Validate enum type assignment
      const targetTypeInfo = this.context.typeRegistry.get(id);
      if (targetTypeInfo?.isEnum && targetTypeInfo.enumTypeName) {
        const targetEnumType = targetTypeInfo.enumTypeName;
        const valueEnumType = this.getExpressionEnumType(ctx.expression());

        // Check if assigning from a different enum type
        if (valueEnumType && valueEnumType !== targetEnumType) {
          throw new Error(
            `Error: Cannot assign ${valueEnumType} enum to ${targetEnumType} enum`,
          );
        }

        // Check if assigning integer to enum
        if (this.isIntegerExpression(ctx.expression())) {
          throw new Error(
            `Error: Cannot assign integer to ${targetEnumType} enum`,
          );
        }

        // Check if assigning a non-enum, non-integer expression to enum
        // (must be same enum type or a valid enum member access)
        if (!valueEnumType) {
          const exprText = ctx.expression().getText();
          const parts = exprText.split(".");

          // ADR-016: Handle this.State.MEMBER pattern
          if (
            parts[0] === "this" &&
            this.context.currentScope &&
            parts.length >= 3
          ) {
            const scopedEnumName = `${this.context.currentScope}_${parts[1]}`;
            if (scopedEnumName !== targetEnumType) {
              throw new Error(
                `Error: Cannot assign non-enum value to ${targetEnumType} enum`,
              );
            }
          }
          // Allow if it's an enum member access of the correct type
          else if (!exprText.startsWith(targetEnumType + ".")) {
            // Not a direct enum member access - check if it's scoped enum
            if (parts.length >= 3) {
              // Could be Scope.Enum.Member
              const scopedEnumName = `${parts[0]}_${parts[1]}`;
              if (scopedEnumName !== targetEnumType) {
                throw new Error(
                  `Error: Cannot assign non-enum value to ${targetEnumType} enum`,
                );
              }
            } else if (parts.length === 2) {
              // Could be Enum.Member or variable.field
              if (
                parts[0] !== targetEnumType &&
                !this.symbols!.knownEnums.has(parts[0])
              ) {
                throw new Error(
                  `Error: Cannot assign non-enum value to ${targetEnumType} enum`,
                );
              }
            }
          }
        }
      }

      // ADR-024: Validate integer type conversions for simple assignments only
      // Skip validation for compound assignments (+<-, -<-, etc.) since the
      // operand doesn't need to fit directly in the target type
      if (
        !isCompound &&
        targetTypeInfo &&
        this.isIntegerType(targetTypeInfo.baseType)
      ) {
        const exprText = ctx.expression().getText().trim();
        // Check if it's a direct literal
        if (
          exprText.match(/^-?\d+$/) ||
          exprText.match(/^0[xX][0-9a-fA-F]+$/) ||
          exprText.match(/^0[bB][01]+$/)
        ) {
          this.validateLiteralFitsType(exprText, targetTypeInfo.baseType);
        } else {
          // Not a literal - check for narrowing/sign conversions
          const sourceType = this.getExpressionType(ctx.expression());
          this.validateTypeConversion(targetTypeInfo.baseType, sourceType);
        }
      }
    }

    // Check array element assignment - validate the array is not const
    if (targetCtx.arrayAccess()) {
      const arrayName = targetCtx.arrayAccess()!.IDENTIFIER().getText();
      const constError = this.typeValidator!.checkConstAssignment(arrayName);
      if (constError) {
        throw new Error(`${constError} (array element)`);
      }
    }

    // Check member access on const struct - validate the root is not const
    if (targetCtx.memberAccess()) {
      const identifiers = targetCtx.memberAccess()!.IDENTIFIER();
      if (identifiers.length > 0) {
        const rootName = identifiers[0].getText();
        const constError = this.typeValidator!.checkConstAssignment(rootName);
        if (constError) {
          throw new Error(`${constError} (member access)`);
        }

        // ADR-013: Check for read-only register members (ro = implicitly const)
        if (identifiers.length >= 2) {
          const memberName = identifiers[1].getText();
          const fullName = `${rootName}_${memberName}`;
          const accessMod = this.symbols!.registerMemberAccess.get(fullName);
          if (accessMod === "ro") {
            throw new Error(
              `cannot assign to read-only register member '${memberName}' ` +
                `(${rootName}.${memberName} has 'ro' access modifier)`,
            );
          }

          // ADR-029: Validate callback field assignments with nominal typing
          const rootTypeInfo = this.context.typeRegistry.get(rootName);
          if (rootTypeInfo && this.isKnownStruct(rootTypeInfo.baseType)) {
            const structType = rootTypeInfo.baseType;
            const callbackFieldKey = `${structType}.${memberName}`;
            const expectedCallbackType =
              this.callbackFieldTypes.get(callbackFieldKey);

            if (expectedCallbackType) {
              this.typeValidator!.validateCallbackAssignment(
                expectedCallbackType,
                ctx.expression(),
                memberName,
                (funcName: string) =>
                  this.isCallbackTypeUsedAsFieldType(funcName),
              );
            }
          }
        }
      }
    }

    // ADR-034: Check if this is a bitmap field write (e.g., flags.Running <- true)
    if (targetCtx.memberAccess()) {
      const memberAccessCtx = targetCtx.memberAccess()!;
      const identifiers = memberAccessCtx.IDENTIFIER();
      const exprs = memberAccessCtx.expression();

      // Simple member access: var.field (2 identifiers, no subscripts)
      if (identifiers.length === 2 && exprs.length === 0) {
        const varName = identifiers[0].getText();
        const fieldName = identifiers[1].getText();

        const typeInfo = this.context.typeRegistry.get(varName);
        if (typeInfo?.isBitmap && typeInfo.bitmapTypeName) {
          // Compound operators not supported for bitmap field access
          if (isCompound) {
            throw new Error(
              `Compound assignment operators not supported for bitmap field access: ${cnextOp}`,
            );
          }

          const bitmapType = typeInfo.bitmapTypeName;
          const fields = this.symbols!.bitmapFields.get(bitmapType);
          if (fields && fields.has(fieldName)) {
            const fieldInfo = fields.get(fieldName)!;

            // Validate compile-time literal overflow
            this.typeValidator!.validateBitmapFieldLiteral(
              ctx.expression(),
              fieldInfo.width,
              fieldName,
            );

            const mask = (1 << fieldInfo.width) - 1;
            const maskHex = `0x${mask.toString(16).toUpperCase()}`;

            if (fieldInfo.width === 1) {
              // Single bit write: var = (var & ~(1 << offset)) | ((value ? 1 : 0) << offset)
              return `${varName} = (${varName} & ~(1 << ${fieldInfo.offset})) | ((${value} ? 1 : 0) << ${fieldInfo.offset});`;
            } else {
              // Multi-bit write: var = (var & ~(mask << offset)) | ((value & mask) << offset)
              return `${varName} = (${varName} & ~(${maskHex} << ${fieldInfo.offset})) | ((${value} & ${maskHex}) << ${fieldInfo.offset});`;
            }
          } else {
            throw new Error(
              `Error: Unknown bitmap field '${fieldName}' on type '${bitmapType}'`,
            );
          }
        }
      }

      // ADR-034: Register member bitmap field write: MOTOR.CTRL.Running <- true
      // 3 identifiers: [register, member, bitmapField], no subscripts
      if (identifiers.length === 3 && exprs.length === 0) {
        const regName = identifiers[0].getText();
        const memberName = identifiers[1].getText();
        const fieldName = identifiers[2].getText();

        // Check if first identifier is a register and second is a bitmap-typed member
        if (this.symbols!.knownRegisters.has(regName)) {
          const fullRegMember = `${regName}_${memberName}`;
          const bitmapType =
            this.symbols!.registerMemberTypes.get(fullRegMember);

          if (bitmapType) {
            // This is a bitmap field access on a register member
            if (isCompound) {
              throw new Error(
                `Compound assignment operators not supported for bitmap field access: ${cnextOp}`,
              );
            }

            const fields = this.symbols!.bitmapFields.get(bitmapType);
            if (fields && fields.has(fieldName)) {
              const fieldInfo = fields.get(fieldName)!;

              // Validate compile-time literal overflow
              this.typeValidator!.validateBitmapFieldLiteral(
                ctx.expression(),
                fieldInfo.width,
                fieldName,
              );

              const mask = (1 << fieldInfo.width) - 1;
              const maskHex = `0x${mask.toString(16).toUpperCase()}`;

              if (fieldInfo.width === 1) {
                // Single bit write on register: REG_MEMBER = (REG_MEMBER & ~(1 << offset)) | ((value ? 1 : 0) << offset)
                return `${fullRegMember} = (${fullRegMember} & ~(1 << ${fieldInfo.offset})) | ((${value} ? 1 : 0) << ${fieldInfo.offset});`;
              } else {
                // Multi-bit write on register
                return `${fullRegMember} = (${fullRegMember} & ~(${maskHex} << ${fieldInfo.offset})) | ((${value} & ${maskHex}) << ${fieldInfo.offset});`;
              }
            } else {
              throw new Error(
                `Error: Unknown bitmap field '${fieldName}' on type '${bitmapType}'`,
              );
            }
          }
        }

        // ADR-034: Struct member bitmap field write: device.flags.Active <- true
        // 3 identifiers: [structVar, bitmapMember, bitmapField], no subscripts
        // Check if first identifier is a struct variable (not a register)
        const structVarName = identifiers[0].getText();
        const structMemberName = identifiers[1].getText();
        if (!this.symbols!.knownRegisters.has(structVarName)) {
          // Check if structVarName is a struct variable
          const structTypeInfo = this.context.typeRegistry.get(structVarName);
          if (structTypeInfo && this.isKnownStruct(structTypeInfo.baseType)) {
            // Check if the struct member is a bitmap type
            const memberInfo = this.getMemberTypeInfo(
              structTypeInfo.baseType,
              structMemberName,
            );
            if (memberInfo) {
              const memberBitmapType = memberInfo.baseType;
              const structBitmapFields =
                this.symbols!.bitmapFields.get(memberBitmapType);
              if (structBitmapFields && structBitmapFields.has(fieldName)) {
                // This is a bitmap field access on a struct member
                if (isCompound) {
                  throw new Error(
                    `Compound assignment operators not supported for bitmap field access: ${cnextOp}`,
                  );
                }

                const structFieldInfo = structBitmapFields.get(fieldName)!;

                // Validate compile-time literal overflow
                this.typeValidator!.validateBitmapFieldLiteral(
                  ctx.expression(),
                  structFieldInfo.width,
                  fieldName,
                );

                const mask = (1 << structFieldInfo.width) - 1;
                const maskHex = `0x${mask.toString(16).toUpperCase()}`;
                const memberPath = `${structVarName}.${structMemberName}`;

                if (structFieldInfo.width === 1) {
                  // Single bit write: struct.member = (struct.member & ~(1 << offset)) | ((value ? 1 : 0) << offset)
                  return `${memberPath} = (${memberPath} & ~(1 << ${structFieldInfo.offset})) | ((${value} ? 1 : 0) << ${structFieldInfo.offset});`;
                } else {
                  // Multi-bit write
                  return `${memberPath} = (${memberPath} & ~(${maskHex} << ${structFieldInfo.offset})) | ((${value} & ${maskHex}) << ${structFieldInfo.offset});`;
                }
              }
            }
          }
        }
      }

      // ADR-016: Scoped register member bitmap field write: Teensy4.GPIO7.ICR1.LED_BUILTIN <- value
      // 4 identifiers: [scope, register, member, bitmapField], no subscripts
      if (identifiers.length === 4 && exprs.length === 0) {
        const scopeName = identifiers[0].getText();
        const regName = identifiers[1].getText();
        const memberName = identifiers[2].getText();
        const fieldName = identifiers[3].getText();

        // Check if first identifier is a scope
        if (this.symbols!.knownScopes.has(scopeName)) {
          const fullRegName = `${scopeName}_${regName}`;
          // Check if this is a scoped register
          if (this.symbols!.knownRegisters.has(fullRegName)) {
            const fullRegMember = `${fullRegName}_${memberName}`;
            const bitmapType =
              this.symbols!.registerMemberTypes.get(fullRegMember);

            if (bitmapType) {
              // This is a bitmap field access on a scoped register member
              if (isCompound) {
                throw new Error(
                  `Compound assignment operators not supported for bitmap field access: ${cnextOp}`,
                );
              }

              const fields = this.symbols!.bitmapFields.get(bitmapType);
              if (fields && fields.has(fieldName)) {
                const fieldInfo = fields.get(fieldName)!;

                // Validate compile-time literal overflow
                this.typeValidator!.validateBitmapFieldLiteral(
                  ctx.expression(),
                  fieldInfo.width,
                  fieldName,
                );

                // Check if this is a write-only register
                const accessMod =
                  this.symbols!.registerMemberAccess.get(fullRegMember);
                const isWriteOnly = accessMod === "wo";

                const mask = (1 << fieldInfo.width) - 1;
                const maskHex = `0x${mask.toString(16).toUpperCase()}`;

                if (isWriteOnly) {
                  // Write-only register: just write the value shifted to position (no RMW)
                  if (fieldInfo.width === 1) {
                    return `${fullRegMember} = ((${value} ? 1 : 0) << ${fieldInfo.offset});`;
                  } else {
                    return `${fullRegMember} = ((${value} & ${maskHex}) << ${fieldInfo.offset});`;
                  }
                } else {
                  // Read-write register: use read-modify-write pattern
                  if (fieldInfo.width === 1) {
                    return `${fullRegMember} = (${fullRegMember} & ~(1 << ${fieldInfo.offset})) | ((${value} ? 1 : 0) << ${fieldInfo.offset});`;
                  } else {
                    return `${fullRegMember} = (${fullRegMember} & ~(${maskHex} << ${fieldInfo.offset})) | ((${value} & ${maskHex}) << ${fieldInfo.offset});`;
                  }
                }
              } else {
                throw new Error(
                  `Error: Unknown bitmap field '${fieldName}' on type '${bitmapType}'`,
                );
              }
            }
          }
        }
      }
    }

    // Check if this is a member access with subscript (e.g., GPIO7.DR_SET[LED_BIT] or matrix[0][0])
    const memberAccessCtx = targetCtx.memberAccess();
    if (memberAccessCtx) {
      const exprs = memberAccessCtx.expression();
      const identifiers = memberAccessCtx.IDENTIFIER();

      // ADR-036: Multi-dimensional array access (e.g., matrix[0][0])
      // Has one identifier and multiple subscript expressions
      if (identifiers.length === 1 && exprs.length > 0) {
        const arrayName = identifiers[0].getText();

        // ADR-036: Compile-time bounds checking for constant indices
        const typeInfo = this.context.typeRegistry.get(arrayName);
        if (typeInfo?.isArray && typeInfo.arrayDimensions) {
          this.typeValidator!.checkArrayBounds(
            arrayName,
            typeInfo.arrayDimensions,
            exprs,
            ctx.start?.line ?? 0,
            (expr) => this.tryEvaluateConstant(expr),
          );

          // Bug #8: Check for bit indexing on array element
          // e.g., matrix[ROW][COL][FIELD_BIT] where matrix is u8[4][4]
          const numDims = typeInfo.arrayDimensions.length;
          const numSubscripts = exprs.length;

          if (numSubscripts === numDims + 1) {
            const elementType = typeInfo.baseType;
            const isPrimitiveInt = [
              "u8",
              "u16",
              "u32",
              "u64",
              "i8",
              "i16",
              "i32",
              "i64",
            ].includes(elementType);

            if (isPrimitiveInt) {
              // Compound operators not supported for bit field access
              if (isCompound) {
                throw new Error(
                  `Compound assignment operators not supported for bit field access: ${cnextOp}`,
                );
              }

              // Generate array access for dimensions, then bit assignment
              const arrayIndices = exprs
                .slice(0, numDims)
                .map((e) => `[${this.generateExpression(e)}]`)
                .join("");
              const bitIndex = this.generateExpression(exprs[numDims]);
              const arrayElement = `${arrayName}${arrayIndices}`;

              // Generate: arr[i][j] = (arr[i][j] & ~(1 << bitIndex)) | ((value ? 1 : 0) << bitIndex)
              return `${arrayElement} = (${arrayElement} & ~(1 << ${bitIndex})) | ((${value} ? 1 : 0) << ${bitIndex});`;
            }
          }
        }

        // Generate all subscript indices
        const indices = exprs.map((e) => this.generateExpression(e)).join("][");
        return `${arrayName}[${indices}] ${cOp} ${value};`;
      }

      // ADR-036: Struct member multi-dimensional array access (e.g., screen.pixels[0][0])
      // Has 2+ identifiers (struct.field), subscripts, and first identifier is NOT a register or scope
      const firstId = identifiers[0].getText();
      // Check if this is a scoped register: Scope.Register.Member[bit]
      const scopedRegName =
        identifiers.length >= 3 && this.symbols!.knownScopes.has(firstId)
          ? `${firstId}_${identifiers[1].getText()}`
          : null;
      const isScopedRegister =
        scopedRegName && this.symbols!.knownRegisters.has(scopedRegName);

      if (
        identifiers.length >= 2 &&
        exprs.length > 0 &&
        !this.symbols!.knownRegisters.has(firstId) &&
        !isScopedRegister
      ) {
        // Fix for Bug #2: Walk children in order to preserve operation sequence
        // For cfg.items[0].value, we need to emit: cfg.items[0].value
        // Not: cfg.items.value[0] (which the old heuristic generated)

        if (memberAccessCtx.children && identifiers.length > 1) {
          // Walk parse tree children in order, building result incrementally
          // Bug #8 fix: Use while loop with proper child iteration
          // instead of fragile index arithmetic (i += 2)
          let result = firstId;
          let idIndex = 1; // Start at 1 since we already used firstId
          let exprIndex = 0;

          // Check if first identifier is a scope for special handling
          const isCrossScope = this.symbols!.knownScopes.has(firstId);

          // Bug #8: Track struct types to detect bit access through chains
          // e.g., items[0].byte[7] where byte is u8 - final [7] is bit access
          let currentStructType: string | undefined;
          let lastMemberType: string | undefined;
          let lastMemberIsArray = false; // Track if last accessed member is an array
          let _lastMemberStructType: string | undefined; // Struct type containing the last member (kept for future use)
          const firstTypeInfo = this.context.typeRegistry.get(firstId);
          if (firstTypeInfo) {
            currentStructType = this.isKnownStruct(firstTypeInfo.baseType)
              ? firstTypeInfo.baseType
              : undefined;
          }

          let i = 1;
          while (i < memberAccessCtx.children.length) {
            const child = memberAccessCtx.children[i];
            const childText = child.getText();

            if (childText === ".") {
              // Dot found - consume it, then get the next identifier
              i++;
              if (
                i < memberAccessCtx.children.length &&
                idIndex < identifiers.length
              ) {
                const memberName = identifiers[idIndex].getText();
                // Use underscore for first join if cross-scope, dot otherwise
                const separator = isCrossScope && idIndex === 1 ? "_" : ".";
                result += `${separator}${memberName}`;
                idIndex++;

                // Update type tracking for the member we just accessed
                if (currentStructType) {
                  const fields =
                    this.symbols!.structFields.get(currentStructType);
                  lastMemberType = fields?.get(memberName);
                  _lastMemberStructType = currentStructType;
                  // Check if this member is an array field
                  const arrayFields =
                    this.symbols!.structFieldArrays.get(currentStructType);
                  lastMemberIsArray = arrayFields?.has(memberName) ?? false;
                  // Check if this member is itself a struct
                  if (lastMemberType && this.isKnownStruct(lastMemberType)) {
                    currentStructType = lastMemberType;
                  } else {
                    currentStructType = undefined;
                  }
                }
              }
            } else if (childText === "[") {
              // Opening bracket - check if this is bit access on primitive integer
              // Must NOT be an array field (e.g., indices[12] is array, not bit access)
              const isPrimitiveInt =
                lastMemberType &&
                !lastMemberIsArray &&
                ["u8", "u16", "u32", "u64", "i8", "i16", "i32", "i64"].includes(
                  lastMemberType,
                );
              const isLastExpr = exprIndex === exprs.length - 1;

              if (isPrimitiveInt && isLastExpr && exprIndex < exprs.length) {
                // Bug #8: This is bit access on a struct member!
                // e.g., items[0].byte[7] <- true
                // Generate: result = (result & ~(1 << bitIndex)) | ((value ? 1 : 0) << bitIndex)
                if (isCompound) {
                  throw new Error(
                    `Compound assignment operators not supported for bit field access: ${cnextOp}`,
                  );
                }
                const bitIndex = this.generateExpression(exprs[exprIndex]);
                // Use 1ULL for 64-bit types to avoid undefined behavior on large shifts
                const one =
                  lastMemberType === "u64" || lastMemberType === "i64"
                    ? "1ULL"
                    : "1";
                return `${result} = (${result} & ~(${one} << ${bitIndex})) | ((${value} ? ${one} : 0) << ${bitIndex});`;
              }

              // Normal array subscript
              if (exprIndex < exprs.length) {
                const expr = this.generateExpression(exprs[exprIndex]);
                result += `[${expr}]`;
                exprIndex++;

                // After subscripting an array, update type tracking
                if (firstTypeInfo?.isArray && exprIndex === 1) {
                  // First subscript on array - element type might be a struct
                  const elementType = firstTypeInfo.baseType;
                  if (this.isKnownStruct(elementType)) {
                    currentStructType = elementType;
                  }
                }
              }
              // Skip forward to find and pass the closing bracket
              while (
                i < memberAccessCtx.children.length &&
                memberAccessCtx.children[i].getText() !== "]"
              ) {
                i++;
              }
              // Reset lastMemberType after subscript (no longer on a member)
              lastMemberType = undefined;
            }
            i++;
          }

          // Check if this is a string array element assignment before returning
          // Pattern: struct.field[index] where field is a string array
          if (identifiers.length === 2 && exprs.length === 1) {
            const structName = firstId;
            const fieldName = identifiers[1].getText();

            const structTypeInfo = this.context.typeRegistry.get(structName);
            if (structTypeInfo && this.isKnownStruct(structTypeInfo.baseType)) {
              const structType = structTypeInfo.baseType;
              const fieldDimensions =
                this.symbols!.structFieldDimensions.get(structType);
              const dimensions = fieldDimensions?.get(fieldName);
              const fieldArrays =
                this.symbols!.structFieldArrays.get(structType);
              const isArrayField = fieldArrays?.has(fieldName);
              const structFields = this.symbols!.structFields.get(structType);
              const fieldType = structFields?.get(fieldName);

              // String arrays: field type starts with "string<" and has multi-dimensional array
              if (
                fieldType &&
                fieldType.startsWith("string<") &&
                isArrayField &&
                dimensions &&
                dimensions.length > 1
              ) {
                const capacity = dimensions[dimensions.length - 1] - 1; // -1 because we added +1 for null terminator
                if (cOp !== "=") {
                  throw new Error(
                    `Error: Compound operators not supported for string array assignment: ${cnextOp}`,
                  );
                }
                this.needsString = true; // Ensure #include <string.h>
                const index = this.generateExpression(exprs[0]);
                return `strncpy(${structName}.${fieldName}[${index}], ${value}, ${capacity});`;
              }
            }
          }

          return `${result} ${cOp} ${value};`;
        }

        // Fallback for simple cases (shouldn't normally reach here)
        const indices = exprs.map((e) => this.generateExpression(e)).join("][");
        return `${firstId}[${indices}] ${cOp} ${value};`;
      }

      // Register access with bit indexing (e.g., GPIO7.DR_SET[LED_BIT] or Scope.GPIO7.DR_SET[LED_BIT])
      if (identifiers.length >= 2 && exprs.length > 0) {
        // Compound operators not supported for bit field access
        if (isCompound) {
          throw new Error(
            `Compound assignment operators not supported for bit field access: ${cnextOp}`,
          );
        }

        // Determine if this is a scoped register access
        // Pattern 1: GPIO7.DR_SET[bit] - 2 identifiers, first is register
        // Pattern 2: Scope.GPIO7.DR_SET[bit] - 3 identifiers, first is scope
        let fullName: string;
        const leadingId = identifiers[0].getText();
        if (
          this.symbols!.knownScopes.has(leadingId) &&
          identifiers.length >= 3
        ) {
          // Scoped register: Scope.Register.Member
          const scopeName = leadingId;
          const regName = identifiers[1].getText();
          const memberName = identifiers[2].getText();
          fullName = `${scopeName}_${regName}_${memberName}`;
        } else {
          // Non-scoped register: Register.Member
          const regName = firstId;
          const memberName = identifiers[1].getText();
          fullName = `${regName}_${memberName}`;
        }

        // Check if this is a write-only register
        const accessMod = this.symbols!.registerMemberAccess.get(fullName);
        const isWriteOnly =
          accessMod === "wo" || accessMod === "w1s" || accessMod === "w1c";

        if (exprs.length === 1) {
          const bitIndex = this.generateExpression(exprs[0]);
          if (isWriteOnly) {
            // Write-only: assigning false/0 is semantically meaningless
            if (value === "false" || value === "0") {
              throw new Error(
                `Cannot assign false to write-only register bit ${fullName}[${bitIndex}]. ` +
                  `Use the corresponding CLEAR register to clear bits.`,
              );
            }
            // Write-only: just write the mask, no read-modify-write needed
            // GPIO7.DR_SET[LED_BIT] <- true  =>  GPIO7_DR_SET = (1 << LED_BIT)
            return `${fullName} = (1 << ${bitIndex});`;
          } else {
            // Read-write: need read-modify-write
            return `${fullName} = (${fullName} & ~(1 << ${bitIndex})) | ((${value} ? 1 : 0) << ${bitIndex});`;
          }
        } else if (exprs.length === 2) {
          const start = this.generateExpression(exprs[0]);
          const width = this.generateExpression(exprs[1]);
          const mask = this.generateBitMask(width);
          if (isWriteOnly) {
            // Write-only: assigning 0 is semantically meaningless
            if (value === "0") {
              throw new Error(
                `Cannot assign 0 to write-only register bits ${fullName}[${start}, ${width}]. ` +
                  `Use the corresponding CLEAR register to clear bits.`,
              );
            }
            // Write-only: just write the value shifted to position
            return `${fullName} = ((${value} & ${mask}) << ${start});`;
          } else {
            // Read-write: need read-modify-write
            return `${fullName} = (${fullName} & ~(${mask} << ${start})) | ((${value} & ${mask}) << ${start});`;
          }
        }
      }
    }

    // ADR-016: Check if this is a global array access (e.g., global.GPIO7.DR_SET[LED_BIT])
    const globalArrayAccessCtx = targetCtx.globalArrayAccess();
    if (globalArrayAccessCtx) {
      const identifiers = globalArrayAccessCtx.IDENTIFIER();
      const parts = identifiers.map((id) => id.getText());
      const expr = globalArrayAccessCtx.expression();
      const indexExpr = this.generateExpression(expr);
      const firstId = parts[0];

      if (this.symbols!.knownRegisters.has(firstId)) {
        // Compound operators not supported for bit field access on registers
        if (isCompound) {
          throw new Error(
            `Compound assignment operators not supported for bit field access: ${cnextOp}`,
          );
        }
        const bitIndex = indexExpr;
        // This is a register access: global.GPIO7.DR_SET[LED_BIT]
        const regName = parts.join("_");

        // Check if this is a write-only register
        const accessMod = this.symbols!.registerMemberAccess.get(regName);
        const isWriteOnly =
          accessMod === "wo" || accessMod === "w1s" || accessMod === "w1c";

        if (isWriteOnly) {
          // Write-only: assigning false/0 is semantically meaningless
          if (value === "false" || value === "0") {
            throw new Error(
              `Cannot assign false to write-only register bit ${regName}[${bitIndex}]. ` +
                `Use the corresponding CLEAR register to clear bits.`,
            );
          }
          // Write-only: just write the mask, no read-modify-write needed
          // global.GPIO7.DR_SET[LED_BIT] <- true  =>  GPIO7_DR_SET = (1 << LED_BIT)
          return `${regName} = (1 << ${bitIndex});`;
        } else {
          // Read-write: need read-modify-write
          return `${regName} = (${regName} & ~(1 << ${bitIndex})) | ((${value} ? 1 : 0) << ${bitIndex});`;
        }
      } else if (this.symbols!.knownScopes.has(firstId)) {
        // Scope member array access: global.Counter.data[0] -> Counter_data[0]
        const scopedName = parts.join("_");
        return `${scopedName}[${indexExpr}] ${cOp} ${value};`;
      } else {
        // Non-register, non-scope global array access - normal array indexing
        if (parts.length === 1) {
          return `${parts[0]}[${indexExpr}] ${cOp} ${value};`;
        }
        return `${parts[0]}.${parts.slice(1).join(".")}[${indexExpr}] ${cOp} ${value};`;
      }
    }

    // ADR-016: Check if this is a this array access (e.g., this.GPIO7.DR_SET[LED_BIT])
    const thisArrayAccessCtx = targetCtx.thisArrayAccess();
    if (thisArrayAccessCtx) {
      if (!this.context.currentScope) {
        throw new Error("Error: 'this' can only be used inside a scope");
      }

      const identifiers = thisArrayAccessCtx.IDENTIFIER();
      const parts = identifiers.map((id) => id.getText());
      const expressions = thisArrayAccessCtx.expression();
      const scopeName = this.context.currentScope;

      // Check if first identifier is a scoped register
      const scopedRegName = `${scopeName}_${parts[0]}`;
      if (this.symbols!.knownRegisters.has(scopedRegName)) {
        // Compound operators not supported for bit field access on registers
        if (isCompound) {
          throw new Error(
            `Compound assignment operators not supported for bit field access: ${cnextOp}`,
          );
        }
        // This is a scoped register access: this.GPIO7.DR_SET[LED_BIT]
        const regName = `${scopeName}_${parts.join("_")}`;

        // Check if this is a write-only register
        const accessMod = this.symbols!.registerMemberAccess.get(regName);
        const isWriteOnly =
          accessMod === "wo" || accessMod === "w1s" || accessMod === "w1c";

        if (expressions.length === 2) {
          // Multi-bit field access: this.GPIO7.ICR1[6, 2] <- value
          const start = this.generateExpression(expressions[0]);
          const width = this.generateExpression(expressions[1]);
          const mask = `((1U << ${width}) - 1)`;

          if (isWriteOnly) {
            // Write-only: assigning 0 is semantically meaningless for multi-bit
            if (value === "0") {
              throw new Error(
                `Cannot assign 0 to write-only register bits ${regName}[${start}, ${width}]. ` +
                  `Use the corresponding CLEAR register to clear bits.`,
              );
            }
            // Write-only: just write the value shifted to position
            return `${regName} = ((${value} & ${mask}) << ${start});`;
          } else {
            // Read-write: need read-modify-write
            return `${regName} = (${regName} & ~(${mask} << ${start})) | ((${value} & ${mask}) << ${start});`;
          }
        } else {
          // Single bit access: this.GPIO7.DR_SET[LED_BIT] <- true
          const bitIndex = this.generateExpression(expressions[0]);

          if (isWriteOnly) {
            // Write-only: assigning false/0 is semantically meaningless
            if (value === "false" || value === "0") {
              throw new Error(
                `Cannot assign false to write-only register bit ${regName}[${bitIndex}]. ` +
                  `Use the corresponding CLEAR register to clear bits.`,
              );
            }
            // Write-only: just write the mask, no read-modify-write needed
            return `${regName} = (1 << ${bitIndex});`;
          } else {
            // Read-write: need read-modify-write
            return `${regName} = (${regName} & ~(1 << ${bitIndex})) | ((${value} ? 1 : 0) << ${bitIndex});`;
          }
        }
      } else {
        // Non-register scoped array access
        const expr = this.generateExpression(expressions[0]);
        if (parts.length === 1) {
          return `${scopeName}_${parts[0]}[${expr}] ${cOp} ${value};`;
        }
        return `${scopeName}_${parts[0]}.${parts.slice(1).join(".")}[${expr}] ${cOp} ${value};`;
      }
    }

    // ADR-034: Check if this is a thisMemberAccess bitmap field assignment (e.g., this.SysTick.CTRL.ENABLE <- true)
    const thisMemberAccessCtx = targetCtx.thisMemberAccess();
    if (thisMemberAccessCtx) {
      if (!this.context.currentScope) {
        throw new Error("Error: 'this' can only be used inside a scope");
      }

      const identifiers = thisMemberAccessCtx.IDENTIFIER();
      const parts = identifiers.map((id) => id.getText());
      const scopeName = this.context.currentScope;

      // Check for scoped register member bitmap field: this.SysTick.CTRL.ENABLE (3 parts)
      if (parts.length === 3) {
        const regName = parts[0];
        const memberName = parts[1];
        const fieldName = parts[2];

        const scopedRegName = `${scopeName}_${regName}`;
        if (this.symbols!.knownRegisters.has(scopedRegName)) {
          const fullRegMember = `${scopedRegName}_${memberName}`;
          const bitmapType =
            this.symbols!.registerMemberTypes.get(fullRegMember);

          if (bitmapType) {
            // This is a bitmap field access on a scoped register member
            if (isCompound) {
              throw new Error(
                `Compound assignment operators not supported for bitmap field access: ${cnextOp}`,
              );
            }

            const fields = this.symbols!.bitmapFields.get(bitmapType);
            if (fields && fields.has(fieldName)) {
              const fieldInfo = fields.get(fieldName)!;

              // Validate compile-time literal overflow
              this.typeValidator!.validateBitmapFieldLiteral(
                ctx.expression(),
                fieldInfo.width,
                fieldName,
              );

              const mask = (1 << fieldInfo.width) - 1;
              const maskHex = `0x${mask.toString(16).toUpperCase()}`;

              // Check if this is a write-only register
              const accessMod =
                this.symbols!.registerMemberAccess.get(fullRegMember);
              const isWriteOnly =
                accessMod === "wo" ||
                accessMod === "w1s" ||
                accessMod === "w1c";

              if (isWriteOnly) {
                // Write-only register: just write the value, no RMW needed
                if (fieldInfo.width === 1) {
                  return `${fullRegMember} = ((${value} ? 1 : 0) << ${fieldInfo.offset});`;
                } else {
                  return `${fullRegMember} = ((${value} & ${maskHex}) << ${fieldInfo.offset});`;
                }
              } else {
                // Read-write register: use read-modify-write pattern
                if (fieldInfo.width === 1) {
                  return `${fullRegMember} = (${fullRegMember} & ~(1 << ${fieldInfo.offset})) | ((${value} ? 1 : 0) << ${fieldInfo.offset});`;
                } else {
                  return `${fullRegMember} = (${fullRegMember} & ~(${maskHex} << ${fieldInfo.offset})) | ((${value} & ${maskHex}) << ${fieldInfo.offset});`;
                }
              }
            } else {
              throw new Error(
                `Error: Unknown bitmap field '${fieldName}' on type '${bitmapType}'`,
              );
            }
          }
        }
      }
    }

    // Check if this is a simple array/bit access assignment (e.g., flags[3])
    const arrayAccessCtx = targetCtx.arrayAccess();
    if (arrayAccessCtx) {
      const name = arrayAccessCtx.IDENTIFIER().getText();
      const exprs = arrayAccessCtx.expression();
      const typeInfo = this.context.typeRegistry.get(name);

      // ADR-040: ISR arrays use normal array indexing, not bit manipulation
      // Also handle any array type that isn't an integer scalar
      const isActualArray =
        typeInfo?.isArray &&
        typeInfo.arrayDimensions &&
        typeInfo.arrayDimensions.length > 0;
      const isISRType = typeInfo?.baseType === "ISR";

      if (isActualArray || isISRType) {
        // Check for slice assignment: array[offset, length] <- value
        if (exprs.length === 2) {
          // Slice assignment - generate memcpy with bounds checking
          const offset = this.generateExpression(exprs[0]);
          const length = this.generateExpression(exprs[1]);

          // Compound operators not supported for slice assignment
          if (cOp !== "=") {
            throw new Error(
              `Compound assignment operators not supported for slice assignment: ${cnextOp}`,
            );
          }

          // Set flag to include string.h for memcpy
          this.needsString = true;

          // Generate bounds-checked memcpy
          // if (offset + length <= sizeof(buffer)) { memcpy(&buffer[offset], &value, length); }
          return `if (${offset} + ${length} <= sizeof(${name})) { memcpy(&${name}[${offset}], &${value}, ${length}); }`;
        }

        // Normal array element assignment (single index)
        const index = this.generateExpression(exprs[0]);

        // Check if this is a string array (e.g., string<64> arr[4])
        // String arrays need strncpy, not direct assignment
        if (
          typeInfo?.isString &&
          typeInfo.arrayDimensions &&
          typeInfo.arrayDimensions.length > 1
        ) {
          // This is a string array (multi-dimensional: [array_size, string_capacity])
          // arr[0] <- "value" should generate: strncpy(arr[index], value, capacity);
          const capacity = typeInfo.stringCapacity;
          if (!capacity) {
            throw new Error(
              `Error: String array ${name} missing capacity information`,
            );
          }
          if (cOp !== "=") {
            throw new Error(
              `Error: Compound operators not supported for string array assignment: ${cnextOp}`,
            );
          }
          this.needsString = true; // Ensure #include <string.h>
          return `strncpy(${name}[${index}], ${value}, ${capacity});`;
        }

        return `${name}[${index}] ${cOp} ${value};`;
      }

      // Bit manipulation for scalar integer types
      // Compound operators not supported for bit field access
      if (isCompound) {
        throw new Error(
          `Compound assignment operators not supported for bit field access: ${cnextOp}`,
        );
      }

      if (exprs.length === 1) {
        // Single bit assignment: flags[3] <- true
        const bitIndex = this.generateExpression(exprs[0]);
        // Generate: name = (name & ~(1 << index)) | ((value ? 1 : 0) << index)
        return `${name} = (${name} & ~(1 << ${bitIndex})) | ((${value} ? 1 : 0) << ${bitIndex});`;
      } else if (exprs.length === 2) {
        // Bit range assignment: flags[0, 3] <- 5
        const start = this.generateExpression(exprs[0]);
        const width = this.generateExpression(exprs[1]);
        // Generate: name = (name & ~(mask << start)) | ((value & mask) << start)
        const mask = this.generateBitMask(width);
        return `${name} = (${name} & ~(${mask} << ${start})) | ((${value} & ${mask}) << ${start});`;
      }
    }

    // Bug #8: Handle bit assignment on multi-dimensional array elements
    // e.g., matrix[ROW][COL][FIELD_BIT] <- false
    // where matrix is u8[4][4] and FIELD_BIT is a bit index on the u8 element
    if (targetCtx.memberAccess()) {
      const memberAccessCtx = targetCtx.memberAccess()!;
      const identifiers = memberAccessCtx.IDENTIFIER();
      const exprs = memberAccessCtx.expression();

      // Check if first identifier is an array with known dimensions
      if (identifiers.length === 1 && exprs.length > 0) {
        const arrayName = identifiers[0].getText();
        const typeInfo = this.context.typeRegistry.get(arrayName);

        if (typeInfo?.isArray && typeInfo.arrayDimensions) {
          const numDims = typeInfo.arrayDimensions.length;
          const numSubscripts = exprs.length;

          // If we have more subscripts than dimensions, the extra one is a bit index
          if (numSubscripts === numDims + 1) {
            const elementType = typeInfo.baseType;
            const isPrimitiveInt = [
              "u8",
              "u16",
              "u32",
              "u64",
              "i8",
              "i16",
              "i32",
              "i64",
            ].includes(elementType);

            if (isPrimitiveInt) {
              // Compound operators not supported for bit field access
              if (isCompound) {
                throw new Error(
                  `Compound assignment operators not supported for bit field access: ${cnextOp}`,
                );
              }

              // Generate array access for dimensions, then bit assignment
              const arrayIndices = exprs
                .slice(0, numDims)
                .map((e) => `[${this.generateExpression(e)}]`)
                .join("");
              const bitIndex = this.generateExpression(exprs[numDims]);
              const arrayElement = `${arrayName}${arrayIndices}`;

              // Generate: arr[i][j] = (arr[i][j] & ~(1 << bitIndex)) | ((value ? 1 : 0) << bitIndex)
              return `${arrayElement} = (${arrayElement} & ~(1 << ${bitIndex})) | ((${value} ? 1 : 0) << ${bitIndex});`;
            }
          }
        }
      }
    }

    // Normal assignment (simple or compound)
    const target = this.generateAssignmentTarget(targetCtx);

    // ADR-049: Handle atomic compound assignments with LDREX/STREX or PRIMASK
    if (isCompound && targetCtx.IDENTIFIER()) {
      const id = targetCtx.IDENTIFIER()!.getText();
      const typeInfo = this.context.typeRegistry.get(id);

      if (typeInfo?.isAtomic) {
        return this.generateAtomicRMW(target, cOp, value, typeInfo);
      }
    }

    // ADR-044: Handle compound assignments with overflow behavior (non-atomic)
    if (isCompound && targetCtx.IDENTIFIER()) {
      const id = targetCtx.IDENTIFIER()!.getText();
      const typeInfo = this.context.typeRegistry.get(id);

      if (
        typeInfo &&
        typeInfo.overflowBehavior === "clamp" &&
        TYPE_WIDTH[typeInfo.baseType] &&
        !typeInfo.baseType.startsWith("f") // Floats use native C arithmetic (overflow to infinity)
      ) {
        // Clamp behavior: use helper function (integers only)
        const opMap: Record<string, string> = {
          "+=": "add",
          "-=": "sub",
          "*=": "mul",
        };
        const helperOp = opMap[cOp];

        if (helperOp) {
          this.markClampOpUsed(helperOp, typeInfo.baseType);
          return `${target} = cnx_clamp_${helperOp}_${typeInfo.baseType}(${target}, ${value});`;
        }
      }
      // Wrap behavior or non-integer: use natural C arithmetic (fall through)
    }

    // ADR-044: Handle compound assignments with overflow behavior for this.member access
    if (isCompound && targetCtx.thisAccess() && this.context.currentScope) {
      const memberName = targetCtx.thisAccess()!.IDENTIFIER().getText();
      const scopedName = `${this.context.currentScope}_${memberName}`;
      const typeInfo = this.context.typeRegistry.get(scopedName);

      if (
        typeInfo &&
        typeInfo.overflowBehavior === "clamp" &&
        TYPE_WIDTH[typeInfo.baseType] &&
        !typeInfo.baseType.startsWith("f") // Floats use native C arithmetic
      ) {
        // Clamp behavior: use helper function (integers only)
        const opMap: Record<string, string> = {
          "+=": "add",
          "-=": "sub",
          "*=": "mul",
        };
        const helperOp = opMap[cOp];

        if (helperOp) {
          this.markClampOpUsed(helperOp, typeInfo.baseType);
          return `${target} = cnx_clamp_${helperOp}_${typeInfo.baseType}(${target}, ${value});`;
        }
      }
      // Wrap behavior or non-integer: use natural C arithmetic (fall through)
    }

    // Check for struct member string array assignment: struct.arr[0] <- "value"
    if (targetCtx.memberAccess()) {
      const structMemberAccessCtx = targetCtx.memberAccess()!;
      const identifiers = structMemberAccessCtx.IDENTIFIER();
      const exprs = structMemberAccessCtx.expression();

      // Pattern: struct.field[index] (2 identifiers, 1 expression)
      if (identifiers.length === 2 && exprs.length === 1) {
        const structName = identifiers[0].getText();
        const fieldName = identifiers[1].getText();

        const structTypeInfo = this.context.typeRegistry.get(structName);
        if (structTypeInfo && this.isKnownStruct(structTypeInfo.baseType)) {
          const structType = structTypeInfo.baseType;

          // Check if this field is a string array in the struct
          const fieldDimensions =
            this.symbols!.structFieldDimensions.get(structType);
          const dimensions = fieldDimensions?.get(fieldName);
          const fieldArrays = this.symbols!.structFieldArrays.get(structType);
          const isArrayField = fieldArrays?.has(fieldName);

          // Check if field type is string (stored as "string<N>" in C-Next)
          const structFields = this.symbols!.structFields.get(structType);
          const fieldType = structFields?.get(fieldName);

          // String arrays in structs: field type starts with "string<" and has multi-dimensional array
          if (
            fieldType &&
            fieldType.startsWith("string<") &&
            isArrayField &&
            dimensions &&
            dimensions.length > 1
          ) {
            // This is a string array: dimensions are [array_size, string_capacity]
            const capacity = dimensions[dimensions.length - 1] - 1; // -1 because we added +1 for null terminator

            if (cOp !== "=") {
              throw new Error(
                `Error: Compound operators not supported for string array assignment: ${cnextOp}`,
              );
            }
            this.needsString = true; // Ensure #include <string.h>
            const index = this.generateExpression(exprs[0]);
            return `strncpy(${structName}.${fieldName}[${index}], ${value}, ${capacity});`;
          }
        }
      }
    }

    // Issue #139: Handle simple string variable assignment
    // Pattern: identifier <- stringValue (where identifier is a string type, not an array)
    if (
      targetCtx.IDENTIFIER() &&
      !targetCtx.memberAccess() &&
      !targetCtx.arrayAccess()
    ) {
      const id = targetCtx.IDENTIFIER()!.getText();
      const typeInfo = this.context.typeRegistry.get(id);

      if (typeInfo?.isString && typeInfo.stringCapacity !== undefined) {
        // String arrays are handled earlier (line ~4969), this handles simple string variables
        // Check that this is not a string array (single dimension = just the capacity)
        if (!typeInfo.arrayDimensions || typeInfo.arrayDimensions.length <= 1) {
          if (cOp !== "=") {
            throw new Error(
              `Error: Compound operators not supported for string assignment: ${cnextOp}`,
            );
          }
          this.needsString = true;
          const capacity = typeInfo.stringCapacity;
          return `strncpy(${target}, ${value}, ${capacity}); ${target}[${capacity}] = '\\0';`;
        }
      }
    }

    // Issue #139: Handle this.member string assignment (ADR-016 scopes)
    if (targetCtx.thisAccess() && this.context.currentScope) {
      const memberName = targetCtx.thisAccess()!.IDENTIFIER().getText();
      const scopedName = `${this.context.currentScope}_${memberName}`;
      const typeInfo = this.context.typeRegistry.get(scopedName);

      if (typeInfo?.isString && typeInfo.stringCapacity !== undefined) {
        if (!typeInfo.arrayDimensions || typeInfo.arrayDimensions.length <= 1) {
          if (cOp !== "=") {
            throw new Error(
              `Error: Compound operators not supported for string assignment: ${cnextOp}`,
            );
          }
          this.needsString = true;
          const capacity = typeInfo.stringCapacity;
          return `strncpy(${target}, ${value}, ${capacity}); ${target}[${capacity}] = '\\0';`;
        }
      }
    }

    // Issue #139: Handle global.member string assignment (ADR-016 global accessor)
    if (targetCtx.globalAccess()) {
      const id = targetCtx.globalAccess()!.IDENTIFIER().getText();
      const typeInfo = this.context.typeRegistry.get(id);

      if (typeInfo?.isString && typeInfo.stringCapacity !== undefined) {
        if (!typeInfo.arrayDimensions || typeInfo.arrayDimensions.length <= 1) {
          if (cOp !== "=") {
            throw new Error(
              `Error: Compound operators not supported for string assignment: ${cnextOp}`,
            );
          }
          this.needsString = true;
          const capacity = typeInfo.stringCapacity;
          return `strncpy(${target}, ${value}, ${capacity}); ${target}[${capacity}] = '\\0';`;
        }
      }
    }

    // Issue #139: Handle struct.field string assignment (non-array string field)
    if (targetCtx.memberAccess()) {
      const memberAccessCtx = targetCtx.memberAccess()!;
      const identifiers = memberAccessCtx.IDENTIFIER();
      const exprs = memberAccessCtx.expression();

      // Pattern: struct.field (2 identifiers, 0 expressions) - non-array member
      if (identifiers.length === 2 && exprs.length === 0) {
        const structName = identifiers[0].getText();
        const fieldName = identifiers[1].getText();

        const structTypeInfo = this.context.typeRegistry.get(structName);
        if (structTypeInfo && this.isKnownStruct(structTypeInfo.baseType)) {
          const structType = structTypeInfo.baseType;
          const structFields = this.symbols!.structFields.get(structType);
          const fieldType = structFields?.get(fieldName);

          // Check if field is a string type (non-array)
          if (fieldType && fieldType.startsWith("string<")) {
            const match = fieldType.match(/^string<(\d+)>$/);
            if (match) {
              if (cOp !== "=") {
                throw new Error(
                  `Error: Compound operators not supported for string assignment: ${cnextOp}`,
                );
              }
              const capacity = parseInt(match[1], 10);
              this.needsString = true;
              return `strncpy(${structName}.${fieldName}, ${value}, ${capacity}); ${structName}.${fieldName}[${capacity}] = '\\0';`;
            }
          }
        }
      }
    }

    return `${target} ${cOp} ${value};`;
  }

  /**
   * ADR-049: Generate atomic Read-Modify-Write operation
   * Uses LDREX/STREX on platforms that support it, otherwise PRIMASK
   */
  private generateAtomicRMW(
    target: string,
    cOp: string,
    value: string,
    typeInfo: TTypeInfo,
  ): string {
    const caps = this.context.targetCapabilities;
    const baseType = typeInfo.baseType;

    // Generate the inner operation (handles clamp/wrap)
    const innerOp = this.generateInnerAtomicOp(cOp, value, typeInfo);

    // Use LDREX/STREX if available for this type, otherwise PRIMASK fallback
    if (caps.hasLdrexStrex && LDREX_MAP[baseType]) {
      return this.generateLdrexStrexLoop(target, innerOp, typeInfo);
    } else {
      return this.generatePrimaskWrapper(target, cOp, value, typeInfo);
    }
  }

  /**
   * ADR-049: Generate the inner operation for atomic RMW
   * Handles clamp/wrap behavior for arithmetic operations
   */
  private generateInnerAtomicOp(
    cOp: string,
    value: string,
    typeInfo: TTypeInfo,
  ): string {
    // Map compound operators to simple operators
    const simpleOpMap: Record<string, string> = {
      "+=": "+",
      "-=": "-",
      "*=": "*",
      "/=": "/",
      "%=": "%",
      "&=": "&",
      "|=": "|",
      "^=": "^",
      "<<=": "<<",
      ">>=": ">>",
    };
    const simpleOp = simpleOpMap[cOp] || "+";

    // Handle clamp behavior for arithmetic operations (integers only)
    if (
      typeInfo.overflowBehavior === "clamp" &&
      TYPE_WIDTH[typeInfo.baseType] &&
      !typeInfo.baseType.startsWith("f") // Floats use native C arithmetic
    ) {
      const opMap: Record<string, string> = {
        "+=": "add",
        "-=": "sub",
        "*=": "mul",
      };
      const helperOp = opMap[cOp];

      if (helperOp) {
        this.markClampOpUsed(helperOp, typeInfo.baseType);
        return `cnx_clamp_${helperOp}_${typeInfo.baseType}(__old, ${value})`;
      }
    }

    // For wrap behavior, floats, or non-clamp ops, use natural arithmetic
    return `__old ${simpleOp} ${value}`;
  }

  /**
   * ADR-049: Generate LDREX/STREX retry loop for atomic RMW
   * Uses ARM exclusive access instructions for lock-free atomics
   */
  private generateLdrexStrexLoop(
    target: string,
    innerOp: string,
    typeInfo: TTypeInfo,
  ): string {
    const ldrex = LDREX_MAP[typeInfo.baseType];
    const strex = STREX_MAP[typeInfo.baseType];
    const cType = TYPE_MAP[typeInfo.baseType];

    // Mark that we need CMSIS headers
    this.needsCMSIS = true;

    // Generate LDREX/STREX retry loop
    // Uses do-while because we always need at least one attempt
    return `do {
    ${cType} __old = ${ldrex}(&${target});
    ${cType} __new = ${innerOp};
    if (${strex}(__new, &${target}) == 0) break;
} while (1);`;
  }

  /**
   * ADR-049: Generate PRIMASK-based atomic wrapper
   * Disables all interrupts during the RMW operation
   */
  private generatePrimaskWrapper(
    target: string,
    cOp: string,
    value: string,
    typeInfo: TTypeInfo,
  ): string {
    // Mark that we need CMSIS headers
    this.needsCMSIS = true;

    // Generate the actual assignment operation inside the critical section
    let assignment: string;

    // Handle clamp behavior (integers only)
    if (
      typeInfo.overflowBehavior === "clamp" &&
      TYPE_WIDTH[typeInfo.baseType] &&
      !typeInfo.baseType.startsWith("f") // Floats use native C arithmetic
    ) {
      const opMap: Record<string, string> = {
        "+=": "add",
        "-=": "sub",
        "*=": "mul",
      };
      const helperOp = opMap[cOp];

      if (helperOp) {
        this.markClampOpUsed(helperOp, typeInfo.baseType);
        assignment = `${target} = cnx_clamp_${helperOp}_${typeInfo.baseType}(${target}, ${value});`;
      } else {
        assignment = `${target} ${cOp} ${value};`;
      }
    } else {
      assignment = `${target} ${cOp} ${value};`;
    }

    // Generate PRIMASK save/restore wrapper
    return `{
    uint32_t __primask = __get_PRIMASK();
    __disable_irq();
    ${assignment}
    __set_PRIMASK(__primask);
}`;
  }

  private generateAssignmentTarget(
    ctx: Parser.AssignmentTargetContext,
  ): string {
    // Set flag to indicate we're generating an assignment target (write context)
    this.inAssignmentTarget = true;
    try {
      return this.doGenerateAssignmentTarget(ctx);
    } finally {
      this.inAssignmentTarget = false;
    }
  }

  private doGenerateAssignmentTarget(
    ctx: Parser.AssignmentTargetContext,
  ): string {
    // ADR-016: Handle global.arr[i] or global.GPIO7.DR_SET[i] access
    if (ctx.globalArrayAccess()) {
      return this.generateGlobalArrayAccess(ctx.globalArrayAccess()!);
    }

    // ADR-016: Handle global.GPIO7.DR_SET access (member chain)
    if (ctx.globalMemberAccess()) {
      return this.generateGlobalMemberAccess(ctx.globalMemberAccess()!);
    }

    // ADR-016: Handle global.value access (simple)
    if (ctx.globalAccess()) {
      return ctx.globalAccess()!.IDENTIFIER().getText();
    }

    // ADR-016: Handle this.GPIO7.DR_SET[idx] access for scope-local array/bit assignment
    if (ctx.thisArrayAccess()) {
      return this.generateThisArrayAccess(ctx.thisArrayAccess()!);
    }

    // ADR-016: Handle this.GPIO7.DR_SET access for scope-local member chain assignment
    if (ctx.thisMemberAccess()) {
      return this.generateThisMemberAccess(ctx.thisMemberAccess()!);
    }

    // ADR-016: Handle this.member access for scope-local assignment
    if (ctx.thisAccess()) {
      const memberName = ctx.thisAccess()!.IDENTIFIER().getText();
      if (!this.context.currentScope) {
        throw new Error("Error: 'this' can only be used inside a scope");
      }
      return `${this.context.currentScope}_${memberName}`;
    }
    if (ctx.memberAccess()) {
      return this.generateMemberAccess(ctx.memberAccess()!);
    }
    if (ctx.arrayAccess()) {
      return this.generateArrayAccess(ctx.arrayAccess()!);
    }

    const id = ctx.IDENTIFIER()!.getText();

    // ADR-006: Check if it's a function parameter
    const paramInfo = this.context.currentParameters.get(id);
    if (paramInfo) {
      // ADR-029: Callback parameters don't need dereferencing (they're function pointers)
      if (paramInfo.isCallback) {
        return id;
      }
      // Float types use pass-by-value, no dereference needed
      if (this.isFloatType(paramInfo.baseType)) {
        return id;
      }
      // Enum types use pass-by-value, no dereference needed
      if (this.symbols!.knownEnums.has(paramInfo.baseType)) {
        return id;
      }
      // Parameter - allowed as bare identifier, but needs dereference
      if (!paramInfo.isArray) {
        return `(*${id})`;
      }
      return id;
    }

    // Check if it's a local variable
    const isLocalVariable = this.context.localVariables.has(id);

    // ADR-016: Enforce explicit qualification inside scopes
    // Bare identifiers are ONLY allowed for local variables and parameters
    this.typeValidator!.validateBareIdentifierInScope(
      id,
      isLocalVariable,
      (name: string) => this.isKnownStruct(name),
    );

    return id;
  }

  // ADR-016: Generate global member access for assignment targets
  private generateGlobalMemberAccess(
    ctx: Parser.GlobalMemberAccessContext,
  ): string {
    const identifiers = ctx.IDENTIFIER();
    const parts = identifiers.map((id) => id.getText());
    const firstId = parts[0];
    // Check if first identifier is a register
    if (this.symbols!.knownRegisters.has(firstId)) {
      // Register member access: GPIO7.DR_SET -> GPIO7_DR_SET
      return parts.join("_");
    }
    // Check if first identifier is a scope
    if (this.symbols!.knownScopes.has(firstId)) {
      // Scope member access: global.Counter.value -> Counter_value
      return parts.join("_");
    }
    // Non-register, non-scope member access: obj.field
    return parts.join(".");
  }

  // ADR-016: Generate global array access for assignment targets
  private generateGlobalArrayAccess(
    ctx: Parser.GlobalArrayAccessContext,
  ): string {
    const identifiers = ctx.IDENTIFIER();
    const parts = identifiers.map((id) => id.getText());
    const expr = this.generateExpression(ctx.expression());
    const firstId = parts[0];

    if (this.symbols!.knownRegisters.has(firstId)) {
      // Register bit access: GPIO7.DR_SET[idx] -> GPIO7_DR_SET |= (1 << idx) (handled elsewhere)
      // For assignment target, just generate the left-hand side representation
      const regName = parts.join("_");
      return `${regName}[${expr}]`;
    }

    // Check if first identifier is a scope
    if (this.symbols!.knownScopes.has(firstId)) {
      // Scope array access: global.Counter.data[0] -> Counter_data[0]
      const scopedName = parts.join("_");
      return `${scopedName}[${expr}]`;
    }

    // Non-register, non-scope array access
    const baseName = parts.join(".");
    return `${baseName}[${expr}]`;
  }

  // ADR-016: Generate this.member.member for scope-local chained member access
  private generateThisMemberAccess(
    ctx: Parser.ThisMemberAccessContext,
  ): string {
    if (!this.context.currentScope) {
      throw new Error("Error: 'this' can only be used inside a scope");
    }
    const identifiers = ctx.IDENTIFIER();
    const parts = identifiers.map((id) => id.getText());
    const scopeName = this.context.currentScope;

    // Check if first identifier is a scoped register: this.GPIO7.DR_SET -> Teensy4_GPIO7_DR_SET
    const scopedRegName = `${scopeName}_${parts[0]}`;
    if (this.symbols!.knownRegisters.has(scopedRegName)) {
      // Scoped register member access: this.GPIO7.DR_SET -> Teensy4_GPIO7_DR_SET
      return `${scopeName}_${parts.join("_")}`;
    }

    // Non-register scoped member access: this.config.value -> Teensy4_config.value
    return `${scopeName}_${parts[0]}.${parts.slice(1).join(".")}`;
  }

  // ADR-016: Generate this.member[idx] or this.member.member[idx] for scope-local array/bit access
  private generateThisArrayAccess(ctx: Parser.ThisArrayAccessContext): string {
    if (!this.context.currentScope) {
      throw new Error("Error: 'this' can only be used inside a scope");
    }
    const identifiers = ctx.IDENTIFIER();
    const parts = identifiers.map((id) => id.getText());
    const expressions = ctx.expression();
    const scopeName = this.context.currentScope;

    // Check if first identifier is a scoped register
    const scopedRegName = `${scopeName}_${parts[0]}`;
    if (this.symbols!.knownRegisters.has(scopedRegName)) {
      // Scoped register bit access: this.GPIO7.DR_SET[idx] -> Teensy4_GPIO7_DR_SET[idx]
      const regName = `${scopeName}_${parts.join("_")}`;

      // Check if this register member has a bitmap type
      const bitmapType = this.symbols!.registerMemberTypes.get(regName);
      if (bitmapType) {
        const line = ctx.start?.line ?? 0;
        throw new Error(
          `Error at line ${line}: Cannot use bracket indexing on bitmap type '${bitmapType}'. ` +
            `Use named field access instead (e.g., ${parts.join(".")}.FIELD_NAME).`,
        );
      }

      if (expressions.length === 2) {
        // Multi-bit field: this.GPIO7.ICR1[6, 2]
        const offset = this.generateExpression(expressions[0]);
        const width = this.generateExpression(expressions[1]);
        return `${regName}[${offset}, ${width}]`;
      } else {
        const expr = this.generateExpression(expressions[0]);
        return `${regName}[${expr}]`;
      }
    }

    // Non-register scoped array access
    const expr = this.generateExpression(expressions[0]);
    if (parts.length === 1) {
      return `${scopeName}_${parts[0]}[${expr}]`;
    }
    return `${scopeName}_${parts[0]}.${parts.slice(1).join(".")}[${expr}]`;
  }

  private generateIf(ctx: Parser.IfStatementContext): string {
    const statements = ctx.statement();

    // Analyze condition and body for repeated .length accesses (strlen optimization)
    const lengthCounts = this.countStringLengthAccesses(ctx.expression());

    // Also count in the then branch if it's a block
    const thenStmt = statements[0];
    if (thenStmt.block()) {
      this.countBlockLengthAccesses(thenStmt.block()!, lengthCounts);
    }

    // Set up cache and generate declarations
    const cacheDecls = this.setupLengthCache(lengthCounts);

    // Generate with cache enabled
    const condition = this.generateExpression(ctx.expression());
    const thenBranch = this.generateStatement(thenStmt);

    let result = `if (${condition}) ${thenBranch}`;

    if (statements.length > 1) {
      const elseBranch = this.generateStatement(statements[1]);
      result += ` else ${elseBranch}`;
    }

    // Clear cache after generating
    this.clearLengthCache();

    // Prepend cache declarations if any
    if (cacheDecls) {
      return cacheDecls + result;
    }

    return result;
  }

  private generateWhile(ctx: Parser.WhileStatementContext): string {
    const condition = this.generateExpression(ctx.expression());
    const body = this.generateStatement(ctx.statement());
    return `while (${condition}) ${body}`;
  }

  // ADR-027: Do-while loops with MISRA-compliant boolean condition
  private generateDoWhile(ctx: Parser.DoWhileStatementContext): string {
    // Validate the condition is a boolean expression (E0701)
    this.typeValidator!.validateDoWhileCondition(ctx.expression());

    const body = this.generateBlock(ctx.block());
    const condition = this.generateExpression(ctx.expression());
    return `do ${body} while (${condition});`;
  }

  private generateFor(ctx: Parser.ForStatementContext): string {
    let init = "";
    const forInit = ctx.forInit();
    if (forInit) {
      if (forInit.forVarDecl()) {
        // Generate variable declaration for for loop init
        init = this.generateForVarDecl(forInit.forVarDecl()!);
      } else if (forInit.forAssignment()) {
        // Generate assignment for for loop init
        init = this.generateForAssignment(forInit.forAssignment()!);
      }
    }

    let condition = "";
    if (ctx.expression()) {
      condition = this.generateExpression(ctx.expression()!);
    }

    let update = "";
    const forUpdate = ctx.forUpdate();
    if (forUpdate) {
      // forUpdate has same structure as forAssignment
      const target = this.generateAssignmentTarget(
        forUpdate.assignmentTarget(),
      );
      const value = this.generateExpression(forUpdate.expression());
      const operatorCtx = forUpdate.assignmentOperator();
      const cnextOp = operatorCtx.getText();
      const cOp = ASSIGNMENT_OPERATOR_MAP[cnextOp] || "=";
      update = `${target} ${cOp} ${value}`;
    }

    const body = this.generateStatement(ctx.statement());

    return `for (${init}; ${condition}; ${update}) ${body}`;
  }

  // Generate variable declaration for for loop init (no trailing semicolon)
  private generateForVarDecl(ctx: Parser.ForVarDeclContext): string {
    const atomicMod = ctx.atomicModifier() ? "volatile " : "";
    const volatileMod = ctx.volatileModifier() ? "volatile " : "";
    const typeName = this.generateType(ctx.type());
    const name = ctx.IDENTIFIER().getText();

    // ADR-016: Track local variables (allowed as bare identifiers inside scopes)
    this.context.localVariables.add(name);

    let result = `${atomicMod}${volatileMod}${typeName} ${name}`;

    // ADR-036: Handle array dimensions (now returns array for multi-dim support)
    const arrayDims = ctx.arrayDimension();
    if (arrayDims.length > 0) {
      result = `${typeName} ${name}${this.generateArrayDimensions(arrayDims)}`;
    }

    // Handle initialization
    if (ctx.expression()) {
      const value = this.generateExpression(ctx.expression()!);
      result += ` = ${value}`;
    }

    return result;
  }

  // Generate assignment for for loop init/update (no trailing semicolon)
  private generateForAssignment(ctx: Parser.ForAssignmentContext): string {
    const target = this.generateAssignmentTarget(ctx.assignmentTarget());
    const value = this.generateExpression(ctx.expression());
    const operatorCtx = ctx.assignmentOperator();
    const cnextOp = operatorCtx.getText();
    const cOp = ASSIGNMENT_OPERATOR_MAP[cnextOp] || "=";
    return `${target} ${cOp} ${value}`;
  }

  private generateReturn(ctx: Parser.ReturnStatementContext): string {
    if (ctx.expression()) {
      return `return ${this.generateExpression(ctx.expression()!)};`;
    }
    return "return;";
  }

  // ========================================================================
  // Critical Statements (ADR-050)
  // ========================================================================

  /**
   * ADR-050: Generate critical statement with PRIMASK wrapper
   * Ensures atomic execution of multi-variable operations
   */
  private generateCriticalStatement(
    ctx: Parser.CriticalStatementContext,
  ): string {
    // Validate no early exits inside critical block
    this.typeValidator!.validateNoEarlyExits(ctx.block());

    // Mark that we need CMSIS headers
    this.needsCMSIS = true;

    // Generate the block contents
    const blockCode = this.generateBlock(ctx.block());

    // Remove outer braces from block since we're wrapping
    const innerCode = blockCode.slice(1, -1).trim();

    // Generate PRIMASK save/restore wrapper
    return `{
    uint32_t __primask = __get_PRIMASK();
    __disable_irq();
    ${innerCode}
    __set_PRIMASK(__primask);
}`;
  }

  // Issue #63: validateNoEarlyExits moved to TypeValidator

  // ========================================================================
  // Switch Statements (ADR-025)
  // ========================================================================

  private generateSwitch(ctx: Parser.SwitchStatementContext): string {
    const switchExpr = ctx.expression();
    const exprCode = this.generateExpression(switchExpr);

    // ADR-025: Semantic validation
    this.typeValidator!.validateSwitchStatement(ctx, switchExpr);

    // Build the switch statement
    const lines: string[] = [`switch (${exprCode}) {`];

    // Generate cases
    for (const caseCtx of ctx.switchCase()) {
      lines.push(this.generateSwitchCase(caseCtx));
    }

    // Generate default if present
    const defaultCtx = ctx.defaultCase();
    if (defaultCtx) {
      lines.push(this.generateDefaultCase(defaultCtx));
    }

    lines.push("}");

    return lines.join("\n");
  }

  private generateSwitchCase(ctx: Parser.SwitchCaseContext): string {
    const labels = ctx.caseLabel();
    const block = ctx.block();
    const lines: string[] = [];

    // Generate case labels - expand || to multiple C case labels
    for (let i = 0; i < labels.length; i++) {
      const labelCode = this.generateCaseLabel(labels[i]);
      if (i < labels.length - 1) {
        // Multiple labels: just the label without body
        lines.push(this.indent(`case ${labelCode}:`));
      } else {
        // Last label: attach the block
        lines.push(this.indent(`case ${labelCode}: {`));
      }
    }

    // Generate block contents (without the outer braces - we added them above)
    const statements = block.statement();
    for (const stmt of statements) {
      const stmtCode = this.generateStatement(stmt);
      if (stmtCode) {
        lines.push(this.indent(this.indent(stmtCode)));
      }
    }

    // Add break and close block
    lines.push(this.indent(this.indent("break;")));
    lines.push(this.indent("}"));

    return lines.join("\n");
  }

  private generateCaseLabel(ctx: Parser.CaseLabelContext): string {
    // qualifiedType - for enum values like EState.IDLE
    if (ctx.qualifiedType()) {
      const qt = ctx.qualifiedType()!;
      // Convert EState.IDLE to EState_IDLE for C
      const parts = qt.IDENTIFIER();
      return parts.map((id) => id.getText()).join("_");
    }

    // IDENTIFIER - const variable or plain enum member
    if (ctx.IDENTIFIER()) {
      return ctx.IDENTIFIER()!.getText();
    }

    // Numeric literals (may have optional minus prefix)
    if (ctx.INTEGER_LITERAL()) {
      const num = ctx.INTEGER_LITERAL()!.getText();
      // Check if minus token exists (first child would be '-')
      const hasNeg = ctx.children && ctx.children[0]?.getText() === "-";
      return hasNeg ? `-${num}` : num;
    }

    if (ctx.HEX_LITERAL()) {
      const hex = ctx.HEX_LITERAL()!.getText();
      // Check if minus token exists (first child would be '-')
      const hasNeg = ctx.children && ctx.children[0]?.getText() === "-";
      return hasNeg ? `-${hex}` : hex;
    }

    if (ctx.BINARY_LITERAL()) {
      // Convert binary to hex for cleaner C output
      // Issue #114: Use BigInt to preserve precision for values > 2^53
      const binText = ctx.BINARY_LITERAL()!.getText();
      // Check if minus token exists (first child would be '-')
      const hasNeg = ctx.children && ctx.children[0]?.getText() === "-";
      const value = BigInt(binText); // BigInt handles 0b prefix natively
      const hexStr = (hasNeg ? -value : value).toString(16).toUpperCase();
      // Add ULL suffix for values that exceed 32-bit range
      const needsULL = value > 0xffffffffn;
      return `${hasNeg ? "-" : ""}0x${hexStr}${needsULL ? "ULL" : ""}`;
    }

    if (ctx.CHAR_LITERAL()) {
      return ctx.CHAR_LITERAL()!.getText();
    }

    return "";
  }

  private generateDefaultCase(ctx: Parser.DefaultCaseContext): string {
    const block = ctx.block();
    const lines: string[] = [];

    // Note: default(n) count is for compile-time validation only,
    // not included in generated C
    lines.push(this.indent("default: {"));

    // Generate block contents
    const statements = block.statement();
    for (const stmt of statements) {
      const stmtCode = this.generateStatement(stmt);
      if (stmtCode) {
        lines.push(this.indent(this.indent(stmtCode)));
      }
    }

    // Add break and close block
    lines.push(this.indent(this.indent("break;")));
    lines.push(this.indent("}"));

    return lines.join("\n");
  }

  // Issue #63: validateSwitchStatement, validateEnumExhaustiveness, getDefaultCount,
  //            getCaseLabelValue moved to TypeValidator

  // Issue #63: validateTernaryCondition, validateNoNestedTernary,
  //            validateDoWhileCondition, isBooleanExpression moved to TypeValidator

  // ========================================================================
  // Expressions
  // ========================================================================

  private generateExpression(ctx: Parser.ExpressionContext): string {
    return this.generateTernaryExpr(ctx.ternaryExpression());
  }

  // ADR-022: Ternary operator with safety constraints
  private generateTernaryExpr(ctx: Parser.TernaryExpressionContext): string {
    const orExprs = ctx.orExpression();

    // Non-ternary path: just one orExpression
    if (orExprs.length === 1) {
      return this.generateOrExpr(orExprs[0]);
    }

    // Ternary path: 3 orExpressions (condition, true branch, false branch)
    const condition = orExprs[0];
    const trueExpr = orExprs[1];
    const falseExpr = orExprs[2];

    // ADR-022: Validate ternary constraints
    this.typeValidator!.validateTernaryCondition(condition);
    this.typeValidator!.validateNoNestedTernary(trueExpr, "true branch");
    this.typeValidator!.validateNoNestedTernary(falseExpr, "false branch");

    // Generate C output - parentheses already present from grammar
    const condCode = this.generateOrExpr(condition);
    const trueCode = this.generateOrExpr(trueExpr);
    const falseCode = this.generateOrExpr(falseExpr);

    return `(${condCode}) ? ${trueCode} : ${falseCode}`;
  }

  private generateOrExpr(ctx: Parser.OrExpressionContext): string {
    const parts = ctx.andExpression().map((e) => this.generateAndExpr(e));
    return parts.join(" || ");
  }

  private generateAndExpr(ctx: Parser.AndExpressionContext): string {
    const parts = ctx
      .equalityExpression()
      .map((e) => this.generateEqualityExpr(e));
    return parts.join(" && ");
  }

  // ADR-001: = becomes == in C
  // ADR-017: Enum type safety validation
  private generateEqualityExpr(ctx: Parser.EqualityExpressionContext): string {
    const exprs = ctx.relationalExpression();
    if (exprs.length === 1) {
      return this.generateRelationalExpr(exprs[0]);
    }

    // ADR-017: Validate enum type safety for comparisons
    if (exprs.length >= 2) {
      const leftEnumType = this.getExpressionEnumType(exprs[0]);
      const rightEnumType = this.getExpressionEnumType(exprs[1]);

      // Check if comparing different enum types
      if (leftEnumType && rightEnumType && leftEnumType !== rightEnumType) {
        throw new Error(
          `Error: Cannot compare ${leftEnumType} enum to ${rightEnumType} enum`,
        );
      }

      // Check if comparing enum to integer
      if (leftEnumType && this.isIntegerExpression(exprs[1])) {
        throw new Error(
          `Error: Cannot compare ${leftEnumType} enum to integer`,
        );
      }
      if (rightEnumType && this.isIntegerExpression(exprs[0])) {
        throw new Error(
          `Error: Cannot compare integer to ${rightEnumType} enum`,
        );
      }

      // ADR-045: Check for string comparison
      const leftIsString = this.isStringExpression(exprs[0]);
      const rightIsString = this.isStringExpression(exprs[1]);

      if (leftIsString || rightIsString) {
        // Generate strcmp for string comparison
        const leftCode = this.generateRelationalExpr(exprs[0]);
        const rightCode = this.generateRelationalExpr(exprs[1]);
        const fullText = ctx.getText();
        const isNotEqual = fullText.includes("!=");
        const cmpOp = isNotEqual ? "!= 0" : "== 0";
        return `strcmp(${leftCode}, ${rightCode}) ${cmpOp}`;
      }
    }

    // Build the expression, transforming = to ==
    // Issue #152: Extract operators in order from parse tree children
    const operators = this.getOperatorsFromChildren(ctx);
    let result = this.generateRelationalExpr(exprs[0]);

    for (let i = 1; i < exprs.length; i++) {
      // ADR-001: C-Next uses = for equality, transpile to ==
      // C-Next uses != for inequality, keep as !=
      const rawOp = operators[i - 1] || "=";
      const op = rawOp === "=" ? "==" : rawOp;
      result += ` ${op} ${this.generateRelationalExpr(exprs[i])}`;
    }

    return result;
  }

  private generateRelationalExpr(
    ctx: Parser.RelationalExpressionContext,
  ): string {
    const exprs = ctx.bitwiseOrExpression();
    if (exprs.length === 1) {
      return this.generateBitwiseOrExpr(exprs[0]);
    }

    // Issue #152: Extract operators in order from parse tree children
    const operators = this.getOperatorsFromChildren(ctx);
    let result = this.generateBitwiseOrExpr(exprs[0]);

    for (let i = 1; i < exprs.length; i++) {
      const op = operators[i - 1] || "<";
      result += ` ${op} ${this.generateBitwiseOrExpr(exprs[i])}`;
    }

    return result;
  }

  private generateBitwiseOrExpr(
    ctx: Parser.BitwiseOrExpressionContext,
  ): string {
    const parts = ctx
      .bitwiseXorExpression()
      .map((e) => this.generateBitwiseXorExpr(e));
    return parts.join(" | ");
  }

  private generateBitwiseXorExpr(
    ctx: Parser.BitwiseXorExpressionContext,
  ): string {
    const parts = ctx
      .bitwiseAndExpression()
      .map((e) => this.generateBitwiseAndExpr(e));
    return parts.join(" ^ ");
  }

  private generateBitwiseAndExpr(
    ctx: Parser.BitwiseAndExpressionContext,
  ): string {
    const parts = ctx.shiftExpression().map((e) => this.generateShiftExpr(e));
    return parts.join(" & ");
  }

  private generateShiftExpr(ctx: Parser.ShiftExpressionContext): string {
    const exprs = ctx.additiveExpression();
    if (exprs.length === 1) {
      return this.generateAdditiveExpr(exprs[0]);
    }

    // Issue #152: Extract operators in order from parse tree children
    const operators = this.getOperatorsFromChildren(ctx);
    let result = this.generateAdditiveExpr(exprs[0]);

    // Get type of left operand for shift validation
    const leftType = this.getAdditiveExpressionType(exprs[0]);

    for (let i = 1; i < exprs.length; i++) {
      const op = operators[i - 1] || "<<";
      const rightExpr = exprs[i];

      // Validate shift amount if we can determine the left operand type
      if (leftType) {
        this.typeValidator!.validateShiftAmount(leftType, rightExpr, op, ctx);
      }

      result += ` ${op} ${this.generateAdditiveExpr(exprs[i])}`;
    }

    return result;
  }

  // Issue #63: validateShiftAmount, getTypeWidth, evaluateShiftAmount,
  //            evaluateUnaryExpression moved to TypeValidator

  /**
   * Get the type of an additive expression.
   */
  private getAdditiveExpressionType(
    ctx: Parser.AdditiveExpressionContext,
  ): string | null {
    // For simple case, get type from first multiplicative expression
    const multExprs = ctx.multiplicativeExpression();
    if (multExprs.length === 0) return null;

    return this.getMultiplicativeExpressionType(multExprs[0]);
  }

  /**
   * Get the type of a multiplicative expression.
   */
  private getMultiplicativeExpressionType(
    ctx: Parser.MultiplicativeExpressionContext,
  ): string | null {
    const unaryExprs = ctx.unaryExpression();
    if (unaryExprs.length === 0) return null;

    return this.getUnaryExpressionType(unaryExprs[0]);
  }

  /**
   * Extracts binary operators from a parse tree context in order.
   * Issue #152: Fixes bug where mixed operators (e.g., + and -) were incorrectly
   * detected using text.includes() which would use the same operator for all positions.
   *
   * @param ctx The parser rule context containing operands and operators as children
   * @returns Array of operator strings in the order they appear
   */
  private getOperatorsFromChildren(ctx: ParserRuleContext): string[] {
    const operators: string[] = [];
    for (const child of ctx.children) {
      if (child instanceof TerminalNode) {
        operators.push(child.getText());
      }
    }
    return operators;
  }

  private generateAdditiveExpr(ctx: Parser.AdditiveExpressionContext): string {
    const exprs = ctx.multiplicativeExpression();
    if (exprs.length === 1) {
      return this.generateMultiplicativeExpr(exprs[0]);
    }

    // Issue #152: Extract operators in order from parse tree children
    const operators = this.getOperatorsFromChildren(ctx);
    let result = this.generateMultiplicativeExpr(exprs[0]);

    for (let i = 1; i < exprs.length; i++) {
      const op = operators[i - 1] || "+";
      result += ` ${op} ${this.generateMultiplicativeExpr(exprs[i])}`;
    }

    return result;
  }

  private generateMultiplicativeExpr(
    ctx: Parser.MultiplicativeExpressionContext,
  ): string {
    const exprs = ctx.unaryExpression();
    if (exprs.length === 1) {
      return this.generateUnaryExpr(exprs[0]);
    }

    // Issue #152: Extract operators in order from parse tree children
    const operators = this.getOperatorsFromChildren(ctx);
    let result = this.generateUnaryExpr(exprs[0]);

    for (let i = 1; i < exprs.length; i++) {
      const op = operators[i - 1] || "*";
      result += ` ${op} ${this.generateUnaryExpr(exprs[i])}`;
    }

    return result;
  }

  private generateUnaryExpr(ctx: Parser.UnaryExpressionContext): string {
    if (ctx.postfixExpression()) {
      return this.generatePostfixExpr(ctx.postfixExpression()!);
    }

    const inner = this.generateUnaryExpr(ctx.unaryExpression()!);
    const text = ctx.getText();

    if (text.startsWith("!")) return `!${inner}`;
    if (text.startsWith("-")) return `-${inner}`;
    if (text.startsWith("~")) return `~${inner}`;
    if (text.startsWith("&")) return `&${inner}`;

    return inner;
  }

  private generatePostfixExpr(ctx: Parser.PostfixExpressionContext): string {
    const primary = ctx.primaryExpression();
    const ops = ctx.postfixOp();

    // Check if this is a struct parameter - we may need to handle -> access
    const primaryId = primary.IDENTIFIER()?.getText();
    const paramInfo = primaryId
      ? this.context.currentParameters.get(primaryId)
      : null;
    const isStructParam = paramInfo?.isStruct ?? false;

    let result = this.generatePrimaryExpr(primary);

    // ADR-016: Track if we've encountered a register in the access chain
    let isRegisterChain = primaryId
      ? this.symbols!.knownRegisters.has(primaryId)
      : false;

    // Track if current member is an array through member access chain
    // e.g., buf.data[0] - after .data, we know data is an array member
    // Note: This tracks STRUCT MEMBER arrays only, not the primary identifier being an array
    // Primary identifier arrays are handled by remainingArrayDims and isPrimaryArray
    let currentMemberIsArray = false;
    let currentStructType = primaryId
      ? this.context.typeRegistry.get(primaryId)?.baseType
      : undefined;

    // Track previous struct type and member name for .length on struct members (cfg.magic.length)
    let previousStructType: string | undefined = undefined;
    let previousMemberName: string | undefined = undefined;

    // Track the current resolved identifier for type lookups (fixes scope/parameter .length)
    let currentIdentifier = primaryId;
    // Bug #8: Track remaining array dimensions for multi-dimensional arrays
    // e.g., matrix[4][4] starts with 2 dims; after matrix[0] there's still 1 dim left
    // Check both typeRegistry (for variables) and currentParameters (for function params)
    const primaryTypeInfo = primaryId
      ? this.context.typeRegistry.get(primaryId)
      : undefined;
    const primaryParamInfo = primaryId
      ? this.context.currentParameters.get(primaryId)
      : undefined;
    let remainingArrayDims =
      primaryTypeInfo?.arrayDimensions?.length ??
      // Fallback: if parameter is marked as array but no dimensions, assume at least 1
      (primaryParamInfo?.isArray ? 1 : 0);
    // Track how many dimensions we've subscripted (arr[0] -> depth 1, arr[0][1] -> depth 2)
    let subscriptDepth = 0;
    // ADR-016: Track if we're in a global. access chain (skips scope/enum/register validation)
    let isGlobalAccess = false;

    for (let i = 0; i < ops.length; i++) {
      const op = ops[i];

      // Member access
      if (op.IDENTIFIER()) {
        const memberName = op.IDENTIFIER()!.getText();

        // ADR-016: Handle global. prefix - first member becomes the identifier
        if (result === "__GLOBAL_PREFIX__") {
          result = memberName;
          currentIdentifier = memberName; // Track for .length lookups
          isGlobalAccess = true; // Mark that we're in a global access chain
          // Check if this first identifier is a register
          if (this.symbols!.knownRegisters.has(memberName)) {
            isRegisterChain = true;
          }
          continue; // Skip further processing, this just sets the base identifier
        }

        // Handle .length property for arrays, strings, and integers
        if (memberName === "length") {
          // Special case: main function's args.length -> argc
          if (
            this.context.mainArgsName &&
            primaryId === this.context.mainArgsName
          ) {
            result = "argc";
          } else {
            // Check if we're accessing a struct member (cfg.magic.length)
            if (previousStructType && previousMemberName) {
              // Look up the member's type in the struct definition
              // Uses SymbolTable first (for C headers), falls back to local structs
              const fieldInfo = this.getStructFieldInfo(
                previousStructType,
                previousMemberName,
              );
              if (fieldInfo) {
                const memberType = fieldInfo.type;
                const dimensions = fieldInfo.dimensions;
                // ADR-045: Check if this is a string field
                const isStringField = memberType.startsWith("string<");

                if (dimensions && dimensions.length > 1 && isStringField) {
                  // String array field: string<64> arr[4]
                  if (subscriptDepth === 0) {
                    // ts.arr.length -> return element count (first dimension)
                    result = String(dimensions[0]);
                  } else {
                    // ts.arr[0].length -> strlen(ts.arr[0])
                    this.needsString = true;
                    result = `strlen(${result})`;
                  }
                } else if (
                  dimensions &&
                  dimensions.length === 1 &&
                  isStringField
                ) {
                  // Single string field: string<64> str
                  // ts.str.length -> strlen(ts.str)
                  this.needsString = true;
                  result = `strlen(${result})`;
                } else if (
                  dimensions &&
                  dimensions.length > 0 &&
                  subscriptDepth < dimensions.length
                ) {
                  // Multi-dim array member with partial subscript
                  // e.g., ts.arr.length -> dimensions[0], ts.arr[0].length -> dimensions[1]
                  result = String(dimensions[subscriptDepth]);
                } else if (
                  dimensions &&
                  dimensions.length > 0 &&
                  subscriptDepth >= dimensions.length
                ) {
                  // Array member fully subscripted (e.g., ts.arr[0][1].length) -> return element bit width
                  // Try C-Next types first, then C types
                  const bitWidth =
                    TYPE_WIDTH[memberType] || C_TYPE_WIDTH[memberType] || 0;
                  if (bitWidth > 0) {
                    result = String(bitWidth);
                  } else {
                    result = `/* .length: unsupported element type ${memberType} */0`;
                  }
                } else {
                  // Non-array member -> return bit width
                  // Try C-Next types first, then C types
                  const bitWidth =
                    TYPE_WIDTH[memberType] || C_TYPE_WIDTH[memberType] || 0;
                  if (bitWidth > 0) {
                    result = String(bitWidth);
                  } else {
                    result = `/* .length: unsupported type ${memberType} */0`;
                  }
                }
                // Skip the rest of the logic since we handled it
                previousStructType = undefined;
                previousMemberName = undefined;
                continue;
              }
            }

            // Fall back to checking the current resolved identifier's type
            // Check type registry (parameters are also registered here with bitWidth)
            const typeInfo = currentIdentifier
              ? this.context.typeRegistry.get(currentIdentifier)
              : undefined;

            if (!typeInfo) {
              // Type lookup failed - generate error placeholder
              result = `/* .length: unknown type for ${result} */0`;
              continue;
            }

            if (typeInfo) {
              // ADR-045: String type handling
              if (typeInfo.isString) {
                if (
                  typeInfo.arrayDimensions &&
                  typeInfo.arrayDimensions.length > 1
                ) {
                  // String array: arrayDimensions: [4, 65]
                  if (subscriptDepth === 0) {
                    // arr.length -> return element count (first dimension)
                    result = String(typeInfo.arrayDimensions[0]);
                  } else {
                    // arr[0].length -> strlen(arr[0])
                    // Use 'result' which has the subscript, not 'currentIdentifier'
                    result = `strlen(${result})`;
                  }
                } else {
                  // Single string: arrayDimensions: [65]
                  // str.length -> strlen(str)
                  if (
                    currentIdentifier &&
                    this.context.lengthCache?.has(currentIdentifier)
                  ) {
                    result = this.context.lengthCache.get(currentIdentifier)!;
                  } else {
                    result = currentIdentifier
                      ? `strlen(${currentIdentifier})`
                      : `strlen(${result})`;
                  }
                }
              } else if (
                typeInfo.isArray &&
                typeInfo.arrayDimensions &&
                typeInfo.arrayDimensions.length > 0 &&
                subscriptDepth < typeInfo.arrayDimensions.length
              ) {
                // ADR-036: Multi-dimensional array length
                // matrix.length -> arrayDimensions[0], matrix[0].length -> arrayDimensions[1]
                result = String(typeInfo.arrayDimensions[subscriptDepth]);
              } else if (
                typeInfo.isArray &&
                typeInfo.arrayDimensions &&
                typeInfo.arrayDimensions.length > 0 &&
                subscriptDepth >= typeInfo.arrayDimensions.length
              ) {
                // Array fully subscripted (arr[0][1].length) -> return element bit width from TYPE_WIDTH
                // Issue #121: Check for enum arrays first
                // Issue #136: Check for string arrays - need strlen() for element length
                if (typeInfo.isEnum) {
                  // ADR-017: Enum array element .length returns 32 (default enum size)
                  result = "32";
                } else if (
                  typeInfo.baseType.startsWith("string<") ||
                  typeInfo.isString
                ) {
                  // ADR-045/Issue #136: String array element .length -> strlen(arr[index])
                  this.needsString = true;
                  result = `strlen(${result})`;
                } else {
                  const elementBitWidth = TYPE_WIDTH[typeInfo.baseType] || 0;
                  if (elementBitWidth > 0) {
                    result = String(elementBitWidth);
                  } else {
                    result = `/* .length: unsupported element type ${typeInfo.baseType} */0`;
                  }
                }
              } else if (typeInfo.isEnum && !typeInfo.isArray) {
                // ADR-017: Enum types default to 32-bit width like C
                // Issue #121: Enums were previously returning 0 for .length
                // Only applies to non-array enum variables
                result = "32";
              } else if (!typeInfo.isArray) {
                // Integer bit width - return the compile-time constant
                result = String(typeInfo.bitWidth);
              } else {
                // Unknown length, generate error placeholder
                result = `/* .length unknown for ${currentIdentifier} */0`;
              }
            }
          }
        }
        // ADR-045: Handle .capacity property for strings
        else if (memberName === "capacity") {
          const typeInfo = primaryId
            ? this.context.typeRegistry.get(primaryId)
            : undefined;
          if (typeInfo?.isString && typeInfo.stringCapacity !== undefined) {
            // Return compile-time constant capacity (max string length)
            result = String(typeInfo.stringCapacity);
          } else {
            throw new Error(
              `Error: .capacity is only available on string types`,
            );
          }
        }
        // ADR-045: Handle .size property for strings (buffer size = capacity + 1)
        // Use .size with functions like fgets that need buffer size, not max length
        else if (memberName === "size") {
          const typeInfo = primaryId
            ? this.context.typeRegistry.get(primaryId)
            : undefined;
          if (typeInfo?.isString && typeInfo.stringCapacity !== undefined) {
            // Return buffer size (capacity + 1 for null terminator)
            result = String(typeInfo.stringCapacity + 1);
          } else {
            throw new Error(`Error: .size is only available on string types`);
          }
        }
        // ADR-034: Handle bitmap field read access: flags.Running -> ((flags >> 0) & 1)
        else if (primaryId) {
          const typeInfo = this.context.typeRegistry.get(primaryId);
          if (typeInfo?.isBitmap && typeInfo.bitmapTypeName) {
            const bitmapType = typeInfo.bitmapTypeName;
            const fields = this.symbols!.bitmapFields.get(bitmapType);
            if (fields && fields.has(memberName)) {
              const fieldInfo = fields.get(memberName)!;
              if (fieldInfo.width === 1) {
                // Single bit: ((value >> offset) & 1)
                result = `((${result} >> ${fieldInfo.offset}) & 1)`;
              } else {
                // Multi-bit: ((value >> offset) & mask)
                const mask = (1 << fieldInfo.width) - 1;
                result = `((${result} >> ${fieldInfo.offset}) & 0x${mask.toString(16).toUpperCase()})`;
              }
            } else {
              throw new Error(
                `Error: Unknown bitmap field '${memberName}' on type '${bitmapType}'`,
              );
            }
          }
          // Check if this is a scope member access: Scope.member (ADR-016)
          else if (this.symbols!.knownScopes.has(result)) {
            // ADR-016: Skip validation if we're already in a global. access chain
            if (!isGlobalAccess) {
              // ADR-016: Prevent self-referential scope access - must use 'this.' inside own scope
              if (result === this.context.currentScope) {
                throw new Error(
                  `Error: Cannot reference own scope '${result}' by name. Use 'this.${memberName}' instead of '${result}.${memberName}'`,
                );
              }
              // ADR-016: Inside a scope, accessing another scope requires global. prefix
              if (this.context.currentScope) {
                throw new Error(
                  `Error: Use 'global.${result}.${memberName}' to access scope '${result}' from inside scope '${this.context.currentScope}'`,
                );
              }
            }
            // Transform Scope.member to Scope_member
            result = `${result}_${memberName}`;
            currentIdentifier = result; // Track for .length lookups

            // Check if this resolved identifier is a struct type for chained access
            const resolvedTypeInfo = this.context.typeRegistry.get(result);
            if (
              resolvedTypeInfo &&
              this.isKnownStruct(resolvedTypeInfo.baseType)
            ) {
              currentStructType = resolvedTypeInfo.baseType;
            }
          }
          // ADR-017: Check if this is an enum member access: State.IDLE -> State_IDLE
          else if (this.symbols!.knownEnums.has(result)) {
            // ADR-016: Inside a scope, accessing global enum requires global. prefix
            // Exception: if the enum belongs to the current scope (e.g., Motor_State in Motor scope),
            // it's a scoped enum and access is allowed (via this.State transformation)
            // Also skip if we're already in a global. access chain
            if (!isGlobalAccess) {
              const belongsToCurrentScope =
                this.context.currentScope &&
                result.startsWith(this.context.currentScope + "_");
              if (this.context.currentScope && !belongsToCurrentScope) {
                throw new Error(
                  `Error: Use 'global.${result}.${memberName}' to access enum '${result}' from inside scope '${this.context.currentScope}'`,
                );
              }
            }
            // Transform Enum.member to Enum_member
            result = `${result}_${memberName}`;
          }
          // Check if this is a register member access: GPIO7.DR -> GPIO7_DR
          else if (this.symbols!.knownRegisters.has(result)) {
            // ADR-016: Inside a scope, accessing global register requires global. prefix
            // Exception: if the register belongs to the current scope (e.g., Motor_GPIO in Motor scope),
            // it's a scoped register and access is allowed (via this. transformation)
            // Also skip if we're already in a global. access chain
            if (!isGlobalAccess) {
              const registerBelongsToCurrentScope =
                this.context.currentScope &&
                result.startsWith(this.context.currentScope + "_");
              if (this.context.currentScope && !registerBelongsToCurrentScope) {
                throw new Error(
                  `Error: Use 'global.${result}.${memberName}' to access register '${result}' from inside scope '${this.context.currentScope}'`,
                );
              }
            }
            // ADR-013: Check for write-only register members (wo = cannot read)
            const fullName = `${result}_${memberName}`;
            const accessMod = this.symbols!.registerMemberAccess.get(fullName);
            if (accessMod === "wo") {
              throw new Error(
                `cannot read from write-only register member '${memberName}' ` +
                  `(${result}.${memberName} has 'wo' access modifier)`,
              );
            }
            // Transform Register.member to Register_member (matching #define)
            result = fullName;
            isRegisterChain = true; // ADR-016: Track register chain for subscript handling
          }
          // ADR-034: Check if result is a register member with bitmap type
          // Handle: MOTOR_CTRL.Running where MOTOR_CTRL has bitmap type MotorControl
          else if (this.symbols!.registerMemberTypes.has(result)) {
            const bitmapType = this.symbols!.registerMemberTypes.get(result)!;
            const fields = this.symbols!.bitmapFields.get(bitmapType);
            if (fields && fields.has(memberName)) {
              const fieldInfo = fields.get(memberName)!;
              if (fieldInfo.width === 1) {
                // Single bit: ((value >> offset) & 1)
                result = `((${result} >> ${fieldInfo.offset}) & 1)`;
              } else {
                // Multi-bit: ((value >> offset) & mask)
                const mask = (1 << fieldInfo.width) - 1;
                result = `((${result} >> ${fieldInfo.offset}) & 0x${mask.toString(16).toUpperCase()})`;
              }
            } else {
              throw new Error(
                `Error: Unknown bitmap field '${memberName}' on type '${bitmapType}'`,
              );
            }
          }
          // ADR-006: Struct parameter uses -> for member access
          else if (isStructParam && result === primaryId) {
            // If currentStructType is not set yet, check if current result is a struct
            if (!currentStructType && currentIdentifier) {
              const identifierTypeInfo =
                this.context.typeRegistry.get(currentIdentifier);
              if (
                identifierTypeInfo &&
                this.isKnownStruct(identifierTypeInfo.baseType)
              ) {
                currentStructType = identifierTypeInfo.baseType;
              }
            }

            // ADR-034: Check if currentStructType is a bitmap - handle field access
            // This handles structParam->bitmapMember.field -> bitwise access
            const bitmapFieldsPtr = this.symbols!.bitmapFields.get(
              currentStructType || "",
            );
            if (bitmapFieldsPtr && bitmapFieldsPtr.has(memberName)) {
              const fieldInfo = bitmapFieldsPtr.get(memberName)!;
              if (fieldInfo.width === 1) {
                // Single bit: ((value >> offset) & 1)
                result = `((${result} >> ${fieldInfo.offset}) & 1)`;
              } else {
                // Multi-bit: ((value >> offset) & mask)
                const mask = (1 << fieldInfo.width) - 1;
                result = `((${result} >> ${fieldInfo.offset}) & 0x${mask.toString(16).toUpperCase()})`;
              }
              // Bitmap fields don't have sub-members, clear struct type tracking
              currentStructType = undefined;
              continue;
            }

            result = `${result}->${memberName}`;
            // Track this member for potential .length access (save BEFORE updating)
            previousStructType = currentStructType;
            previousMemberName = memberName;
            // Update type tracking for struct member
            if (currentStructType) {
              const memberTypeInfo = this.getMemberTypeInfo(
                currentStructType,
                memberName,
              );
              if (memberTypeInfo) {
                currentMemberIsArray = memberTypeInfo.isArray;
                currentStructType = memberTypeInfo.baseType;
              }
            }
          } else {
            // If currentStructType is not set yet, check if current result is a struct
            // This handles cases like global.structVar.field or this.structVar.field
            if (!currentStructType && currentIdentifier) {
              const identifierTypeInfo =
                this.context.typeRegistry.get(currentIdentifier);
              if (
                identifierTypeInfo &&
                this.isKnownStruct(identifierTypeInfo.baseType)
              ) {
                currentStructType = identifierTypeInfo.baseType;
              }
            }

            // ADR-034: Check if currentStructType is a bitmap - handle field access
            // This handles struct.bitmapMember.field -> bitwise access
            const bitmapFields = this.symbols!.bitmapFields.get(
              currentStructType || "",
            );
            if (bitmapFields && bitmapFields.has(memberName)) {
              const fieldInfo = bitmapFields.get(memberName)!;
              if (fieldInfo.width === 1) {
                // Single bit: ((value >> offset) & 1)
                result = `((${result} >> ${fieldInfo.offset}) & 1)`;
              } else {
                // Multi-bit: ((value >> offset) & mask)
                const mask = (1 << fieldInfo.width) - 1;
                result = `((${result} >> ${fieldInfo.offset}) & 0x${mask.toString(16).toUpperCase()})`;
              }
              // Bitmap fields don't have sub-members, clear struct type tracking
              currentStructType = undefined;
              continue;
            }

            result = `${result}.${memberName}`;
            // Track this member for potential .length access (save BEFORE updating)
            previousStructType = currentStructType;
            previousMemberName = memberName;
            // Update type tracking for struct member
            if (currentStructType) {
              const memberTypeInfo = this.getMemberTypeInfo(
                currentStructType,
                memberName,
              );
              if (memberTypeInfo) {
                currentMemberIsArray = memberTypeInfo.isArray;
                currentStructType = memberTypeInfo.baseType;
              }
            }
          }
        }
        // No primaryId - check type access patterns: Scope.member, Enum.member, Register.member
        else {
          // ADR-016: Handle 'this' marker for scope-local access (this.member -> Scope_member)
          if (result === "__THIS_SCOPE__") {
            if (!this.context.currentScope) {
              throw new Error("Error: 'this' can only be used inside a scope");
            }
            // Transform this.member to Scope_member
            result = `${this.context.currentScope}_${memberName}`;
            currentIdentifier = result; // Track for .length lookups

            // Set struct type for chained access, but ONLY if result is not an enum
            // This prevents treating enum types (like Motor_State) as struct variables
            if (!this.symbols!.knownEnums.has(result)) {
              const resolvedTypeInfo = this.context.typeRegistry.get(result);
              if (
                resolvedTypeInfo &&
                this.isKnownStruct(resolvedTypeInfo.baseType)
              ) {
                currentStructType = resolvedTypeInfo.baseType;
              }
            }
          } else if (this.symbols!.knownScopes.has(result)) {
            // ADR-016: Skip validation if we're already in a global. access chain
            if (!isGlobalAccess) {
              // ADR-016: Prevent self-referential scope access - must use 'this.' inside own scope
              if (result === this.context.currentScope) {
                throw new Error(
                  `Error: Cannot reference own scope '${result}' by name. Use 'this.${memberName}' instead of '${result}.${memberName}'`,
                );
              }
              // ADR-016: Inside a scope, accessing another scope requires global. prefix
              if (this.context.currentScope) {
                throw new Error(
                  `Error: Use 'global.${result}.${memberName}' to access scope '${result}' from inside scope '${this.context.currentScope}'`,
                );
              }
            }
            // Transform Scope.member to Scope_member
            result = `${result}_${memberName}`;
            currentIdentifier = result; // Track for .length lookups
          } else if (this.symbols!.knownEnums.has(result)) {
            // ADR-016: Inside a scope, accessing global enum requires global. prefix
            // Exception: if the enum belongs to the current scope, access is allowed
            // Also skip if we're already in a global. access chain
            if (!isGlobalAccess) {
              const enumBelongsToCurrentScope =
                this.context.currentScope &&
                result.startsWith(this.context.currentScope + "_");
              if (this.context.currentScope && !enumBelongsToCurrentScope) {
                throw new Error(
                  `Error: Use 'global.${result}.${memberName}' to access enum '${result}' from inside scope '${this.context.currentScope}'`,
                );
              }
            }
            // Transform Enum.member to Enum_member
            result = `${result}_${memberName}`;
          } else if (this.symbols!.knownRegisters.has(result)) {
            // ADR-016: Inside a scope, accessing global register requires global. prefix
            // Exception: if the register belongs to the current scope, access is allowed
            // Also skip if we're already in a global. access chain
            if (!isGlobalAccess) {
              const registerBelongsToCurrentScope =
                this.context.currentScope &&
                result.startsWith(this.context.currentScope + "_");
              if (this.context.currentScope && !registerBelongsToCurrentScope) {
                throw new Error(
                  `Error: Use 'global.${result}.${memberName}' to access register '${result}' from inside scope '${this.context.currentScope}'`,
                );
              }
            }
            // Transform Register.member to Register_member (matching #define)
            result = `${result}_${memberName}`;
            isRegisterChain = true;
          }
          // ADR-034: Check if result is a register member with bitmap type (no primaryId case)
          else if (this.symbols!.registerMemberTypes.has(result)) {
            const bitmapType = this.symbols!.registerMemberTypes.get(result)!;
            const fields = this.symbols!.bitmapFields.get(bitmapType);
            if (fields && fields.has(memberName)) {
              const fieldInfo = fields.get(memberName)!;
              if (fieldInfo.width === 1) {
                result = `((${result} >> ${fieldInfo.offset}) & 1)`;
              } else {
                const mask = (1 << fieldInfo.width) - 1;
                result = `((${result} >> ${fieldInfo.offset}) & 0x${mask.toString(16).toUpperCase()})`;
              }
            } else {
              throw new Error(
                `Error: Unknown bitmap field '${memberName}' on type '${bitmapType}'`,
              );
            }
          } else {
            result = `${result}.${memberName}`;
            // Track this member for potential .length access (save BEFORE updating)
            previousStructType = currentStructType;
            previousMemberName = memberName;
            // Update type tracking for struct member
            if (currentStructType) {
              const memberTypeInfo = this.getMemberTypeInfo(
                currentStructType,
                memberName,
              );
              if (memberTypeInfo) {
                currentMemberIsArray = memberTypeInfo.isArray;
                currentStructType = memberTypeInfo.baseType;
                // Clear currentIdentifier so .length uses previousStructType path
                currentIdentifier = undefined;
              }
            }
          }
        } // end of else (no primaryId)
      }
      // Array subscript / bit access
      else if (op.expression().length > 0) {
        const exprs = op.expression();
        if (exprs.length === 1) {
          // Single index: could be array[i] or bit access flags[3]
          const index = this.generateExpression(exprs[0]);

          // Check if result is a register member with bitmap type
          if (this.symbols!.registerMemberTypes.has(result)) {
            const bitmapType = this.symbols!.registerMemberTypes.get(result)!;
            const line = primary.start?.line ?? 0;
            throw new Error(
              `Error at line ${line}: Cannot use bracket indexing on bitmap type '${bitmapType}'. ` +
                `Use named field access instead (e.g., ${result.split("_").slice(-1)[0]}.FIELD_NAME).`,
            );
          }

          // ADR-016: Use isRegisterChain to detect register access via global. prefix
          const isRegisterAccess =
            isRegisterChain ||
            (primaryId ? this.symbols!.knownRegisters.has(primaryId) : false);

          // Check if current identifier (which may have been updated by global./this./Scope. access) is an array
          // Use currentIdentifier if available (handles global.arr, this.arr, Scope.arr),
          // otherwise fall back to primaryId (handles bare arr)
          const identifierToCheck = currentIdentifier || primaryId;
          const identifierTypeInfo = identifierToCheck
            ? this.context.typeRegistry.get(identifierToCheck)
            : undefined;
          const isPrimaryArray = identifierTypeInfo?.isArray ?? false;

          // Determine if this subscript is array access or bit access
          // Priority: register access > tracked member array > struct member primitive int > primary array > default bit access
          // Bug #8: Check currentStructType BEFORE isPrimaryArray to handle items[0].byte[7] correctly
          const isPrimitiveIntMember =
            currentStructType &&
            ["u8", "u16", "u32", "u64", "i8", "i16", "i32", "i64"].includes(
              currentStructType,
            );

          if (isRegisterAccess) {
            // Register - use bit access: ((value >> index) & 1)
            result = `((${result} >> ${index}) & 1)`;
          } else if (currentMemberIsArray) {
            // Struct member that is an array (e.g., config.tempInputs[0])
            // This is the most reliable indicator - we tracked it through member access
            result = `${result}[${index}]`;
            currentMemberIsArray = false; // After subscript, no longer array
            subscriptDepth++; // Track dimension depth for .length
          } else if (remainingArrayDims > 0) {
            // Bug #8: Multi-dimensional array - still have dimensions to consume
            // e.g., matrix[0][0] where matrix is u8[4][4]
            result = `${result}[${index}]`;
            remainingArrayDims--;
            subscriptDepth++; // Track dimension depth for .length
            // After consuming all array dimensions, set struct type if element is struct
            if (remainingArrayDims === 0 && primaryTypeInfo) {
              const elementType = primaryTypeInfo.baseType;
              if (this.isKnownStruct(elementType)) {
                currentStructType = elementType;
              }
            }
          } else if (isPrimitiveIntMember) {
            // Bug #8: Struct member is primitive integer - use bit access
            // e.g., items[0].byte[7] where byte is u8
            result = `((${result} >> ${index}) & 1)`;
            currentStructType = undefined; // Reset after bit access
          } else if (isPrimaryArray) {
            // Primary identifier is an array (e.g., arr[0] or global.arr[0])
            result = `${result}[${index}]`;
            subscriptDepth++; // Track dimension depth for .length
            // After subscripting an array, set currentStructType if the element is a struct
            if (identifierTypeInfo && !currentStructType) {
              const elementType = identifierTypeInfo.baseType;
              if (this.isKnownStruct(elementType)) {
                currentStructType = elementType;
              }
            }
          } else {
            // Check identifierTypeInfo for simple variables (not through member access)
            const typeToCheck = identifierTypeInfo?.baseType;
            const isPrimitiveInt =
              typeToCheck &&
              ["u8", "u16", "u32", "u64", "i8", "i16", "i32", "i64"].includes(
                typeToCheck,
              );
            if (isPrimitiveInt) {
              // Primitive integer - use bit access: ((value >> index) & 1)
              result = `((${result} >> ${index}) & 1)`;
            } else {
              // Non-primitive type or unknown - default to array access
              result = `${result}[${index}]`;
            }
          }
        } else if (exprs.length === 2) {
          // Bit range: flags[start, width]
          const start = this.generateExpression(exprs[0]);
          const width = this.generateExpression(exprs[1]);
          const mask = this.generateBitMask(width);
          // Optimize: skip shift when start is 0
          if (start === "0") {
            result = `((${result}) & ${mask})`;
          } else {
            // Generate bit range read: ((value >> start) & mask)
            result = `((${result} >> ${start}) & ${mask})`;
          }
        }
      }
      // Function call
      else if (op.argumentList()) {
        // Check if this is a C-Next function (uses pass-by-reference)
        // C/C++ functions use pass-by-value
        // Uses both internal tracking and symbol table for cross-language interop
        const isCNextFunc = this.isCNextFunction(result);

        const argExprs = op.argumentList()!.expression();

        // ADR-051: Handle safe_div() and safe_mod() built-in functions
        if (result === "safe_div" || result === "safe_mod") {
          if (argExprs.length !== 4) {
            throw new Error(
              `${result} requires exactly 4 arguments: output, numerator, divisor, defaultValue`,
            );
          }

          // Get the output parameter (first argument) to determine type
          const outputArgId = this.getSimpleIdentifier(argExprs[0]);
          if (!outputArgId) {
            throw new Error(
              `${result} requires a variable as the first argument (output parameter)`,
            );
          }

          // Look up the type of the output parameter
          const typeInfo = this.context.typeRegistry.get(outputArgId);
          if (!typeInfo) {
            throw new Error(
              `Cannot determine type of output parameter '${outputArgId}' for ${result}`,
            );
          }

          // Map C-Next type to helper function suffix
          const cnxType = typeInfo.baseType; // e.g., "u32", "i16", etc.
          if (!cnxType) {
            throw new Error(
              `Output parameter '${outputArgId}' has no C-Next type for ${result}`,
            );
          }

          // Generate arguments: &output, numerator, divisor, defaultValue
          const outputArg = `&${this.generateExpression(argExprs[0])}`;
          const numeratorArg = this.generateExpression(argExprs[1]);
          const divisorArg = this.generateExpression(argExprs[2]);
          const defaultArg = this.generateExpression(argExprs[3]);

          const helperName =
            result === "safe_div"
              ? `cnx_safe_div_${cnxType}`
              : `cnx_safe_mod_${cnxType}`;

          // Track that this operation is used for helper generation
          const opType = result === "safe_div" ? "div" : "mod";
          this.usedSafeDivOps.add(`${opType}_${cnxType}`);

          result = `${helperName}(${outputArg}, ${numeratorArg}, ${divisorArg}, ${defaultArg})`;
        }
        // Regular function call handling
        else {
          // ADR-013: Check const-to-non-const before generating arguments
          if (isCNextFunc) {
            const sig = this.functionSignatures.get(result);
            if (sig) {
              for (
                let argIdx = 0;
                argIdx < argExprs.length && argIdx < sig.parameters.length;
                argIdx++
              ) {
                const argId = this.getSimpleIdentifier(argExprs[argIdx]);
                if (argId && this.typeValidator!.isConstValue(argId)) {
                  const param = sig.parameters[argIdx];
                  if (!param.isConst) {
                    throw new Error(
                      `cannot pass const '${argId}' to non-const parameter '${param.name}' ` +
                        `of function '${result}'`,
                    );
                  }
                }
              }
            }
          }

          const args = argExprs
            // eslint-disable-next-line @typescript-eslint/no-loop-func
            .map((e, idx) => {
              if (!isCNextFunc) {
                return this.generateExpression(e);
              }
              // C-Next function: check if target parameter is a pass-by-value type
              const sig = this.functionSignatures.get(result);
              const targetParam = sig?.parameters[idx];
              const isFloatParam =
                targetParam && this.isFloatType(targetParam.baseType);
              const isEnumParam =
                targetParam &&
                this.symbols!.knownEnums.has(targetParam.baseType);

              if (isFloatParam || isEnumParam) {
                // Target parameter is float or enum (pass-by-value): pass value directly
                return this.generateExpression(e);
              } else {
                // Target parameter is non-float/non-enum (pass-by-reference): use & logic
                // Pass the target param type for proper literal handling
                return this.generateFunctionArg(e, targetParam?.baseType);
              }
            })
            .join(", ");
          result = `${result}(${args})`;
        }
      }
      // Empty function call
      else {
        result = `${result}()`;
      }
    }

    // ADR-006: If a struct parameter is used as a whole value (no postfix ops),
    // it needs to be dereferenced since it's a pointer in C.
    // With postfix ops (member access), -> is already used in the loop above.
    if (isStructParam && ops.length === 0) {
      return `(*${result})`;
    }

    return result;
  }

  private generatePrimaryExpr(ctx: Parser.PrimaryExpressionContext): string {
    // ADR-023: sizeof expression - sizeof(u32) or sizeof(variable)
    if (ctx.sizeofExpression()) {
      return this.generateSizeofExpr(ctx.sizeofExpression()!);
    }
    // ADR-017: Cast expression - (u8)State.IDLE
    if (ctx.castExpression()) {
      return this.generateCastExpression(ctx.castExpression()!);
    }
    // ADR-014: Struct initializer - Point { x: 10, y: 20 }
    if (ctx.structInitializer()) {
      return this.generateStructInitializer(ctx.structInitializer()!);
    }
    // ADR-035: Array initializer - [1, 2, 3] or [0*]
    if (ctx.arrayInitializer()) {
      return this.generateArrayInitializer(ctx.arrayInitializer()!);
    }

    // ADR-016: Handle 'this' keyword for scope-local reference
    // 'this' returns a marker that postfixOps will transform to Scope_member
    const text = ctx.getText();
    if (text === "this") {
      if (!this.context.currentScope) {
        throw new Error("Error: 'this' can only be used inside a scope");
      }
      // Return marker - postfixOps will detect and transform to scope-prefixed access
      return "__THIS_SCOPE__";
    }

    // ADR-016: Handle 'global' keyword for global reference
    // 'global' strips the prefix so global.X becomes just X
    if (text === "global") {
      // Return special marker - first postfixOp will become the identifier
      return "__GLOBAL_PREFIX__";
    }

    if (ctx.IDENTIFIER()) {
      const id = ctx.IDENTIFIER()!.getText();

      // Special case: main function's args parameter -> argv
      if (this.context.mainArgsName && id === this.context.mainArgsName) {
        return "argv";
      }

      // ADR-006: Check if it's a function parameter
      const paramInfo = this.context.currentParameters.get(id);
      if (paramInfo) {
        // ADR-029: Callback parameters don't need dereferencing (they're function pointers)
        if (paramInfo.isCallback) {
          return id;
        }
        // Float types use pass-by-value, no dereference needed
        if (this.isFloatType(paramInfo.baseType)) {
          return id;
        }
        // ADR-017: Enum types use pass-by-value, no dereference needed
        if (this.symbols!.knownEnums.has(paramInfo.baseType)) {
          return id;
        }
        // ADR-045: String parameters are passed as char*, no dereference needed
        if (paramInfo.isString) {
          return id;
        }
        // Parameter - allowed as bare identifier
        if (!paramInfo.isArray && !paramInfo.isStruct) {
          return `(*${id})`;
        }
        // For struct parameters, return as-is here (will use -> in member access)
        return id;
      }

      // Check if it's a local variable (tracked in type registry with no underscore prefix)
      // Local variables are those that were declared inside the current function
      const isLocalVariable = this.context.localVariables.has(id);

      // ADR-016: Enforce explicit qualification inside scopes
      // Bare identifiers are ONLY allowed for local variables and parameters
      this.typeValidator!.validateBareIdentifierInScope(
        id,
        isLocalVariable,
        (name: string) => this.isKnownStruct(name),
      );

      return id;
    }
    if (ctx.literal()) {
      let literalText = ctx.literal()!.getText();
      // Track boolean literal usage to include stdbool.h
      if (literalText === "true" || literalText === "false") {
        this.needsStdbool = true;
      }
      // ADR-024: Transform C-Next float suffixes to standard C syntax
      // 3.14f32 -> 3.14f (C float)
      // 3.14f64 -> 3.14 (C double, no suffix needed)
      if (/[fF]32$/.test(literalText)) {
        literalText = literalText.replace(/[fF]32$/, "f");
      } else if (/[fF]64$/.test(literalText)) {
        literalText = literalText.replace(/[fF]64$/, "");
      }

      // Issue #130: Transform C-Next integer suffixes to standard C syntax
      // u8/u16/u32 and i8/i16/i32 suffixes are stripped (C infers from context)
      // u64 -> ULL suffix for 64-bit unsigned
      // i64 -> LL suffix for 64-bit signed
      if (/[uU]64$/.test(literalText)) {
        literalText = literalText.replace(/[uU]64$/, "ULL");
      } else if (/[iI]64$/.test(literalText)) {
        literalText = literalText.replace(/[iI]64$/, "LL");
      } else if (/[uUiI](8|16|32)$/.test(literalText)) {
        // Strip 8/16/32-bit suffixes - C handles these without explicit suffix
        literalText = literalText.replace(/[uUiI](8|16|32)$/, "");
      }
      return literalText;
    }
    if (ctx.expression()) {
      return `(${this.generateExpression(ctx.expression()!)})`;
    }
    return "";
  }

  /**
   * ADR-017: Generate cast expression
   * (u8)State.IDLE -> (uint8_t)State_IDLE
   */
  private generateCastExpression(ctx: Parser.CastExpressionContext): string {
    const targetType = this.generateType(ctx.type());
    const targetTypeName = ctx.type().getText();

    // ADR-024: Validate integer casts for narrowing and sign conversion
    if (this.isIntegerType(targetTypeName)) {
      const sourceType = this.getUnaryExpressionType(ctx.unaryExpression());
      if (sourceType && this.isIntegerType(sourceType)) {
        if (this.isNarrowingConversion(sourceType, targetTypeName)) {
          const targetWidth = TYPE_WIDTH[targetTypeName] || 0;
          throw new Error(
            `Error: Cannot cast ${sourceType} to ${targetTypeName} (narrowing). ` +
              `Use bit indexing: expr[0, ${targetWidth}]`,
          );
        }
        if (this.isSignConversion(sourceType, targetTypeName)) {
          const targetWidth = TYPE_WIDTH[targetTypeName] || 0;
          throw new Error(
            `Error: Cannot cast ${sourceType} to ${targetTypeName} (sign change). ` +
              `Use bit indexing: expr[0, ${targetWidth}]`,
          );
        }
      }
    }

    const expr = this.generateUnaryExpr(ctx.unaryExpression());

    // Validate enum casts are only to unsigned types
    const allowedCastTypes = ["u8", "u16", "u32", "u64"];

    // Check if we're casting an enum (for validation)
    // We allow casts from any expression, but could add validation here
    if (
      !allowedCastTypes.includes(targetTypeName) &&
      !["i8", "i16", "i32", "i64", "f32", "f64", "bool"].includes(
        targetTypeName,
      )
    ) {
      // It's a user type cast - allow for now (could be struct pointer, etc.)
    }

    return `(${targetType})${expr}`;
  }

  /**
   * ADR-023: Generate sizeof expression
   * sizeof(type) -> sizeof(c_type)
   * sizeof(variable) -> sizeof(variable)
   * With safety checks:
   * - E0601: sizeof on array parameter is error
   * - E0602: Side effects in sizeof are error
   */
  private generateSizeofExpr(ctx: Parser.SizeofExpressionContext): string {
    // Check if it's sizeof(type) or sizeof(expression)
    // Note: Due to grammar ambiguity, sizeof(variable) may parse as sizeof(type)
    // when the variable name matches userType (just an identifier)
    if (ctx.type()) {
      const typeCtx = ctx.type()!;
      const typeText = typeCtx.getText();

      // Check if this "type" is actually a variable.member expression
      // qualifiedType matches IDENTIFIER.IDENTIFIER, which could be struct.member
      if (typeCtx.qualifiedType()) {
        const identifiers = typeCtx.qualifiedType()!.IDENTIFIER();
        const firstName = identifiers[0].getText();
        const memberName = identifiers[1].getText();

        // Check if first identifier is a local variable (struct instance)
        if (this.context.localVariables.has(firstName)) {
          return `sizeof(${firstName}.${memberName})`;
        }

        // Check if first identifier is a parameter (struct parameter)
        const paramInfo = this.context.currentParameters.get(firstName);
        if (paramInfo) {
          // Struct parameters use -> in C
          if (paramInfo.isStruct) {
            return `sizeof(${firstName}->${memberName})`;
          }
          return `sizeof(${firstName}.${memberName})`;
        }

        // Check if first identifier is a global variable
        // If not a scope or enum, it's likely a global struct variable
        if (
          !this.symbols!.knownScopes.has(firstName) &&
          !this.symbols!.knownEnums.has(firstName)
        ) {
          return `sizeof(${firstName}.${memberName})`;
        }

        // Fall through to generateType for actual type references (Scope.Type)
      }

      // Check if this "type" is actually a variable or parameter
      // userType is just IDENTIFIER, which could be a variable reference
      if (typeCtx.userType()) {
        const varName = typeText;

        // Check if it's a known parameter
        const paramInfo = this.context.currentParameters.get(varName);
        if (paramInfo) {
          // E0601: Check if it's an array parameter
          if (paramInfo.isArray) {
            throw new Error(
              `Error[E0601]: sizeof() on array parameter '${varName}' returns pointer size. ` +
                `Use ${varName}.length for element count or sizeof(elementType) * ${varName}.length for bytes`,
            );
          }
          // It's a non-array parameter - generate sizeof for it
          // For pass-by-reference parameters (non-array, non-callback), use pointer dereference
          if (!paramInfo.isCallback && !paramInfo.isStruct) {
            return `sizeof(*${varName})`;
          }
          return `sizeof(${varName})`;
        }

        // Check if it's a known local variable
        if (this.context.localVariables.has(varName)) {
          return `sizeof(${varName})`;
        }

        // Check if it's a known struct (actual type)
        if (this.isKnownStruct(varName)) {
          return `sizeof(${varName})`;
        }

        // Check if it's a known enum (actual type)
        if (this.symbols!.knownEnums.has(varName)) {
          return `sizeof(${varName})`;
        }

        // Unknown identifier - treat as variable for safety
        return `sizeof(${varName})`;
      }

      // It's a primitive or other type - generate normally
      const cType = this.generateType(typeCtx);
      return `sizeof(${cType})`;
    }

    // It's sizeof(expression)
    const expr = ctx.expression()!;

    // E0601: Check if expression is an array parameter
    const varName = this.getSingleIdentifierFromExpr(expr);
    if (varName) {
      const paramInfo = this.context.currentParameters.get(varName);
      if (paramInfo?.isArray) {
        throw new Error(
          `Error[E0601]: sizeof() on array parameter '${varName}' returns pointer size. ` +
            `Use ${varName}.length for element count or sizeof(elementType) * ${varName}.length for bytes`,
        );
      }
    }

    // E0602: Check for side effects
    if (this.hasSideEffects(expr)) {
      throw new Error(
        `Error[E0602]: sizeof() operand must not have side effects (MISRA C:2012 Rule 13.6)`,
      );
    }

    const exprCode = this.generateExpression(expr);
    return `sizeof(${exprCode})`;
  }

  /**
   * ADR-023: Extract simple identifier from expression for parameter checking
   * Returns the identifier name if expression is a simple variable reference, null otherwise
   */
  private getSingleIdentifierFromExpr(
    expr: Parser.ExpressionContext,
  ): string | null {
    // Navigate through expression tree to find simple identifier
    const ternary = expr.ternaryExpression();
    if (!ternary) return null;

    const orExprs = ternary.orExpression();
    if (orExprs.length !== 1) return null;

    const or = orExprs[0];
    if (or.andExpression().length !== 1) return null;

    const and = or.andExpression()[0];
    if (and.equalityExpression().length !== 1) return null;

    const eq = and.equalityExpression()[0];
    if (eq.relationalExpression().length !== 1) return null;

    const rel = eq.relationalExpression()[0];
    if (rel.bitwiseOrExpression().length !== 1) return null;

    const bor = rel.bitwiseOrExpression()[0];
    if (bor.bitwiseXorExpression().length !== 1) return null;

    const bxor = bor.bitwiseXorExpression()[0];
    if (bxor.bitwiseAndExpression().length !== 1) return null;

    const band = bxor.bitwiseAndExpression()[0];
    if (band.shiftExpression().length !== 1) return null;

    const shift = band.shiftExpression()[0];
    if (shift.additiveExpression().length !== 1) return null;

    const add = shift.additiveExpression()[0];
    if (add.multiplicativeExpression().length !== 1) return null;

    const mult = add.multiplicativeExpression()[0];
    if (mult.unaryExpression().length !== 1) return null;

    const unary = mult.unaryExpression()[0];
    const postfix = unary.postfixExpression();
    if (!postfix) return null;

    const primary = postfix.primaryExpression();
    const ops = postfix.postfixOp();

    // Must have no postfix operations (no member access, no indexing)
    if (ops.length !== 0) return null;

    // Must be a simple identifier
    const id = primary.IDENTIFIER();
    return id ? id.getText() : null;
  }

  /**
   * ADR-023: Check if expression has side effects (E0602)
   * Side effects include: assignments, function calls
   */
  private hasSideEffects(expr: Parser.ExpressionContext): boolean {
    const text = expr.getText();

    // Check for assignment operators
    if (text.includes("<-")) return true;
    if (text.includes("+<-")) return true;
    if (text.includes("-<-")) return true;
    if (text.includes("*<-")) return true;
    if (text.includes("/<-")) return true;
    if (text.includes("%<-")) return true;
    if (text.includes("&<-")) return true;
    if (text.includes("|<-")) return true;
    if (text.includes("^<-")) return true;
    if (text.includes("<<<-")) return true;
    if (text.includes(">><-")) return true;

    // Check for function calls by looking for identifier followed by (
    // This is a heuristic - looking for "name(" pattern that's not a cast
    if (/[a-zA-Z_][a-zA-Z0-9_]*\s*\(/.test(text)) {
      // Could be a function call - walk the tree to confirm
      return this.hasPostfixFunctionCall(expr);
    }

    return false;
  }

  /**
   * ADR-023: Check if expression contains a function call (postfix with argumentList)
   */
  private hasPostfixFunctionCall(expr: Parser.ExpressionContext): boolean {
    // Navigate through expression tree to find function calls
    const ternary = expr.ternaryExpression();
    if (!ternary) return false;

    // Check all branches for function calls
    for (const or of ternary.orExpression()) {
      for (const and of or.andExpression()) {
        for (const eq of and.equalityExpression()) {
          for (const rel of eq.relationalExpression()) {
            for (const bor of rel.bitwiseOrExpression()) {
              for (const bxor of bor.bitwiseXorExpression()) {
                for (const band of bxor.bitwiseAndExpression()) {
                  for (const shift of band.shiftExpression()) {
                    for (const add of shift.additiveExpression()) {
                      for (const mult of add.multiplicativeExpression()) {
                        for (const unary of mult.unaryExpression()) {
                          const postfix = unary.postfixExpression();
                          if (postfix) {
                            for (const op of postfix.postfixOp()) {
                              // Check if this is a function call
                              if (
                                op.argumentList() ||
                                op.getText().startsWith("(")
                              ) {
                                return true;
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    return false;
  }

  private generateMemberAccess(ctx: Parser.MemberAccessContext): string {
    const parts = ctx.IDENTIFIER().map((id) => id.getText());
    const expressions = ctx.expression();

    if (expressions.length > 0) {
      const firstPart = parts[0];

      // ADR-036: Check if first identifier is a register for bit access
      // Register bit access: GPIO7.DR[bit] or GPIO7.DR[start, width]
      // Also handle scoped registers: Board.GPIO.DR[bit]
      const isDirectRegister =
        parts.length > 1 && this.symbols!.knownRegisters.has(firstPart);
      const scopedRegisterName =
        parts.length > 2 && this.symbols!.knownScopes.has(firstPart)
          ? `${parts[0]}_${parts[1]}`
          : null;
      const isScopedRegister =
        scopedRegisterName &&
        this.symbols!.knownRegisters.has(scopedRegisterName);

      if (isDirectRegister || isScopedRegister) {
        // This is register member bit access (handled elsewhere for assignment)
        // For read: generate bit extraction
        const registerName = parts.join("_");

        // ADR-013: Check for write-only register members (wo = cannot read)
        // Skip check if we're in assignment target context (write operation)
        if (!this.inAssignmentTarget) {
          const accessMod =
            this.symbols!.registerMemberAccess.get(registerName);
          if (accessMod === "wo") {
            const displayName = isDirectRegister
              ? `${parts[0]}.${parts[1]}`
              : `${parts[0]}.${parts[1]}.${parts[2]}`;
            throw new Error(
              `cannot read from write-only register member '${parts[isDirectRegister ? 1 : 2]}' ` +
                `(${displayName} has 'wo' access modifier)`,
            );
          }
        }

        if (expressions.length === 1) {
          const bitIndex = this.generateExpression(expressions[0]);
          return `((${registerName} >> ${bitIndex}) & 1)`;
        } else if (expressions.length === 2) {
          const start = this.generateExpression(expressions[0]);
          const width = this.generateExpression(expressions[1]);
          const mask = this.generateBitMask(width);
          if (start === "0") {
            return `((${registerName}) & ${mask})`;
          }
          return `((${registerName} >> ${start}) & ${mask})`;
        }
      }

      // ADR-036: Multi-dimensional array access (e.g., matrix[0][1] or screen.pixels[0][0])
      // Compile-time bounds checking for constant indices
      if (parts.length === 1) {
        // Simple array access: matrix[i][j]
        const typeInfo = this.context.typeRegistry.get(firstPart);
        if (typeInfo?.isArray && typeInfo.arrayDimensions) {
          this.typeValidator!.checkArrayBounds(
            firstPart,
            typeInfo.arrayDimensions,
            expressions,
            ctx.start?.line ?? 0,
            (expr) => this.tryEvaluateConstant(expr),
          );
        }
      }
      // TODO: Add bounds checking for struct.field[i][j] patterns

      const indices = expressions
        .map((e) => this.generateExpression(e))
        .join("][");

      if (parts.length > 1) {
        // Fix for Bug #2: Walk children in order to preserve operation sequence
        // For cfg.items[i].value, we need to emit: cfg.items[i].value
        // Not: cfg.items.value[i] (which the old heuristic generated)

        if (ctx.children) {
          // Walk parse tree children in order, building result incrementally
          // Bug #8 fix: Use while loop with proper child type detection
          // instead of fragile index arithmetic (i += 2)
          let result = firstPart;
          let idIndex = 1; // Start at 1 since we already used firstPart
          let exprIndex = 0;

          // Check if first identifier is a scope for special handling
          const isCrossScope = this.symbols!.knownScopes.has(firstPart);

          // ADR-016: Inside a scope, accessing another scope requires global. prefix
          if (isCrossScope && this.context.currentScope) {
            // Self-referential access should use 'this.'
            if (firstPart === this.context.currentScope) {
              throw new Error(
                `Error: Cannot reference own scope '${firstPart}' by name. Use 'this.${parts[1]}' instead of '${firstPart}.${parts[1]}'`,
              );
            }
            // Cross-scope access should use 'global.'
            throw new Error(
              `Error: Use 'global.${parts.join(".")}' to access scope '${firstPart}' from inside scope '${this.context.currentScope}'`,
            );
          }

          // Bug #8: Track struct types to detect bit access through chains
          // e.g., items[0].byte[7] where byte is u8 - final [7] is bit read
          let currentStructType: string | undefined;
          let lastMemberType: string | undefined;
          let lastMemberIsArray = false; // Track if last accessed member is an array
          const firstTypeInfo = this.context.typeRegistry.get(firstPart);
          if (firstTypeInfo) {
            currentStructType = this.isKnownStruct(firstTypeInfo.baseType)
              ? firstTypeInfo.baseType
              : undefined;
          }

          let i = 1;
          while (i < ctx.children.length) {
            const child = ctx.children[i];
            const childText = child.getText();

            if (childText === ".") {
              // Dot found - consume it, then get the next identifier
              i++;
              if (i < ctx.children.length && idIndex < parts.length) {
                const memberName = parts[idIndex];
                // Use underscore for first join if cross-scope, dot otherwise
                const separator = isCrossScope && idIndex === 1 ? "_" : ".";
                result += `${separator}${memberName}`;
                idIndex++;

                // Update type tracking for the member we just accessed
                if (currentStructType) {
                  const fields =
                    this.symbols!.structFields.get(currentStructType);
                  lastMemberType = fields?.get(memberName);
                  // Check if this member is an array field
                  const arrayFields =
                    this.symbols!.structFieldArrays.get(currentStructType);
                  lastMemberIsArray = arrayFields?.has(memberName) ?? false;
                  // Check if this member is itself a struct
                  if (lastMemberType && this.isKnownStruct(lastMemberType)) {
                    currentStructType = lastMemberType;
                  } else {
                    currentStructType = undefined;
                  }
                }
              }
            } else if (childText === "[") {
              // Opening bracket - check if this is bit access on primitive integer
              // Must NOT be an array field (e.g., indices[12] is array, not bit access)
              const isPrimitiveInt =
                lastMemberType &&
                !lastMemberIsArray &&
                ["u8", "u16", "u32", "u64", "i8", "i16", "i32", "i64"].includes(
                  lastMemberType,
                );
              const isLastExpr = exprIndex === expressions.length - 1;

              if (
                isPrimitiveInt &&
                isLastExpr &&
                exprIndex < expressions.length
              ) {
                // Bug #8: This is bit read on a struct member!
                // e.g., items[0].byte[7] -> ((items[0].byte >> 7) & 1)
                const bitIndex = this.generateExpression(
                  expressions[exprIndex],
                );
                return `((${result} >> ${bitIndex}) & 1)`;
              }

              // Normal array subscript
              if (exprIndex < expressions.length) {
                const expr = this.generateExpression(expressions[exprIndex]);
                result += `[${expr}]`;
                exprIndex++;

                // After subscripting an array, update type tracking
                if (firstTypeInfo?.isArray && exprIndex === 1) {
                  // First subscript on array - element type might be a struct
                  const elementType = firstTypeInfo.baseType;
                  if (this.isKnownStruct(elementType)) {
                    currentStructType = elementType;
                  }
                }
              }
              // Skip forward to find and pass the closing bracket
              while (
                i < ctx.children.length &&
                ctx.children[i].getText() !== "]"
              ) {
                i++;
              }
              // Reset lastMemberType after subscript (no longer on a member)
              lastMemberType = undefined;
            }
            i++;
          }
          return result;
        }

        // Fallback for simple cases without children
        const text = ctx.getText();
        const firstBracket = text.indexOf("[");
        const firstDot = text.indexOf(".");

        if (firstBracket !== -1 && firstBracket < firstDot) {
          // Pattern: arr[i].field -> indices come after first identifier
          const trailingMembers = parts.slice(1);
          if (trailingMembers.length > 0) {
            return `${firstPart}[${indices}].${trailingMembers.join(".")}`;
          }
          return `${firstPart}[${indices}]`;
        }

        // Pattern: struct.field[i][j] -> indices come at the end
        return `${parts.join(".")}[${indices}]`;
      }
      return `${firstPart}[${indices}]`;
    }

    const firstPart = parts[0];

    // Check if it's a register member access: GPIO7.DR -> GPIO7_DR
    if (this.symbols!.knownRegisters.has(firstPart)) {
      // ADR-016: Inside a scope, accessing a global register requires global. prefix
      if (this.context.currentScope) {
        throw new Error(
          `Error: Use 'global.${parts.join(".")}' to access register '${firstPart}' from inside scope '${this.context.currentScope}'`,
        );
      }
      // ADR-013: Check for write-only register members (wo = cannot read)
      // Skip check if we're in assignment target context (write operation)
      if (!this.inAssignmentTarget && parts.length >= 2) {
        const memberName = parts[1];
        const fullName = `${firstPart}_${memberName}`;
        const accessMod = this.symbols!.registerMemberAccess.get(fullName);
        if (accessMod === "wo") {
          throw new Error(
            `cannot read from write-only register member '${memberName}' ` +
              `(${firstPart}.${memberName} has 'wo' access modifier)`,
          );
        }
      }
      return parts.join("_");
    }

    // Check if it's a scope member access: Timing.tickCount -> Timing_tickCount (ADR-016)
    if (this.symbols!.knownScopes.has(firstPart)) {
      // ADR-016: Inside a scope, accessing another scope requires global. prefix
      if (this.context.currentScope) {
        // Self-referential access should use 'this.'
        if (firstPart === this.context.currentScope) {
          throw new Error(
            `Error: Cannot reference own scope '${firstPart}' by name. Use 'this.${parts[1]}' instead of '${firstPart}.${parts[1]}'`,
          );
        }
        // Cross-scope access should use 'global.'
        throw new Error(
          `Error: Use 'global.${parts.join(".")}' to access scope '${firstPart}' from inside scope '${this.context.currentScope}'`,
        );
      }
      return parts.join("_");
    }

    // ADR-006: Check if the first part is a struct parameter
    const paramInfo = this.context.currentParameters.get(firstPart);
    if (paramInfo && paramInfo.isStruct) {
      // Use -> for struct parameter member access
      if (parts.length === 1) {
        return firstPart;
      }
      return `${firstPart}->${parts.slice(1).join(".")}`;
    }

    return parts.join(".");
  }

  private generateArrayAccess(ctx: Parser.ArrayAccessContext): string {
    const name = ctx.IDENTIFIER().getText();
    const exprs = ctx.expression();

    if (exprs.length === 1) {
      // Single index: array[i] or bit access flags[3]
      // ADR-036: Compile-time bounds checking for constant indices
      const typeInfo = this.context.typeRegistry.get(name);

      // Check if this is a bitmap type
      if (typeInfo?.isBitmap && typeInfo.bitmapTypeName) {
        const line = ctx.start?.line ?? 0;
        throw new Error(
          `Error at line ${line}: Cannot use bracket indexing on bitmap type '${typeInfo.bitmapTypeName}'. ` +
            `Use named field access instead (e.g., ${name}.FIELD_NAME).`,
        );
      }

      if (typeInfo?.isArray && typeInfo.arrayDimensions) {
        this.typeValidator!.checkArrayBounds(
          name,
          typeInfo.arrayDimensions,
          exprs,
          ctx.start?.line ?? 0,
          (expr) => this.tryEvaluateConstant(expr),
        );
      }

      const index = this.generateExpression(exprs[0]);
      return `${name}[${index}]`;
    } else if (exprs.length === 2) {
      // Bit range: flags[start, width]
      const start = this.generateExpression(exprs[0]);
      const width = this.generateExpression(exprs[1]);
      const mask = this.generateBitMask(width);
      // Optimize: skip shift when start is 0
      if (start === "0") {
        return `((${name}) & ${mask})`;
      }
      // Generate bit range read: ((value >> start) & mask)
      return `((${name} >> ${start}) & ${mask})`;
    }

    return `${name}[/* error */]`;
  }

  // ========================================================================
  // Types
  // ========================================================================

  /**
   * Get the C-Next type name (for tracking purposes, not C translation)
   */
  private getTypeName(ctx: Parser.TypeContext): string {
    // ADR-016: Handle this.Type for scoped types (e.g., this.State -> Motor_State)
    if (ctx.scopedType()) {
      const typeName = ctx.scopedType()!.IDENTIFIER().getText();
      if (this.context.currentScope) {
        return `${this.context.currentScope}_${typeName}`;
      }
      return typeName;
    }
    // ADR-016: Handle Scope.Type from outside scope (e.g., Motor.State -> Motor_State)
    if (ctx.qualifiedType()) {
      const identifiers = ctx.qualifiedType()!.IDENTIFIER();
      const scopeName = identifiers[0].getText();
      const typeName = identifiers[1].getText();
      return `${scopeName}_${typeName}`;
    }
    if (ctx.userType()) {
      return ctx.userType()!.getText();
    }
    if (ctx.primitiveType()) {
      return ctx.primitiveType()!.getText();
    }
    return ctx.getText();
  }

  private generateType(ctx: Parser.TypeContext): string {
    if (ctx.primitiveType()) {
      const type = ctx.primitiveType()!.getText();
      // Track required includes based on type usage
      if (type === "bool") {
        this.needsStdbool = true;
      } else if (type === "ISR") {
        this.needsISR = true; // ADR-040: ISR function pointer typedef
      } else if (type in TYPE_MAP && type !== "void") {
        this.needsStdint = true;
      }
      return TYPE_MAP[type] || type;
    }
    // ADR-045: Handle bounded string type
    if (ctx.stringType()) {
      this.needsString = true;
      return "char"; // String declarations handle the array dimension separately
    }
    // ADR-016: Handle this.Type for scoped types (e.g., this.State -> Motor_State)
    if (ctx.scopedType()) {
      const typeName = ctx.scopedType()!.IDENTIFIER().getText();
      if (!this.context.currentScope) {
        throw new Error("Error: 'this.Type' can only be used inside a scope");
      }
      return `${this.context.currentScope}_${typeName}`;
    }
    // ADR-016: Handle Scope.Type from outside scope (e.g., Motor.State -> Motor_State)
    if (ctx.qualifiedType()) {
      const identifiers = ctx.qualifiedType()!.IDENTIFIER();
      const scopeName = identifiers[0].getText();
      const typeName = identifiers[1].getText();
      return `${scopeName}_${typeName}`;
    }
    if (ctx.userType()) {
      return ctx.userType()!.getText();
    }
    if (ctx.arrayType()) {
      const arrCtx = ctx.arrayType()!;
      let baseType: string;
      if (arrCtx.primitiveType()) {
        baseType =
          TYPE_MAP[arrCtx.primitiveType()!.getText()] ||
          arrCtx.primitiveType()!.getText();
      } else {
        baseType = arrCtx.userType()!.getText();
      }
      return baseType;
    }
    if (ctx.getText() === "void") {
      return "void";
    }
    return ctx.getText();
  }

  // ========================================================================
  // Helpers
  // ========================================================================

  private indent(text: string): string {
    const spaces = "    ".repeat(this.context.indentLevel);
    return text
      .split("\n")
      .map((line) => spaces + line)
      .join("\n");
  }

  // ========================================================================
  // strlen Optimization - Cache repeated .length accesses
  // ========================================================================

  /**
   * Analyze an expression tree and count .length accesses per string variable.
   * Returns a map of variable name -> access count.
   */
  private countStringLengthAccesses(
    ctx: Parser.ExpressionContext,
  ): Map<string, number> {
    const counts = new Map<string, number>();
    this.walkExpressionForLength(ctx, counts);
    return counts;
  }

  /**
   * Recursively walk an expression tree looking for .length accesses on string variables.
   */
  private walkExpressionForLength(
    ctx: Parser.ExpressionContext,
    counts: Map<string, number>,
  ): void {
    // Get the ternary expression (top level of expression)
    const ternary = ctx.ternaryExpression();
    if (ternary) {
      this.walkTernaryForLength(ternary, counts);
    }
  }

  private walkTernaryForLength(
    ctx: Parser.TernaryExpressionContext,
    counts: Map<string, number>,
  ): void {
    for (const orExpr of ctx.orExpression()) {
      this.walkOrExprForLength(orExpr, counts);
    }
  }

  private walkOrExprForLength(
    ctx: Parser.OrExpressionContext,
    counts: Map<string, number>,
  ): void {
    for (const andExpr of ctx.andExpression()) {
      this.walkAndExprForLength(andExpr, counts);
    }
  }

  private walkAndExprForLength(
    ctx: Parser.AndExpressionContext,
    counts: Map<string, number>,
  ): void {
    for (const eqExpr of ctx.equalityExpression()) {
      this.walkEqualityForLength(eqExpr, counts);
    }
  }

  private walkEqualityForLength(
    ctx: Parser.EqualityExpressionContext,
    counts: Map<string, number>,
  ): void {
    for (const relExpr of ctx.relationalExpression()) {
      this.walkRelationalForLength(relExpr, counts);
    }
  }

  private walkRelationalForLength(
    ctx: Parser.RelationalExpressionContext,
    counts: Map<string, number>,
  ): void {
    for (const borExpr of ctx.bitwiseOrExpression()) {
      this.walkBitwiseOrForLength(borExpr, counts);
    }
  }

  private walkBitwiseOrForLength(
    ctx: Parser.BitwiseOrExpressionContext,
    counts: Map<string, number>,
  ): void {
    for (const bxorExpr of ctx.bitwiseXorExpression()) {
      this.walkBitwiseXorForLength(bxorExpr, counts);
    }
  }

  private walkBitwiseXorForLength(
    ctx: Parser.BitwiseXorExpressionContext,
    counts: Map<string, number>,
  ): void {
    for (const bandExpr of ctx.bitwiseAndExpression()) {
      this.walkBitwiseAndForLength(bandExpr, counts);
    }
  }

  private walkBitwiseAndForLength(
    ctx: Parser.BitwiseAndExpressionContext,
    counts: Map<string, number>,
  ): void {
    for (const shiftExpr of ctx.shiftExpression()) {
      this.walkShiftForLength(shiftExpr, counts);
    }
  }

  private walkShiftForLength(
    ctx: Parser.ShiftExpressionContext,
    counts: Map<string, number>,
  ): void {
    for (const addExpr of ctx.additiveExpression()) {
      this.walkAdditiveForLength(addExpr, counts);
    }
  }

  private walkAdditiveForLength(
    ctx: Parser.AdditiveExpressionContext,
    counts: Map<string, number>,
  ): void {
    for (const multExpr of ctx.multiplicativeExpression()) {
      this.walkMultiplicativeForLength(multExpr, counts);
    }
  }

  private walkMultiplicativeForLength(
    ctx: Parser.MultiplicativeExpressionContext,
    counts: Map<string, number>,
  ): void {
    for (const unaryExpr of ctx.unaryExpression()) {
      this.walkUnaryForLength(unaryExpr, counts);
    }
  }

  private walkUnaryForLength(
    ctx: Parser.UnaryExpressionContext,
    counts: Map<string, number>,
  ): void {
    const postfix = ctx.postfixExpression();
    if (postfix) {
      this.walkPostfixForLength(postfix, counts);
    }
    // Also check nested unary expressions
    const nestedUnary = ctx.unaryExpression();
    if (nestedUnary) {
      this.walkUnaryForLength(nestedUnary, counts);
    }
  }

  private walkPostfixForLength(
    ctx: Parser.PostfixExpressionContext,
    counts: Map<string, number>,
  ): void {
    const primary = ctx.primaryExpression();
    const primaryId = primary.IDENTIFIER()?.getText();
    const ops = ctx.postfixOp();

    // Check for pattern: identifier.length where identifier is a string
    if (primaryId && ops.length > 0) {
      for (const op of ops) {
        const memberName = op.IDENTIFIER()?.getText();
        if (memberName === "length") {
          // Check if this is a string type
          const typeInfo = this.context.typeRegistry.get(primaryId);
          if (typeInfo?.isString) {
            const currentCount = counts.get(primaryId) || 0;
            counts.set(primaryId, currentCount + 1);
          }
        }
        // Walk any nested expressions in array accesses or function calls
        for (const expr of op.expression()) {
          this.walkExpressionForLength(expr, counts);
        }
      }
    }

    // Walk nested expression in primary if present
    if (primary.expression()) {
      this.walkExpressionForLength(primary.expression()!, counts);
    }
  }

  /**
   * Count .length accesses in a block's statements.
   */
  private countBlockLengthAccesses(
    ctx: Parser.BlockContext,
    counts: Map<string, number>,
  ): void {
    for (const stmt of ctx.statement()) {
      this.countStatementLengthAccesses(stmt, counts);
    }
  }

  /**
   * Count .length accesses in a statement.
   */
  private countStatementLengthAccesses(
    ctx: Parser.StatementContext,
    counts: Map<string, number>,
  ): void {
    // Assignment statement
    if (ctx.assignmentStatement()) {
      const assign = ctx.assignmentStatement()!;
      // Count in target (array index expressions)
      const target = assign.assignmentTarget();
      if (target.arrayAccess()) {
        for (const expr of target.arrayAccess()!.expression()) {
          this.walkExpressionForLength(expr, counts);
        }
      }
      // Count in value expression
      this.walkExpressionForLength(assign.expression(), counts);
    }
    // Expression statement
    if (ctx.expressionStatement()) {
      this.walkExpressionForLength(
        ctx.expressionStatement()!.expression(),
        counts,
      );
    }
    // Variable declaration
    if (ctx.variableDeclaration()) {
      const varDecl = ctx.variableDeclaration()!;
      if (varDecl.expression()) {
        this.walkExpressionForLength(varDecl.expression()!, counts);
      }
    }
    // Nested if/while/for would need recursion, but for now keep it simple
    if (ctx.block()) {
      this.countBlockLengthAccesses(ctx.block()!, counts);
    }
  }

  /**
   * Generate temp variable declarations for string lengths that are accessed 2+ times.
   * Returns the declarations as a string and populates the lengthCache.
   */
  private setupLengthCache(counts: Map<string, number>): string {
    const declarations: string[] = [];
    const cache = new Map<string, string>();

    for (const [varName, count] of counts) {
      if (count >= 2) {
        const tempVar = `_${varName}_len`;
        cache.set(varName, tempVar);
        declarations.push(`size_t ${tempVar} = strlen(${varName});`);
      }
    }

    if (declarations.length > 0) {
      this.context.lengthCache = cache;
      return declarations.join("\n") + "\n";
    }

    return "";
  }

  /**
   * Clear the length cache after generating a statement.
   */
  private clearLengthCache(): void {
    this.context.lengthCache = null;
  }

  // ========================================================================
  // ADR-044: Overflow Helper Functions
  // ========================================================================

  /**
   * Maps C-Next types to C max value macros from limits.h
   */
  private static readonly TYPE_MAX: Record<string, string> = {
    u8: "UINT8_MAX",
    u16: "UINT16_MAX",
    u32: "UINT32_MAX",
    u64: "UINT64_MAX",
    i8: "INT8_MAX",
    i16: "INT16_MAX",
    i32: "INT32_MAX",
    i64: "INT64_MAX",
  };

  /**
   * Maps C-Next types to C min value macros from limits.h
   */
  private static readonly TYPE_MIN: Record<string, string> = {
    u8: "0",
    u16: "0",
    u32: "0",
    u64: "0",
    i8: "INT8_MIN",
    i16: "INT16_MIN",
    i32: "INT32_MIN",
    i64: "INT64_MIN",
  };

  /**
   * Generate all needed overflow helper functions
   */
  private generateOverflowHelpers(): string[] {
    if (this.usedClampOps.size === 0) {
      return [];
    }

    const lines: string[] = [];

    if (this.debugMode) {
      lines.push(
        "// ADR-044: Debug overflow helper functions (panic on overflow)",
      );
      lines.push("#include <limits.h>");
      lines.push("#include <stdio.h>");
      lines.push("#include <stdlib.h>");
    } else {
      lines.push("// ADR-044: Overflow helper functions");
      lines.push("#include <limits.h>");
    }
    lines.push("");

    // Sort for deterministic output
    const sortedOps = Array.from(this.usedClampOps).sort();

    for (const op of sortedOps) {
      const [operation, cnxType] = op.split("_");
      const helper = this.debugMode
        ? this.generateDebugHelper(operation, cnxType)
        : this.generateSingleHelper(operation, cnxType);
      if (helper) {
        lines.push(helper);
        lines.push("");
      }
    }

    return lines;
  }

  /**
   * Generate a single overflow helper function
   */
  private generateSingleHelper(
    operation: string,
    cnxType: string,
  ): string | null {
    const cType = TYPE_MAP[cnxType];
    const widerType = WIDER_TYPE_MAP[cnxType] || cType;
    const maxValue = CodeGenerator.TYPE_MAX[cnxType];
    const minValue = CodeGenerator.TYPE_MIN[cnxType];

    if (!cType || !maxValue) {
      return null;
    }

    const isUnsigned = cnxType.startsWith("u");

    // For signed types narrower than i64, use wider arithmetic to avoid UB (Issue #94)
    const useWiderArithmetic =
      !isUnsigned && widerType !== cType && cnxType !== "i64";

    switch (operation) {
      case "add":
        if (isUnsigned) {
          // Unsigned addition: use wider type for b to prevent truncation (Issue #94)
          return `static inline ${cType} cnx_clamp_add_${cnxType}(${cType} a, ${widerType} b) {
    if (b > ${maxValue} - a) return ${maxValue};
    return a + (${cType})b;
}`;
        } else if (useWiderArithmetic) {
          // Signed addition: compute in wider type, then clamp (Issue #94)
          // This avoids UB from casting out-of-range values
          return `static inline ${cType} cnx_clamp_add_${cnxType}(${cType} a, ${widerType} b) {
    ${widerType} result = (${widerType})a + b;
    if (result > ${maxValue}) return ${maxValue};
    if (result < ${minValue}) return ${minValue};
    return (${cType})result;
}`;
        } else {
          // i64: already widest type, use original check logic
          return `static inline ${cType} cnx_clamp_add_${cnxType}(${cType} a, ${cType} b) {
    if (b > 0 && a > ${maxValue} - b) return ${maxValue};
    if (b < 0 && a < ${minValue} - b) return ${minValue};
    return a + b;
}`;
        }

      case "sub":
        if (isUnsigned) {
          // Unsigned subtraction: use wider type for b to prevent truncation (Issue #94)
          // Cast a to wider type for comparison to handle b > type max
          return `static inline ${cType} cnx_clamp_sub_${cnxType}(${cType} a, ${widerType} b) {
    if (b >= (${widerType})a) return 0;
    return a - (${cType})b;
}`;
        } else if (useWiderArithmetic) {
          // Signed subtraction: compute in wider type, then clamp (Issue #94)
          return `static inline ${cType} cnx_clamp_sub_${cnxType}(${cType} a, ${widerType} b) {
    ${widerType} result = (${widerType})a - b;
    if (result > ${maxValue}) return ${maxValue};
    if (result < ${minValue}) return ${minValue};
    return (${cType})result;
}`;
        } else {
          // i64: already widest type, use original check logic
          return `static inline ${cType} cnx_clamp_sub_${cnxType}(${cType} a, ${cType} b) {
    if (b < 0 && a > ${maxValue} + b) return ${maxValue};
    if (b > 0 && a < ${minValue} + b) return ${minValue};
    return a - b;
}`;
        }

      case "mul":
        if (isUnsigned) {
          // Unsigned multiplication: use wider type for b to prevent truncation (Issue #94)
          return `static inline ${cType} cnx_clamp_mul_${cnxType}(${cType} a, ${widerType} b) {
    if (b != 0 && a > ${maxValue} / b) return ${maxValue};
    return a * (${cType})b;
}`;
        } else if (useWiderArithmetic) {
          // Signed multiplication: compute in wider type, then clamp (Issue #94)
          return `static inline ${cType} cnx_clamp_mul_${cnxType}(${cType} a, ${widerType} b) {
    ${widerType} result = (${widerType})a * b;
    if (result > ${maxValue}) return ${maxValue};
    if (result < ${minValue}) return ${minValue};
    return (${cType})result;
}`;
        } else {
          // i64: already widest type, use original check logic
          return `static inline ${cType} cnx_clamp_mul_${cnxType}(${cType} a, ${cType} b) {
    if (a == 0 || b == 0) return 0;
    if (a > 0 && b > 0 && a > ${maxValue} / b) return ${maxValue};
    if (a < 0 && b < 0 && a < ${maxValue} / b) return ${maxValue};
    if (a > 0 && b < 0 && b < ${minValue} / a) return ${minValue};
    if (a < 0 && b > 0 && a < ${minValue} / b) return ${minValue};
    return a * b;
}`;
        }

      default:
        return null;
    }
  }

  /**
   * Generate a single debug helper function (panics on overflow)
   */
  private generateDebugHelper(
    operation: string,
    cnxType: string,
  ): string | null {
    const cType = TYPE_MAP[cnxType];
    const widerType = WIDER_TYPE_MAP[cnxType] || cType;
    const maxValue = CodeGenerator.TYPE_MAX[cnxType];
    const minValue = CodeGenerator.TYPE_MIN[cnxType];

    if (!cType || !maxValue) {
      return null;
    }

    const isUnsigned = cnxType.startsWith("u");
    const opName =
      operation === "add"
        ? "addition"
        : operation === "sub"
          ? "subtraction"
          : "multiplication";

    // For signed types narrower than i64, use wider arithmetic to avoid UB (Issue #94)
    const useWiderArithmetic =
      !isUnsigned && widerType !== cType && cnxType !== "i64";

    switch (operation) {
      case "add":
        if (isUnsigned) {
          // Use wider type for b to prevent truncation (Issue #94)
          return `static inline ${cType} cnx_clamp_add_${cnxType}(${cType} a, ${widerType} b) {
    if (b > ${maxValue} - a) {
        fprintf(stderr, "PANIC: Integer overflow in ${cnxType} ${opName}\\n");
        abort();
    }
    return a + (${cType})b;
}`;
        } else if (useWiderArithmetic) {
          // Signed addition: compute in wider type, check bounds (Issue #94)
          return `static inline ${cType} cnx_clamp_add_${cnxType}(${cType} a, ${widerType} b) {
    ${widerType} result = (${widerType})a + b;
    if (result > ${maxValue} || result < ${minValue}) {
        fprintf(stderr, "PANIC: Integer overflow in ${cnxType} ${opName}\\n");
        abort();
    }
    return (${cType})result;
}`;
        } else {
          // i64: already widest type, use original check logic
          return `static inline ${cType} cnx_clamp_add_${cnxType}(${cType} a, ${cType} b) {
    if ((b > 0 && a > ${maxValue} - b) || (b < 0 && a < ${minValue} - b)) {
        fprintf(stderr, "PANIC: Integer overflow in ${cnxType} ${opName}\\n");
        abort();
    }
    return a + b;
}`;
        }

      case "sub":
        if (isUnsigned) {
          // Use wider type for b to prevent truncation (Issue #94)
          return `static inline ${cType} cnx_clamp_sub_${cnxType}(${cType} a, ${widerType} b) {
    if (b >= (${widerType})a) {
        fprintf(stderr, "PANIC: Integer underflow in ${cnxType} ${opName}\\n");
        abort();
    }
    return a - (${cType})b;
}`;
        } else if (useWiderArithmetic) {
          // Signed subtraction: compute in wider type, check bounds (Issue #94)
          return `static inline ${cType} cnx_clamp_sub_${cnxType}(${cType} a, ${widerType} b) {
    ${widerType} result = (${widerType})a - b;
    if (result > ${maxValue} || result < ${minValue}) {
        fprintf(stderr, "PANIC: Integer overflow in ${cnxType} ${opName}\\n");
        abort();
    }
    return (${cType})result;
}`;
        } else {
          // i64: already widest type, use original check logic
          return `static inline ${cType} cnx_clamp_sub_${cnxType}(${cType} a, ${cType} b) {
    if ((b < 0 && a > ${maxValue} + b) || (b > 0 && a < ${minValue} + b)) {
        fprintf(stderr, "PANIC: Integer overflow in ${cnxType} ${opName}\\n");
        abort();
    }
    return a - b;
}`;
        }

      case "mul":
        if (isUnsigned) {
          // Use wider type for b to prevent truncation (Issue #94)
          return `static inline ${cType} cnx_clamp_mul_${cnxType}(${cType} a, ${widerType} b) {
    if (b != 0 && a > ${maxValue} / b) {
        fprintf(stderr, "PANIC: Integer overflow in ${cnxType} ${opName}\\n");
        abort();
    }
    return a * (${cType})b;
}`;
        } else if (useWiderArithmetic) {
          // Signed multiplication: compute in wider type, check bounds (Issue #94)
          return `static inline ${cType} cnx_clamp_mul_${cnxType}(${cType} a, ${widerType} b) {
    ${widerType} result = (${widerType})a * b;
    if (result > ${maxValue} || result < ${minValue}) {
        fprintf(stderr, "PANIC: Integer overflow in ${cnxType} ${opName}\\n");
        abort();
    }
    return (${cType})result;
}`;
        } else {
          // i64: already widest type, use original check logic
          return `static inline ${cType} cnx_clamp_mul_${cnxType}(${cType} a, ${cType} b) {
    if (a != 0 && b != 0) {
        if ((a > 0 && b > 0 && a > ${maxValue} / b) ||
            (a < 0 && b < 0 && a < ${maxValue} / b) ||
            (a > 0 && b < 0 && b < ${minValue} / a) ||
            (a < 0 && b > 0 && a < ${minValue} / b)) {
            fprintf(stderr, "PANIC: Integer overflow in ${cnxType} ${opName}\\n");
            abort();
        }
    }
    return a * b;
}`;
        }

      default:
        return null;
    }
  }

  /**
   * Mark a clamp operation as used (will trigger helper generation)
   */
  private markClampOpUsed(operation: string, cnxType: string): void {
    // Only generate helpers for integer types (not float/bool)
    if (TYPE_WIDTH[cnxType] && !cnxType.startsWith("f") && cnxType !== "bool") {
      this.usedClampOps.add(`${operation}_${cnxType}`);
    }
  }

  // ========================================================================
  // Preprocessor Directive Handling (ADR-037)
  // ========================================================================

  /**
   * Process a preprocessor directive
   * - Flag-only defines (#define FLAG): pass through
   * - Value defines (#define FLAG value): ERROR E0502
   * - Function macros (#define NAME(args)): ERROR E0501
   * - Conditional directives: pass through
   */
  private processPreprocessorDirective(
    ctx: Parser.PreprocessorDirectiveContext,
  ): string | null {
    if (ctx.defineDirective()) {
      return this.processDefineDirective(ctx.defineDirective()!);
    }
    if (ctx.conditionalDirective()) {
      return this.processConditionalDirective(ctx.conditionalDirective()!);
    }
    return null;
  }

  /**
   * Process a #define directive
   * Only flag-only defines are allowed; value and function macros produce errors
   */
  private processDefineDirective(
    ctx: Parser.DefineDirectiveContext,
  ): string | null {
    const text = ctx.getText();

    // Check for function-like macro: #define NAME(
    if (ctx.DEFINE_FUNCTION()) {
      const name = this.extractDefineName(text);
      const line = ctx.start?.line ?? 0;
      throw new Error(
        `E0501: Function-like macro '${name}' is not allowed. ` +
          `Use inline functions instead. Line ${line}`,
      );
    }

    // Check for value define: #define NAME value
    if (ctx.DEFINE_WITH_VALUE()) {
      const name = this.extractDefineName(text);
      const line = ctx.start?.line ?? 0;
      throw new Error(
        `E0502: #define with value '${name}' is not allowed. ` +
          `Use 'const' instead: const u32 ${name} <- value; Line ${line}`,
      );
    }

    // Flag-only define: pass through
    if (ctx.DEFINE_FLAG()) {
      return text.trim();
    }

    return null;
  }

  /**
   * Process a conditional compilation directive (#ifdef, #ifndef, #else, #endif)
   * These are passed through unchanged
   */
  private processConditionalDirective(
    ctx: Parser.ConditionalDirectiveContext,
  ): string {
    return ctx.getText().trim();
  }

  /**
   * Extract the macro name from a #define directive
   */
  private extractDefineName(text: string): string {
    const match = text.match(/#\s*define\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
    return match ? match[1] : "unknown";
  }

  // ========================================================================
  // Comment Handling (ADR-043)
  // ========================================================================

  /**
   * Get comments that appear before a parse tree node
   */
  private getLeadingComments(ctx: {
    start?: { tokenIndex: number } | null;
  }): IComment[] {
    if (!this.commentExtractor || !ctx.start) return [];
    return this.commentExtractor.getCommentsBefore(ctx.start.tokenIndex);
  }

  /**
   * Get inline comments that appear after a parse tree node (same line)
   */
  private getTrailingComments(ctx: {
    stop?: { tokenIndex: number } | null;
  }): IComment[] {
    if (!this.commentExtractor || !ctx.stop) return [];
    return this.commentExtractor.getCommentsAfter(ctx.stop.tokenIndex);
  }

  /**
   * Format leading comments with current indentation
   */
  private formatLeadingComments(comments: IComment[]): string[] {
    if (comments.length === 0) return [];
    const indent = "    ".repeat(this.context.indentLevel);
    return this.commentFormatter.formatLeadingComments(comments, indent);
  }

  /**
   * Format a trailing/inline comment
   */
  private formatTrailingComment(comments: IComment[]): string {
    if (comments.length === 0) return "";
    // Only use the first comment for inline
    return this.commentFormatter.formatTrailingComment(comments[0]);
  }

  /**
   * ADR-051: Generate safe division helper functions for used integer types only
   */
  private generateSafeDivHelpers(): string[] {
    if (this.usedSafeDivOps.size === 0) {
      return [];
    }

    const lines: string[] = [];

    lines.push("// ADR-051: Safe division helper functions");
    lines.push("#include <stdbool.h>");
    lines.push("");

    const integerTypes = ["u8", "u16", "u32", "u64", "i8", "i16", "i32", "i64"];

    for (const cnxType of integerTypes) {
      const needsDiv = this.usedSafeDivOps.has(`div_${cnxType}`);
      const needsMod = this.usedSafeDivOps.has(`mod_${cnxType}`);

      if (!needsDiv && !needsMod) {
        continue; // Skip types that aren't used
      }

      const cType = TYPE_MAP[cnxType];

      // Generate safe_div helper if needed
      if (needsDiv) {
        lines.push(
          `static inline bool cnx_safe_div_${cnxType}(${cType}* output, ${cType} numerator, ${cType} divisor, ${cType} defaultValue) {`,
        );
        lines.push(`    if (divisor == 0) {`);
        lines.push(`        *output = defaultValue;`);
        lines.push(`        return true;  // Error occurred`);
        lines.push(`    }`);
        lines.push(`    *output = numerator / divisor;`);
        lines.push(`    return false;  // Success`);
        lines.push(`}`);
        lines.push("");
      }

      // Generate safe_mod helper if needed
      if (needsMod) {
        lines.push(
          `static inline bool cnx_safe_mod_${cnxType}(${cType}* output, ${cType} numerator, ${cType} divisor, ${cType} defaultValue) {`,
        );
        lines.push(`    if (divisor == 0) {`);
        lines.push(`        *output = defaultValue;`);
        lines.push(`        return true;  // Error occurred`);
        lines.push(`    }`);
        lines.push(`    *output = numerator % divisor;`);
        lines.push(`    return false;  // Success`);
        lines.push(`}`);
        lines.push("");
      }
    }

    return lines;
  }
}
