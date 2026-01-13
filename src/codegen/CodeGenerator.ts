/**
 * C-Next Code Generator
 * Transforms C-Next AST to clean, readable C code
 */

import { CommonTokenStream } from "antlr4ng";
import * as Parser from "../parser/grammar/CNextParser.js";
import SymbolTable from "../symbols/SymbolTable.js";
import ESourceLanguage from "../types/ESourceLanguage.js";
import ESymbolKind from "../types/ESymbolKind.js";
import CommentExtractor from "./CommentExtractor.js";
import CommentFormatter from "./CommentFormatter.js";
import IComment from "./types/IComment.js";
import {
  TYPE_WIDTH,
  BITMAP_SIZE,
  BITMAP_BACKING_TYPE,
} from "./types/TTypeConstants.js";
import TTypeInfo from "./types/TTypeInfo.js";
import TParameterInfo from "./types/TParameterInfo.js";
import TOverflowBehavior from "./types/TOverflowBehavior.js";
import TypeResolver from "./TypeResolver.js";
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
 * Options for the code generator
 */
export interface ICodeGeneratorOptions {
  /** ADR-044: When true, generate panic helpers instead of clamp helpers */
  debugMode?: boolean;
  /** ADR-049: CLI/config target override (takes priority over #pragma target) */
  target?: string;
  /** ADR-010: Source file path for validating includes */
  sourcePath?: string;
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

  private knownScopes: Set<string> = new Set(); // ADR-016: renamed from knownNamespaces

  private knownStructs: Set<string> = new Set();

  private structFields: Map<string, Map<string, string>> = new Map(); // struct -> (field -> type)

  private structFieldArrays: Map<string, Set<string>> = new Map(); // struct -> set of array field names

  private structFieldDimensions: Map<string, Map<string, number[]>> = new Map(); // struct -> (field -> dimensions)

  private knownRegisters: Set<string> = new Set();

  private inAssignmentTarget: boolean = false;

  private scopedRegisters: Map<string, string> = new Map(); // fullRegName -> scopeName (for scoped registers)

  private knownFunctions: Set<string> = new Set(); // Track C-Next defined functions

  private functionSignatures: Map<string, FunctionSignature> = new Map(); // ADR-013: Track function parameter const-ness

  private registerMemberAccess: Map<string, string> = new Map(); // "GPIO7_DR_SET" -> "wo"

  private registerMemberTypes: Map<string, string> = new Map(); // "MOTOR_CTRL" -> "MotorControl" (for bitmap types)

  private knownEnums: Set<string> = new Set(); // ADR-017: Track enum types

  private enumMembers: Map<string, Map<string, number>> = new Map(); // ADR-017: enumName -> (memberName -> value)

  // ADR-034: Bitmap types registry
  private knownBitmaps: Set<string> = new Set(); // Track bitmap type names

  private bitmapFields: Map<
    string,
    Map<string, { offset: number; width: number }>
  > = new Map(); // bitmapName -> (fieldName -> info)

  private bitmapBackingType: Map<string, string> = new Map(); // bitmapName -> C backing type

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
   * Check if a type name is a known struct (from C-Next or C headers)
   */
  private isKnownStruct(typeName: string): boolean {
    // Check local C-Next structs
    if (this.knownStructs.has(typeName)) {
      return true;
    }

    // Check SymbolTable for C header structs
    if (this.symbolTable) {
      const symbols = this.symbolTable.getOverloads(typeName);
      for (const sym of symbols) {
        if (sym.kind === ESymbolKind.Struct) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Convert C type name to C-Next type name for TYPE_WIDTH lookup
   * E.g., "uint32_t" -> "u32", "int16_t" -> "i16"
   */
  private normalizeCTypeForLookup(cType: string): string {
    // Remove qualifiers and whitespace
    const cleanType = cType
      .trim()
      .replace(/\b(const|volatile)\b/g, "")
      .trim();

    // Map C stdint types to C-Next types
    const cTypeMap: Record<string, string> = {
      uint8_t: "u8",
      uint16_t: "u16",
      uint32_t: "u32",
      uint64_t: "u64",
      int8_t: "i8",
      int16_t: "i16",
      int32_t: "i32",
      int64_t: "i64",
      float: "f32",
      double: "f64",
      _Bool: "bool",
      bool: "bool",
    };

    return cTypeMap[cleanType] || cleanType;
  }

  /**
   * Get struct field type and dimensions from both local structs and SymbolTable
   * Returns {type, dimensions} or null if not found
   */
  private getStructFieldInfo(
    structName: string,
    fieldName: string,
  ): { type: string; dimensions?: number[] } | null {
    // First check local C-Next structs
    const localFields = this.structFields.get(structName);
    if (localFields) {
      const fieldType = localFields.get(fieldName);
      if (fieldType) {
        const fieldDimensions = this.structFieldDimensions.get(structName);
        const dimensions = fieldDimensions?.get(fieldName);
        return {
          type: fieldType,
          dimensions:
            dimensions && dimensions.length > 0 ? dimensions : undefined,
        };
      }
    }

    // TODO: Add SymbolTable integration when Issue #45 is merged
    // For now, only check local C-Next structs

    return null;
  }

  /**
   * Check if an assignment target is a string that requires strcpy()
   * Handles: arr[0], struct.arr[0], this.arr[0], Scope.arr[0]
   */
  private isStringAssignmentTarget(
    targetCtx: Parser.AssignmentTargetContext,
  ): boolean {
    // Case 1: Simple array access - arr[0]
    if (targetCtx.arrayAccess()) {
      const arrayName = targetCtx.arrayAccess()!.IDENTIFIER().getText();
      const typeInfo = this.context.typeRegistry.get(arrayName);

      // Check if it's a string array (has isString and multiple dimensions)
      if (
        typeInfo &&
        typeInfo.isString &&
        typeInfo.arrayDimensions &&
        typeInfo.arrayDimensions.length > 1
      ) {
        return true;
      }
    }

    // Case 2: Member access - struct.arr[0]
    if (targetCtx.memberAccess()) {
      const memberAccessCtx = targetCtx.memberAccess()!;
      const identifiers = memberAccessCtx.IDENTIFIER();
      const expressions = memberAccessCtx.expression();

      if (identifiers.length >= 2 && expressions.length > 0) {
        const rootName = identifiers[0].getText();
        const memberName = identifiers[1].getText();

        // Get root type
        const rootTypeInfo = this.context.typeRegistry.get(rootName);
        if (rootTypeInfo && this.isKnownStruct(rootTypeInfo.baseType)) {
          const structType = rootTypeInfo.baseType;
          const fieldInfo = this.getStructFieldInfo(structType, memberName);

          // Check if the field is a string array
          if (
            fieldInfo &&
            fieldInfo.type.startsWith("string<") &&
            fieldInfo.dimensions &&
            fieldInfo.dimensions.length > 1
          ) {
            return true;
          }
        }
      }
    }

    // Case 3: This array access - this.arr[0] (within a scope)
    if (targetCtx.thisArrayAccess()) {
      const thisArrayAccessCtx = targetCtx.thisArrayAccess()!;
      const identifiers = thisArrayAccessCtx.IDENTIFIER();

      if (identifiers.length >= 1 && this.context.currentScope) {
        const memberName = identifiers[0].getText();
        const scopedName = `${this.context.currentScope}_${memberName}`;

        const typeInfo = this.context.typeRegistry.get(scopedName);
        if (
          typeInfo &&
          typeInfo.isString &&
          typeInfo.arrayDimensions &&
          typeInfo.arrayDimensions.length > 1
        ) {
          return true;
        }
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

    // Initialize type resolver for type classification and validation
    this.typeResolver = new TypeResolver(this);

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
    this.knownScopes = new Set(); // ADR-016
    this.knownStructs = new Set();
    this.structFields = new Map();
    this.structFieldArrays = new Map();
    this.structFieldDimensions = new Map();
    this.knownRegisters = new Set();
    this.scopedRegisters = new Map(); // Scoped register tracking
    this.knownFunctions = new Set();
    this.functionSignatures = new Map();
    this.registerMemberAccess = new Map();
    this.registerMemberTypes = new Map(); // ADR-034: Reset register member types (for bitmap in register)
    this.knownEnums = new Set();
    this.enumMembers = new Map();
    this.knownBitmaps = new Set(); // ADR-034: Reset bitmap types
    this.bitmapFields = new Map(); // ADR-034: Reset bitmap fields
    this.bitmapBackingType = new Map(); // ADR-034: Reset bitmap backing types
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
    this.collectSymbols(tree);

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
    // ADR-010: Transform .cnx includes to .h
    for (const includeDir of tree.includeDirective()) {
      const leadingComments = this.getLeadingComments(includeDir);
      output.push(...this.formatLeadingComments(leadingComments));
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

  /**
   * First pass: collect all scope member names (ADR-016)
   */
  private collectSymbols(tree: Parser.ProgramContext): void {
    for (const decl of tree.declaration()) {
      // ADR-016: Handle scope declarations (renamed from namespace)
      if (decl.scopeDeclaration()) {
        const scopeDecl = decl.scopeDeclaration()!;
        const name = scopeDecl.IDENTIFIER().getText();
        this.knownScopes.add(name);

        const members = new Set<string>();
        for (const member of scopeDecl.scopeMember()) {
          if (member.variableDeclaration()) {
            members.add(member.variableDeclaration()!.IDENTIFIER().getText());
          }
          if (member.functionDeclaration()) {
            const funcDecl = member.functionDeclaration()!;
            const funcName = funcDecl.IDENTIFIER().getText();
            members.add(funcName);
            // Track fully qualified function name: Scope_function
            const fullName = `${name}_${funcName}`;
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
          // ADR-017: Collect enums declared inside scopes
          if (member.enumDeclaration()) {
            const enumDecl = member.enumDeclaration()!;
            const enumName = enumDecl.IDENTIFIER().getText();
            members.add(enumName);
            // Collect enum with scope prefix (e.g., Motor_State)
            this.collectEnum(enumDecl, name);
          }
          // ADR-034: Collect bitmaps declared inside scopes (before registers!)
          if (member.bitmapDeclaration()) {
            const bitmapDecl = member.bitmapDeclaration()!;
            const bitmapName = bitmapDecl.IDENTIFIER().getText();
            members.add(bitmapName);
            // Collect bitmap with scope prefix (e.g., Teensy4_GPIO7Pins)
            this.collectBitmap(bitmapDecl, name);
          }
          // Handle registers declared inside scopes
          if (member.registerDeclaration()) {
            const regDecl = member.registerDeclaration()!;
            const regName = regDecl.IDENTIFIER().getText();
            const fullRegName = `${name}_${regName}`; // Scope_RegisterName
            members.add(regName);

            // Track the prefixed register name
            this.knownRegisters.add(fullRegName);
            this.scopedRegisters.set(fullRegName, name);

            // Track access modifiers and types for each register member
            for (const regMember of regDecl.registerMember()) {
              const memberName = regMember.IDENTIFIER().getText();
              const accessMod = regMember.accessModifier().getText();
              const fullMemberName = `${fullRegName}_${memberName}`; // Scope_Register_Member
              this.registerMemberAccess.set(fullMemberName, accessMod);

              // Track register member type (especially for bitmap types)
              // Check both unscoped and scoped bitmap names
              const typeName = this.getTypeName(regMember.type());
              const scopedTypeName = `${name}_${typeName}`;
              if (this.knownBitmaps.has(scopedTypeName)) {
                this.registerMemberTypes.set(fullMemberName, scopedTypeName);
              } else if (this.knownBitmaps.has(typeName)) {
                this.registerMemberTypes.set(fullMemberName, typeName);
              }
            }
          }
        }
        this.context.scopeMembers.set(name, members);
      }

      if (decl.structDeclaration()) {
        const structDecl = decl.structDeclaration()!;
        const name = structDecl.IDENTIFIER().getText();
        this.knownStructs.add(name);

        // Track field types for inferred struct initializers
        const fields = new Map<string, string>();
        const arrayFields = new Set<string>();
        const fieldDimensions = new Map<string, number[]>();
        for (const member of structDecl.structMember()) {
          const fieldName = member.IDENTIFIER().getText();
          const typeCtx = member.type();
          const fieldType = this.getTypeName(typeCtx);
          fields.set(fieldName, fieldType);

          const arrayDims = member.arrayDimension();
          const dimensions: number[] = [];

          // Check if this is a string type
          if (typeCtx.stringType()) {
            const stringCtx = typeCtx.stringType()!;
            const intLiteral = stringCtx.INTEGER_LITERAL();

            if (intLiteral) {
              const capacity = parseInt(intLiteral.getText(), 10);

              // If there are array dimensions, they come BEFORE string capacity
              if (arrayDims.length > 0) {
                for (const dim of arrayDims) {
                  const sizeExpr = dim.expression();
                  if (sizeExpr) {
                    const size = parseInt(sizeExpr.getText(), 10);
                    if (!isNaN(size)) {
                      dimensions.push(size);
                    }
                  }
                }
              }
              // Always add string capacity as final dimension
              dimensions.push(capacity + 1);
              arrayFields.add(fieldName);
            }
          } else if (arrayDims.length > 0) {
            // Non-string array field (existing logic)
            arrayFields.add(fieldName);
            for (const dim of arrayDims) {
              const sizeExpr = dim.expression();
              if (sizeExpr) {
                const size = parseInt(sizeExpr.getText(), 10);
                if (!isNaN(size)) {
                  dimensions.push(size);
                }
              }
            }
          }

          if (dimensions.length > 0) {
            fieldDimensions.set(fieldName, dimensions);
          }

          // ADR-029: Track callback field types during symbol collection
          // (needed to know which functions need typedefs before generation)
          if (this.callbackTypes.has(fieldType)) {
            this.callbackFieldTypes.set(`${name}.${fieldName}`, fieldType);
          }
        }
        this.structFields.set(name, fields);
        this.structFieldArrays.set(name, arrayFields);
        this.structFieldDimensions.set(name, fieldDimensions);
      }

      // ADR-017: Handle enum declarations
      if (decl.enumDeclaration()) {
        this.collectEnum(decl.enumDeclaration()!);
      }

      // ADR-034: Handle bitmap declarations
      if (decl.bitmapDeclaration()) {
        this.collectBitmap(decl.bitmapDeclaration()!);
      }

      if (decl.registerDeclaration()) {
        const regDecl = decl.registerDeclaration()!;
        const regName = regDecl.IDENTIFIER().getText();
        this.knownRegisters.add(regName);

        // Track access modifiers and types for each register member
        for (const member of regDecl.registerMember()) {
          const memberName = member.IDENTIFIER().getText();
          const accessMod = member.accessModifier().getText(); // rw, ro, wo, w1c, w1s
          const fullName = `${regName}_${memberName}`;
          this.registerMemberAccess.set(fullName, accessMod);

          // ADR-034: Track register member type (especially for bitmap types)
          const typeName = this.getTypeName(member.type());
          if (this.knownBitmaps.has(typeName)) {
            this.registerMemberTypes.set(fullName, typeName);
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
      }

      // Register scope member variable types
      if (decl.scopeDeclaration()) {
        const scopeDecl = decl.scopeDeclaration()!;
        const scopeName = scopeDecl.IDENTIFIER().getText();

        for (const member of scopeDecl.scopeMember()) {
          if (member.variableDeclaration()) {
            const varDecl = member.variableDeclaration()!;
            const varName = varDecl.IDENTIFIER().getText();
            const fullName = `${scopeName}_${varName}`;
            // Register with mangled name (Scope_variable)
            this.trackVariableTypeWithName(varDecl, fullName);
          }
        }
      }

      // Note: Function parameters are registered per-function during generation
      // since they're scoped to the function body
    }
  }

  /**
   * ADR-017: Collect enum declaration and track members
   */
  private collectEnum(
    enumDecl: Parser.EnumDeclarationContext,
    scopeName?: string,
  ): void {
    const name = enumDecl.IDENTIFIER().getText();
    const fullName = scopeName ? `${scopeName}_${name}` : name;
    this.knownEnums.add(fullName);

    // Collect member values
    const members = new Map<string, number>();
    let currentValue = 0;

    for (const member of enumDecl.enumMember()) {
      const memberName = member.IDENTIFIER().getText();

      if (member.expression()) {
        // Explicit value with <-
        const valueText = member.expression()!.getText();
        const value = this.evaluateConstantExpression(valueText);
        if (value < 0) {
          throw new Error(
            `Error: Negative values not allowed in enum (found ${value} in ${fullName}.${memberName})`,
          );
        }
        currentValue = value;
      }

      members.set(memberName, currentValue);
      currentValue++;
    }

    this.enumMembers.set(fullName, members);
  }

  /**
   * ADR-034: Collect bitmap declaration and validate total bits
   */
  private collectBitmap(
    bitmapDecl: Parser.BitmapDeclarationContext,
    scopeName?: string,
  ): void {
    const name = bitmapDecl.IDENTIFIER().getText();
    const fullName = scopeName ? `${scopeName}_${name}` : name;
    const bitmapType = bitmapDecl.bitmapType().getText();
    const expectedBits = BITMAP_SIZE[bitmapType];

    this.knownBitmaps.add(fullName);
    this.bitmapBackingType.set(fullName, BITMAP_BACKING_TYPE[bitmapType]);

    // Collect fields and validate total bits
    const fields = new Map<string, { offset: number; width: number }>();
    let totalBits = 0;

    for (const member of bitmapDecl.bitmapMember()) {
      const fieldName = member.IDENTIFIER().getText();
      const widthLiteral = member.INTEGER_LITERAL();
      const width = widthLiteral ? parseInt(widthLiteral.getText(), 10) : 1;

      fields.set(fieldName, { offset: totalBits, width });
      totalBits += width;
    }

    // Validate total bits equals bitmap size
    if (totalBits !== expectedBits) {
      throw new Error(
        `Error: Bitmap '${fullName}' has ${totalBits} bits but ${bitmapType} requires exactly ${expectedBits} bits`,
      );
    }

    this.bitmapFields.set(fullName, fields);
  }

  /**
   * ADR-034: Validate that a literal value fits in a bitmap field
   */
  private validateBitmapFieldLiteral(
    expr: Parser.ExpressionContext,
    width: number,
    fieldName: string,
  ): void {
    const text = expr.getText().trim();
    const maxValue = (1 << width) - 1;

    // Check for integer literals
    let value: number | null = null;

    if (text.match(/^\d+$/)) {
      value = parseInt(text, 10);
    } else if (text.match(/^0[xX][0-9a-fA-F]+$/)) {
      value = parseInt(text, 16);
    } else if (text.match(/^0[bB][01]+$/)) {
      value = parseInt(text.substring(2), 2);
    }

    if (value !== null && value > maxValue) {
      throw new Error(
        `Error: Value ${value} exceeds ${width}-bit field '${fieldName}' maximum of ${maxValue}`,
      );
    }
  }

  /**
   * ADR-017: Evaluate constant expression for enum values
   */
  private evaluateConstantExpression(expr: string): number {
    // Handle hex literals
    if (expr.startsWith("0x") || expr.startsWith("0X")) {
      return parseInt(expr, 16);
    }
    // Handle binary literals
    if (expr.startsWith("0b") || expr.startsWith("0B")) {
      return parseInt(expr.substring(2), 2);
    }
    // Handle decimal
    const value = parseInt(expr, 10);
    if (isNaN(value)) {
      throw new Error(`Error: Invalid constant expression in enum: ${expr}`);
    }
    return value;
  }

  /**
   * ADR-036: Try to evaluate an expression as a compile-time constant.
   * Returns the numeric value if constant, undefined if not evaluable.
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

    // For more complex expressions, we can't evaluate at compile time
    return undefined;
  }

  /**
   * ADR-036: Check array bounds at compile time for constant indices.
   * Throws an error if the constant index is out of bounds.
   */
  private checkArrayBounds(
    arrayName: string,
    dimensions: number[],
    indexExprs: Parser.ExpressionContext[],
    line: number,
  ): void {
    for (let i = 0; i < indexExprs.length && i < dimensions.length; i++) {
      const constValue = this.tryEvaluateConstant(indexExprs[i]);
      if (constValue !== undefined) {
        if (constValue < 0) {
          throw new Error(
            `Array index out of bounds: ${constValue} is negative for '${arrayName}' dimension ${i + 1} (line ${line})`,
          );
        } else if (constValue >= dimensions[i]) {
          throw new Error(
            `Array index out of bounds: ${constValue} >= ${dimensions[i]} for '${arrayName}' dimension ${i + 1} (line ${line})`,
          );
        }
      }
    }
  }

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
          // Append string capacity as final dimension
          stringArrayDims.push(stringDim);

          this.context.typeRegistry.set(name, {
            baseType: "char",
            bitWidth: 8,
            isArray: true,
            arrayDimensions: stringArrayDims, // [4, 65] for string<64> arr[4]
            isConst,
            isString: true,
            stringCapacity: capacity,
            overflowBehavior,
            isAtomic, // ADR-049
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
            isAtomic, // ADR-049
          });
        }
        return; // Now we can return, having processed all dimensions
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
      if (this.knownEnums.has(baseType)) {
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
      if (this.knownBitmaps.has(baseType)) {
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
      if (this.knownEnums.has(baseType)) {
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
      if (this.knownBitmaps.has(baseType)) {
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
      if (this.knownEnums.has(baseType)) {
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
      if (this.knownBitmaps.has(baseType)) {
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
    if (arrayDim && arrayDim.length > 0) {
      isArray = true;
      for (const dim of arrayDim) {
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
          // Append string capacity as final dimension
          stringArrayDims.push(stringDim);

          this.context.typeRegistry.set(registryName, {
            baseType: "char",
            bitWidth: 8,
            isArray: true,
            arrayDimensions: stringArrayDims, // [4, 65] for string<64> arr[4]
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
      if (this.knownEnums.has(baseType)) {
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
      if (this.knownEnums.has(baseType)) {
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
      if (this.knownEnums.has(baseType)) {
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
    if (arrayDim && arrayDim.length > 0) {
      isArray = true;
      for (const dim of arrayDim) {
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

      // Determine if it's a struct type or callback type
      let isStruct = false;
      let isCallback = false;
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
      }

      this.context.currentParameters.set(name, {
        name,
        baseType: typeName,
        isArray,
        isStruct,
        isConst,
        isCallback,
      });

      // ADR-025: Register parameter type for switch exhaustiveness checking
      const isEnum = this.knownEnums.has(typeName);
      const isBitmap = this.knownBitmaps.has(typeName);

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

  /**
   * ADR-029: Validate callback assignment with nominal typing
   * - If value IS a callback type used as a field type: must match exactly (nominal typing)
   * - If value is just a function (not used as a type): signature must match
   */
  private validateCallbackAssignment(
    expectedType: string,
    valueExpr: Parser.ExpressionContext,
    fieldName: string,
  ): void {
    const valueText = valueExpr.getText();

    // Check if the value is a known function
    if (!this.knownFunctions.has(valueText)) {
      // Not a function name - could be a variable holding a callback
      // Skip validation for now (C compiler will catch type mismatches)
      return;
    }

    const expectedInfo = this.callbackTypes.get(expectedType);
    const valueInfo = this.callbackTypes.get(valueText);

    if (!expectedInfo || !valueInfo) {
      // Shouldn't happen, but guard against it
      return;
    }

    // First check if signatures match
    if (!this.callbackSignaturesMatch(expectedInfo, valueInfo)) {
      throw new Error(
        `Error: Function '${valueText}' signature does not match callback type '${expectedType}'`,
      );
    }

    // Nominal typing: if the value function is used as a field type somewhere,
    // it can only be assigned to fields of that same type
    if (
      this.isCallbackTypeUsedAsFieldType(valueText) &&
      valueText !== expectedType
    ) {
      throw new Error(
        `Error: Cannot assign '${valueText}' to callback field '${fieldName}' ` +
          `(expected ${expectedType} type, got ${valueText} type - nominal typing)`,
      );
    }
  }

  /**
   * ADR-029: Check if two callback signatures match
   */
  private callbackSignaturesMatch(
    a: CallbackTypeInfo,
    b: CallbackTypeInfo,
  ): boolean {
    if (a.returnType !== b.returnType) return false;
    if (a.parameters.length !== b.parameters.length) return false;

    for (let i = 0; i < a.parameters.length; i++) {
      const pa = a.parameters[i];
      const pb = b.parameters[i];
      if (pa.type !== pb.type) return false;
      if (pa.isConst !== pb.isConst) return false;
      if (pa.isPointer !== pb.isPointer) return false;
      if (pa.isArray !== pb.isArray) return false;
    }

    return true;
  }

  /**
   * ADR-013: Check if an argument is const (variable or parameter)
   */
  private isConstValue(identifier: string): boolean {
    // Check if it's a const parameter
    const paramInfo = this.context.currentParameters.get(identifier);
    if (paramInfo?.isConst) {
      return true;
    }

    // Check if it's a const variable
    const typeInfo = this.context.typeRegistry.get(identifier);
    if (typeInfo?.isConst) {
      return true;
    }

    return false;
  }

  /**
   * ADR-016: Validate that bare identifiers inside scopes are only used for local variables.
   * Throws an error if a bare identifier references a scope member or global.
   *
   * @param identifier The bare identifier to validate
   * @param isLocalVariable Whether this identifier is a known local variable/parameter
   */
  private validateBareIdentifierInScope(
    identifier: string,
    isLocalVariable: boolean,
  ): void {
    // Only enforce inside scopes
    if (!this.context.currentScope) {
      return;
    }

    // Local variables and parameters are allowed as bare identifiers
    if (isLocalVariable) {
      return;
    }

    // Check if this identifier is a scope member
    const scopeMembers = this.context.scopeMembers.get(
      this.context.currentScope,
    );
    if (scopeMembers && scopeMembers.has(identifier)) {
      throw new Error(
        `Error: Use 'this.${identifier}' to access scope member '${identifier}' inside scope '${this.context.currentScope}'`,
      );
    }

    // Check if this is a known global (register, function, enum, struct)
    if (this.knownRegisters.has(identifier)) {
      throw new Error(
        `Error: Use 'global.${identifier}' to access register '${identifier}' inside scope '${this.context.currentScope}'`,
      );
    }

    if (
      this.knownFunctions.has(identifier) &&
      !identifier.startsWith(this.context.currentScope + "_")
    ) {
      throw new Error(
        `Error: Use 'global.${identifier}' to access global function '${identifier}' inside scope '${this.context.currentScope}'`,
      );
    }

    if (this.knownEnums.has(identifier)) {
      throw new Error(
        `Error: Use 'global.${identifier}' to access global enum '${identifier}' inside scope '${this.context.currentScope}'`,
      );
    }

    if (this.knownStructs.has(identifier)) {
      throw new Error(
        `Error: Use 'global.${identifier}' to access global struct '${identifier}' inside scope '${this.context.currentScope}'`,
      );
    }

    // Check if this identifier exists as a global variable in the type registry
    // (but not a scoped variable - those would have Scope_ prefix)
    const typeInfo = this.context.typeRegistry.get(identifier);
    if (typeInfo && !identifier.includes("_")) {
      throw new Error(
        `Error: Use 'global.${identifier}' to access global variable '${identifier}' inside scope '${this.context.currentScope}'`,
      );
    }
  }

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
        if (this.knownEnums.has(scopedEnumName)) {
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
      if (this.knownEnums.has(possibleEnum)) {
        return possibleEnum;
      }

      // Check scoped enum: Motor.State.IDLE -> Motor_State
      if (parts.length >= 3) {
        const scopeName = parts[0];
        const enumName = parts[1];
        const scopedEnumName = `${scopeName}_${enumName}`;
        if (this.knownEnums.has(scopedEnumName)) {
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
   */
  private isStringExpression(ctx: Parser.RelationalExpressionContext): boolean {
    const text = ctx.getText();

    // Check for string literals
    if (text.startsWith('"') && text.endsWith('"')) {
      return true;
    }

    // Check if it's a variable of string type
    if (text.match(/^[a-zA-Z_][a-zA-Z0-9_]*$/)) {
      const typeInfo = this.context.typeRegistry.get(text);
      if (typeInfo?.isString) {
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

    // Check for [start, length] pattern (exactly 2 expressions)
    if (exprs.length !== 2) return null;

    // Get the source variable name
    const sourceId = primary.IDENTIFIER();
    if (!sourceId) return null;

    const sourceName = sourceId.getText();

    // Check if source is a string type
    const typeInfo = this.context.typeRegistry.get(sourceName);
    if (!typeInfo?.isString || typeInfo.stringCapacity === undefined) {
      return null;
    }

    return {
      source: sourceName,
      start: this.generateExpression(exprs[0]),
      length: this.generateExpression(exprs[1]),
      sourceCapacity: typeInfo.stringCapacity,
    };
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

  /**
   * ADR-013: Check if assigning to an identifier would violate const rules.
   * Returns error message if const, null if mutable.
   */
  private checkConstAssignment(identifier: string): string | null {
    // Check if it's a const parameter
    const paramInfo = this.context.currentParameters.get(identifier);
    if (paramInfo?.isConst) {
      return `cannot assign to const parameter '${identifier}'`;
    }

    // Resolve identifier to scoped name for proper lookup
    const scopedName = this.resolveIdentifier(identifier);

    // Check if it's a const variable
    const typeInfo = this.context.typeRegistry.get(scopedName);
    if (typeInfo?.isConst) {
      return `cannot assign to const variable '${identifier}'`;
    }

    return null; // Mutable, assignment OK
  }

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
   * Generate a function argument with proper ADR-006 semantics.
   * - Local variables get & (address-of)
   * - Member access (cursor.x) gets & (address-of)
   * - Array access (arr[i]) gets & (address-of)
   * - Parameters are passed as-is (already pointers)
   * - Arrays are passed as-is (naturally decay to pointers)
   * - Literals and complex expressions are passed as-is
   */
  private generateFunctionArg(ctx: Parser.ExpressionContext): string {
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

    // Complex expression or literal - generate normally
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
        const typeCtx = varDecl.type();
        const type = this.generateType(typeCtx);
        const varName = varDecl.IDENTIFIER().getText();
        const fullName = `${name}_${varName}`;
        const prefix = isPrivate ? "static " : "";

        // Note: Type already registered in registerAllVariableTypes() pass

        // ADR-045: Special handling for string arrays
        const arrayDims = varDecl.arrayDimension();
        if (typeCtx.stringType()) {
          const stringCtx = typeCtx.stringType()!;
          const intLiteral = stringCtx.INTEGER_LITERAL();

          if (intLiteral) {
            const capacity = parseInt(intLiteral.getText(), 10);
            let decl = `${prefix}char ${fullName}`;

            if (arrayDims.length > 0) {
              // String array: string<64> arr[4] -> char arr[4][65]
              decl += this.generateArrayDimensions(arrayDims); // [4]
              decl += `[${capacity + 1}]`; // [65]
            } else {
              // Single string: string<64> s -> char s[65]
              decl += `[${capacity + 1}]`;
            }

            if (varDecl.expression()) {
              decl += ` = ${this.generateExpression(varDecl.expression()!)}`;
            } else {
              // ADR-015: Zero initialization
              decl += arrayDims.length > 0 ? " = {0}" : ' = ""';
            }
            lines.push(decl + ";");
          } else {
            throw new Error(
              `Error: Unsized string not allowed in scope member`,
            );
          }
        } else {
          // Non-string types (existing logic)
          const isArray = arrayDims.length > 0;
          let decl = `${prefix}${type} ${fullName}`;
          if (isArray) {
            decl += this.generateArrayDimensions(arrayDims);
          }
          if (varDecl.expression()) {
            decl += ` = ${this.generateExpression(varDecl.expression()!)}`;
          } else {
            // ADR-015: Zero initialization for uninitialized scope variables
            decl += ` = ${this.getZeroInitializer(typeCtx, isArray)}`;
          }
          lines.push(decl + ";");
        }
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
      if (member.enumDeclaration()) {
        const enumDecl = member.enumDeclaration()!;
        // Collect the scoped enum (if not already collected)
        this.collectEnum(enumDecl, name);
        const enumCode = this.generateEnum(enumDecl);
        lines.push("");
        lines.push(enumCode);
      }

      // ADR-034: Handle bitmap declarations inside scopes
      if (member.bitmapDeclaration()) {
        const bitmapDecl = member.bitmapDeclaration()!;
        // Collect the scoped bitmap (if not already collected)
        this.collectBitmap(bitmapDecl, name);
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
      if (this.knownBitmaps.has(scopedTypeName)) {
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
      const typeCtx = member.type();
      const typeName = this.getTypeName(typeCtx);
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
      } else if (typeCtx.stringType()) {
        // ADR-045: Special handling for string types
        const stringCtx = typeCtx.stringType()!;
        const intLiteral = stringCtx.INTEGER_LITERAL();

        if (intLiteral) {
          const capacity = parseInt(intLiteral.getText(), 10);

          if (isArray) {
            // String array: string<64> arr[4] -> char arr[4][65]
            const dims = this.generateArrayDimensions(arrayDims);
            lines.push(`    char ${fieldName}${dims}[${capacity + 1}];`);
          } else {
            // Single string: string<64> s -> char s[65]
            lines.push(`    char ${fieldName}[${capacity + 1}];`);
          }
        } else {
          throw new Error(`Error: Unsized string not allowed in struct member`);
        }
      } else {
        // Regular field handling
        const type = this.generateType(typeCtx);
        if (isArray) {
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

    const members = this.enumMembers.get(fullName);
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

    const backingType = this.bitmapBackingType.get(fullName);
    if (!backingType) {
      throw new Error(`Error: Bitmap ${fullName} not found in registry`);
    }

    this.needsStdint = true;

    const lines: string[] = [];

    // Generate comment with field layout
    lines.push(`/* Bitmap: ${fullName} */`);

    const fields = this.bitmapFields.get(fullName);
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
    const structFieldTypes = this.structFields.get(typeName);

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
      actualReturnType = returnType;
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

    // Handle string[] - an array of strings should become char* name[]
    // (string becomes char, but string[] means array of string pointers)
    if (ctx.type().stringType() && dims.length > 0) {
      const dimStr = dims.map((d) => this.generateArrayDimension(d)).join("");
      return `${constMod}char* ${name}${dimStr}`;
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

    // ADR-006: Pass by reference for non-array types
    // Add pointer for primitive types to enable pass-by-reference semantics
    return `${constMod}${type}* ${name}`;
  }

  private generateArrayDimension(ctx: Parser.ArrayDimensionContext): string {
    if (ctx.expression()) {
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
    }

    // ADR-045: Handle bounded string type specially
    if (typeCtx.stringType()) {
      const stringCtx = typeCtx.stringType()!;
      const intLiteral = stringCtx.INTEGER_LITERAL();

      if (intLiteral) {
        const capacity = parseInt(intLiteral.getText(), 10);

        // Check for array dimensions on the variable declaration
        const arrayDims = ctx.arrayDimension();
        if (arrayDims.length > 0) {
          // String array: string<64> arr[4] -> char arr[4][65] = {0};
          let decl = `${constMod}char ${name}`;
          decl += this.generateArrayDimensions(arrayDims); // [4]
          decl += `[${capacity + 1}]`; // [65]

          if (ctx.expression()) {
            throw new Error(
              `Error: Array initializers for string arrays not yet supported`,
            );
          }

          // Initialize to empty: char arr[4][65] = {0};
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

        // Array dimensions not supported for unsized strings
        const arrayDims = ctx.arrayDimension();
        if (arrayDims.length > 0) {
          throw new Error(
            "Error: const string array requires explicit capacity, e.g., const string<32> arr[4]",
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

        return `${decl} = ${initValue};`;
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
      if (this.knownEnums.has(typeName)) {
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
      if (this.knownEnums.has(typeName)) {
        // Return the first member of the enum (which has value 0)
        const members = this.enumMembers.get(typeName);
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

    // Check for generic types (like RingBuffer<u8, 256>)
    if (typeCtx.genericType()) {
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
      const constError = this.checkConstAssignment(id);
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
                !this.knownEnums.has(parts[0])
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
      const constError = this.checkConstAssignment(arrayName);
      if (constError) {
        throw new Error(`${constError} (array element)`);
      }
    }

    // Check member access on const struct - validate the root is not const
    if (targetCtx.memberAccess()) {
      const identifiers = targetCtx.memberAccess()!.IDENTIFIER();
      if (identifiers.length > 0) {
        const rootName = identifiers[0].getText();
        const constError = this.checkConstAssignment(rootName);
        if (constError) {
          throw new Error(`${constError} (member access)`);
        }

        // ADR-013: Check for read-only register members (ro = implicitly const)
        if (identifiers.length >= 2) {
          const memberName = identifiers[1].getText();
          const fullName = `${rootName}_${memberName}`;
          const accessMod = this.registerMemberAccess.get(fullName);
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
              this.validateCallbackAssignment(
                expectedCallbackType,
                ctx.expression(),
                memberName,
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
          const fields = this.bitmapFields.get(bitmapType);
          if (fields && fields.has(fieldName)) {
            const fieldInfo = fields.get(fieldName)!;

            // Validate compile-time literal overflow
            this.validateBitmapFieldLiteral(
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
        if (this.knownRegisters.has(regName)) {
          const fullRegMember = `${regName}_${memberName}`;
          const bitmapType = this.registerMemberTypes.get(fullRegMember);

          if (bitmapType) {
            // This is a bitmap field access on a register member
            if (isCompound) {
              throw new Error(
                `Compound assignment operators not supported for bitmap field access: ${cnextOp}`,
              );
            }

            const fields = this.bitmapFields.get(bitmapType);
            if (fields && fields.has(fieldName)) {
              const fieldInfo = fields.get(fieldName)!;

              // Validate compile-time literal overflow
              this.validateBitmapFieldLiteral(
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
      }

      // ADR-016: Scoped register member bitmap field write: Teensy4.GPIO7.ICR1.LED_BUILTIN <- value
      // 4 identifiers: [scope, register, member, bitmapField], no subscripts
      if (identifiers.length === 4 && exprs.length === 0) {
        const scopeName = identifiers[0].getText();
        const regName = identifiers[1].getText();
        const memberName = identifiers[2].getText();
        const fieldName = identifiers[3].getText();

        // Check if first identifier is a scope
        if (this.knownScopes.has(scopeName)) {
          const fullRegName = `${scopeName}_${regName}`;
          // Check if this is a scoped register
          if (this.knownRegisters.has(fullRegName)) {
            const fullRegMember = `${fullRegName}_${memberName}`;
            const bitmapType = this.registerMemberTypes.get(fullRegMember);

            if (bitmapType) {
              // This is a bitmap field access on a scoped register member
              if (isCompound) {
                throw new Error(
                  `Compound assignment operators not supported for bitmap field access: ${cnextOp}`,
                );
              }

              const fields = this.bitmapFields.get(bitmapType);
              if (fields && fields.has(fieldName)) {
                const fieldInfo = fields.get(fieldName)!;

                // Validate compile-time literal overflow
                this.validateBitmapFieldLiteral(
                  ctx.expression(),
                  fieldInfo.width,
                  fieldName,
                );

                // Check if this is a write-only register
                const accessMod = this.registerMemberAccess.get(fullRegMember);
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
          this.checkArrayBounds(
            arrayName,
            typeInfo.arrayDimensions,
            exprs,
            ctx.start?.line ?? 0,
          );
        }

        // Generate all subscript indices
        const indices = exprs.map((e) => this.generateExpression(e)).join("][");

        // ADR-045: String array assignment - use strcpy for simple assignments
        if (
          !isCompound &&
          typeInfo &&
          typeInfo.isString &&
          typeInfo.arrayDimensions &&
          typeInfo.arrayDimensions.length > 1
        ) {
          this.needsString = true;
          return `strcpy(${arrayName}[${indices}], ${value});`;
        }

        return `${arrayName}[${indices}] ${cOp} ${value};`;
      }

      // ADR-036: Struct member multi-dimensional array access (e.g., screen.pixels[0][0])
      // Has 2+ identifiers (struct.field), subscripts, and first identifier is NOT a register or scope
      const firstId = identifiers[0].getText();
      // Check if this is a scoped register: Scope.Register.Member[bit]
      const scopedRegName =
        identifiers.length >= 3 && this.knownScopes.has(firstId)
          ? `${firstId}_${identifiers[1].getText()}`
          : null;
      const isScopedRegister =
        scopedRegName && this.knownRegisters.has(scopedRegName);

      if (
        identifiers.length >= 2 &&
        exprs.length > 0 &&
        !this.knownRegisters.has(firstId) &&
        !isScopedRegister
      ) {
        // Fix for Bug #2: Walk children in order to preserve operation sequence
        // For cfg.items[0].value, we need to emit: cfg.items[0].value
        // Not: cfg.items.value[0] (which the old heuristic generated)

        if (memberAccessCtx.children && identifiers.length > 1) {
          // Walk parse tree children in order, building result incrementally
          let result = firstId;
          let idIndex = 1; // Start at 1 since we already used firstId
          let exprIndex = 0;

          // Check if first identifier is a scope for special handling
          const isCrossScope = this.knownScopes.has(firstId);

          for (let i = 1; i < memberAccessCtx.children.length; i++) {
            const child = memberAccessCtx.children[i];
            const childText = child.getText();

            if (childText === ".") {
              // Next child should be an IDENTIFIER
              if (
                i + 1 < memberAccessCtx.children.length &&
                idIndex < identifiers.length
              ) {
                // Use underscore for first join if cross-scope, dot otherwise
                const separator = isCrossScope && idIndex === 1 ? "_" : ".";
                result += `${separator}${identifiers[idIndex].getText()}`;
                idIndex++;
                i++; // Skip the identifier we just processed
              }
            } else if (childText === "[") {
              // Next child is an expression, then "]"
              if (exprIndex < exprs.length) {
                const expr = this.generateExpression(exprs[exprIndex]);
                result += `[${expr}]`;
                exprIndex++;
                i += 2; // Skip expression and "]"
              }
            }
          }

          // ADR-045: Check if this is a string array member assignment
          if (!isCompound && identifiers.length >= 2 && exprs.length > 0) {
            const rootName = identifiers[0].getText();
            const memberName = identifiers[1].getText();
            const rootTypeInfo = this.context.typeRegistry.get(rootName);

            if (rootTypeInfo && this.isKnownStruct(rootTypeInfo.baseType)) {
              const structType = rootTypeInfo.baseType;
              const fieldInfo = this.getStructFieldInfo(structType, memberName);

              if (
                fieldInfo &&
                fieldInfo.type.startsWith("string<") &&
                fieldInfo.dimensions &&
                fieldInfo.dimensions.length > 1
              ) {
                this.needsString = true;
                return `strcpy(${result}, ${value});`;
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
        if (this.knownScopes.has(leadingId) && identifiers.length >= 3) {
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
        const accessMod = this.registerMemberAccess.get(fullName);
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

      if (this.knownRegisters.has(firstId)) {
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
        const accessMod = this.registerMemberAccess.get(regName);
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
      } else {
        // Non-register global array access - normal array indexing
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
      if (this.knownRegisters.has(scopedRegName)) {
        // Compound operators not supported for bit field access on registers
        if (isCompound) {
          throw new Error(
            `Compound assignment operators not supported for bit field access: ${cnextOp}`,
          );
        }
        // This is a scoped register access: this.GPIO7.DR_SET[LED_BIT]
        const regName = `${scopeName}_${parts.join("_")}`;

        // Check if this is a write-only register
        const accessMod = this.registerMemberAccess.get(regName);
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
        if (this.knownRegisters.has(scopedRegName)) {
          const fullRegMember = `${scopedRegName}_${memberName}`;
          const bitmapType = this.registerMemberTypes.get(fullRegMember);

          if (bitmapType) {
            // This is a bitmap field access on a scoped register member
            if (isCompound) {
              throw new Error(
                `Compound assignment operators not supported for bitmap field access: ${cnextOp}`,
              );
            }

            const fields = this.bitmapFields.get(bitmapType);
            if (fields && fields.has(fieldName)) {
              const fieldInfo = fields.get(fieldName)!;

              // Validate compile-time literal overflow
              this.validateBitmapFieldLiteral(
                ctx.expression(),
                fieldInfo.width,
                fieldName,
              );

              const mask = (1 << fieldInfo.width) - 1;
              const maskHex = `0x${mask.toString(16).toUpperCase()}`;

              // Check if this is a write-only register
              const accessMod = this.registerMemberAccess.get(fullRegMember);
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
        // Normal array element assignment
        const index = this.generateExpression(exprs[0]);

        // ADR-045: String array assignment - use strcpy for simple assignments
        if (
          !isCompound &&
          typeInfo &&
          typeInfo.isString &&
          typeInfo.arrayDimensions &&
          typeInfo.arrayDimensions.length > 1
        ) {
          this.needsString = true;
          return `strcpy(${name}[${index}], ${value});`;
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
        TYPE_WIDTH[typeInfo.baseType]
      ) {
        // Clamp behavior: use helper function
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

    // Handle clamp behavior for arithmetic operations
    if (
      typeInfo.overflowBehavior === "clamp" &&
      TYPE_WIDTH[typeInfo.baseType]
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

    // For wrap behavior or non-clamp ops, use natural arithmetic
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

    // Handle clamp behavior
    if (
      typeInfo.overflowBehavior === "clamp" &&
      TYPE_WIDTH[typeInfo.baseType]
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
    this.validateBareIdentifierInScope(id, isLocalVariable);

    return id;
  }

  // ADR-016: Generate global member access for assignment targets
  private generateGlobalMemberAccess(
    ctx: Parser.GlobalMemberAccessContext,
  ): string {
    const identifiers = ctx.IDENTIFIER();
    const parts = identifiers.map((id) => id.getText());
    // Check if first identifier is a register
    const firstId = parts[0];
    if (this.knownRegisters.has(firstId)) {
      // Register member access: GPIO7.DR_SET -> GPIO7_DR_SET
      return parts.join("_");
    }
    // Non-register member access: obj.field
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

    if (this.knownRegisters.has(firstId)) {
      // Register bit access: GPIO7.DR_SET[idx] -> GPIO7_DR_SET |= (1 << idx) (handled elsewhere)
      // For assignment target, just generate the left-hand side representation
      const regName = parts.join("_");
      return `${regName}[${expr}]`;
    }

    // Non-register array access
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
    if (this.knownRegisters.has(scopedRegName)) {
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
    if (this.knownRegisters.has(scopedRegName)) {
      // Scoped register bit access: this.GPIO7.DR_SET[idx] -> Teensy4_GPIO7_DR_SET[idx]
      const regName = `${scopeName}_${parts.join("_")}`;

      // Check if this register member has a bitmap type
      const bitmapType = this.registerMemberTypes.get(regName);
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
    this.validateDoWhileCondition(ctx.expression());

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
    this.validateNoEarlyExits(ctx.block());

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

  /**
   * ADR-050: Validate no early exits inside critical block
   * return, break, continue would leave interrupts disabled
   */
  private validateNoEarlyExits(ctx: Parser.BlockContext): void {
    for (const stmt of ctx.statement()) {
      if (stmt.returnStatement()) {
        throw new Error(
          `E0853: Cannot use 'return' inside critical section - would leave interrupts disabled`,
        );
      }
      // Recursively check nested blocks
      if (stmt.block()) {
        this.validateNoEarlyExits(stmt.block()!);
      }
      // Check inside if statements
      if (stmt.ifStatement()) {
        for (const innerStmt of stmt.ifStatement()!.statement()) {
          if (innerStmt.returnStatement()) {
            throw new Error(
              `E0853: Cannot use 'return' inside critical section - would leave interrupts disabled`,
            );
          }
          if (innerStmt.block()) {
            this.validateNoEarlyExits(innerStmt.block()!);
          }
        }
      }
      // Check inside while/for/do-while loops for return (break/continue are already rejected by ADR-026)
      if (stmt.whileStatement()) {
        const loopStmt = stmt.whileStatement()!.statement();
        if (loopStmt.returnStatement()) {
          throw new Error(
            `E0853: Cannot use 'return' inside critical section - would leave interrupts disabled`,
          );
        }
        if (loopStmt.block()) {
          this.validateNoEarlyExits(loopStmt.block()!);
        }
      }
      if (stmt.forStatement()) {
        const loopStmt = stmt.forStatement()!.statement();
        if (loopStmt.returnStatement()) {
          throw new Error(
            `E0853: Cannot use 'return' inside critical section - would leave interrupts disabled`,
          );
        }
        if (loopStmt.block()) {
          this.validateNoEarlyExits(loopStmt.block()!);
        }
      }
      if (stmt.doWhileStatement()) {
        // do-while uses block directly, not statement
        const loopBlock = stmt.doWhileStatement()!.block();
        this.validateNoEarlyExits(loopBlock);
      }
    }
  }

  // ========================================================================
  // Switch Statements (ADR-025)
  // ========================================================================

  private generateSwitch(ctx: Parser.SwitchStatementContext): string {
    const switchExpr = ctx.expression();
    const exprCode = this.generateExpression(switchExpr);

    // ADR-025: Semantic validation
    this.validateSwitchStatement(ctx, switchExpr);

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

    // Numeric literals
    if (ctx.INTEGER_LITERAL()) {
      return ctx.INTEGER_LITERAL()!.getText();
    }

    if (ctx.HEX_LITERAL()) {
      return ctx.HEX_LITERAL()!.getText();
    }

    if (ctx.BINARY_LITERAL()) {
      // Convert binary to hex for cleaner C output
      const binText = ctx.BINARY_LITERAL()!.getText();
      const value = parseInt(binText.replace(/0[bB]/, ""), 2);
      return `0x${value.toString(16).toUpperCase()}`;
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

  /**
   * ADR-025: Validate switch statement for MISRA compliance
   */
  private validateSwitchStatement(
    ctx: Parser.SwitchStatementContext,
    switchExpr: Parser.ExpressionContext,
  ): void {
    const cases = ctx.switchCase();
    const defaultCase = ctx.defaultCase();
    const totalClauses = cases.length + (defaultCase ? 1 : 0);

    // MISRA 16.7: No boolean switches (use if/else instead)
    const exprType = this.getExpressionType(switchExpr);
    if (exprType === "bool") {
      throw new Error(
        "Error: Cannot switch on boolean type (MISRA 16.7). Use if/else instead.",
      );
    }

    // MISRA 16.6: Minimum 2 clauses required
    if (totalClauses < 2) {
      throw new Error(
        "Error: Switch requires at least 2 clauses (MISRA 16.6). Use if statement for single case.",
      );
    }

    // MISRA 16.5: Default must be last clause (checked by grammar order, but verify)
    // Grammar ensures default comes after cases, so this is always satisfied

    // Check for duplicate case values
    const seenValues = new Set<string>();
    for (const caseCtx of cases) {
      for (const labelCtx of caseCtx.caseLabel()) {
        const labelValue = this.getCaseLabelValue(labelCtx);
        if (seenValues.has(labelValue)) {
          throw new Error(
            `Error: Duplicate case value '${labelValue}' in switch statement.`,
          );
        }
        seenValues.add(labelValue);
      }
    }

    // ADR-025: Enum exhaustiveness checking
    if (exprType && this.knownEnums.has(exprType)) {
      this.validateEnumExhaustiveness(ctx, exprType, cases, defaultCase);
    }
  }

  /**
   * ADR-025: Validate enum switch exhaustiveness with default(n) counting
   */
  private validateEnumExhaustiveness(
    ctx: Parser.SwitchStatementContext,
    enumTypeName: string,
    cases: Parser.SwitchCaseContext[],
    defaultCase: Parser.DefaultCaseContext | null,
  ): void {
    const enumVariants = this.enumMembers.get(enumTypeName);
    if (!enumVariants) return; // Shouldn't happen if knownEnums has it

    const totalVariants = enumVariants.size;

    // Count explicit cases (each || alternative counts as 1)
    let explicitCaseCount = 0;
    for (const caseCtx of cases) {
      explicitCaseCount += caseCtx.caseLabel().length;
    }

    if (defaultCase) {
      // Check for default(n) syntax
      const defaultCount = this.getDefaultCount(defaultCase);

      if (defaultCount !== null) {
        // default(n) mode: explicit + n must equal total variants
        const covered = explicitCaseCount + defaultCount;
        if (covered !== totalVariants) {
          throw new Error(
            `Error: switch covers ${covered} of ${totalVariants} ${enumTypeName} variants ` +
              `(${explicitCaseCount} explicit + default(${defaultCount})). ` +
              `Expected ${totalVariants}.`,
          );
        }
      }
      // Plain default: no exhaustiveness check needed
    } else {
      // No default: must cover all variants explicitly
      if (explicitCaseCount !== totalVariants) {
        const missing = totalVariants - explicitCaseCount;
        throw new Error(
          `Error: Non-exhaustive switch on ${enumTypeName}: covers ${explicitCaseCount} of ${totalVariants} variants, missing ${missing}.`,
        );
      }
    }
  }

  /**
   * Get the count from default(n) syntax, or null for plain default
   */
  private getDefaultCount(ctx: Parser.DefaultCaseContext): number | null {
    const intLiteral = ctx.INTEGER_LITERAL();
    if (intLiteral) {
      return parseInt(intLiteral.getText(), 10);
    }
    return null;
  }

  /**
   * Get the string representation of a case label for duplicate checking
   */
  private getCaseLabelValue(ctx: Parser.CaseLabelContext): string {
    if (ctx.qualifiedType()) {
      const qt = ctx.qualifiedType()!;
      return qt
        .IDENTIFIER()
        .map((id) => id.getText())
        .join(".");
    }
    if (ctx.IDENTIFIER()) {
      return ctx.IDENTIFIER()!.getText();
    }
    if (ctx.INTEGER_LITERAL()) {
      return ctx.INTEGER_LITERAL()!.getText();
    }
    if (ctx.HEX_LITERAL()) {
      // Normalize hex to decimal for comparison
      const hex = ctx.HEX_LITERAL()!.getText();
      return String(parseInt(hex, 16));
    }
    if (ctx.BINARY_LITERAL()) {
      // Normalize binary to decimal for comparison
      const bin = ctx.BINARY_LITERAL()!.getText();
      return String(parseInt(bin.replace(/0[bB]/, ""), 2));
    }
    if (ctx.CHAR_LITERAL()) {
      return ctx.CHAR_LITERAL()!.getText();
    }
    return "";
  }

  // ========================================================================
  // Ternary Validation (ADR-022)
  // ========================================================================

  /**
   * ADR-022: Validate that ternary condition is a boolean expression
   * Must be a comparison or logical operation, not just a value
   */
  private validateTernaryCondition(ctx: Parser.OrExpressionContext): void {
    // Check if the condition contains a comparison or logical operator
    // A valid boolean expression must have one of: =, !=, <, >, <=, >=, &&, ||
    const text = ctx.getText();

    // If it has && or ||, it's a logical expression (valid)
    if (ctx.andExpression().length > 1) {
      return; // Has || operator - valid
    }

    const andExpr = ctx.andExpression(0);
    if (!andExpr) {
      throw new Error(
        `Error: Ternary condition must be a boolean expression (comparison or logical operation), not '${text}'`,
      );
    }

    if (andExpr.equalityExpression().length > 1) {
      return; // Has && operator - valid
    }

    const equalityExpr = andExpr.equalityExpression(0);
    if (!equalityExpr) {
      throw new Error(
        `Error: Ternary condition must be a boolean expression (comparison or logical operation), not '${text}'`,
      );
    }

    if (equalityExpr.relationalExpression().length > 1) {
      return; // Has = or != operator - valid
    }

    const relationalExpr = equalityExpr.relationalExpression(0);
    if (!relationalExpr) {
      throw new Error(
        `Error: Ternary condition must be a boolean expression (comparison or logical operation), not '${text}'`,
      );
    }

    if (relationalExpr.bitwiseOrExpression().length > 1) {
      return; // Has <, >, <=, >= operator - valid
    }

    // No comparison or logical operators found - just a value
    throw new Error(
      `Error: Ternary condition must be a boolean expression (comparison or logical operation), not '${text}'`,
    );
  }

  /**
   * ADR-022: Validate that expression does not contain a nested ternary
   */
  private validateNoNestedTernary(
    ctx: Parser.OrExpressionContext,
    branchName: string,
  ): void {
    const text = ctx.getText();
    // Check for ternary pattern: something ? something : something
    // This is a simple heuristic - the grammar would catch malformed ternaries
    if (text.includes("?") && text.includes(":")) {
      throw new Error(
        `Error: Nested ternary not allowed in ${branchName}. Use if/else instead.`,
      );
    }
  }

  // ========================================================================
  // Do-While Validation (ADR-027)
  // ========================================================================

  /**
   * ADR-027: Validate that do-while condition is a boolean expression (E0701)
   * Must be a comparison, logical operation, or boolean variable - not just a value.
   * This enforces MISRA C:2012 Rule 14.4.
   */
  private validateDoWhileCondition(ctx: Parser.ExpressionContext): void {
    // Unwrap: ExpressionContext -> TernaryExpressionContext -> OrExpressionContext
    const ternaryExpr = ctx.ternaryExpression();
    const orExprs = ternaryExpr.orExpression();

    // For do-while, we expect a non-ternary expression (single orExpression)
    if (orExprs.length !== 1) {
      throw new Error(
        `Error E0701: do-while condition must be a boolean expression, not a ternary (MISRA C:2012 Rule 14.4)`,
      );
    }

    const orExpr = orExprs[0];
    const text = orExpr.getText();

    // If it has || operator, it's valid (logical expression)
    if (orExpr.andExpression().length > 1) {
      return;
    }

    const andExpr = orExpr.andExpression(0);
    if (!andExpr) {
      throw new Error(
        `Error E0701: do-while condition must be a boolean expression (comparison or logical operation), not '${text}' (MISRA C:2012 Rule 14.4)`,
      );
    }

    // If it has && operator, it's valid
    if (andExpr.equalityExpression().length > 1) {
      return;
    }

    const equalityExpr = andExpr.equalityExpression(0);
    if (!equalityExpr) {
      throw new Error(
        `Error E0701: do-while condition must be a boolean expression (comparison or logical operation), not '${text}' (MISRA C:2012 Rule 14.4)`,
      );
    }

    // If it has = or != operator, it's valid
    if (equalityExpr.relationalExpression().length > 1) {
      return;
    }

    const relationalExpr = equalityExpr.relationalExpression(0);
    if (!relationalExpr) {
      throw new Error(
        `Error E0701: do-while condition must be a boolean expression (comparison or logical operation), not '${text}' (MISRA C:2012 Rule 14.4)`,
      );
    }

    // If it has <, >, <=, >= operator, it's valid
    if (relationalExpr.bitwiseOrExpression().length > 1) {
      return;
    }

    // Check if it's a unary ! (negation) expression - that's valid on booleans
    // Need to drill down to check for unary not operator
    const bitwiseOrExpr = relationalExpr.bitwiseOrExpression(0);
    if (bitwiseOrExpr && this.isBooleanExpression(bitwiseOrExpr)) {
      return;
    }

    // No comparison or logical operators found - just a value
    throw new Error(
      `Error E0701: do-while condition must be a boolean expression (comparison or logical operation), not '${text}' (MISRA C:2012 Rule 14.4)\n  help: use explicit comparison: ${text} > 0 or ${text} != 0`,
    );
  }

  /**
   * Check if an expression resolves to a boolean type.
   * This includes: boolean literals, boolean variables, negation of booleans, function calls returning bool.
   */
  private isBooleanExpression(ctx: Parser.BitwiseOrExpressionContext): boolean {
    const text = ctx.getText();

    // Check for boolean literals
    if (text === "true" || text === "false") {
      return true;
    }

    // Check for negation (! operator) - valid for boolean expressions
    if (text.startsWith("!")) {
      return true;
    }

    // Check if it's a known boolean variable
    const typeInfo = this.context.typeRegistry.get(text);
    if (typeInfo && typeInfo.baseType === "bool") {
      return true;
    }

    return false;
  }

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
    this.validateTernaryCondition(condition);
    this.validateNoNestedTernary(trueExpr, "true branch");
    this.validateNoNestedTernary(falseExpr, "false branch");

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
    let result = this.generateRelationalExpr(exprs[0]);

    // Get the full text to find operators
    const fullText = ctx.getText();

    for (let i = 1; i < exprs.length; i++) {
      // Check if there's a != operator before this expression
      // Simple heuristic: look for != in the text
      const op = fullText.includes("!=") ? "!=" : "==";
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

    let result = this.generateBitwiseOrExpr(exprs[0]);
    const text = ctx.getText();

    for (let i = 1; i < exprs.length; i++) {
      let op = "<";
      if (text.includes(">=")) op = ">=";
      else if (text.includes("<=")) op = "<=";
      else if (text.includes(">")) op = ">";

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

    let result = this.generateAdditiveExpr(exprs[0]);
    const text = ctx.getText();

    for (let i = 1; i < exprs.length; i++) {
      const op = text.includes("<<") ? "<<" : ">>";
      result += ` ${op} ${this.generateAdditiveExpr(exprs[i])}`;
    }

    return result;
  }

  private generateAdditiveExpr(ctx: Parser.AdditiveExpressionContext): string {
    const exprs = ctx.multiplicativeExpression();
    if (exprs.length === 1) {
      return this.generateMultiplicativeExpr(exprs[0]);
    }

    // Need to get operators - for now use simple approach
    let result = this.generateMultiplicativeExpr(exprs[0]);
    const text = ctx.getText();

    for (let i = 1; i < exprs.length; i++) {
      // Simple heuristic to determine operator
      const op = text.includes("-") ? "-" : "+";
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

    let result = this.generateUnaryExpr(exprs[0]);
    const text = ctx.getText();

    for (let i = 1; i < exprs.length; i++) {
      let op = "*";
      if (text.includes("/")) op = "/";
      else if (text.includes("%")) op = "%";
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
      ? this.knownRegisters.has(primaryId)
      : false;

    // Track if current member is an array through member access chain
    // e.g., buf.data[0] - after .data, we know data is an array member
    let currentMemberIsArray = primaryId
      ? (this.context.typeRegistry.get(primaryId)?.isArray ?? false)
      : false;
    let currentStructType = primaryId
      ? this.context.typeRegistry.get(primaryId)?.baseType
      : undefined;

    // Track previous struct type and member name for .length on struct members (cfg.magic.length)
    let previousStructType: string | undefined = undefined;
    let previousMemberName: string | undefined = undefined;

    // Track the current resolved identifier for type lookups (fixes scope/parameter .length)
    let currentIdentifier = primaryId;
    // Track if we've subscripted an array (arr[0] -> element type, not array type)
    let isSubscripted = false;

    for (let i = 0; i < ops.length; i++) {
      const op = ops[i];

      // Member access
      if (op.IDENTIFIER()) {
        const memberName = op.IDENTIFIER()!.getText();

        // ADR-016: Handle global. prefix - first member becomes the identifier
        if (result === "__GLOBAL_PREFIX__") {
          result = memberName;
          currentIdentifier = memberName; // Track for .length lookups
          // Check if this first identifier is a register
          if (this.knownRegisters.has(memberName)) {
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
              // Look up the member's type using unified lookup (C-Next + C headers)
              const fieldInfo = this.getStructFieldInfo(
                previousStructType,
                previousMemberName,
              );

              if (fieldInfo) {
                const { type: memberType, dimensions } = fieldInfo;

                // Check if this is a string field
                const isStringField = memberType.startsWith("string<");

                if (dimensions && dimensions.length > 1 && isStringField) {
                  // String array field
                  if (!isSubscripted) {
                    // ts.arr.length -> return element count (first dimension)
                    result = String(dimensions[0]);
                  } else {
                    // ts.arr[0].length -> strlen(ts.arr[0])
                    result = `strlen(${result})`;
                  }
                } else if (
                  dimensions &&
                  dimensions.length === 1 &&
                  isStringField
                ) {
                  // Single string field: ts.str.length -> strlen(ts.str)
                  result = `strlen(${result})`;
                } else if (
                  dimensions &&
                  dimensions.length > 0 &&
                  !isSubscripted
                ) {
                  // Non-string array member: return array length (first dimension)
                  result = String(dimensions[0]);
                } else if (
                  dimensions &&
                  dimensions.length > 0 &&
                  isSubscripted
                ) {
                  // Non-string array element: return element bit width
                  const bitWidth = TYPE_WIDTH[memberType] || 0;
                  if (bitWidth > 0) {
                    result = String(bitWidth);
                  } else {
                    result = `/* .length: unsupported element type ${memberType} */0`;
                  }
                } else {
                  // Non-array member: return bit width
                  const bitWidth = TYPE_WIDTH[memberType] || 0;
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
                  if (!isSubscripted) {
                    // arr.length -> return element count (first dimension)
                    result = String(typeInfo.arrayDimensions[0]);
                  } else {
                    // arr[0].length -> strlen(arr[0])
                    // Use 'result' which has the subscript, not 'currentIdentifier'
                    result = `strlen(${result})`;
                  }
                } else if (currentIdentifier) {
                  // Single string: arrayDimensions: [65]
                  // str.length -> strlen(str)
                  if (this.context.lengthCache?.has(currentIdentifier)) {
                    result = this.context.lengthCache.get(currentIdentifier)!;
                  } else {
                    result = `strlen(${currentIdentifier})`;
                  }
                } else {
                  result = `/* .length: no identifier for string */0`;
                }
              } else if (
                typeInfo.isArray &&
                typeInfo.arrayDimensions &&
                typeInfo.arrayDimensions.length > 0 &&
                !isSubscripted
              ) {
                // ADR-036: Array length - return the first dimension
                // For matrix.length -> first dimension
                result = String(typeInfo.arrayDimensions[0]);
              } else if (
                typeInfo.isArray &&
                typeInfo.arrayDimensions &&
                typeInfo.arrayDimensions.length > 0 &&
                isSubscripted
              ) {
                // arr[0].length -> return element bit width from TYPE_WIDTH
                const elementBitWidth = TYPE_WIDTH[typeInfo.baseType] || 0;
                if (elementBitWidth > 0) {
                  result = String(elementBitWidth);
                } else {
                  result = `/* .length: unsupported element type ${typeInfo.baseType} */0`;
                }
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
            const fields = this.bitmapFields.get(bitmapType);
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
          else if (this.knownScopes.has(result)) {
            // ADR-016: Prevent self-referential scope access - must use 'this.' inside own scope
            if (result === this.context.currentScope) {
              throw new Error(
                `Error: Cannot reference own scope '${result}' by name. Use 'this.${memberName}' instead of '${result}.${memberName}'`,
              );
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
          else if (this.knownEnums.has(result)) {
            // Transform Enum.member to Enum_member
            result = `${result}_${memberName}`;
          }
          // Check if this is a register member access: GPIO7.DR -> GPIO7_DR
          else if (this.knownRegisters.has(result)) {
            // ADR-013: Check for write-only register members (wo = cannot read)
            const fullName = `${result}_${memberName}`;
            const accessMod = this.registerMemberAccess.get(fullName);
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
          else if (this.registerMemberTypes.has(result)) {
            const bitmapType = this.registerMemberTypes.get(result)!;
            const fields = this.bitmapFields.get(bitmapType);
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
            if (!this.knownEnums.has(result)) {
              const resolvedTypeInfo = this.context.typeRegistry.get(result);
              if (
                resolvedTypeInfo &&
                this.isKnownStruct(resolvedTypeInfo.baseType)
              ) {
                currentStructType = resolvedTypeInfo.baseType;
              }
            }
          } else if (this.knownScopes.has(result)) {
            // ADR-016: Prevent self-referential scope access - must use 'this.' inside own scope
            if (result === this.context.currentScope) {
              throw new Error(
                `Error: Cannot reference own scope '${result}' by name. Use 'this.${memberName}' instead of '${result}.${memberName}'`,
              );
            }
            // Transform Scope.member to Scope_member
            result = `${result}_${memberName}`;
            currentIdentifier = result; // Track for .length lookups
          } else if (this.knownEnums.has(result)) {
            // Transform Enum.member to Enum_member
            result = `${result}_${memberName}`;
          } else if (this.knownRegisters.has(result)) {
            // Transform Register.member to Register_member (matching #define)
            result = `${result}_${memberName}`;
            isRegisterChain = true;
          }
          // ADR-034: Check if result is a register member with bitmap type (no primaryId case)
          else if (this.registerMemberTypes.has(result)) {
            const bitmapType = this.registerMemberTypes.get(result)!;
            const fields = this.bitmapFields.get(bitmapType);
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
          if (this.registerMemberTypes.has(result)) {
            const bitmapType = this.registerMemberTypes.get(result)!;
            const line = primary.start?.line ?? 0;
            throw new Error(
              `Error at line ${line}: Cannot use bracket indexing on bitmap type '${bitmapType}'. ` +
                `Use named field access instead (e.g., ${result.split("_").slice(-1)[0]}.FIELD_NAME).`,
            );
          }

          // ADR-016: Use isRegisterChain to detect register access via global. prefix
          const isRegisterAccess =
            isRegisterChain ||
            (primaryId ? this.knownRegisters.has(primaryId) : false);

          // Check if current identifier (which may have been updated by global./this./Scope. access) is an array
          // Use currentIdentifier if available (handles global.arr, this.arr, Scope.arr),
          // otherwise fall back to primaryId (handles bare arr)
          const identifierToCheck = currentIdentifier || primaryId;
          const identifierTypeInfo = identifierToCheck
            ? this.context.typeRegistry.get(identifierToCheck)
            : undefined;
          const isPrimaryArray = identifierTypeInfo?.isArray ?? false;

          // Determine if this subscript is array access or bit access
          // Priority: register access > tracked member array > primary array > bit access
          if (isRegisterAccess) {
            // Register - use bit access: ((value >> index) & 1)
            result = `((${result} >> ${index}) & 1)`;
          } else if (currentMemberIsArray) {
            // Struct member that is an array (e.g., buf.data[0])
            result = `${result}[${index}]`;
            currentMemberIsArray = false; // After subscript, no longer array
            isSubscripted = true; // Track for .length on element
          } else if (isPrimaryArray) {
            // Primary identifier is an array (e.g., arr[0] or global.arr[0])
            result = `${result}[${index}]`;
            isSubscripted = true; // Track for .length on element
          } else if (identifierTypeInfo && !isPrimaryArray) {
            // Non-array type (integer, etc.) - use bit access
            result = `((${result} >> ${index}) & 1)`;
          } else {
            // Unknown type - default to array access
            result = `${result}[${index}]`;
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
                if (argId && this.isConstValue(argId)) {
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
              // C-Next function: check if target parameter is a float type
              const sig = this.functionSignatures.get(result);
              const targetParam = sig?.parameters[idx];
              const isFloatParam =
                targetParam && this.isFloatType(targetParam.baseType);

              if (isFloatParam) {
                // Target parameter is float (pass-by-value): pass value directly
                return this.generateExpression(e);
              } else {
                // Target parameter is non-float (pass-by-reference): use & logic
                return this.generateFunctionArg(e);
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
      this.validateBareIdentifierInScope(id, isLocalVariable);

      return id;
    }
    if (ctx.literal()) {
      const literalText = ctx.literal()!.getText();
      // Track boolean literal usage to include stdbool.h
      if (literalText === "true" || literalText === "false") {
        this.needsStdbool = true;
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
        if (this.knownStructs.has(varName)) {
          return `sizeof(${varName})`;
        }

        // Check if it's a known enum (actual type)
        if (this.knownEnums.has(varName)) {
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
        parts.length > 1 && this.knownRegisters.has(firstPart);
      const scopedRegisterName =
        parts.length > 2 && this.knownScopes.has(firstPart)
          ? `${parts[0]}_${parts[1]}`
          : null;
      const isScopedRegister =
        scopedRegisterName && this.knownRegisters.has(scopedRegisterName);

      if (isDirectRegister || isScopedRegister) {
        // This is register member bit access (handled elsewhere for assignment)
        // For read: generate bit extraction
        const registerName = parts.join("_");

        // ADR-013: Check for write-only register members (wo = cannot read)
        // Skip check if we're in assignment target context (write operation)
        if (!this.inAssignmentTarget) {
          const accessMod = this.registerMemberAccess.get(registerName);
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
          this.checkArrayBounds(
            firstPart,
            typeInfo.arrayDimensions,
            expressions,
            ctx.start?.line ?? 0,
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
          let result = firstPart;
          let idIndex = 1; // Start at 1 since we already used firstPart
          let exprIndex = 0;

          // Check if first identifier is a scope for special handling
          const isCrossScope = this.knownScopes.has(firstPart);

          for (let i = 1; i < ctx.children.length; i++) {
            const child = ctx.children[i];
            const childText = child.getText();

            if (childText === ".") {
              // Next child should be an IDENTIFIER
              if (i + 1 < ctx.children.length && idIndex < parts.length) {
                // Use underscore for first join if cross-scope, dot otherwise
                const separator = isCrossScope && idIndex === 1 ? "_" : ".";
                result += `${separator}${parts[idIndex]}`;
                idIndex++;
                i++; // Skip the identifier we just processed
              }
            } else if (childText === "[") {
              // Next child is an expression, then "]"
              if (exprIndex < expressions.length) {
                const expr = this.generateExpression(expressions[exprIndex]);
                result += `[${expr}]`;
                exprIndex++;
                i += 2; // Skip expression and "]"
              }
            }
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
    if (this.knownRegisters.has(firstPart)) {
      // ADR-013: Check for write-only register members (wo = cannot read)
      // Skip check if we're in assignment target context (write operation)
      if (!this.inAssignmentTarget && parts.length >= 2) {
        const memberName = parts[1];
        const fullName = `${firstPart}_${memberName}`;
        const accessMod = this.registerMemberAccess.get(fullName);
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
    if (this.knownScopes.has(firstPart)) {
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
        this.checkArrayBounds(
          name,
          typeInfo.arrayDimensions,
          exprs,
          ctx.start?.line ?? 0,
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
    if (ctx.genericType()) {
      return ctx.genericType()!.IDENTIFIER().getText();
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
    if (ctx.genericType()) {
      // Generics need special handling - for now, return the base name
      return ctx.genericType()!.IDENTIFIER().getText();
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
    const maxValue = CodeGenerator.TYPE_MAX[cnxType];
    const minValue = CodeGenerator.TYPE_MIN[cnxType];

    if (!cType || !maxValue) {
      return null;
    }

    const isUnsigned = cnxType.startsWith("u");

    switch (operation) {
      case "add":
        if (isUnsigned) {
          // Unsigned addition: check if result would wrap
          return `static inline ${cType} cnx_clamp_add_${cnxType}(${cType} a, ${cType} b) {
    if (a > ${maxValue} - b) return ${maxValue};
    return a + b;
}`;
        } else {
          // Signed addition: check both overflow and underflow
          return `static inline ${cType} cnx_clamp_add_${cnxType}(${cType} a, ${cType} b) {
    if (b > 0 && a > ${maxValue} - b) return ${maxValue};
    if (b < 0 && a < ${minValue} - b) return ${minValue};
    return a + b;
}`;
        }

      case "sub":
        if (isUnsigned) {
          // Unsigned subtraction: check if result would underflow
          return `static inline ${cType} cnx_clamp_sub_${cnxType}(${cType} a, ${cType} b) {
    if (a < b) return 0;
    return a - b;
}`;
        } else {
          // Signed subtraction: check both overflow and underflow
          return `static inline ${cType} cnx_clamp_sub_${cnxType}(${cType} a, ${cType} b) {
    if (b < 0 && a > ${maxValue} + b) return ${maxValue};
    if (b > 0 && a < ${minValue} + b) return ${minValue};
    return a - b;
}`;
        }

      case "mul":
        if (isUnsigned) {
          // Unsigned multiplication
          return `static inline ${cType} cnx_clamp_mul_${cnxType}(${cType} a, ${cType} b) {
    if (b != 0 && a > ${maxValue} / b) return ${maxValue};
    return a * b;
}`;
        } else {
          // Signed multiplication: handle negative cases
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

    switch (operation) {
      case "add":
        if (isUnsigned) {
          return `static inline ${cType} cnx_clamp_add_${cnxType}(${cType} a, ${cType} b) {
    if (a > ${maxValue} - b) {
        fprintf(stderr, "PANIC: Integer overflow in ${cnxType} ${opName}\\n");
        abort();
    }
    return a + b;
}`;
        } else {
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
          return `static inline ${cType} cnx_clamp_sub_${cnxType}(${cType} a, ${cType} b) {
    if (a < b) {
        fprintf(stderr, "PANIC: Integer underflow in ${cnxType} ${opName}\\n");
        abort();
    }
    return a - b;
}`;
        } else {
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
          return `static inline ${cType} cnx_clamp_mul_${cnxType}(${cType} a, ${cType} b) {
    if (b != 0 && a > ${maxValue} / b) {
        fprintf(stderr, "PANIC: Integer overflow in ${cnxType} ${opName}\\n");
        abort();
    }
    return a * b;
}`;
        } else {
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
