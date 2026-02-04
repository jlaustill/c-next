/**
 * C-Next Code Generator
 * Transforms C-Next AST to clean, readable C code
 */

import { CommonTokenStream, ParserRuleContext, TerminalNode } from "antlr4ng";
import * as Parser from "../../logic/parser/grammar/CNextParser";
import SymbolTable from "../../logic/symbols/SymbolTable";
import ESourceLanguage from "../../../utils/types/ESourceLanguage";
import ESymbolKind from "../../../utils/types/ESymbolKind";
import CommentExtractor from "../../logic/analysis/CommentExtractor";
import CommentFormatter from "./CommentFormatter";
import IncludeDiscovery from "../../data/IncludeDiscovery";
import IComment from "../../types/IComment";
import TYPE_WIDTH from "./types/TYPE_WIDTH";
import TYPE_MAP from "./types/TYPE_MAP";
import TYPE_LIMITS from "./types/TYPE_LIMITS";
// Issue #60: BITMAP_SIZE and BITMAP_BACKING_TYPE moved to SymbolCollector
import TTypeInfo from "./types/TTypeInfo";
import TParameterInfo from "./types/TParameterInfo";
import TOverflowBehavior from "./types/TOverflowBehavior";
import ICodeGeneratorOptions from "./types/ICodeGeneratorOptions";
import TypeResolver from "./TypeResolver";
import ICodeGenSymbols from "../../types/ICodeGenSymbols";
import TypeValidator from "./TypeValidator";
import TypeRegistrationUtils from "./TypeRegistrationUtils";
import IOrchestrator from "./generators/IOrchestrator";
import IGeneratorInput from "./generators/IGeneratorInput";
import IGeneratorState from "./generators/IGeneratorState";
import TGeneratorEffect from "./generators/TGeneratorEffect";
import TIncludeHeader from "./generators/TIncludeHeader";
import GeneratorRegistry from "./generators/GeneratorRegistry";
// ADR-053: Expression generators (A2)
import generateLiteral from "./generators/expressions/LiteralGenerator";
import binaryExprGenerators from "./generators/expressions/BinaryExprGenerator";
import generateUnaryExpr from "./generators/expressions/UnaryExprGenerator";
import expressionGenerators from "./generators/expressions/ExpressionGenerator";
import generatePostfixExpression from "./generators/expressions/PostfixExpressionGenerator";
// ADR-053: Statement generators (A3)
import controlFlowGenerators from "./generators/statements/ControlFlowGenerator";
import generateCriticalStatement from "./generators/statements/CriticalGenerator";
import atomicGenerators from "./generators/statements/AtomicGenerator";
import switchGenerators from "./generators/statements/SwitchGenerator";
// ADR-053: Declaration generators (A4)
import enumGenerator from "./generators/declarationGenerators/EnumGenerator";
import bitmapGenerator from "./generators/declarationGenerators/BitmapGenerator";
import registerGenerator from "./generators/declarationGenerators/RegisterGenerator";
import scopedRegisterGenerator from "./generators/declarationGenerators/ScopedRegisterGenerator";
import structGenerator from "./generators/declarationGenerators/StructGenerator";
import functionGenerator from "./generators/declarationGenerators/FunctionGenerator";
import scopeGenerator from "./generators/declarationGenerators/ScopeGenerator";
// ADR-109: Extracted utilities
import BitUtils from "../../../utils/BitUtils";
import CppNamespaceUtils from "../../../utils/CppNamespaceUtils";
import FormatUtils from "../../../utils/FormatUtils";
import StringUtils from "../../../utils/StringUtils";
import TypeCheckUtils from "../../../utils/TypeCheckUtils";
// ADR-053: Support generators (A5)
import helperGenerators from "./generators/support/HelperGenerator";
import includeGenerators from "./generators/support/IncludeGenerator";
import commentUtils from "./generators/support/CommentUtils";
// ADR-046: NullCheckAnalyzer for nullable C pointer type detection
import NullCheckAnalyzer from "../../logic/analysis/NullCheckAnalyzer";
// ADR-006: Helper for building member access chains with proper separators
import memberAccessChain from "./memberAccessChain";
// ADR-109: Assignment decomposition (Phase 2)
import assignmentHandlers from "./assignment/index";
import AssignmentClassifier from "./assignment/AssignmentClassifier";
import buildAssignmentContext from "./assignment/AssignmentContextBuilder";
import IHandlerDeps from "./assignment/handlers/IHandlerDeps";
// Issue #461: LiteralUtils for parsing const values from symbol table
import LiteralUtils from "../../../utils/LiteralUtils";
// Issue #644: Extracted string length counter for strlen caching optimization
import StringLengthCounter from "./analysis/StringLengthCounter";
// Issue #644: C/C++ mode helper for consolidated mode-specific patterns
import CppModeHelper from "./helpers/CppModeHelper";

const {
  generateOverflowHelpers: helperGenerateOverflowHelpers,
  generateSafeDivHelpers: helperGenerateSafeDivHelpers,
} = helperGenerators;

const {
  transformIncludeDirective: includeTransformIncludeDirective,
  processPreprocessorDirective: includeProcessPreprocessorDirective,
} = includeGenerators;

const {
  getLeadingComments: commentGetLeadingComments,
  getTrailingComments: commentGetTrailingComments,
  formatLeadingComments: commentFormatLeadingComments,
  formatTrailingComment: commentFormatTrailingComment,
} = commentUtils;

/** C null terminator character literal for generated code */
const C_NULL_CHAR = String.raw`'\0'`;

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
  currentFunctionName: string | null; // Issue #269: track current function for pass-by-value lookup
  currentFunctionReturnType: string | null; // Issue #477: track return type for enum inference
  indentLevel: number;
  scopeMembers: Map<string, Set<string>>; // scope -> member names (ADR-016)
  currentParameters: Map<string, TParameterInfo>; // ADR-006: track params for pointer semantics
  // Issue #558: modifiedParameters removed - now uses analysis-phase results from this.modifiedParameters
  localArrays: Set<string>; // ADR-006: track local array variables (no & needed)
  localVariables: Set<string>; // ADR-016: track local variables (allowed as bare identifiers)
  floatBitShadows: Set<string>; // Track declared shadow variables for float bit indexing
  floatShadowCurrent: Set<string>; // Track which shadows have current value (skip redundant memcpy reads)
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
 *
 * Implements IOrchestrator to support modular generator extraction (ADR-053).
 */
export default class CodeGenerator implements IOrchestrator {
  /** ADR-044: Debug mode generates panic-on-overflow helpers */
  private debugMode: boolean = false;

  private context: GeneratorContext = {
    currentScope: null, // ADR-016: renamed from currentNamespace
    currentFunctionName: null, // Issue #269: track current function for pass-by-value lookup
    currentFunctionReturnType: null, // Issue #477: track return type for enum inference
    indentLevel: 0,
    scopeMembers: new Map(), // ADR-016: renamed from namespaceMembers
    currentParameters: new Map(),
    // Issue #558: modifiedParameters removed - now uses analysis-phase results
    localArrays: new Set(),
    localVariables: new Set(), // ADR-016: track local variables
    floatBitShadows: new Set(), // Track declared shadow variables for float bit indexing
    floatShadowCurrent: new Set(), // Track which shadows have current value
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

  private needsFloatStaticAssert: boolean = false; // For float bit indexing size verification

  private needsISR: boolean = false; // ADR-040: For ISR function pointer type

  private needsCMSIS: boolean = false; // ADR-049/050: For atomic intrinsics and critical sections

  private needsLimits: boolean = false; // Issue #632: For float-to-int clamp casts

  private needsIrqWrappers: boolean = false; // Issue #473: IRQ wrappers for critical sections

  /** External symbol table for cross-language interop */
  private symbolTable: SymbolTable | null = null;

  /** ADR-010: Source file path for validating includes */
  private sourcePath: string | null = null;

  /** Issue #349: Include directories for resolving angle-bracket .cnx includes */
  private includeDirs: string[] = [];

  /** Issue #349: Input directories for calculating relative paths */
  private inputs: string[] = [];

  /** Token stream for comment extraction (ADR-043) */
  private tokenStream: CommonTokenStream | null = null;

  private commentExtractor: CommentExtractor | null = null;

  private readonly commentFormatter: CommentFormatter = new CommentFormatter();

  /** Type resolution and classification */
  private typeResolver: TypeResolver | null = null;

  /** Symbol collection - ADR-055: Now uses ISymbolInfo from TSymbolInfoAdapter */
  public symbols: ICodeGenSymbols | null = null;

  /** Type validation - Issue #63: Extracted from CodeGenerator */
  private typeValidator: TypeValidator | null = null;

  /** Issue #644: String length counter for strlen caching optimization */
  private stringLengthCounter: StringLengthCounter | null = null;

  /** Generator registry for modular code generation (ADR-053) */
  private readonly registry: GeneratorRegistry = new GeneratorRegistry();

  /** Issue #250: C++ mode - use temp vars instead of compound literals */
  private cppMode: boolean = false;

  /** Issue #644: C/C++ mode helper for consolidated mode-specific patterns */
  private cppHelper: CppModeHelper | null = null;

  /** Issue #250: Pending temp variable declarations for C++ mode */
  private pendingTempDeclarations: string[] = [];

  /** Issue #250: Counter for unique temp variable names */
  private tempVarCounter: number = 0;

  /** Issue #517: Pending field assignments for C++ class struct init */
  private pendingCppClassAssignments: string[] = [];

  /**
   * Issue #269: Tracks which parameters are modified (directly or transitively)
   * Map of functionName -> Set of modified parameter names
   */
  private readonly modifiedParameters: Map<string, Set<string>> = new Map();

  /**
   * Issue #579: Tracks which parameters have subscript access (read or write)
   * These parameters must become pointers to support array access semantics
   * Map of functionName -> Set of parameter names with subscript access
   */
  private readonly subscriptAccessedParameters: Map<string, Set<string>> =
    new Map();

  /**
   * Issue #558: Pending cross-file modifications to inject after analyzePassByValue clears.
   * Set by Pipeline before generate() to share modifications from previously processed files.
   */
  private pendingCrossFileModifications: ReadonlyMap<
    string,
    ReadonlySet<string>
  > | null = null;

  /**
   * Issue #558: Pending cross-file parameter lists to inject for transitive propagation.
   */
  private pendingCrossFileParamLists: ReadonlyMap<
    string,
    readonly string[]
  > | null = null;

  /**
   * Issue #269: Tracks which parameters should pass by value
   * Map of functionName -> Set of passByValue parameter names
   */
  private readonly passByValueParams: Map<string, Set<string>> = new Map();

  /**
   * Issue #269: Tracks function call relationships for transitive modification analysis
   * Map of functionName -> Array of {callee, paramIndex, argParamName}
   * where argParamName is the caller's parameter passed as argument
   */
  private readonly functionCallGraph: Map<
    string,
    Array<{ callee: string; paramIndex: number; argParamName: string }>
  > = new Map();

  /**
   * Issue #269: Tracks function parameter lists for call graph analysis
   * Map of functionName -> Array of parameter names in order
   */
  private readonly functionParamLists: Map<string, string[]> = new Map();

  /**
   * Issue #369: Tracks whether self-include was added.
   * When true, skip struct/enum/bitmap definitions in .c file because
   * they'll be defined in the included header.
   */
  private selfIncludeAdded: boolean = false;

  /**
   * Initialize generator registry with extracted generators.
   * Called once before code generation begins.
   */
  private initializeGenerators(): void {
    // Phase 1: Simple leaf generators
    this.registry.registerDeclaration("enum", enumGenerator);
    this.registry.registerDeclaration("bitmap", bitmapGenerator);
    this.registry.registerDeclaration("register", registerGenerator);
    // Note: generateScopedRegister has a different signature (extra scopeName param)
    // and is called directly rather than through the registry

    // Phase 2: Medium complexity generators
    this.registry.registerDeclaration("struct", structGenerator);

    // Phase 3: Complex generators
    this.registry.registerDeclaration("function", functionGenerator);

    // Phase 4: Composite generators
    this.registry.registerDeclaration("scope", scopeGenerator);

    // Statement generators (ADR-053 A3)
    // Note: generateSwitchCase, generateCaseLabel, generateDefaultCase have extra
    // switchEnumType param and are called directly rather than through the registry.
    // Same for generateForVarDecl, generateForAssignment - internal helpers.
    this.registry.registerStatement(
      "return",
      controlFlowGenerators.generateReturn,
    );
    this.registry.registerStatement("if", controlFlowGenerators.generateIf);
    this.registry.registerStatement(
      "while",
      controlFlowGenerators.generateWhile,
    );
    this.registry.registerStatement(
      "do-while",
      controlFlowGenerators.generateDoWhile,
    );
    this.registry.registerStatement("for", controlFlowGenerators.generateFor);
    this.registry.registerStatement("switch", switchGenerators.generateSwitch);
    this.registry.registerStatement("critical", generateCriticalStatement);

    // Expression generators (ADR-053 A2)
    this.registry.registerExpression(
      "expression",
      expressionGenerators.generateExpression,
    );
    this.registry.registerExpression(
      "ternary",
      expressionGenerators.generateTernaryExpr,
    );
    this.registry.registerExpression("or", binaryExprGenerators.generateOrExpr);
    this.registry.registerExpression(
      "and",
      binaryExprGenerators.generateAndExpr,
    );
    this.registry.registerExpression(
      "equality",
      binaryExprGenerators.generateEqualityExpr,
    );
    this.registry.registerExpression(
      "relational",
      binaryExprGenerators.generateRelationalExpr,
    );
    this.registry.registerExpression(
      "bitwise-or",
      binaryExprGenerators.generateBitwiseOrExpr,
    );
    this.registry.registerExpression(
      "bitwise-xor",
      binaryExprGenerators.generateBitwiseXorExpr,
    );
    this.registry.registerExpression(
      "bitwise-and",
      binaryExprGenerators.generateBitwiseAndExpr,
    );
    this.registry.registerExpression(
      "shift",
      binaryExprGenerators.generateShiftExpr,
    );
    this.registry.registerExpression(
      "additive",
      binaryExprGenerators.generateAdditiveExpr,
    );
    this.registry.registerExpression(
      "multiplicative",
      binaryExprGenerators.generateMultiplicativeExpr,
    );
    this.registry.registerExpression("unary", generateUnaryExpr);
    this.registry.registerExpression("literal", generateLiteral);
  }

  /**
   * Invoke a registered statement generator by name.
   * Reduces boilerplate in wrapper methods.
   */
  private invokeStatement(name: string, ctx: ParserRuleContext): string {
    const generator = this.registry.getStatement(name);
    if (!generator) {
      throw new Error(`${name} statement generator not registered`);
    }
    const result = generator(ctx, this.getInput(), this.getState(), this);
    this.applyEffects(result.effects);
    return result.code;
  }

  /**
   * Invoke a registered expression generator by name.
   * Reduces boilerplate in wrapper methods.
   */
  private invokeExpression(name: string, ctx: ParserRuleContext): string {
    const generator = this.registry.getExpression(name);
    if (!generator) {
      throw new Error(`${name} expression generator not registered`);
    }
    const result = generator(ctx, this.getInput(), this.getState(), this);
    this.applyEffects(result.effects);
    return result.code;
  }

  private generatorsInitialized = false;

  // ===========================================================================
  // IOrchestrator Implementation (ADR-053)
  // ===========================================================================

  /**
   * Get read-only input context for generators.
   * Contains all the information generators need to produce code.
   */
  getInput(): IGeneratorInput {
    return {
      symbolTable: this.symbolTable,
      symbols: this.symbols,
      typeRegistry: this.context.typeRegistry,
      functionSignatures: this.functionSignatures,
      knownFunctions: this.knownFunctions,
      knownStructs: this.symbols?.knownStructs ?? new Set(),
      constValues: this.constValues,
      callbackTypes: this.callbackTypes,
      callbackFieldTypes: this.callbackFieldTypes,
      targetCapabilities: this.context.targetCapabilities,
      debugMode: this.debugMode,
    };
  }

  /**
   * Get a snapshot of the current generation state.
   * Represents where we are in the AST traversal.
   */
  getState(): IGeneratorState {
    return {
      currentScope: this.context.currentScope,
      indentLevel: this.context.indentLevel,
      inFunctionBody: this.context.inFunctionBody,
      currentParameters: this.context.currentParameters,
      localVariables: this.context.localVariables,
      localArrays: this.context.localArrays,
      expectedType: this.context.expectedType,
      selfIncludeAdded: this.selfIncludeAdded, // Issue #369
      // Issue #644: Postfix expression state
      scopeMembers: this.context.scopeMembers,
      mainArgsName: this.context.mainArgsName,
      floatBitShadows: this.context.floatBitShadows,
      floatShadowCurrent: this.context.floatShadowCurrent,
      lengthCache: this.context.lengthCache,
    };
  }

  /**
   * Process effects returned by generators, updating internal state.
   * This centralizes all side-effect handling.
   */
  applyEffects(effects: readonly TGeneratorEffect[]): void {
    for (const effect of effects) {
      switch (effect.type) {
        // Include effects - delegate to requireInclude()
        case "include":
          this.requireInclude(effect.header);
          break;
        case "isr":
          this.requireInclude("isr");
          break;

        // Helper function effects
        case "helper":
          this.usedClampOps.add(`${effect.operation}_${effect.cnxType}`);
          break;
        case "safe-div":
          this.usedSafeDivOps.add(`${effect.operation}_${effect.cnxType}`);
          break;

        // Type registration effects
        case "register-type":
          this.context.typeRegistry.set(effect.name, effect.info);
          break;
        case "register-local":
          this.context.localVariables.add(effect.name);
          if (effect.isArray) {
            this.context.localArrays.add(effect.name);
          }
          break;
        case "register-const-value":
          this.constValues.set(effect.name, effect.value);
          break;

        // Scope effects (ADR-016)
        case "set-scope":
          this.context.currentScope = effect.name;
          break;

        // Function body effects
        case "enter-function-body":
          this.context.inFunctionBody = true;
          this.context.localVariables.clear();
          this.context.localArrays.clear();
          this.context.floatBitShadows.clear();
          this.context.floatShadowCurrent.clear();
          break;
        case "exit-function-body":
          this.context.inFunctionBody = false;
          this.context.localVariables.clear();
          this.context.localArrays.clear();
          this.context.floatBitShadows.clear();
          this.context.floatShadowCurrent.clear();
          break;
        case "set-parameters":
          this.context.currentParameters = new Map(effect.params);
          break;
        case "clear-parameters":
          this.context.currentParameters.clear();
          break;

        // Callback effects
        case "register-callback-field":
          this.callbackFieldTypes.set(effect.key, effect.typeName);
          break;

        // Array initializer effects
        case "set-array-init-count":
          this.context.lastArrayInitCount = effect.count;
          break;
        case "set-array-fill-value":
          this.context.lastArrayFillValue = effect.value;
          break;
      }
    }
  }

  /**
   * Register a required include header. Centralizes all include flag management
   * to reduce scattered assignments throughout the codebase.
   *
   * @param header - The header to require (stdint, stdbool, string, etc.)
   */
  private requireInclude(header: TIncludeHeader): void {
    switch (header) {
      case "stdint":
        this.needsStdint = true;
        break;
      case "stdbool":
        this.needsStdbool = true;
        break;
      case "string":
        this.needsString = true;
        break;
      case "cmsis":
        this.needsCMSIS = true;
        break;
      case "limits":
        this.needsLimits = true;
        break;
      case "isr":
        this.needsISR = true;
        break;
      case "float_static_assert":
        this.needsFloatStaticAssert = true;
        break;
      case "irq_wrappers":
        this.needsIrqWrappers = true;
        break;
    }
  }

  /**
   * Get the current indentation string.
   */
  getIndent(): string {
    return FormatUtils.indent(this.context.indentLevel);
  }

  /**
   * Resolve an identifier to its fully-scoped name.
   * Part of IOrchestrator interface - delegates to private implementation.
   */
  resolveIdentifier(identifier: string): string {
    return this._resolveIdentifier(identifier);
  }

  // === Expression Generation (ADR-053 A2) ===

  /**
   * Generate a C expression from any expression context.
   * Part of IOrchestrator interface - delegates to private implementation.
   */
  generateExpression(ctx: Parser.ExpressionContext): string {
    return this._generateExpression(ctx);
  }

  /**
   * Issue #477: Generate expression with a specific expected type context.
   * Used by return statements to resolve unqualified enum values.
   */
  generateExpressionWithExpectedType(
    ctx: Parser.ExpressionContext,
    expectedType: string | null,
  ): string {
    const savedExpectedType = this.context.expectedType;
    this.context.expectedType = expectedType;
    const result = this._generateExpression(ctx);
    this.context.expectedType = savedExpectedType;
    return result;
  }

  /**
   * Generate type translation (C-Next type -> C type).
   * Part of IOrchestrator interface - delegates to private implementation.
   */
  generateType(ctx: Parser.TypeContext): string {
    return this._generateType(ctx);
  }

  /**
   * Generate a unary expression.
   * Part of IOrchestrator interface - delegates to private implementation.
   */
  generateUnaryExpr(ctx: Parser.UnaryExpressionContext): string {
    return this._generateUnaryExpr(ctx);
  }

  /**
   * Generate a postfix expression.
   * Part of IOrchestrator interface - delegates to private implementation.
   */
  generatePostfixExpr(ctx: Parser.PostfixExpressionContext): string {
    return this._generatePostfixExpr(ctx);
  }

  /**
   * Generate the full precedence chain from or-expression down.
   * Part of IOrchestrator interface - delegates to private implementation.
   */
  generateOrExpr(ctx: Parser.OrExpressionContext): string {
    return this._generateOrExpr(ctx);
  }

  // === Type Utilities ===

  /**
   * Check if a type name is a known struct.
   * Part of IOrchestrator interface.
   */
  isKnownStruct(typeName: string): boolean {
    return this._isKnownStruct(typeName);
  }

  /**
   * Check if a type is a float type.
   * Part of IOrchestrator interface - delegates to TypeResolver.
   */
  isFloatType(typeName: string): boolean {
    return this.typeResolver!.isFloatType(typeName);
  }

  /**
   * Check if a type is an integer type.
   * Part of IOrchestrator interface - delegates to TypeResolver.
   */
  isIntegerType(typeName: string): boolean {
    return this.typeResolver!.isIntegerType(typeName);
  }

  /**
   * Check if a function is defined in C-Next.
   * Part of IOrchestrator interface - delegates to private implementation.
   */
  isCNextFunction(name: string): boolean {
    return this._isCNextFunction(name);
  }

  // === Expression Analysis ===

  /**
   * Get the enum type of an expression.
   * Part of IOrchestrator interface - delegates to private implementation.
   */
  getExpressionEnumType(
    ctx: Parser.ExpressionContext | Parser.RelationalExpressionContext,
  ): string | null {
    return this._getExpressionEnumType(ctx);
  }

  /**
   * Check if an expression is an integer literal or variable.
   * Part of IOrchestrator interface - delegates to private implementation.
   */
  isIntegerExpression(
    ctx: Parser.ExpressionContext | Parser.RelationalExpressionContext,
  ): boolean {
    return this._isIntegerExpression(ctx);
  }

  /**
   * Check if an expression is a string type.
   * Part of IOrchestrator interface - delegates to private implementation.
   */
  isStringExpression(ctx: Parser.RelationalExpressionContext): boolean {
    return this._isStringExpression(ctx);
  }

  /**
   * Get type of additive expression.
   * Part of IOrchestrator interface - delegates to private implementation.
   */
  getAdditiveExpressionType(
    ctx: Parser.AdditiveExpressionContext,
  ): string | null {
    return this._getAdditiveExpressionType(ctx);
  }

  /**
   * Extract operators from parse tree children in correct order.
   * Part of IOrchestrator interface - delegates to private implementation.
   */
  getOperatorsFromChildren(ctx: ParserRuleContext): string[] {
    return this._getOperatorsFromChildren(ctx);
  }

  // === Validation ===

  /**
   * Validate cross-scope member visibility.
   * Part of IOrchestrator interface - delegates to private implementation.
   */
  validateCrossScopeVisibility(scopeName: string, memberName: string): void {
    this._validateCrossScopeVisibility(scopeName, memberName);
  }

  /**
   * Validate shift amount is within type bounds.
   * Part of IOrchestrator interface - delegates to TypeValidator.
   */
  validateShiftAmount(
    leftType: string,
    rightExpr: Parser.AdditiveExpressionContext,
    op: string,
    ctx: Parser.ShiftExpressionContext,
  ): void {
    this.typeValidator!.validateShiftAmount(leftType, rightExpr, op, ctx);
  }

  /**
   * Validate ternary condition is a comparison (ADR-022).
   * Part of IOrchestrator interface - delegates to TypeValidator.
   */
  validateTernaryCondition(condition: Parser.OrExpressionContext): void {
    this.typeValidator!.validateTernaryCondition(condition);
  }

  /**
   * Validate no nested ternary expressions (ADR-022).
   * Part of IOrchestrator interface - delegates to TypeValidator.
   */
  validateNoNestedTernary(
    expr: Parser.OrExpressionContext,
    branchName: string,
  ): void {
    this.typeValidator!.validateNoNestedTernary(expr, branchName);
  }

  // === Function Call Helpers (ADR-053 A2 Phase 5) ===

  /**
   * Get simple identifier from expression, or null if complex.
   * Part of IOrchestrator interface - delegates to private implementation.
   */
  getSimpleIdentifier(ctx: Parser.ExpressionContext): string | null {
    return this._getSimpleIdentifier(ctx);
  }

  /**
   * Generate function argument with pass-by-reference handling.
   * Part of IOrchestrator interface - delegates to private implementation.
   */
  generateFunctionArg(
    ctx: Parser.ExpressionContext,
    targetParamBaseType?: string,
  ): string {
    return this._generateFunctionArg(ctx, targetParamBaseType);
  }

  /**
   * Check if a value is const.
   * Part of IOrchestrator interface - delegates to TypeValidator.
   */
  isConstValue(name: string): boolean {
    return this.typeValidator!.isConstValue(name);
  }

  /**
   * Get known enums set for pass-by-value detection.
   * Part of IOrchestrator interface.
   */
  getKnownEnums(): ReadonlySet<string> {
    return this.symbols!.knownEnums;
  }

  /**
   * Issue #304: Check if we're generating C++ output.
   * Part of IOrchestrator interface.
   */
  isCppMode(): boolean {
    return this.cppMode;
  }

  /**
   * Issue #304: Check if a type is a C++ enum class (scoped enum).
   * These require explicit casts to integer types in C++.
   * Part of IOrchestrator interface.
   */
  isCppEnumClass(typeName: string): boolean {
    if (!this.symbolTable) {
      return false;
    }

    const symbols = this.symbolTable.getOverloads(typeName);
    for (const sym of symbols) {
      if (
        sym.sourceLanguage === ESourceLanguage.Cpp &&
        sym.kind === ESymbolKind.Enum
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Issue #304: Get the type of an expression.
   * Part of IOrchestrator interface.
   */
  getExpressionType(ctx: Parser.ExpressionContext): string | null {
    return this.typeResolver!.getExpressionType(ctx);
  }

  /**
   * Generate a block (curly braces with statements).
   * Part of IOrchestrator interface (ADR-053 A3).
   */
  generateBlock(ctx: Parser.BlockContext): string {
    return this._generateBlock(ctx);
  }

  /**
   * Validate no early exits (return/break) in critical blocks.
   * Part of IOrchestrator interface (ADR-053 A3).
   */
  validateNoEarlyExits(ctx: Parser.BlockContext): void {
    this.typeValidator!.validateNoEarlyExits(ctx);
  }

  /**
   * Generate a single statement.
   * Part of IOrchestrator interface (ADR-053 A3).
   */
  generateStatement(ctx: Parser.StatementContext): string {
    return this._generateStatement(ctx);
  }

  /**
   * Issue #250: Flush pending temp variable declarations.
   * Returns declarations as a single string and clears the pending list.
   * Part of IOrchestrator interface.
   */
  flushPendingTempDeclarations(): string {
    if (this.pendingTempDeclarations.length === 0) {
      return "";
    }
    const decls = this.pendingTempDeclarations.join("\n");
    this.pendingTempDeclarations = [];
    return decls;
  }

  /**
   * Get indentation string for current level.
   * Part of IOrchestrator interface (ADR-053 A3).
   */
  indent(text: string): string {
    return this._indent(text);
  }

  /**
   * Validate switch statement.
   * Part of IOrchestrator interface (ADR-053 A3).
   */
  validateSwitchStatement(
    ctx: Parser.SwitchStatementContext,
    switchExpr: Parser.ExpressionContext,
  ): void {
    this.typeValidator!.validateSwitchStatement(ctx, switchExpr);
  }

  /**
   * Validate do-while condition.
   * Part of IOrchestrator interface (ADR-053 A3).
   */
  validateDoWhileCondition(ctx: Parser.ExpressionContext): void {
    this.typeValidator!.validateDoWhileCondition(ctx);
  }

  /**
   * Issue #254: Validate no function calls in condition (E0702).
   * Part of IOrchestrator interface (ADR-053 A3).
   */
  validateConditionNoFunctionCall(
    ctx: Parser.ExpressionContext,
    conditionType: string,
  ): void {
    this.typeValidator!.validateConditionNoFunctionCall(ctx, conditionType);
  }

  /**
   * Issue #254: Validate no function calls in ternary condition (E0702).
   * Part of IOrchestrator interface (ADR-053 A2).
   */
  validateTernaryConditionNoFunctionCall(
    ctx: Parser.OrExpressionContext,
  ): void {
    this.typeValidator!.validateTernaryConditionNoFunctionCall(ctx);
  }

  /**
   * Generate an assignment target.
   * Part of IOrchestrator interface (ADR-053 A3).
   */
  generateAssignmentTarget(ctx: Parser.AssignmentTargetContext): string {
    return this._generateAssignmentTarget(ctx);
  }

  /**
   * Generate array dimensions.
   * Part of IOrchestrator interface (ADR-053 A3).
   */
  generateArrayDimensions(dims: Parser.ArrayDimensionContext[]): string {
    return this._generateArrayDimensions(dims);
  }

  // === strlen Optimization (ADR-053 A3) ===

  /**
   * Count string length accesses for caching.
   * Part of IOrchestrator interface (ADR-053 A3).
   */
  countStringLengthAccesses(
    ctx: Parser.ExpressionContext,
  ): Map<string, number> {
    // Issue #644: Delegate to extracted StringLengthCounter
    return this.stringLengthCounter!.countExpression(ctx);
  }

  /**
   * Count block length accesses.
   * Part of IOrchestrator interface (ADR-053 A3).
   */
  countBlockLengthAccesses(
    ctx: Parser.BlockContext,
    counts: Map<string, number>,
  ): void {
    // Issue #644: Delegate to extracted StringLengthCounter
    this.stringLengthCounter!.countBlockInto(ctx, counts);
  }

  /**
   * Setup length cache and return declarations.
   * Part of IOrchestrator interface (ADR-053 A3).
   */
  setupLengthCache(counts: Map<string, number>): string {
    return this._setupLengthCache(counts);
  }

  /**
   * Clear length cache.
   * Part of IOrchestrator interface (ADR-053 A3).
   */
  clearLengthCache(): void {
    this._clearLengthCache();
  }

  /**
   * Register a local variable.
   * Part of IOrchestrator interface (ADR-053 A3).
   */
  registerLocalVariable(name: string): void {
    this.context.localVariables.add(name);
  }

  // === Declaration Generation (ADR-053 A4) ===

  /** Generate single array dimension */
  generateArrayDimension(dim: Parser.ArrayDimensionContext): string {
    return this._generateArrayDimension(dim);
  }

  /** Generate parameter list for function signature */
  generateParameterList(ctx: Parser.ParameterListContext): string {
    return this._generateParameterList(ctx);
  }

  /** Get the raw type name without C conversion */
  getTypeName(ctx: Parser.TypeContext): string {
    return this._getTypeName(ctx);
  }

  /** Try to evaluate a constant expression at compile time */
  tryEvaluateConstant(ctx: Parser.ExpressionContext): number | undefined {
    return this._tryEvaluateConstant(ctx);
  }

  /** Get zero initializer for a type */
  getZeroInitializer(typeCtx: Parser.TypeContext, isArray: boolean): string {
    return this._getZeroInitializer(typeCtx, isArray);
  }

  // === Validation (IOrchestrator A4) ===

  /** Validate that a literal value fits in the target type */
  validateLiteralFitsType(literal: string, typeName: string): void {
    this._validateLiteralFitsType(literal, typeName);
  }

  /** Validate type conversion is allowed */
  validateTypeConversion(targetType: string, sourceType: string | null): void {
    this._validateTypeConversion(targetType, sourceType);
  }

  // === String Helpers (IOrchestrator A4) ===

  /** Get the length of a string literal */
  getStringLiteralLength(literal: string): number {
    return this._getStringLiteralLength(literal);
  }

  /** Get string concatenation operands if expression is a concat */
  getStringConcatOperands(ctx: Parser.ExpressionContext): {
    left: string;
    right: string;
    leftCapacity: number;
    rightCapacity: number;
  } | null {
    return this._getStringConcatOperands(ctx);
  }

  /** Get substring operands if expression is a substring call */
  getSubstringOperands(ctx: Parser.ExpressionContext): {
    source: string;
    start: string;
    length: string;
    sourceCapacity: number;
  } | null {
    return this._getSubstringOperands(ctx);
  }

  /** Get the capacity of a string expression */
  getStringExprCapacity(exprCode: string): number | null {
    return this._getStringExprCapacity(exprCode);
  }

  // === Parameter Management (IOrchestrator A4) ===

  /** Set current function parameters */
  setParameters(paramList: Parser.ParameterListContext | null): void {
    this._setParameters(paramList);
  }

  /** Clear current function parameters */
  clearParameters(): void {
    this._clearParameters();
  }

  /** Check if a callback type is used as a struct field type */
  isCallbackTypeUsedAsFieldType(funcName: string): boolean {
    return this._isCallbackTypeUsedAsFieldType(funcName);
  }

  // === Scope Management (A4) ===

  setCurrentScope(name: string | null): void {
    this.context.currentScope = name;
  }

  /**
   * Issue #269: Set the current function name for pass-by-value lookup.
   * Part of IOrchestrator interface.
   */
  setCurrentFunctionName(name: string | null): void {
    this.context.currentFunctionName = name;
  }

  /**
   * Issue #477: Get the current function's return type for enum inference.
   * Used by return statement generation to set expectedType.
   */
  getCurrentFunctionReturnType(): string | null {
    return this.context.currentFunctionReturnType;
  }

  /**
   * Issue #477: Set the current function's return type for enum inference.
   */
  setCurrentFunctionReturnType(returnType: string | null): void {
    this.context.currentFunctionReturnType = returnType;
  }

  // === Function Body Management (A4) ===

  enterFunctionBody(): void {
    this.context.localVariables.clear();
    this.context.floatBitShadows.clear();
    this.context.floatShadowCurrent.clear();
    // Issue #558: modifiedParameters tracking removed - uses analysis-phase results
    this.context.inFunctionBody = true;
  }

  exitFunctionBody(): void {
    this.context.inFunctionBody = false;
    this.context.localVariables.clear();
    this.context.floatBitShadows.clear();
    this.context.floatShadowCurrent.clear();
    this.context.mainArgsName = null;
  }

  setMainArgsName(name: string | null): void {
    this.context.mainArgsName = name;
  }

  isMainFunctionWithArgs(
    name: string,
    paramList: Parser.ParameterListContext | null,
  ): boolean {
    return this._isMainFunctionWithArgs(name, paramList);
  }

  generateCallbackTypedef(funcName: string): string | null {
    return this._generateCallbackTypedef(funcName);
  }

  /**
   * Issue #268: Store unmodified parameters for a function.
   * Maps function name -> Set of parameter names that were NOT modified.
   * Used by Pipeline to update symbol info before header generation.
   */
  private readonly functionUnmodifiedParams: Map<string, Set<string>> =
    new Map();

  /**
   * Issue #268: Get unmodified parameters info for all functions.
   * Returns map of function name -> Set of unmodified parameter names.
   */
  getFunctionUnmodifiedParams(): ReadonlyMap<string, Set<string>> {
    return this.functionUnmodifiedParams;
  }

  /**
   * Issue #268: Update symbol parameters with auto-const info.
   * Issue #558: Now uses analysis-phase results for modification tracking.
   */
  updateFunctionParamsAutoConst(functionName: string): void {
    // Collect unmodified parameters for this function using analysis results
    const unmodifiedParams = new Set<string>();
    const modifiedSet = this.modifiedParameters.get(functionName);
    for (const [paramName] of this.context.currentParameters) {
      if (!modifiedSet?.has(paramName)) {
        unmodifiedParams.add(paramName);
      }
    }
    this.functionUnmodifiedParams.set(functionName, unmodifiedParams);
  }

  /**
   * Issue #268: Mark a parameter as modified for auto-const tracking.
   * Issue #558: Now a no-op - analysis phase handles all modification tracking
   * including transitive propagation across function calls and files.
   */
  markParameterModified(_paramName: string): void {
    // No-op: Analysis phase (analyzePassByValue) now handles all modification
    // tracking including cross-file and transitive propagation.
  }

  /**
   * Issue #558: Check if a parameter is modified using analysis-phase results.
   * This is the unified source of truth for modification tracking.
   */
  private _isCurrentParameterModified(paramName: string): boolean {
    const funcName = this.context.currentFunctionName;
    if (!funcName) return false;
    return this.modifiedParameters.get(funcName)?.has(paramName) ?? false;
  }

  /**
   * Issue #558: Get the modified parameters map for cross-file propagation.
   * Returns function name -> set of modified parameter names.
   */
  getModifiedParameters(): ReadonlyMap<string, Set<string>> {
    return this.modifiedParameters;
  }

  /**
   * Issue #558: Set cross-file modification data to inject during analyzePassByValue.
   * Called by Pipeline before generate() to share modifications from previously processed files.
   */
  setCrossFileModifications(
    modifications: ReadonlyMap<string, ReadonlySet<string>>,
    paramLists: ReadonlyMap<string, readonly string[]>,
  ): void {
    this.pendingCrossFileModifications = modifications;
    this.pendingCrossFileParamLists = paramLists;
  }

  /**
   * Issue #558: Get the function parameter lists for cross-file propagation.
   */
  getFunctionParamLists(): ReadonlyMap<string, string[]> {
    return this.functionParamLists;
  }

  /**
   * Issue #561: Analyze modifications in a parse tree without full code generation.
   * Used by Pipeline.transpileSource() to collect modification info from includes
   * for cross-file const inference (unified with Pipeline.run() behavior).
   *
   * Issue #565: Now accepts optional cross-file data for transitive propagation.
   * When a file calls a function from an included file that modifies its param,
   * we need that info available during analysis to propagate correctly.
   *
   * Returns the modifications and param lists discovered in this tree.
   */
  analyzeModificationsOnly(
    tree: Parser.ProgramContext,
    crossFileModifications?: ReadonlyMap<string, ReadonlySet<string>>,
    crossFileParamLists?: ReadonlyMap<string, readonly string[]>,
  ): {
    modifications: Map<string, Set<string>>;
    paramLists: Map<string, string[]>;
  } {
    // Save current state
    const savedModifications = new Map(this.modifiedParameters);
    const savedParamLists = new Map(this.functionParamLists);
    const savedCallGraph = new Map(this.functionCallGraph);

    // Clear for fresh analysis
    this.modifiedParameters.clear();
    this.functionParamLists.clear();
    this.functionCallGraph.clear();

    // Issue #565: Inject cross-file data BEFORE collecting this file's info
    // This allows transitive propagation to work across file boundaries
    if (crossFileModifications) {
      for (const [funcName, params] of crossFileModifications) {
        this.modifiedParameters.set(funcName, new Set(params));
      }
    }
    if (crossFileParamLists) {
      for (const [funcName, params] of crossFileParamLists) {
        this.functionParamLists.set(funcName, [...params]);
      }
    }

    // Track which functions were injected (not from this file)
    const injectedFuncs = new Set(crossFileModifications?.keys() ?? []);

    // Run modification analysis on the tree (adds to what was injected)
    this.collectFunctionParametersAndModifications(tree);

    // Issue #565: Run transitive propagation with full context
    // This propagates modifications from included files' functions to this file's functions
    this.propagateTransitiveModifications();

    // Capture results - only include functions NOT from cross-file injection
    // (return only what this file contributes, including transitively discovered mods)
    const modifications = new Map<string, Set<string>>();
    for (const [funcName, params] of this.modifiedParameters) {
      // Include if: not injected, OR has new params beyond what was injected
      const injectedParams = crossFileModifications?.get(funcName);
      if (!injectedFuncs.has(funcName)) {
        // Function defined in this file - include all its modifications
        modifications.set(funcName, new Set(params));
      } else if (injectedParams) {
        // Check if we discovered new modifications for an injected function
        const newParams = new Set<string>();
        for (const p of params) {
          if (!injectedParams.has(p)) {
            newParams.add(p);
          }
        }
        if (newParams.size > 0) {
          modifications.set(funcName, newParams);
        }
      }
    }
    const paramLists = new Map<string, string[]>();
    for (const [funcName, params] of this.functionParamLists) {
      if (!crossFileParamLists?.has(funcName)) {
        paramLists.set(funcName, [...params]);
      }
    }

    // Restore previous state by clearing and repopulating (readonly maps)
    this.modifiedParameters.clear();
    for (const [k, v] of savedModifications) {
      this.modifiedParameters.set(k, v);
    }
    this.functionParamLists.clear();
    for (const [k, v] of savedParamLists) {
      this.functionParamLists.set(k, v);
    }
    this.functionCallGraph.clear();
    for (const [k, v] of savedCallGraph) {
      this.functionCallGraph.set(k, v);
    }

    return { modifications, paramLists };
  }

  /**
   * Issue #268: Check if a callee function's parameter at given index is modified.
   * Returns true if the callee modifies that parameter (should not have const).
   */
  isCalleeParameterModified(funcName: string, paramIndex: number): boolean {
    const unmodifiedParams = this.functionUnmodifiedParams.get(funcName);
    if (!unmodifiedParams) {
      // Callee not yet processed - conservatively return false (assume unmodified)
      // This means we won't mark our param as modified, which may cause a C compiler error
      // if the callee actually modifies the param. The C compiler will catch this.
      return false;
    }

    // Get the parameter name at the given index from the function signature
    const sig = this.functionSignatures.get(funcName);
    if (!sig || paramIndex >= sig.parameters.length) {
      return false;
    }

    const paramName = sig.parameters[paramIndex].name;
    // If the param is NOT in the unmodified set, it was modified
    return !unmodifiedParams.has(paramName);
  }

  /**
   * Issue #268: Check if a name is a parameter of the current function.
   */
  isCurrentParameter(name: string): boolean {
    return this.context.currentParameters.has(name);
  }

  // === Postfix Expression Helpers (Issue #644) ===

  /**
   * Generate a primary expression.
   * Part of IOrchestrator interface for PostfixExpressionGenerator.
   */
  generatePrimaryExpr(ctx: Parser.PrimaryExpressionContext): string {
    return this._generatePrimaryExpr(ctx);
  }

  /**
   * Check if a name is a known scope.
   * Part of IOrchestrator interface.
   */
  isKnownScope(name: string): boolean {
    return this._isKnownScope(name);
  }

  /**
   * Check if a symbol is a C++ scope symbol (namespace, class, enum).
   * Part of IOrchestrator interface.
   */
  isCppScopeSymbol(name: string): boolean {
    return this._isCppScopeSymbol(name);
  }

  /**
   * Get the separator for scope access (:: for C++, _ for C-Next).
   * Part of IOrchestrator interface.
   */
  getScopeSeparator(isCppAccess: boolean): string {
    return this._getScopeSeparator(isCppAccess);
  }

  /**
   * Get struct field info for .length calculations.
   * Part of IOrchestrator interface.
   */
  getStructFieldInfo(
    structType: string,
    fieldName: string,
  ): { type: string; dimensions?: (number | string)[] } | null {
    return this._getStructFieldInfo(structType, fieldName) ?? null;
  }

  /**
   * Get member type info for struct access chains.
   * Part of IOrchestrator interface.
   */
  getMemberTypeInfo(
    structType: string,
    memberName: string,
  ): { baseType: string; isArray: boolean } | null {
    return this._getMemberTypeInfo(structType, memberName) ?? null;
  }

  /**
   * Generate a bit mask for bit range access.
   * Part of IOrchestrator interface.
   * Issue #644: Delegate to BitUtils for code reuse.
   */
  generateBitMask(width: string, is64Bit: boolean = false): string {
    // BitUtils.generateMask expects a type string, not a boolean
    return BitUtils.generateMask(width, is64Bit ? "u64" : undefined);
  }

  /**
   * Add a pending temp variable declaration (for float bit indexing).
   * Part of IOrchestrator interface.
   */
  addPendingTempDeclaration(declaration: string): void {
    this.pendingTempDeclarations.push(declaration);
  }

  /**
   * Register a float bit shadow variable.
   * Part of IOrchestrator interface.
   */
  registerFloatBitShadow(shadowName: string): void {
    this.context.floatBitShadows.add(shadowName);
  }

  /**
   * Mark a float shadow as having current value (skip redundant memcpy).
   * Part of IOrchestrator interface.
   */
  markFloatShadowCurrent(shadowName: string): void {
    this.context.floatShadowCurrent.add(shadowName);
  }

  /**
   * Check if a float shadow has been declared.
   * Part of IOrchestrator interface.
   */
  hasFloatBitShadow(shadowName: string): boolean {
    return this.context.floatBitShadows.has(shadowName);
  }

  /**
   * Check if a float shadow has current value.
   * Part of IOrchestrator interface.
   */
  isFloatShadowCurrent(shadowName: string): boolean {
    return this.context.floatShadowCurrent.has(shadowName);
  }

  // ===========================================================================
  // End IOrchestrator Implementation
  // ===========================================================================

  /**
   * Get struct field type and dimensions, checking SymbolTable first (for C headers),
   * then falling back to local structFields (for C-Next structs).
   *
   * @param structName Name of the struct
   * @param fieldName Name of the field
   * @returns Object with type and optional dimensions, or undefined if not found
   */
  private _getStructFieldInfo(
    structName: string,
    fieldName: string,
  ): { type: string; dimensions?: (number | string)[] } | undefined {
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
          // Copy readonly array to mutable for return type compatibility
          dimensions: dimensions ? [...dimensions] : undefined,
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
  private _isKnownStruct(typeName: string): boolean {
    // Check C-Next structs first (local definitions)
    if (this.symbols!.knownStructs.has(typeName)) {
      return true;
    }
    // Issue #551: Bitmaps are struct-like (use pass-by-reference with -> access)
    if (this.symbols!.knownBitmaps.has(typeName)) {
      return true;
    }
    // Check SymbolTable for C header structs
    if (this.symbolTable?.getStructFields(typeName)) {
      return true;
    }
    return false;
  }

  /**
   * Issue #551: Check if a type is a known primitive type.
   * Known primitives use pass-by-reference with dereference.
   * Unknown types (external enums, typedefs) use pass-by-value.
   */
  private _isKnownPrimitive(typeName: string): boolean {
    return !!TYPE_MAP[typeName];
  }

  /**
   * Issue #517: Check if a type is a C++ class with a user-defined constructor.
   * C++ classes with user-defined constructors are NOT aggregate types,
   * so designated initializers { .field = value } don't work with them.
   * We check for the existence of a constructor symbol (TypeName::ClassName).
   */
  private _isCppClassWithConstructor(typeName: string): boolean {
    // Convert underscore format to :: for namespaced types
    // e.g., TestNS_MyClass -> TestNS::MyClass
    let qualifiedName = typeName;
    if (typeName.includes("_") && !typeName.includes("::")) {
      qualifiedName = typeName.replaceAll("_", "::");
    }

    // Extract just the class name (part after last ::)
    // e.g., TestNS::MyClass -> MyClass, CppTestClass -> CppTestClass
    const parts = qualifiedName.split("::");
    const className = parts.at(-1)!;

    // Constructor name follows the pattern: FullTypeName::ClassName
    // e.g., TestNS::MyClass::MyClass, CppTestClass::CppTestClass
    const constructorName = `${qualifiedName}::${className}`;
    const constructorSymbol = this.symbolTable?.getSymbol(constructorName);
    return constructorSymbol?.kind === ESymbolKind.Function;
  }

  private foldBooleanToInt(expr: string): string {
    if (expr === "true") return "1";
    if (expr === "false") return "0";
    return `(${expr} ? 1 : 0)`;
  }

  /**
   * Check if a function is a C-Next function (uses pass-by-reference semantics).
   * Checks both internal tracking and external symbol table.
   */
  private _isCNextFunction(name: string): boolean {
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
   * Issue #294: Check if an identifier is a known scope
   * Checks both the local SymbolCollector (current file) and the global SymbolTable
   * (all files including includes). This ensures cross-file scope references are
   * properly validated.
   */
  private _isKnownScope(name: string): boolean {
    // Check local file's symbol collector first
    if (this.symbols?.knownScopes.has(name)) {
      return true;
    }

    // Check global symbol table for scopes from included files
    if (this.symbolTable) {
      const symbols = this.symbolTable.getOverloads(name);
      if (symbols.some((sym) => sym.kind === ESymbolKind.Namespace)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Issue #304: Check if a name is a C++ scope-like symbol that requires :: syntax
   * This includes C++ namespaces, classes, and enum classes (scoped enums).
   * Returns true if the symbol comes from C++ and needs :: for member access.
   *
   * Issue #522: Delegates to shared CppNamespaceUtils for consistency.
   */
  private _isCppScopeSymbol(name: string): boolean {
    return CppNamespaceUtils.isCppNamespace(
      name,
      this.symbolTable ?? undefined,
    );
  }

  /**
   * Issue #304: Get the appropriate scope separator for C++ vs C/C-Next.
   * C++ uses :: for scope resolution, C/C-Next uses _ (underscore).
   */
  private _getScopeSeparator(isCppContext: boolean): string {
    return isCppContext ? "::" : "_";
  }

  /**
   * Issue #388: Resolve a qualified type from dot notation to the correct output format.
   * For C++ namespace types (like MockLib.Parse.ParseResult), uses :: separator.
   * For C-Next scope types (like Motor.State), uses _ separator.
   *
   * @param identifiers Array of identifier names forming the qualified type
   * @returns The resolved type name with appropriate separator
   */
  private resolveQualifiedType(identifiers: string[]): string {
    if (identifiers.length === 0) {
      return "";
    }

    const firstName = identifiers[0];

    // Check if the first identifier is a C++ scope symbol (namespace, class, enum)
    if (this.isCppScopeSymbol(firstName)) {
      // C++ namespace type: join all parts with ::
      return identifiers.join("::");
    }

    // C-Next scope type: join all parts with _
    return identifiers.join("_");
  }

  /**
   * Issue #387: Extract pattern information from unified postfix chain.
   * This helper enables generateAssignment to detect special patterns
   * (bitmap fields, register bits, strings) for appropriate code generation.
   */
  private extractAssignmentTargetInfo(ctx: Parser.AssignmentTargetContext): {
    hasGlobal: boolean;
    hasThis: boolean;
    firstIdentifier: string;
    /** All identifiers in the chain (firstIdentifier + member accesses) */
    identifiers: string[];
    /** All expressions from subscript operations */
    expressions: Parser.ExpressionContext[];
    /** Whether this has any postfix operations */
    hasPostfixOps: boolean;
    /** Whether this looks like array access (has subscripts) */
    isArrayAccess: boolean;
    /** Whether this looks like member access (has .member) */
    isMemberAccess: boolean;
    /** The postfix ops for detailed analysis */
    postfixOps: Parser.PostfixTargetOpContext[];
  } {
    const hasGlobal = ctx.GLOBAL() !== null;
    const hasThis = ctx.THIS() !== null;
    const firstIdentifier = ctx.IDENTIFIER()?.getText() ?? "";
    const postfixOps = ctx.postfixTargetOp();

    const identifiers: string[] = [firstIdentifier];
    const expressions: Parser.ExpressionContext[] = [];

    let hasArrayOp = false;
    let hasMemberOp = false;

    for (const op of postfixOps) {
      if (op.IDENTIFIER()) {
        identifiers.push(op.IDENTIFIER()!.getText());
        hasMemberOp = true;
      } else {
        // Array subscript or bit range
        const exprs = op.expression();
        for (const expr of exprs) {
          expressions.push(expr);
        }
        hasArrayOp = true;
      }
    }

    return {
      hasGlobal,
      hasThis,
      firstIdentifier,
      identifiers,
      expressions,
      hasPostfixOps: postfixOps.length > 0,
      isArrayAccess: hasArrayOp,
      isMemberAccess: hasMemberOp,
      postfixOps,
    };
  }

  /**
   * Issue #304: Check if a type name is from a C++ header
   * Used to determine whether to use {} or {0} for initialization.
   * C++ types with constructors may fail with {0} but work with {}.
   */
  private isCppType(typeName: string): boolean {
    if (!this.symbolTable) {
      return false;
    }

    const symbols = this.symbolTable.getOverloads(typeName);
    for (const sym of symbols) {
      if (sym.sourceLanguage === ESourceLanguage.Cpp) {
        // Any C++ struct, class, or user-defined type
        if (
          sym.kind === ESymbolKind.Struct ||
          sym.kind === ESymbolKind.Class ||
          sym.kind === ESymbolKind.Type
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

    // Issue #349: Store include directories and inputs for angle-bracket include resolution
    this.includeDirs = options?.includeDirs ?? [];
    this.inputs = options?.inputs ?? [];

    // Issue #250: Store C++ mode for temp variable generation
    this.cppMode = options?.cppMode ?? false;
    // Issue #644: Initialize C/C++ mode helper
    this.cppHelper = new CppModeHelper({ cppMode: this.cppMode });
    // Reset temp var state for each generation
    this.pendingTempDeclarations = [];
    this.tempVarCounter = 0;
    // Issue #517: Reset C++ class assignments
    this.pendingCppClassAssignments = [];

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

    // ADR-053: Initialize generators (once per CodeGenerator instance)
    if (!this.generatorsInitialized) {
      this.initializeGenerators();
      this.generatorsInitialized = true;
    }

    // Reset state
    this.context = {
      currentScope: null, // ADR-016
      currentFunctionName: null, // Issue #269: track current function for pass-by-value lookup
      currentFunctionReturnType: null, // Issue #477: track return type for enum inference
      indentLevel: 0,
      scopeMembers: new Map(), // ADR-016
      currentParameters: new Map(),
      // Issue #558: modifiedParameters removed - uses analysis-phase results
      localArrays: new Set(),
      localVariables: new Set(), // ADR-016
      floatBitShadows: new Set(), // Track declared shadow variables for float bit indexing
      floatShadowCurrent: new Set(), // Track which shadows have current value
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
      lastArrayFillValue: undefined, // ADR-035: Track fill-all value
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
    this.needsFloatStaticAssert = false; // Reset float bit indexing assertion
    this.needsISR = false; // ADR-040: Reset ISR typedef tracking
    this.needsCMSIS = false; // ADR-049/050: Reset CMSIS include tracking
    this.needsLimits = false; // Issue #632: Reset float-to-int clamp tracking
    this.needsIrqWrappers = false; // Issue #473: Reset IRQ wrappers tracking
    this.selfIncludeAdded = false; // Issue #369: Reset self-include tracking

    // ADR-055: Use pre-collected symbolInfo from Pipeline (TSymbolInfoAdapter)
    if (!options?.symbolInfo) {
      throw new Error(
        "symbolInfo is required - use CNextResolver + TSymbolInfoAdapter",
      );
    }
    this.symbols = options.symbolInfo;

    // Copy symbol data to context.scopeMembers (used by code generation)
    for (const [scopeName, members] of this.symbols.scopeMembers) {
      // Convert ReadonlySet to mutable Set for context
      this.context.scopeMembers.set(scopeName, new Set(members));
    }

    // Issue #461: Initialize constValues from symbol table for external const resolution
    // This allows array dimensions to reference constants from included .cnx files
    this.constValues = new Map();
    if (this.symbolTable) {
      for (const symbol of this.symbolTable.getAllSymbols()) {
        if (
          symbol.kind === ESymbolKind.Variable &&
          symbol.isConst &&
          symbol.initialValue !== undefined
        ) {
          const value = LiteralUtils.parseIntegerLiteral(symbol.initialValue);
          if (value !== undefined) {
            this.constValues.set(symbol.name, value);
          }
        }
      }
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

    // Issue #269: Analyze which parameters can be passed by value
    this.analyzePassByValue(tree);

    // Issue #63: Initialize type validator with clean dependencies
    this.typeValidator = new TypeValidator({
      symbols: this.symbols,
      symbolTable: this.symbolTable,
      typeRegistry: this.context.typeRegistry,
      typeResolver: this.typeResolver,
      callbackTypes: this.callbackTypes,
      knownFunctions: this.knownFunctions,
      knownGlobals: new Set(), // Note: Extract known globals if needed in future
      getCurrentScope: () => this.context.currentScope,
      getScopeMembers: () => this.context.scopeMembers,
      getCurrentParameters: () => this.context.currentParameters,
      getLocalVariables: () => this.context.localVariables,
      resolveIdentifier: (name: string) => this.resolveIdentifier(name),
      getExpressionType: (ctx: unknown) =>
        this.getExpressionType(ctx as Parser.ExpressionContext),
    });

    // Issue #644: Initialize string length counter for strlen caching
    this.stringLengthCounter = new StringLengthCounter((name: string) =>
      this.context.typeRegistry.get(name),
    );

    // Second pass: register all variable types in the type registry
    // This ensures .length and other type-dependent operations can resolve
    // variables regardless of declaration order
    this.registerAllVariableTypes(tree);

    const output: string[] = [];

    // Add header comment
    output.push(
      "/**",
      " * Generated by C-Next Transpiler",
      " * A safer C for embedded systems",
      " */",
      "",
    );

    // Issue #230: Self-include for extern "C" linkage
    // When file has public symbols and headers are being generated,
    // include own header to ensure proper C linkage
    // Issue #339: Use relative path from source root when available
    // Issue #369: Track self-include to skip type definitions in .c file
    // Issue #461: Always generate self-include when there are public symbols
    if (this.symbols!.hasPublicSymbols() && this.sourcePath) {
      // Issue #339: Prefer sourceRelativePath for correct directory structure
      // Otherwise fall back to basename for backward compatibility
      const pathToUse =
        options.sourceRelativePath || this.sourcePath.replace(/^.*[\\/]/, "");
      const headerName = pathToUse.replace(/\.cnx$|\.cnext$/, ".h");
      output.push(`#include "${headerName}"`, "");
      // Issue #369: Mark that self-include was added - types will be in header
      this.selfIncludeAdded = true;
    }

    // Pass through #include directives from source
    // C-Next does NOT hardcode any libraries - all includes must be explicit
    // ADR-043: Comments before first include become file-level comments
    // ADR-010: Transform .cnx includes to .h, reject implementation files
    // E0504: Cache include paths for performance (computed once, used for all includes)
    const includePaths = this.sourcePath
      ? IncludeDiscovery.discoverIncludePaths(this.sourcePath)
      : [];
    for (const includeDir of tree.includeDirective()) {
      const leadingComments = this.getLeadingComments(includeDir);
      output.push(...this.formatLeadingComments(leadingComments));

      // ADR-010: Validate no implementation files are included
      const lineNumber = includeDir.start?.line ?? 0;
      this.typeValidator!.validateIncludeNotImplementationFile(
        includeDir.getText(),
        lineNumber,
      );

      // E0504: Check if a .cnx alternative exists for .h/.hpp includes
      this.typeValidator!.validateIncludeNoCnxAlternative(
        includeDir.getText(),
        lineNumber,
        this.sourcePath,
        includePaths,
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
    if (this.needsLimits) {
      // Issue #632: For float-to-int clamp casts (UINT8_MAX, INT8_MIN, etc.)
      autoIncludes.push("#include <limits.h>");
    }
    if (autoIncludes.length > 0) {
      output.push(...autoIncludes, "");
    }

    // Float bit indexing requires size verification at compile time
    if (this.needsFloatStaticAssert) {
      output.push(
        '_Static_assert(sizeof(float) == 4, "Float bit indexing requires 32-bit float");',
        '_Static_assert(sizeof(double) == 8, "Float bit indexing requires 64-bit double");',
        "",
      );
    }

    // Issue #473: IRQ wrapper functions to avoid macro collisions with platform headers
    // (e.g., Teensy's imxrt.h defines __disable_irq/__enable_irq as macros)
    if (this.needsIrqWrappers) {
      output.push(
        "// ADR-050: IRQ wrappers to avoid macro collisions with platform headers",
        "static inline void __cnx_disable_irq(void) { __disable_irq(); }",
        "static inline uint32_t __cnx_get_PRIMASK(void) { return __get_PRIMASK(); }",
        "static inline void __cnx_set_PRIMASK(uint32_t mask) { __set_PRIMASK(mask); }",
        "",
      );
    }

    // ADR-040: Add ISR typedef if needed
    if (this.needsISR) {
      output.push(
        "/* ADR-040: ISR function pointer type */",
        "typedef void (*ISR)(void);",
        "",
      );
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
        const match = /#\s*pragma\s+target\s+(\S+)/i.exec(text);
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
   * ADR-053 A5: Delegates to IncludeGenerator
   * Issue #349: Now passes includeDirs and inputs for angle-bracket resolution
   */
  private transformIncludeDirective(includeText: string): string {
    return includeTransformIncludeDirective(includeText, {
      sourcePath: this.sourcePath,
      includeDirs: this.includeDirs,
      inputs: this.inputs,
    });
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

        // Set scope context for scoped type resolution (this.Type)
        const savedScope = this.context.currentScope;
        this.context.currentScope = scopeName;

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

        // Restore previous scope context
        this.context.currentScope = savedScope;
      }

      // ADR-029: Track callback field types in structs
      if (decl.structDeclaration()) {
        const structDecl = decl.structDeclaration()!;
        const structName = structDecl.IDENTIFIER().getText();

        for (const member of structDecl.structMember()) {
          const fieldName = member.IDENTIFIER().getText();
          const fieldType = this._getTypeName(member.type());

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
          const constValue = this._tryEvaluateConstant(varDecl.expression()!);
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

  // ========================================================================
  // Issue #269: Pass-by-value analysis for small unmodified parameters
  // ========================================================================

  /**
   * Analyze all functions to determine which parameters should pass by value.
   * This runs before code generation and populates passByValueParams.
   */
  private analyzePassByValue(tree: Parser.ProgramContext): void {
    // Reset analysis state
    this.modifiedParameters.clear();
    this.passByValueParams.clear();
    this.functionCallGraph.clear();
    this.functionParamLists.clear();

    // Phase 1: Collect function parameter lists and direct modifications
    this.collectFunctionParametersAndModifications(tree);

    // Issue #558: Inject cross-file data before transitive propagation
    if (this.pendingCrossFileModifications) {
      for (const [funcName, params] of this.pendingCrossFileModifications) {
        const existing = this.modifiedParameters.get(funcName);
        if (existing) {
          for (const param of params) {
            existing.add(param);
          }
        } else {
          this.modifiedParameters.set(funcName, new Set(params));
        }
      }
      this.pendingCrossFileModifications = null; // Clear after use
    }
    if (this.pendingCrossFileParamLists) {
      for (const [funcName, params] of this.pendingCrossFileParamLists) {
        if (!this.functionParamLists.has(funcName)) {
          this.functionParamLists.set(funcName, [...params]);
        }
      }
      this.pendingCrossFileParamLists = null; // Clear after use
    }

    // Phase 2: Fixed-point iteration for transitive modifications
    this.propagateTransitiveModifications();

    // Phase 3: Determine which parameters can pass by value
    this.computePassByValueParams();
  }

  /**
   * Phase 1: Walk all functions to collect:
   * - Parameter lists (for call graph resolution)
   * - Direct modifications (param <- value)
   * - Function calls where params are passed as arguments
   */
  private collectFunctionParametersAndModifications(
    tree: Parser.ProgramContext,
  ): void {
    for (const decl of tree.declaration()) {
      // Handle scope-level functions
      if (decl.scopeDeclaration()) {
        const scopeDecl = decl.scopeDeclaration()!;
        const scopeName = scopeDecl.IDENTIFIER().getText();

        for (const member of scopeDecl.scopeMember()) {
          if (member.functionDeclaration()) {
            const funcDecl = member.functionDeclaration()!;
            const funcName = funcDecl.IDENTIFIER().getText();
            const fullName = `${scopeName}_${funcName}`;
            this.analyzeFunctionForModifications(fullName, funcDecl);
          }
        }
      }

      // Handle top-level functions
      if (decl.functionDeclaration()) {
        const funcDecl = decl.functionDeclaration()!;
        const name = funcDecl.IDENTIFIER().getText();
        this.analyzeFunctionForModifications(name, funcDecl);
      }
    }
  }

  /**
   * Analyze a single function for parameter modifications and call graph edges.
   */
  private analyzeFunctionForModifications(
    funcName: string,
    funcDecl: Parser.FunctionDeclarationContext,
  ): void {
    // Collect parameter names
    const paramNames: string[] = [];
    const paramList = funcDecl.parameterList();
    if (paramList) {
      for (const param of paramList.parameter()) {
        paramNames.push(param.IDENTIFIER().getText());
      }
    }
    this.functionParamLists.set(funcName, paramNames);

    // Initialize modified set
    this.modifiedParameters.set(funcName, new Set());
    // Issue #579: Initialize subscript access tracking
    this.subscriptAccessedParameters.set(funcName, new Set());
    this.functionCallGraph.set(funcName, []);

    // Walk the function body to find modifications and calls
    const block = funcDecl.block();
    if (block) {
      this.walkBlockForModifications(funcName, paramNames, block);
    }
  }

  /**
   * Walk a block to find parameter modifications and function calls.
   */
  private walkBlockForModifications(
    funcName: string,
    paramNames: string[],
    block: Parser.BlockContext,
  ): void {
    const paramSet = new Set(paramNames);

    for (const stmt of block.statement()) {
      this.walkStatementForModifications(funcName, paramSet, stmt);
    }
  }

  /**
   * Issue #566: Collect all expressions from a statement that need to be walked for function calls.
   * This centralizes expression extraction to prevent missing cases (like issue #565).
   */
  private collectExpressionsFromStatement(
    stmt: Parser.StatementContext,
  ): Parser.ExpressionContext[] {
    const expressions: Parser.ExpressionContext[] = [];

    // Simple statements with expressions
    if (stmt.expressionStatement()) {
      expressions.push(stmt.expressionStatement()!.expression());
    }
    if (stmt.assignmentStatement()) {
      expressions.push(stmt.assignmentStatement()!.expression());
    }
    if (stmt.variableDeclaration()?.expression()) {
      expressions.push(stmt.variableDeclaration()!.expression()!);
    }
    if (stmt.returnStatement()?.expression()) {
      expressions.push(stmt.returnStatement()!.expression()!);
    }

    // Control flow conditions
    if (stmt.ifStatement()) {
      expressions.push(stmt.ifStatement()!.expression());
    }
    if (stmt.whileStatement()) {
      expressions.push(stmt.whileStatement()!.expression());
    }
    if (stmt.doWhileStatement()) {
      expressions.push(stmt.doWhileStatement()!.expression());
    }
    if (stmt.switchStatement()) {
      expressions.push(stmt.switchStatement()!.expression());
    }

    // For statement has multiple expression contexts
    if (stmt.forStatement()) {
      const forStmt = stmt.forStatement()!;
      // Condition (optional)
      if (forStmt.expression()) {
        expressions.push(forStmt.expression()!);
      }
      // forInit expressions
      const forInit = forStmt.forInit();
      if (forInit?.forAssignment()) {
        expressions.push(forInit.forAssignment()!.expression());
      } else if (forInit?.forVarDecl()?.expression()) {
        expressions.push(forInit.forVarDecl()!.expression()!);
      }
      // forUpdate expression
      if (forStmt.forUpdate()) {
        expressions.push(forStmt.forUpdate()!.expression());
      }
    }

    return expressions;
  }

  /**
   * Issue #566: Collect child statements and blocks from control flow statements.
   * This centralizes recursion patterns to prevent missing nested statements.
   */
  private getChildStatementsAndBlocks(stmt: Parser.StatementContext): {
    statements: Parser.StatementContext[];
    blocks: Parser.BlockContext[];
  } {
    const statements: Parser.StatementContext[] = [];
    const blocks: Parser.BlockContext[] = [];

    // if statement: has statement() children (can be blocks or single statements)
    if (stmt.ifStatement()) {
      for (const childStmt of stmt.ifStatement()!.statement()) {
        if (childStmt.block()) {
          blocks.push(childStmt.block()!);
        } else {
          statements.push(childStmt);
        }
      }
    }

    // while statement: single statement() child
    if (stmt.whileStatement()) {
      const bodyStmt = stmt.whileStatement()!.statement();
      if (bodyStmt.block()) {
        blocks.push(bodyStmt.block()!);
      } else {
        statements.push(bodyStmt);
      }
    }

    // for statement: single statement() child
    if (stmt.forStatement()) {
      const bodyStmt = stmt.forStatement()!.statement();
      if (bodyStmt.block()) {
        blocks.push(bodyStmt.block()!);
      } else {
        statements.push(bodyStmt);
      }
    }

    // do-while statement: has block() directly
    if (stmt.doWhileStatement()) {
      blocks.push(stmt.doWhileStatement()!.block());
    }

    // switch statement: case blocks and optional default block
    if (stmt.switchStatement()) {
      const switchStmt = stmt.switchStatement()!;
      for (const caseCtx of switchStmt.switchCase()) {
        blocks.push(caseCtx.block());
      }
      if (switchStmt.defaultCase()) {
        blocks.push(switchStmt.defaultCase()!.block());
      }
    }

    // critical statement: has block() directly (ADR-050)
    if (stmt.criticalStatement()) {
      blocks.push(stmt.criticalStatement()!.block());
    }

    // Nested block statement
    if (stmt.block()) {
      blocks.push(stmt.block()!);
    }

    return { statements, blocks };
  }

  /**
   * Walk a statement recursively looking for modifications and calls.
   * Issue #566: Refactored to use helper methods for expression and child collection.
   */
  private walkStatementForModifications(
    funcName: string,
    paramSet: Set<string>,
    stmt: Parser.StatementContext,
  ): void {
    // 1. Check for parameter modifications via assignment targets
    if (stmt.assignmentStatement()) {
      const assign = stmt.assignmentStatement()!;
      const target = assign.assignmentTarget();

      // Issue #558: Extract base identifier from assignment target
      // - Simple identifier: x <- value
      // - Member access: x.field <- value (first IDENTIFIER is the base)
      // - Array access: x[i] <- value
      let baseIdentifier: string | null = null;

      if (target?.IDENTIFIER()) {
        baseIdentifier = target.IDENTIFIER()!.getText();
      } else if (target?.memberAccess()) {
        const identifiers = target.memberAccess()!.IDENTIFIER();
        if (identifiers.length > 0) {
          baseIdentifier = identifiers[0].getText();
        }
      } else if (target?.arrayAccess()) {
        const arrayAccessCtx = target.arrayAccess()!;
        baseIdentifier = arrayAccessCtx.IDENTIFIER()?.getText() ?? null;
        // Issue #579: Track subscript access on parameters (for write path)
        // Only track single-index subscript (potential array access)
        // Two-index subscript like value[0, 8] is bit extraction, not array access
        const isSingleIndexSubscript = arrayAccessCtx.expression().length === 1;
        if (
          isSingleIndexSubscript &&
          baseIdentifier &&
          paramSet.has(baseIdentifier)
        ) {
          this.subscriptAccessedParameters.get(funcName)!.add(baseIdentifier);
        }
      }

      if (baseIdentifier && paramSet.has(baseIdentifier)) {
        this.modifiedParameters.get(funcName)!.add(baseIdentifier);
      }
    }

    // 2. Walk all expressions in this statement for function calls and subscript access
    for (const expr of this.collectExpressionsFromStatement(stmt)) {
      this.walkExpressionForCalls(funcName, paramSet, expr);
      // Issue #579: Also track subscript read access on parameters
      this.walkExpressionForSubscriptAccess(funcName, paramSet, expr);
    }

    // 3. Recurse into child statements and blocks
    const { statements, blocks } = this.getChildStatementsAndBlocks(stmt);
    for (const childStmt of statements) {
      this.walkStatementForModifications(funcName, paramSet, childStmt);
    }
    for (const block of blocks) {
      this.walkBlockForModifications(funcName, [...paramSet], block);
    }
  }

  /**
   * Walk an expression tree to find function calls where parameters are passed.
   * Uses recursive descent through the expression hierarchy.
   */
  private walkExpressionForCalls(
    funcName: string,
    paramSet: Set<string>,
    expr: Parser.ExpressionContext,
  ): void {
    // Expression -> TernaryExpression -> OrExpression -> ... -> PostfixExpression
    const ternary = expr.ternaryExpression();
    if (ternary) {
      // Walk all orExpression children
      for (const orExpr of ternary.orExpression()) {
        this.walkOrExpressionForCalls(funcName, paramSet, orExpr);
      }
    }
  }

  /**
   * Issue #579: Walk an expression tree to find subscript access on parameters.
   * This tracks read access like `buf[i]` where buf is a parameter.
   * Parameters with subscript access must become pointers.
   */
  private walkExpressionForSubscriptAccess(
    funcName: string,
    paramSet: Set<string>,
    expr: Parser.ExpressionContext,
  ): void {
    const ternary = expr.ternaryExpression();
    if (ternary) {
      for (const orExpr of ternary.orExpression()) {
        this.walkOrExpression(orExpr, (unaryExpr) => {
          this.handleSubscriptAccess(funcName, paramSet, unaryExpr);
        });
      }
    }
  }

  /**
   * Issue #579: Handle subscript access on a unary expression.
   * Only tracks single-index subscript access (which could be array access).
   * Two-index subscript (e.g., value[start, width]) is always bit extraction,
   * so it doesn't require the parameter to become a pointer.
   */
  private handleSubscriptAccess(
    funcName: string,
    paramSet: Set<string>,
    unaryExpr: Parser.UnaryExpressionContext,
  ): void {
    const postfixExpr = unaryExpr.postfixExpression();
    if (!postfixExpr) return;

    const primary = postfixExpr.primaryExpression();
    const ops = postfixExpr.postfixOp();

    // Check if primary is a parameter and there's subscript access
    const primaryId = primary.IDENTIFIER()?.getText();
    if (!primaryId || !paramSet.has(primaryId)) {
      return;
    }

    // Only track SINGLE-index subscript access (potential array access)
    // Two-index subscript like value[0, 8] is bit extraction, not array access
    const hasSingleIndexSubscript = ops.some(
      (op) => op.expression().length === 1,
    );
    if (hasSingleIndexSubscript) {
      this.subscriptAccessedParameters.get(funcName)!.add(primaryId);
    }
  }

  /**
   * Generic walker for orExpression trees.
   * Walks through the expression hierarchy and calls the handler for each unaryExpression.
   * Used by both function call tracking and subscript access tracking.
   */
  private walkOrExpression(
    orExpr: Parser.OrExpressionContext,
    handler: (unaryExpr: Parser.UnaryExpressionContext) => void,
  ): void {
    for (const andExpr of orExpr.andExpression()) {
      for (const eqExpr of andExpr.equalityExpression()) {
        for (const relExpr of eqExpr.relationalExpression()) {
          for (const bitOrExpr of relExpr.bitwiseOrExpression()) {
            for (const bitXorExpr of bitOrExpr.bitwiseXorExpression()) {
              for (const bitAndExpr of bitXorExpr.bitwiseAndExpression()) {
                for (const shiftExpr of bitAndExpr.shiftExpression()) {
                  for (const addExpr of shiftExpr.additiveExpression()) {
                    for (const mulExpr of addExpr.multiplicativeExpression()) {
                      for (const unaryExpr of mulExpr.unaryExpression()) {
                        handler(unaryExpr);
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

  /**
   * Walk an orExpression tree for function calls.
   */
  private walkOrExpressionForCalls(
    funcName: string,
    paramSet: Set<string>,
    orExpr: Parser.OrExpressionContext,
  ): void {
    this.walkOrExpression(orExpr, (unaryExpr) => {
      this.walkUnaryExpressionForCalls(funcName, paramSet, unaryExpr);
    });
  }

  /**
   * Walk a unaryExpression tree for function calls.
   */
  private walkUnaryExpressionForCalls(
    funcName: string,
    paramSet: Set<string>,
    unaryExpr: Parser.UnaryExpressionContext,
  ): void {
    // Recurse into nested unary
    if (unaryExpr.unaryExpression()) {
      this.walkUnaryExpressionForCalls(
        funcName,
        paramSet,
        unaryExpr.unaryExpression()!,
      );
      return;
    }

    // Check postfix expression
    const postfix = unaryExpr.postfixExpression();
    if (postfix) {
      this.walkPostfixExpressionForCalls(funcName, paramSet, postfix);
    }
  }

  /**
   * Walk a postfixExpression for function calls.
   * This is where function calls are found: primaryExpr followed by '(' args ')'
   */
  private walkPostfixExpressionForCalls(
    funcName: string,
    paramSet: Set<string>,
    postfix: Parser.PostfixExpressionContext,
  ): void {
    const primary = postfix.primaryExpression();
    const postfixOps = postfix.postfixOp();

    // Check if this is a function call: IDENTIFIER followed by '(' ... ')'
    if (primary.IDENTIFIER() && postfixOps.length > 0) {
      const firstOp = postfixOps[0];
      // Check if first postfix op is a function call (has argumentList or RPAREN)
      if (firstOp.LPAREN()) {
        const calleeName = primary.IDENTIFIER()!.getText();
        const argList = firstOp.argumentList();

        if (argList) {
          const args = argList.expression();
          for (let i = 0; i < args.length; i++) {
            const arg = args[i];
            // Check if argument is a simple identifier that's a parameter
            const argName = this.getSimpleIdentifierFromExpr(arg);
            if (argName && paramSet.has(argName)) {
              this.functionCallGraph.get(funcName)!.push({
                callee: calleeName,
                paramIndex: i,
                argParamName: argName,
              });
            }
            // Recurse into argument
            this.walkExpressionForCalls(funcName, paramSet, arg);
          }
        }
      }
    }

    // Issue #365: Handle scope-qualified calls: Scope.method(...) or global.Scope.method(...)
    // Track member accesses to build the mangled callee name (e.g., Storage_load)
    // Then when we find the function call, record it to the call graph
    if (postfixOps.length > 0) {
      const memberNames: string[] = [];

      // Start with primary identifier if it's a scope name (not 'global' or 'this')
      // Issue #561: When 'this' is used, resolve to the current scope name from funcName
      const primaryId = primary.IDENTIFIER()?.getText();
      if (primaryId && primaryId !== "global") {
        memberNames.push(primaryId);
      } else if (primary.THIS()) {
        // Issue #561: 'this' keyword - resolve to current scope name from funcName
        // funcName format: "ScopeName_methodName" -> extract "ScopeName"
        const scopeName = funcName.split("_")[0];
        if (scopeName && scopeName !== funcName) {
          memberNames.push(scopeName);
        }
      }

      // Collect member access names until we hit a function call
      for (const op of postfixOps) {
        if (op.IDENTIFIER()) {
          // Member access: .IDENTIFIER
          memberNames.push(op.IDENTIFIER()!.getText());
        } else if (op.LPAREN()) {
          // Function call found - record to call graph if we have a callee name
          if (memberNames.length >= 1) {
            // Build mangled name: e.g., ["Storage", "load"] -> "Storage_load"
            // For scope methods, the last name is the method, everything before is scope
            const calleeName = memberNames.join("_");
            const argList = op.argumentList();

            if (argList) {
              const args = argList.expression();
              for (let j = 0; j < args.length; j++) {
                const arg = args[j];
                const argName = this.getSimpleIdentifierFromExpr(arg);
                if (argName && paramSet.has(argName)) {
                  this.functionCallGraph.get(funcName)!.push({
                    callee: calleeName,
                    paramIndex: j,
                    argParamName: argName,
                  });
                }
              }
            }
          }
          // Reset for potential chained calls like obj.foo().bar()
          memberNames.length = 0;
        } else if (op.expression().length > 0) {
          // Array subscript - doesn't contribute to method name
          // but reset member chain as array access breaks scope chain
          memberNames.length = 0;
        }
      }
    }

    // Recurse into primary expression if it's a parenthesized expression
    if (primary.expression()) {
      this.walkExpressionForCalls(funcName, paramSet, primary.expression()!);
    }

    // Walk arguments in any postfix function call ops (for nested calls)
    for (const op of postfixOps) {
      if (op.argumentList()) {
        for (const argExpr of op.argumentList()!.expression()) {
          this.walkExpressionForCalls(funcName, paramSet, argExpr);
        }
      }
      // Walk array subscript expressions
      for (const expr of op.expression()) {
        this.walkExpressionForCalls(funcName, paramSet, expr);
      }
    }
  }

  /**
   * Get simple identifier from an expression if it's just a bare identifier.
   */
  private getSimpleIdentifierFromExpr(
    expr: Parser.ExpressionContext,
  ): string | null {
    // Expression -> TernaryExpression -> OrExpression -> ... -> PostfixExpression -> PrimaryExpression -> IDENTIFIER
    const ternary = expr.ternaryExpression();
    if (!ternary) return null;

    const orExprs = ternary.orExpression();
    if (orExprs.length !== 1) return null;

    const andExprs = orExprs[0].andExpression();
    if (andExprs.length !== 1) return null;

    const eqExprs = andExprs[0].equalityExpression();
    if (eqExprs.length !== 1) return null;

    const relExprs = eqExprs[0].relationalExpression();
    if (relExprs.length !== 1) return null;

    const bitOrExprs = relExprs[0].bitwiseOrExpression();
    if (bitOrExprs.length !== 1) return null;

    const bitXorExprs = bitOrExprs[0].bitwiseXorExpression();
    if (bitXorExprs.length !== 1) return null;

    const bitAndExprs = bitXorExprs[0].bitwiseAndExpression();
    if (bitAndExprs.length !== 1) return null;

    const shiftExprs = bitAndExprs[0].shiftExpression();
    if (shiftExprs.length !== 1) return null;

    const addExprs = shiftExprs[0].additiveExpression();
    if (addExprs.length !== 1) return null;

    const mulExprs = addExprs[0].multiplicativeExpression();
    if (mulExprs.length !== 1) return null;

    const unaryExprs = mulExprs[0].unaryExpression();
    if (unaryExprs.length !== 1) return null;

    const unary = unaryExprs[0];
    if (unary.unaryExpression()) return null; // Has unary operator

    const postfix = unary.postfixExpression();
    if (!postfix) return null;

    // Must have no postfix operators (just the primary)
    if (postfix.postfixOp().length > 0) return null;

    const primary = postfix.primaryExpression();
    if (!primary.IDENTIFIER()) return null;

    return primary.IDENTIFIER()!.getText();
  }

  /**
   * Phase 2: Fixed-point iteration to propagate transitive modifications.
   * If a parameter is passed to a function that modifies its corresponding param,
   * then the caller's parameter is also considered modified.
   */
  private propagateTransitiveModifications(): void {
    let changed = true;
    while (changed) {
      changed = false;

      for (const [funcName, calls] of this.functionCallGraph) {
        for (const { callee, paramIndex, argParamName } of calls) {
          // Get the callee's parameter list
          const calleeParams = this.functionParamLists.get(callee);
          if (!calleeParams || paramIndex >= calleeParams.length) {
            continue;
          }

          const calleeParamName = calleeParams[paramIndex];
          const calleeModified = this.modifiedParameters.get(callee);

          // If callee's parameter is modified, mark caller's parameter as modified
          if (calleeModified?.has(calleeParamName)) {
            const callerModified = this.modifiedParameters.get(funcName);
            if (callerModified && !callerModified.has(argParamName)) {
              callerModified.add(argParamName);
              changed = true;
            }
          }
        }
      }
    }
  }

  /**
   * Phase 3: Determine which parameters can pass by value.
   * A parameter passes by value if:
   * 1. It's a small primitive type (u8, i8, u16, i16, u32, i32, u64, i64, bool)
   * 2. It's not modified (directly or transitively)
   * 3. It's not an array, struct, string, or callback
   */
  private computePassByValueParams(): void {
    const smallPrimitives = new Set([
      "u8",
      "i8",
      "u16",
      "i16",
      "u32",
      "i32",
      "u64",
      "i64",
      "bool",
    ]);

    for (const [funcName, paramNames] of this.functionParamLists) {
      const passByValue = new Set<string>();
      const modified = this.modifiedParameters.get(funcName) ?? new Set();

      // Get function declaration to check parameter types
      const funcSig = this.functionSignatures.get(funcName);
      if (funcSig) {
        for (let i = 0; i < paramNames.length; i++) {
          const paramName = paramNames[i];
          const paramSig = funcSig.parameters[i];

          if (!paramSig) continue;

          // Check if eligible for pass-by-value:
          // - Is a small primitive type
          // - Not an array
          // - Not modified
          // - Not accessed via subscript (Issue #579)
          const isSmallPrimitive = smallPrimitives.has(paramSig.baseType);
          const isArray = paramSig.isArray ?? false;
          const isModified = modified.has(paramName);
          // Issue #579: Parameters with subscript access must become pointers
          const hasSubscriptAccess =
            this.subscriptAccessedParameters.get(funcName)?.has(paramName) ??
            false;

          if (
            isSmallPrimitive &&
            !isArray &&
            !isModified &&
            !hasSubscriptAccess
          ) {
            passByValue.add(paramName);
          }
        }
      }

      this.passByValueParams.set(funcName, passByValue);
    }
  }

  /**
   * Check if a parameter should be passed by value (by name).
   * Used internally during code generation.
   */
  private _isParameterPassByValueByName(
    funcName: string,
    paramName: string,
  ): boolean {
    const passByValue = this.passByValueParams.get(funcName);
    return passByValue?.has(paramName) ?? false;
  }

  /**
   * Issue #269: Check if a parameter should be passed by value (by index).
   * Part of IOrchestrator interface - used by CallExprGenerator.
   */
  isParameterPassByValue(funcName: string, paramIndex: number): boolean {
    const paramList = this.functionParamLists.get(funcName);
    if (!paramList || paramIndex < 0 || paramIndex >= paramList.length) {
      return false;
    }
    const paramName = paramList[paramIndex];
    return this._isParameterPassByValueByName(funcName, paramName);
  }

  /**
   * Issue #269: Get all pass-by-value parameters.
   * Returns a Map from function name to Set of parameter names that should be pass-by-value.
   * Used by HeaderGenerator to ensure header and implementation signatures match.
   */
  getPassByValueParams(): ReadonlyMap<string, ReadonlySet<string>> {
    return this.passByValueParams;
  }

  /**
   * ADR-036: Try to evaluate an expression as a compile-time constant.
   * Returns the numeric value if constant, undefined if not evaluable.
   * Bug #8: Extended to resolve const variable references for file-scope array sizes.
   */
  private _tryEvaluateConstant(
    ctx: Parser.ExpressionContext,
  ): number | undefined {
    // Get the expression text and try to parse it as a simple integer literal
    const text = ctx.getText().trim();

    // Check if it's a simple integer literal
    if (/^-?\d+$/.exec(text)) {
      return Number.parseInt(text, 10);
    }
    // Check if it's a hex literal
    if (/^0[xX][0-9a-fA-F]+$/.exec(text)) {
      return Number.parseInt(text, 16);
    }
    // Check if it's a binary literal
    if (/^0[bB][01]+$/.exec(text)) {
      return Number.parseInt(text.substring(2), 2);
    }

    // Bug #8: Check if it's a known const value (identifier)
    if (/^[a-zA-Z_]\w*$/.exec(text)) {
      const constValue = this.constValues.get(text);
      if (constValue !== undefined) {
        return constValue;
      }
    }

    // Bug #8: Handle simple binary expressions with const values (e.g., INDEX_1 + INDEX_1)
    const addMatch = /^([a-zA-Z_]\w*)\+([a-zA-Z_]\w*)$/.exec(text);
    if (addMatch) {
      const left = this.constValues.get(addMatch[1]);
      const right = this.constValues.get(addMatch[2]);
      if (left !== undefined && right !== undefined) {
        return left + right;
      }
    }

    // Handle sizeof(type) expressions for primitive types
    const sizeofMatch = /^sizeof\(([a-zA-Z_]\w*)\)$/.exec(text);
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
    const sizeofMulMatch = /^sizeof\(([a-zA-Z_]\w*)\)\*(\d+)$/.exec(text);
    if (sizeofMulMatch) {
      const typeName = sizeofMulMatch[1];
      const multiplier = Number.parseInt(sizeofMulMatch[2], 10);
      const bitWidth = TYPE_WIDTH[typeName];
      if (bitWidth && !Number.isNaN(multiplier)) {
        return (bitWidth / 8) * multiplier;
      }
    }

    // Handle sizeof(type) + N expressions
    const sizeofAddMatch = /^sizeof\(([a-zA-Z_]\w*)\)\+(\d+)$/.exec(text);
    if (sizeofAddMatch) {
      const typeName = sizeofAddMatch[1];
      const addend = Number.parseInt(sizeofAddMatch[2], 10);
      const bitWidth = TYPE_WIDTH[typeName];
      if (bitWidth && !Number.isNaN(addend)) {
        return bitWidth / 8 + addend;
      }
    }

    // For more complex expressions, we can't evaluate at compile time
    return undefined;
  }

  // Issue #63: checkArrayBounds moved to TypeValidator

  /**
   * Evaluate array dimensions from ArrayDimensionContext[] to number[].
   * Used for bitmap array registration.
   */
  private _evaluateArrayDimensions(
    arrayDim: Parser.ArrayDimensionContext[] | null,
  ): number[] | undefined {
    if (!arrayDim || arrayDim.length === 0) {
      return undefined;
    }

    const dimensions: number[] = [];
    for (const dim of arrayDim) {
      const sizeExpr = dim.expression();
      if (sizeExpr) {
        const size = this._tryEvaluateConstant(sizeExpr);
        if (size !== undefined && size > 0) {
          dimensions.push(size);
        }
      }
    }

    return dimensions.length > 0 ? dimensions : undefined;
  }

  /**
   * Try to register a type as enum or bitmap. Returns true if handled.
   * Extracted to reduce duplication across type contexts (ADR-017, ADR-034).
   */
  private _tryRegisterEnumOrBitmapType(
    name: string,
    baseType: string,
    isConst: boolean,
    arrayDim: Parser.ArrayDimensionContext[] | null,
    overflowBehavior: TOverflowBehavior,
    isAtomic: boolean,
  ): boolean {
    // Common options for type registration
    const registrationOptions = {
      name,
      baseType,
      isConst,
      overflowBehavior,
      isAtomic,
    };

    // ADR-017: Check if this is an enum type
    if (
      TypeRegistrationUtils.tryRegisterEnumType(
        this.context.typeRegistry,
        this.symbols!,
        registrationOptions,
      )
    ) {
      return true;
    }

    // ADR-034: Check if this is a bitmap type
    const bitmapDimensions = this._evaluateArrayDimensions(arrayDim);
    if (
      TypeRegistrationUtils.tryRegisterBitmapType(
        this.context.typeRegistry,
        this.symbols!,
        registrationOptions,
        bitmapDimensions,
      )
    ) {
      return true;
    }

    return false;
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
        const capacity = Number.parseInt(intLiteral.getText(), 10);
        this.requireInclude("string");
        const stringDim = capacity + 1; // String capacity dimension (last)

        // Check if there are additional array dimensions (e.g., [4] in string<64> arr[4])
        if (arrayDim && arrayDim.length > 0) {
          // Process array dimensions (they come BEFORE string capacity)
          const dims: number[] = [];
          for (const dim of arrayDim) {
            const sizeExpr = dim.expression();
            if (sizeExpr) {
              const size = Number.parseInt(sizeExpr.getText(), 10);
              if (!Number.isNaN(size) && size > 0) {
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
      }
    } else if (typeCtx.scopedType()) {
      // ADR-016: Handle this.Type for scoped types (e.g., this.State -> Motor_State)
      const typeName = typeCtx.scopedType()!.IDENTIFIER().getText();
      if (this.context.currentScope) {
        baseType = `${this.context.currentScope}_${typeName}`;
      } else {
        baseType = typeName;
      }

      // ADR-017/ADR-034: Check if enum or bitmap type
      if (
        this._tryRegisterEnumOrBitmapType(
          name,
          baseType,
          isConst,
          arrayDim,
          overflowBehavior,
          isAtomic,
        )
      ) {
        return;
      }
    } else if (typeCtx.globalType()) {
      // Issue #478: Handle global.Type for global types inside scope
      // global.ECategory -> ECategory (no scope prefix)
      baseType = typeCtx.globalType()!.IDENTIFIER().getText();

      // ADR-017/ADR-034: Check if enum or bitmap type
      if (
        this._tryRegisterEnumOrBitmapType(
          name,
          baseType,
          isConst,
          arrayDim,
          overflowBehavior,
          isAtomic,
        )
      ) {
        return;
      }
    } else if (typeCtx.qualifiedType()) {
      // ADR-016: Handle Scope.Type from outside scope (e.g., Motor.State -> Motor_State)
      // Issue #388: Also handles C++ namespace types (e.g., MockLib.Parse.ParseResult -> MockLib::Parse::ParseResult)
      const identifiers = typeCtx.qualifiedType()!.IDENTIFIER();
      const identifierNames = identifiers.map((id) => id.getText());
      baseType = this.resolveQualifiedType(identifierNames);

      // ADR-017/ADR-034: Check if enum or bitmap type
      if (
        this._tryRegisterEnumOrBitmapType(
          name,
          baseType,
          isConst,
          arrayDim,
          overflowBehavior,
          isAtomic,
        )
      ) {
        return;
      }
    } else if (typeCtx.userType()) {
      // Track struct/class/enum/bitmap types for inferred struct initializers and type safety
      baseType = typeCtx.userType()!.getText();
      // Note: bitWidth stays 0 for user types (no fixed bit width)

      // ADR-017/ADR-034: Check if enum or bitmap type
      if (
        this._tryRegisterEnumOrBitmapType(
          name,
          baseType,
          isConst,
          arrayDim,
          overflowBehavior,
          isAtomic,
        )
      ) {
        return;
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
        const size = Number.parseInt(sizeText, 10);
        if (!Number.isNaN(size)) {
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
          const size = this._tryEvaluateConstant(sizeExpr);
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

  // =========================================================================
  // Type Registration Helpers - Extracted to reduce cognitive complexity
  // =========================================================================

  /**
   * Extract array dimensions from ArrayDimensionContext array (simple parseInt version)
   * Used for string array dimensions where const evaluation is not needed.
   */
  private extractArrayDimensionsSimple(
    arrayDim: Parser.ArrayDimensionContext[] | null,
  ): number[] {
    const dimensions: number[] = [];
    if (!arrayDim || arrayDim.length === 0) {
      return dimensions;
    }

    for (const dim of arrayDim) {
      const sizeExpr = dim.expression();
      if (sizeExpr) {
        const size = Number.parseInt(sizeExpr.getText(), 10);
        if (!Number.isNaN(size) && size > 0) {
          dimensions.push(size);
        }
      }
    }
    return dimensions;
  }

  /**
   * Register a string type in the type registry
   * Returns true if registration was successful
   */
  private tryRegisterStringType(
    registryName: string,
    typeCtx: Parser.TypeContext,
    arrayDim: Parser.ArrayDimensionContext[] | null,
    isConst: boolean,
    overflowBehavior: TOverflowBehavior,
    isAtomic: boolean,
  ): boolean {
    const stringCtx = typeCtx.stringType();
    if (!stringCtx) {
      return false;
    }

    const intLiteral = stringCtx.INTEGER_LITERAL();
    if (!intLiteral) {
      return false;
    }

    const capacity = Number.parseInt(intLiteral.getText(), 10);
    this.requireInclude("string");
    const stringDim = capacity + 1;

    // Check if there are additional array dimensions (e.g., [4] in string<64> arr[4])
    const additionalDims = this.extractArrayDimensionsSimple(arrayDim);
    const allDims =
      additionalDims.length > 0 ? [...additionalDims, stringDim] : [stringDim];

    this.context.typeRegistry.set(registryName, {
      baseType: "char",
      bitWidth: 8,
      isArray: true,
      arrayDimensions: allDims,
      isConst,
      isString: true,
      stringCapacity: capacity,
      overflowBehavior,
      isAtomic,
    });
    return true;
  }

  /**
   * Resolve base type name from a type context
   * Handles scoped, global, qualified, and user types
   */
  private resolveBaseTypeFromContext(
    typeCtx: Parser.TypeContext,
  ): string | null {
    if (typeCtx.primitiveType()) {
      return typeCtx.primitiveType()!.getText();
    }

    if (typeCtx.scopedType()) {
      // ADR-016: Handle this.Type for scoped types (e.g., this.State -> Motor_State)
      const typeName = typeCtx.scopedType()!.IDENTIFIER().getText();
      return this.context.currentScope
        ? `${this.context.currentScope}_${typeName}`
        : typeName;
    }

    if (typeCtx.globalType()) {
      // Issue #478: Handle global.Type for global types inside scope
      return typeCtx.globalType()!.IDENTIFIER().getText();
    }

    if (typeCtx.qualifiedType()) {
      // ADR-016: Handle Scope.Type from outside scope
      // Issue #388: Also handles C++ namespace types
      const identifiers = typeCtx.qualifiedType()!.IDENTIFIER();
      const identifierNames = identifiers.map((id) => id.getText());
      return this.resolveQualifiedType(identifierNames);
    }

    if (typeCtx.userType()) {
      return typeCtx.userType()!.getText();
    }

    return null;
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

    // ADR-045: Handle bounded string type first (special case)
    if (
      this.tryRegisterStringType(
        registryName,
        typeCtx,
        arrayDim,
        isConst,
        overflowBehavior,
        isAtomic,
      )
    ) {
      return;
    }

    // Handle array type syntax: u8[10]
    if (typeCtx.arrayType()) {
      const arrayTypeCtx = typeCtx.arrayType()!;
      let baseType = "";
      let bitWidth = 0;

      if (arrayTypeCtx.primitiveType()) {
        baseType = arrayTypeCtx.primitiveType()!.getText();
        bitWidth = TYPE_WIDTH[baseType] || 0;
      }

      const arrayDimensions: number[] = [];
      const sizeExpr = arrayTypeCtx.expression();
      if (sizeExpr) {
        const size = Number.parseInt(sizeExpr.getText(), 10);
        if (!Number.isNaN(size)) {
          arrayDimensions.push(size);
        }
      }

      // Also check for additional dimensions using const evaluation
      const additionalDims = this._evaluateArrayDimensions(arrayDim);
      if (additionalDims) {
        arrayDimensions.push(...additionalDims);
      }

      if (baseType) {
        this.context.typeRegistry.set(registryName, {
          baseType,
          bitWidth,
          isArray: true,
          arrayDimensions:
            arrayDimensions.length > 0 ? arrayDimensions : undefined,
          isConst,
          overflowBehavior,
          isAtomic,
        });
      }
      return;
    }

    // Resolve base type from context (handles scoped, global, qualified, user types)
    const baseType = this.resolveBaseTypeFromContext(typeCtx);
    if (!baseType) {
      return;
    }

    // ADR-017/ADR-034: Check if enum or bitmap type (reuse existing helper)
    if (
      this._tryRegisterEnumOrBitmapType(
        registryName,
        baseType,
        isConst,
        arrayDim,
        overflowBehavior,
        isAtomic,
      )
    ) {
      return;
    }

    // Standard type registration
    const bitWidth = TYPE_WIDTH[baseType] || 0;
    const arrayDimensions = this._evaluateArrayDimensions(arrayDim);
    const isArray = arrayDimensions !== undefined && arrayDimensions.length > 0;

    this.context.typeRegistry.set(registryName, {
      baseType,
      bitWidth,
      isArray,
      arrayDimensions: isArray ? arrayDimensions : undefined,
      isConst,
      overflowBehavior,
      isAtomic,
    });
  }

  /**
   * Issue #322: Check if a type name is a user-defined struct
   * Part of IOrchestrator interface.
   */
  isStructType(typeName: string): boolean {
    return this.typeResolver!.isStructType(typeName);
  }

  /**
   * Set up parameter tracking for a function
   */
  private _setParameters(params: Parser.ParameterListContext | null): void {
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
        // ADR-016: Handle qualified types like Scope.Type
        // Issue #388: Also handles C++ namespace types (MockLib.Parse.ParseResult -> MockLib::Parse::ParseResult)
        const identifierNames = typeCtx
          .qualifiedType()!
          .IDENTIFIER()
          .map((id) => id.getText());
        typeName = this.resolveQualifiedType(identifierNames);
        // Check if this is a struct type
        isStruct = this.isStructType(typeName);
      } else if (typeCtx.scopedType()) {
        // ADR-016: Handle scoped types like this.Type (inside a scope)
        const localTypeName = typeCtx.scopedType()!.IDENTIFIER().getText();
        if (this.context.currentScope) {
          typeName = `${this.context.currentScope}_${localTypeName}`;
        } else {
          typeName = localTypeName;
        }
        // Check if this is a struct type
        isStruct = this.isStructType(typeName);
      } else if (typeCtx.globalType()) {
        // Issue #478: Handle global.Type for global types inside scope
        typeName = typeCtx.globalType()!.IDENTIFIER().getText();
        // Check if this is a struct type
        isStruct = this.isStructType(typeName);
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
      // Issue #547: Always count each dimension, even if unsized (use 0 for unsized)
      const arrayDimensions: number[] = [];
      if (isArray) {
        const arrayDims = param.arrayDimension();
        for (const dim of arrayDims) {
          const sizeExpr = dim.expression();
          if (sizeExpr) {
            const sizeText = sizeExpr.getText();
            const size = Number.parseInt(sizeText, 10);
            if (Number.isNaN(size)) {
              // Non-numeric size (e.g., constant identifier) - still count the dimension
              arrayDimensions.push(0);
            } else {
              arrayDimensions.push(size);
            }
          } else {
            // Unsized dimension (e.g., arr[]) - use 0 to indicate unknown size
            arrayDimensions.push(0);
          }
        }
      }

      // ADR-045: Get string capacity if this is a string parameter
      let stringCapacity: number | undefined;
      if (isString && typeCtx.stringType()) {
        const intLiteral = typeCtx.stringType()!.INTEGER_LITERAL();
        if (intLiteral) {
          stringCapacity = Number.parseInt(intLiteral.getText(), 10);
          // For string arrays, add capacity+1 as second dimension for proper .length handling
          if (isArray && stringCapacity !== undefined) {
            arrayDimensions.push(stringCapacity + 1);
          }
        }
      }

      this.context.typeRegistry.set(name, {
        baseType: typeName,
        bitWidth: isBitmap
          ? this.symbols!.bitmapBitWidth.get(typeName) || 0
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
        isParameter: true, // Issue #579: Mark as parameter for subscript classification
      });
    }
  }

  /**
   * Clear parameter tracking when leaving a function
   */
  private _clearParameters(): void {
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
        const baseType = this._getTypeName(param.type());
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
    const returnType = this._generateType(funcDecl.type());
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
        const typeName = this._getTypeName(param.type());
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
          paramType = this._generateType(param.type());
          // ADR-006: Non-array parameters become pointers
          isPointer = !isArray;
        }

        const arrayDims = isArray
          ? dims.map((d) => this._generateArrayDimension(d)).join("")
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
  private _isCallbackTypeUsedAsFieldType(funcName: string): boolean {
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
  private _getExpressionEnumType(
    ctx: Parser.ExpressionContext | Parser.RelationalExpressionContext,
  ): string | null {
    // Get the text representation to analyze
    const text = ctx.getText();

    // Check if it's a function call returning an enum
    const enumReturnType = this._getFunctionCallEnumType(text);
    if (enumReturnType) {
      return enumReturnType;
    }

    // Check if it's a simple identifier that's an enum variable
    if (/^[a-zA-Z_]\w*$/.exec(text)) {
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

      // Issue #478: Check global.Enum.Member pattern (global.ECategory.CAT_A)
      if (parts[0] === "global" && parts.length >= 3) {
        const enumName = parts[1];
        if (this.symbols!.knownEnums.has(enumName)) {
          return enumName;
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
   * Check if an expression is a function call returning an enum type.
   * Handles patterns:
   * - func() or func(args) - global function
   * - Scope.method() or Scope.method(args) - scope method from outside
   * - this.method() or this.method(args) - scope method from inside
   * - global.func() or global.func(args) - global function from inside scope
   * - global.Scope.method() or global.Scope.method(args) - scope method from inside another scope
   */
  private _getFunctionCallEnumType(text: string): string | null {
    // Check if this looks like a function call (contains parentheses)
    const parenIndex = text.indexOf("(");
    if (parenIndex === -1) {
      return null;
    }

    // Extract the function reference (everything before the opening paren)
    const funcRef = text.substring(0, parenIndex);
    const parts = funcRef.split(".");

    let fullFuncName: string | null = null;

    if (parts.length === 1) {
      // Simple function call: func()
      fullFuncName = parts[0];
    } else if (parts.length === 2) {
      if (parts[0] === "this" && this.context.currentScope) {
        // this.method() -> Scope_method
        fullFuncName = `${this.context.currentScope}_${parts[1]}`;
      } else if (parts[0] === "global") {
        // global.func() -> func
        fullFuncName = parts[1];
      } else if (this.symbols!.knownScopes.has(parts[0])) {
        // Scope.method() -> Scope_method
        fullFuncName = `${parts[0]}_${parts[1]}`;
      }
    } else if (parts.length === 3) {
      if (parts[0] === "global" && this.symbols!.knownScopes.has(parts[1])) {
        // global.Scope.method() -> Scope_method
        fullFuncName = `${parts[1]}_${parts[2]}`;
      }
    }

    if (!fullFuncName) {
      return null;
    }

    // Look up the function's return type
    const returnType = this.symbols!.functionReturnTypes.get(fullFuncName);
    if (!returnType) {
      return null;
    }

    // Check if the return type is an enum
    if (this.symbols!.knownEnums.has(returnType)) {
      return returnType;
    }

    return null;
  }

  /**
   * ADR-017: Check if an expression represents an integer literal or numeric type.
   * Used to detect comparisons between enums and integers.
   */
  private _isIntegerExpression(
    ctx: Parser.ExpressionContext | Parser.RelationalExpressionContext,
  ): boolean {
    const text = ctx.getText();

    // Check for integer literals
    if (
      /^-?\d+$/.exec(text) ||
      /^0[xX][0-9a-fA-F]+$/.exec(text) ||
      /^0[bB][01]+$/.exec(text)
    ) {
      return true;
    }

    // Check if it's a variable of primitive integer type
    if (/^[a-zA-Z_]\w*$/.exec(text)) {
      const typeInfo = this.context.typeRegistry.get(text);
      if (
        typeInfo &&
        !typeInfo.isEnum &&
        TypeCheckUtils.isInteger(typeInfo.baseType)
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
  private _isStringExpression(
    ctx: Parser.RelationalExpressionContext,
  ): boolean {
    const text = ctx.getText();

    // Check for string literals
    if (text.startsWith('"') && text.endsWith('"')) {
      return true;
    }

    // Check if it's a simple variable of string type
    if (/^[a-zA-Z_]\w*$/.exec(text)) {
      const typeInfo = this.context.typeRegistry.get(text);
      if (typeInfo?.isString) {
        return true;
      }
    }

    // Issue #137: Check for array element access (e.g., names[0], arr[i])
    // Pattern: identifier[expression] or identifier[expression][expression]...
    // BUT NOT if accessing .length/.capacity/.size (those return numbers, not strings)
    const arrayAccessMatch = /^([a-zA-Z_]\w*)\[/.exec(text);
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
      if (
        typeInfo?.isString ||
        (typeInfo?.baseType && TypeCheckUtils.isString(typeInfo.baseType))
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * ADR-045: Check if an expression is a string concatenation (contains + with string operands).
   * Returns the operand expressions if it is, null otherwise.
   */
  private _getStringConcatOperands(ctx: Parser.ExpressionContext): {
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
    const leftCapacity = this._getStringExprCapacity(leftText);
    const rightCapacity = this._getStringExprCapacity(rightText);

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
  private _getStringExprCapacity(expr: string): number | null {
    // String literal - capacity equals content length
    if (expr.startsWith('"') && expr.endsWith('"')) {
      return this._getStringLiteralLength(expr);
    }

    // Variable - check type registry
    if (/^[a-zA-Z_]\w*$/.exec(expr)) {
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
  private _getSubstringOperands(ctx: Parser.ExpressionContext): {
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
        start: this._generateExpression(exprs[0]),
        length: this._generateExpression(exprs[1]),
        sourceCapacity: typeInfo.stringCapacity,
      };
    } else if (exprs.length === 1) {
      // Single-character access: source[i] is sugar for source[i, 1]
      return {
        source: sourceName,
        start: this._generateExpression(exprs[0]),
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

  // NOTE: Public isIntegerType and isFloatType moved to IOrchestrator interface (ADR-053 A2)
  // Private versions kept for internal use
  private _isIntegerType(typeName: string): boolean {
    return this.typeResolver!.isIntegerType(typeName);
  }

  private _isFloatType(typeName: string): boolean {
    return this.typeResolver!.isFloatType(typeName);
  }

  /**
   * Get type info for a struct member field
   * Used to track types through member access chains like buf.data[0]
   */
  private _getMemberTypeInfo(
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
  private _validateLiteralFitsType(
    literalText: string,
    targetType: string,
  ): void {
    this.typeResolver!.validateLiteralFitsType(literalText, targetType);
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
  private _validateTypeConversion(
    targetType: string,
    sourceType: string | null,
  ): void {
    this.typeResolver!.validateTypeConversion(targetType, sourceType);
  }

  /**
   * Internal implementation of identifier resolution.
   * Inside a scope, checks if the identifier is a scope member first.
   * Otherwise returns the identifier unchanged (global scope).
   * ADR-016: Renamed from namespace-based resolution
   */
  private _resolveIdentifier(identifier: string): string {
    // Check current scope first (inner scope shadows outer)
    if (this.context.currentScope) {
      const members = this.context.scopeMembers.get(this.context.currentScope);
      if (members?.has(identifier)) {
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
  private _getSimpleIdentifier(ctx: Parser.ExpressionContext): string | null {
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
  private _getStringLiteralLength(literal: string): number {
    return StringUtils.literalLength(literal);
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
    const lastOp = ops.at(-1)!;

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
   * Issue #251/#252/#256: Check if a member access expression needs a temp variable in C++ mode.
   *
   * Returns true when passing struct member to function would fail C++ compilation:
   * 1. Const struct parameter member -> non-const parameter (const T* -> T* invalid)
   * 2. External C struct members of bool/enum type -> u8 parameter (type mismatch)
   * 3. Array element member access (arr[i].member) with external struct elements
   */
  private needsCppMemberConversion(
    ctx: Parser.ExpressionContext,
    targetParamBaseType?: string,
  ): boolean {
    if (!this.cppMode) return false;
    if (!targetParamBaseType) return false;

    const postfix = this.getPostfixExpression(ctx);
    if (!postfix) return false;

    // Get the base identifier (e.g., "cfg" in "cfg.value" or "sensors" in "sensors[0].value")
    const primary = postfix.primaryExpression();
    if (!primary) return false;
    const baseId = primary.IDENTIFIER()?.getText();
    if (!baseId) return false;

    const ops = postfix.postfixOp();

    // Case 1: Direct parameter member access (cfg.value)
    const paramInfo = this.context.currentParameters.get(baseId);
    if (paramInfo) {
      // Check if the parameter type is a primitive type
      const isPrimitiveParam = !!TYPE_MAP[paramInfo.baseType];

      // If not a primitive type, it's either a known struct or an external C struct
      // (typedef structs from C headers may not be recognized as structs)
      const couldBeStruct = paramInfo.isStruct || !isPrimitiveParam;
      if (couldBeStruct) {
        // Issue #251: Const struct parameter needs temp to break const chain
        if (paramInfo.isConst) {
          return true;
        }

        // Issue #252: External C structs may have bool/enum members that need casting
        // In C++ mode, we conservatively create temps for all external struct member accesses
        // to u8 parameters, since we don't have full member type info for C headers
        const targetCType = TYPE_MAP[targetParamBaseType];
        if (targetCType === "uint8_t") {
          return true; // Could be bool or typed enum
        }
      }
      return false;
    }

    // Issue #256: Array element member access (arr[i].member) or
    // function return member access (getConfig().member)
    // Check if the expression ends with member access preceded by array/function
    if (ops.length >= 2) {
      const lastOp = ops.at(-1)!;
      // Last op must be member access (.identifier)
      if (lastOp.IDENTIFIER()) {
        const precedingOps = ops.slice(0, -1);

        // Case 2a: Array element member access (arr[i].member)
        const hasArraySubscript = precedingOps.some(
          (op) => op.expression() !== null,
        );
        if (hasArraySubscript) {
          // Check if base is an array with non-primitive element type
          const typeInfo = this.context.typeRegistry.get(baseId);
          if (typeInfo?.isArray) {
            const isPrimitiveElement = !!TYPE_MAP[typeInfo.baseType];
            if (!isPrimitiveElement) {
              // Only for u8 target parameters (could be bool or typed enum)
              const targetCType = TYPE_MAP[targetParamBaseType];
              if (targetCType === "uint8_t") {
                return true;
              }
            }
          }
        }

        // Case 2b: Function return member access (getConfig().member)
        // Function call is detected by checking if preceding op has argumentList
        // (even empty function calls have argumentList node, just empty)
        const hasFunctionCall = precedingOps.some(
          (op) => op.argumentList() !== null || op.getText().endsWith(")"),
        );
        if (hasFunctionCall) {
          // Conservatively generate temp for any function().member -> u8 in C++ mode
          // The function could return a struct from C header with bool/enum members
          const targetCType = TYPE_MAP[targetParamBaseType];
          if (targetCType === "uint8_t") {
            return true;
          }
        }
      }
    }

    return false;
  }

  /**
   * Issue #246: Check if an expression is a subscript access on a string variable.
   * For example, buf[0] where buf is a string<N>.
   * Used to determine when to cast char* to uint8_t* etc.
   */
  private isStringSubscriptAccess(ctx: Parser.ExpressionContext): boolean {
    const postfix = this.getPostfixExpression(ctx);
    if (!postfix) return false;

    // Must have at least one postfix operator
    const ops = postfix.postfixOp();
    if (ops.length === 0) return false;

    // Last operator must be array access [expression]
    const lastOp = ops.at(-1)!;
    if (!lastOp.expression()) return false;

    // Get the base identifier
    const primary = postfix.primaryExpression();
    const baseId = primary.IDENTIFIER()?.getText();
    if (!baseId) return false;

    // Check if the base is a string type in the type registry
    const typeInfo = this.context.typeRegistry.get(baseId);
    if (typeInfo?.isString) return true;

    // Also check if it's a string parameter
    const paramInfo = this.context.currentParameters.get(baseId);
    if (paramInfo?.isString) return true;

    return false;
  }

  /**
   * Issue #308: Check if a member access expression is accessing an array member.
   * For example, result.data where data is a u8[6] array member.
   * When passing such expressions to functions, the array should naturally decay
   * to a pointer, so we should NOT add & operator.
   *
   * Note: Currently handles single-level member access only (e.g., result.data).
   * Nested access like outer.inner.data would require traversing the postfix chain
   * to resolve intermediate struct types. This is acceptable since issue #308
   * involves single-level access patterns.
   *
   * @param ctx - The expression context
   * @returns true if the expression is a member access to an array field
   */
  private isMemberAccessToArray(ctx: Parser.ExpressionContext): boolean {
    const result = this.getMemberAccessArrayStatus(ctx);
    return result === "array";
  }

  /**
   * Issue #355: Check if struct field info is available for a member access.
   * Used for defensive code generation - when we don't have field info,
   * we skip potentially dangerous conversions.
   *
   * @returns "array" if definitely an array, "not-array" if definitely not,
   *          "unknown" if struct field info is not available
   */
  private getMemberAccessArrayStatus(
    ctx: Parser.ExpressionContext,
  ): "array" | "not-array" | "unknown" {
    const postfix = this.getPostfixExpression(ctx);
    if (!postfix) return "not-array";

    const ops = postfix.postfixOp();
    if (ops.length === 0) return "not-array";

    // Last operator must be member access (.identifier)
    const lastOp = ops.at(-1)!;
    const memberName = lastOp.IDENTIFIER()?.getText();
    if (!memberName) return "not-array";

    // Get the base identifier to find the struct type
    const primary = postfix.primaryExpression();
    if (!primary) return "not-array";
    const baseId = primary.IDENTIFIER()?.getText();
    if (!baseId) return "not-array";

    // Look up the struct type from either:
    // 1. Local variable: typeRegistry.get(baseId).baseType
    // 2. Parameter: currentParameters.get(baseId).baseType
    let structType: string | undefined;

    const typeInfo = this.context.typeRegistry.get(baseId);
    if (typeInfo) {
      structType = typeInfo.baseType;
    } else {
      const paramInfo = this.context.currentParameters.get(baseId);
      if (paramInfo) {
        structType = paramInfo.baseType;
      }
    }

    if (!structType) return "not-array";

    // Check if this struct member is an array
    const memberInfo = this.getMemberTypeInfo(structType, memberName);

    // Issue #355: If memberInfo is undefined, we don't have struct field info
    // This could mean the header wasn't parsed - return "unknown" for defensive generation
    if (!memberInfo) {
      return "unknown";
    }

    return memberInfo.isArray ? "array" : "not-array";
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
  private _generateFunctionArg(
    ctx: Parser.ExpressionContext,
    targetParamBaseType?: string,
  ): string {
    const id = this._getSimpleIdentifier(ctx);

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
        if (members?.has(id)) {
          // Issue #409/#644: In C++ mode, references don't need &
          const scopedName = `${this.context.currentScope}_${id}`;
          return this.cppHelper!.maybeAddressOf(scopedName);
        }
      }

      // Local variable - add & (except in C++ mode where references are used)
      // Issue #409/#644: In C++ mode, parameters are references, so no & needed
      return this.cppHelper!.maybeAddressOf(id);
    }

    // Check if it's a member access or array access (lvalue) - needs &
    const lvalueType = this.getLvalueType(ctx);
    if (lvalueType) {
      // Issue #308: If member access to an array, don't add & - arrays decay to pointers
      // For example: result.data where data is u8[6] should pass as result.data (decays to uint8_t*)
      // NOT &result.data (which gives uint8_t (*)[6] - wrong type)
      if (lvalueType === "member") {
        const arrayStatus = this.getMemberAccessArrayStatus(ctx);

        if (arrayStatus === "array") {
          return this._generateExpression(ctx);
        }

        // Issue #355: Only apply static_cast when we KNOW the field is not an array.
        // When "unknown" (header not parsed), skip this path - safer than potentially
        // casting an array to a scalar.
        // Issue #251/#252: In C++ mode, struct member access may need temp variable.
        if (
          arrayStatus === "not-array" &&
          this.needsCppMemberConversion(ctx, targetParamBaseType)
        ) {
          const cType = TYPE_MAP[targetParamBaseType!] || "uint8_t";
          const value = this._generateExpression(ctx);
          const tempName = `_cnx_tmp_${this.tempVarCounter++}`;
          // Use static_cast for C++ type safety (needsCppMemberConversion implies cppMode)
          const castExpr = this.cppHelper!.cast(cType, value);
          this.pendingTempDeclarations.push(
            `${cType} ${tempName} = ${castExpr};`,
          );
          // Issue #409/#644: In C++ mode, references don't need &
          return this.cppHelper!.maybeAddressOf(tempName);
        }
      }

      // Generate the expression and wrap with & (except in C++ mode)
      // Issue #409/#644: In C++ mode, parameters are references, so no & needed
      const generatedExpr = this._generateExpression(ctx);
      const expr = this.cppHelper!.maybeAddressOf(generatedExpr);

      // Issue #246: When passing string bytes to integer pointer parameters
      // (C-Next's by-reference semantics), cast from char* to the appropriate
      // integer pointer type to avoid signedness warnings
      // Issue #267: Use reinterpret_cast for pointer type conversions in C++ mode
      if (
        lvalueType === "array" &&
        targetParamBaseType &&
        this.isStringSubscriptAccess(ctx)
      ) {
        const cType = TYPE_MAP[targetParamBaseType];
        if (cType && !["float", "double", "bool", "void"].includes(cType)) {
          return this.cppHelper!.reinterpretCast(`${cType}*`, expr);
        }
      }

      return expr;
    }

    // Check if it's a literal OR complex expression being passed to a pointer parameter
    // Any expression reaching this point is an rvalue (identifiers/lvalues handled above)
    if (targetParamBaseType) {
      const cType = TYPE_MAP[targetParamBaseType];
      if (cType && cType !== "void") {
        const value = this._generateExpression(ctx);

        // Issue #409: In C++ mode with references, rvalues can bind to const T&
        // No need for temp variables or address-of
        if (this.cppMode) {
          return value;
        }

        // C mode: Use C99 compound literal syntax: &(type){value}
        return `&(${cType}){${value}}`;
      }
    }

    // No target type info - generate expression as-is
    return this._generateExpression(ctx);
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
    // Issue #369: Skip struct/enum/bitmap definitions when self-include is added
    // These types will be defined in the included header file
    if (ctx.structDeclaration()) {
      if (this.selfIncludeAdded) {
        return ""; // Definition will come from header
      }
      return this.generateStruct(ctx.structDeclaration()!);
    }
    // ADR-017: Handle enum declarations
    if (ctx.enumDeclaration()) {
      if (this.selfIncludeAdded) {
        return ""; // Definition will come from header
      }
      return this.generateEnum(ctx.enumDeclaration()!);
    }
    // ADR-034: Handle bitmap declarations
    if (ctx.bitmapDeclaration()) {
      if (this.selfIncludeAdded) {
        return ""; // Definition will come from header
      }
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
    // ADR-053: Check registry for extracted generator
    const generator = this.registry.getDeclaration("scope");
    if (generator) {
      const result = generator(ctx, this.getInput(), this.getState(), this);
      this.applyEffects(result.effects);
      return result.code;
    }

    // Fallback to inline implementation (will be removed after migration)
    const name = ctx.IDENTIFIER().getText();
    this.context.currentScope = name;

    const lines: string[] = [];
    lines.push(`/* Scope: ${name} */`);

    for (const member of ctx.scopeMember()) {
      const visibility = member.visibilityModifier()?.getText() || "private";
      const isPrivate = visibility === "private";

      if (member.variableDeclaration()) {
        const varDecl = member.variableDeclaration()!;
        const type = this._generateType(varDecl.type());
        const varName = varDecl.IDENTIFIER().getText();
        const fullName = `${name}_${varName}`;
        const prefix = isPrivate ? "static " : "";

        // Note: Type already registered in registerAllVariableTypes() pass

        // ADR-036: arrayDimension() now returns an array
        const arrayDims = varDecl.arrayDimension();
        const isArray = arrayDims.length > 0;
        let decl = `${prefix}${type} ${fullName}`;
        if (isArray) {
          decl += this._generateArrayDimensions(arrayDims);
        }
        // ADR-045: Add string capacity dimension for string arrays
        if (varDecl.type().stringType()) {
          const stringCtx = varDecl.type().stringType()!;
          const intLiteral = stringCtx.INTEGER_LITERAL();
          if (intLiteral) {
            const capacity = Number.parseInt(intLiteral.getText(), 10);
            decl += `[${capacity + 1}]`;
          }
        }
        if (varDecl.expression()) {
          decl += ` = ${this._generateExpression(varDecl.expression()!)}`;
        } else {
          // ADR-015: Zero initialization for uninitialized scope variables
          decl += ` = ${this._getZeroInitializer(varDecl.type(), isArray)}`;
        }
        lines.push(decl + ";");
      }

      if (member.functionDeclaration()) {
        const funcDecl = member.functionDeclaration()!;
        const returnType = this._generateType(funcDecl.type());
        const funcName = funcDecl.IDENTIFIER().getText();
        const fullName = `${name}_${funcName}`;
        const prefix = isPrivate ? "static " : "";

        // Issue #269: Set current function name for pass-by-value lookup
        this.context.currentFunctionName = fullName;
        // Issue #477: Set return type for enum inference in return statements
        this.context.currentFunctionReturnType = funcDecl.type().getText();

        // Track parameters for ADR-006 pointer semantics
        this._setParameters(funcDecl.parameterList() ?? null);

        // ADR-016: Enter function body context (also clears modifiedParameters for Issue #281)
        this.enterFunctionBody();

        // Issue #281: Generate body FIRST to track parameter modifications,
        // then generate parameter list using that tracking info
        const body = this._generateBlock(funcDecl.block());

        // Issue #281: Update symbol's parameter info with auto-const before generating params
        this.updateFunctionParamsAutoConst(fullName);

        // Now generate parameter list (can use modifiedParameters for auto-const)
        const params = funcDecl.parameterList()
          ? this._generateParameterList(funcDecl.parameterList()!)
          : "void";

        // ADR-016: Exit function body context
        this.exitFunctionBody();
        this.context.currentFunctionName = null; // Issue #269: Clear function name
        this.context.currentFunctionReturnType = null; // Issue #477: Clear return type
        this._clearParameters();

        lines.push("", `${prefix}${returnType} ${fullName}(${params}) ${body}`);

        // ADR-029: Generate callback typedef only if used as a type
        if (this._isCallbackTypeUsedAsFieldType(fullName)) {
          const typedef = this._generateCallbackTypedef(fullName);
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
        lines.push("", enumCode);
      }

      // ADR-034: Handle bitmap declarations inside scopes
      // Issue #60: Symbol collection done by SymbolCollector
      if (member.bitmapDeclaration()) {
        const bitmapDecl = member.bitmapDeclaration()!;
        const bitmapCode = this.generateBitmap(bitmapDecl);
        lines.push("", bitmapCode);
      }

      // Handle register declarations inside scopes
      if (member.registerDeclaration()) {
        const regDecl = member.registerDeclaration()!;
        const regCode = this.generateScopedRegister(regDecl, name);
        lines.push("", regCode);
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
    // ADR-053: Check registry for extracted generator
    const generator = this.registry.getDeclaration("register");
    if (generator) {
      const result = generator(ctx, this.getInput(), this.getState(), this);
      this.applyEffects(result.effects);
      return result.code;
    }

    // Fallback to inline implementation (will be removed after migration)
    const name = ctx.IDENTIFIER().getText();
    const baseAddress = this._generateExpression(ctx.expression());

    const lines: string[] = [];
    lines.push(`/* Register: ${name} @ ${baseAddress} */`);

    // Generate individual #define for each register member with its offset
    // This handles non-contiguous register layouts correctly (like i.MX RT1062)
    for (const member of ctx.registerMember()) {
      const regName = member.IDENTIFIER().getText();
      const regType = this._generateType(member.type());
      const access = member.accessModifier().getText();
      const offset = this._generateExpression(member.expression());

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
    // ADR-053: Delegate to extracted generator
    const result = scopedRegisterGenerator(
      ctx,
      scopeName,
      this.getInput(),
      this.getState(),
      this,
    );
    this.applyEffects(result.effects);
    return result.code;
  }

  // ========================================================================
  // Struct
  // ========================================================================

  private generateStruct(ctx: Parser.StructDeclarationContext): string {
    // ADR-053: Check registry for extracted generator
    const generator = this.registry.getDeclaration("struct");
    if (generator) {
      const result = generator(ctx, this.getInput(), this.getState(), this);
      this.applyEffects(result.effects);
      return result.code;
    }

    // Fallback to inline implementation (will be removed after migration)
    const name = ctx.IDENTIFIER().getText();
    const callbackFields: Array<{ fieldName: string; callbackType: string }> =
      [];

    const lines: string[] = [];
    lines.push(`typedef struct {`);

    for (const member of ctx.structMember()) {
      const fieldName = member.IDENTIFIER().getText();
      const typeName = this._getTypeName(member.type());
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
          const dims = this._generateArrayDimensions(arrayDims);
          lines.push(`    ${callbackInfo.typedefName} ${fieldName}${dims};`);
        } else {
          lines.push(`    ${callbackInfo.typedefName} ${fieldName};`);
        }
      } else {
        // Regular field handling
        const type = this._generateType(member.type());

        // Check if we have tracked dimensions for this field (includes string capacity for string arrays)
        const trackedDimensions = this.symbols!.structFieldDimensions.get(name);
        const fieldDims = trackedDimensions?.get(fieldName);

        if (fieldDims && fieldDims.length > 0) {
          // Use tracked dimensions (includes string capacity for string arrays)
          const dimsStr = fieldDims.map((d) => `[${d}]`).join("");
          lines.push(`    ${type} ${fieldName}${dimsStr};`);
        } else if (isArray) {
          // Fall back to AST dimensions for non-string arrays
          const dims = this._generateArrayDimensions(arrayDims);
          lines.push(`    ${type} ${fieldName}${dims};`);
        } else {
          lines.push(`    ${type} ${fieldName};`);
        }
      }
    }

    lines.push(`} ${name};`, "");

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
    lines.push(
      `${structName} ${structName}_init(void) {`,
      `    return (${structName}){`,
    );

    for (let i = 0; i < callbackFields.length; i++) {
      const field = callbackFields[i];
      const comma = i < callbackFields.length - 1 ? "," : "";
      lines.push(`        .${field.fieldName} = ${field.callbackType}${comma}`);
    }

    lines.push(`    };`, `}`, "");

    return lines.join("\n");
  }

  // ========================================================================
  // Enum (ADR-017: Type-safe enums)
  // ========================================================================

  /**
   * ADR-017: Generate enum declaration
   * enum State { IDLE, RUNNING, ERROR <- 255 }
   * -> typedef enum { State_IDLE = 0, State_RUNNING = 1, State_ERROR = 255 } State;
   *
   * ADR-053: Delegates to extracted generator if registered.
   */
  private generateEnum(ctx: Parser.EnumDeclarationContext): string {
    // ADR-053: Check registry for extracted generator
    const generator = this.registry.getDeclaration("enum");
    if (generator) {
      const result = generator(ctx, this.getInput(), this.getState(), this);
      this.applyEffects(result.effects);
      return result.code;
    }

    // Fallback to inline implementation (will be removed after migration)
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

    lines.push(`} ${fullName};`, "");

    return lines.join("\n");
  }

  /**
   * ADR-034: Generate bitmap declaration
   * bitmap8 MotorFlags { Running, Direction, Mode[3], Reserved[2] }
   * -> typedef uint8_t MotorFlags; (with field layout comment)
   *
   * ADR-053: Delegates to extracted generator if registered.
   */
  private generateBitmap(ctx: Parser.BitmapDeclarationContext): string {
    // ADR-053: Check registry for extracted generator
    const generator = this.registry.getDeclaration("bitmap");
    if (generator) {
      const result = generator(ctx, this.getInput(), this.getState(), this);
      this.applyEffects(result.effects);
      return result.code;
    }

    // Fallback to inline implementation (will be removed after migration)
    const name = ctx.IDENTIFIER().getText();
    const prefix = this.context.currentScope
      ? `${this.context.currentScope}_`
      : "";
    const fullName = `${prefix}${name}`;

    const backingType = this.symbols!.bitmapBackingType.get(fullName);
    if (!backingType) {
      throw new Error(`Error: Bitmap ${fullName} not found in registry`);
    }

    this.requireInclude("stdint");

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

    lines.push(`typedef ${backingType} ${fullName};`, "");

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

    // Issue #517: Check if this is a C++ class with a user-defined constructor.
    // C++ classes with user-defined constructors are NOT aggregate types,
    // so designated initializers { .field = value } don't work with them.
    // We check the SymbolTable for a constructor symbol (TypeName::TypeName).
    const isCppClass =
      this.cppMode && this._isCppClassWithConstructor(typeName);

    if (!fieldList) {
      // Empty initializer: Point {} -> (Point){ 0 } or {} for C++ classes
      return isCppClass ? "{}" : `(${typeName}){ 0 }`;
    }

    // Get field type info for nested initializers
    // Issue #502: Check both local struct fields and SymbolTable (for C++ header structs)
    const structFieldTypes = this.symbols!.structFields.get(typeName);

    const fields = fieldList.fieldInitializer().map((field) => {
      const fieldName = field.IDENTIFIER().getText();

      // Set expected type for nested initializers
      const savedExpectedType = this.context.expectedType;
      if (structFieldTypes?.has(fieldName)) {
        // Issue #502: Convert underscore format to correct output format
        // C-Next struct fields may store C++ types with _ separator (e.g., SeaDash_Parse_ParseResult)
        // but code generation needs :: for C++ types (e.g., SeaDash::Parse::ParseResult)
        let fieldType = structFieldTypes.get(fieldName)!;
        if (fieldType.includes("_")) {
          // Check if this looks like a qualified type (contains _) and convert
          const parts = fieldType.split("_");
          if (parts.length > 1 && this.isCppScopeSymbol(parts[0])) {
            // It's a C++ namespaced type - convert _ to ::
            fieldType = parts.join("::");
          }
        }
        this.context.expectedType = fieldType;
      }

      const value = this._generateExpression(field.expression());

      // Restore expected type
      this.context.expectedType = savedExpectedType;

      return { fieldName, value };
    });

    // Issue #517: For C++ classes, store assignments for later and return {}
    if (isCppClass) {
      for (const { fieldName, value } of fields) {
        this.pendingCppClassAssignments.push(`${fieldName} = ${value};`);
      }
      return "{}";
    }

    // For C-Next/C structs, generate designated initializer
    const fieldInits = fields.map((f) => `.${f.fieldName} = ${f.value}`);
    return `(${typeName}){ ${fieldInits.join(", ")} }`;
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
      const fillValue = this._generateExpression(ctx.expression()!);
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
        generatedElements.push(this._generateExpression(elem.expression()!));
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
    // ADR-053: Check registry for extracted generator
    const generator = this.registry.getDeclaration("function");
    if (generator) {
      const result = generator(ctx, this.getInput(), this.getState(), this);
      this.applyEffects(result.effects);
      return result.code;
    }

    // Fallback to inline implementation (will be removed after migration)
    const returnType = this._generateType(ctx.type());
    const name = ctx.IDENTIFIER().getText();

    // Issue #269: Set current function name for pass-by-value lookup
    // Include scope prefix for scoped functions
    const fullFuncName = this.context.currentScope
      ? `${this.context.currentScope}_${name}`
      : name;
    this.context.currentFunctionName = fullFuncName;
    // Issue #477: Set return type for enum inference in return statements
    this.context.currentFunctionReturnType = ctx.type().getText();

    // Track parameters for ADR-006 pointer semantics
    this._setParameters(ctx.parameterList() ?? null);

    // Issue #558: modifiedParameters tracking removed - uses analysis-phase results

    // ADR-016: Clear local variables and mark that we're in a function body
    this.context.localVariables.clear();
    this.context.floatBitShadows.clear();
    this.context.floatShadowCurrent.clear();
    this.context.inFunctionBody = true;

    // Check for main function with args parameter (u8 args[][])
    const isMainWithArgs = this._isMainFunctionWithArgs(
      name,
      ctx.parameterList(),
    );

    let params: string = ""; // Will be set below
    let actualReturnType: string;

    // Issue #268: Generate body FIRST to track parameter modifications,
    // then generate parameter list using that tracking info
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
    }

    // Generate body first (this populates modifiedParameters)
    const body = this._generateBlock(ctx.block());

    // Issue #268: Update symbol's parameter info with auto-const before clearing
    this.updateFunctionParamsAutoConst(name);

    // Now generate parameter list (can use modifiedParameters for auto-const)
    if (!isMainWithArgs) {
      params = ctx.parameterList()
        ? this._generateParameterList(ctx.parameterList()!)
        : "void";
    }

    // ADR-016: Clear local variables and mark that we're no longer in a function body
    this.context.inFunctionBody = false;
    this.context.localVariables.clear();
    this.context.floatBitShadows.clear();
    this.context.floatShadowCurrent.clear();
    this.context.mainArgsName = null;
    this.context.currentFunctionName = null; // Issue #269: Clear function name
    this.context.currentFunctionReturnType = null; // Issue #477: Clear return type
    this._clearParameters();

    const functionCode = `${actualReturnType} ${name}(${params}) ${body}\n`;

    // ADR-029: Generate callback typedef only if this function is used as a type
    if (name !== "main" && this._isCallbackTypeUsedAsFieldType(name)) {
      const typedef = this._generateCallbackTypedef(name);
      if (typedef) {
        return functionCode + typedef;
      }
    }

    return functionCode;
  }

  /**
   * ADR-029: Generate typedef for callback type
   */
  private _generateCallbackTypedef(funcName: string): string | null {
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
  private _isMainFunctionWithArgs(
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

  private _generateParameterList(ctx: Parser.ParameterListContext): string {
    return ctx
      .parameter()
      .map((p) => this.generateParameter(p))
      .join(", ");
  }

  private generateParameter(ctx: Parser.ParameterContext): string {
    const constMod = ctx.constModifier() ? "const " : "";
    const typeName = this._getTypeName(ctx.type());
    const name = ctx.IDENTIFIER().getText();
    const dims = ctx.arrayDimension();

    // ADR-029: Check if this is a callback type parameter
    if (this.callbackTypes.has(typeName)) {
      const callbackInfo = this.callbackTypes.get(typeName)!;
      // Callback types are already function pointers, no additional pointer needed
      return `${callbackInfo.typedefName} ${name}`;
    }

    const type = this._generateType(ctx.type());

    // ADR-045: Handle string<N>[] - array of bounded strings becomes 2D char array
    // string<32> arr[5] -> char arr[5][33] (5 elements, each is capacity + 1 chars)
    if (ctx.type().stringType() && dims.length > 0) {
      const stringType = ctx.type().stringType()!;
      const capacity = stringType.INTEGER_LITERAL()
        ? Number.parseInt(stringType.INTEGER_LITERAL()!.getText(), 10)
        : 256; // Default capacity
      const dimStr = dims.map((d) => this._generateArrayDimension(d)).join("");
      return `${constMod}char ${name}${dimStr}[${capacity + 1}]`;
    }

    // Arrays pass naturally as pointers
    if (dims.length > 0) {
      const dimStr = dims.map((d) => this._generateArrayDimension(d)).join("");
      // Issue #268/#558: Add const for unmodified array parameters (uses analysis results)
      const wasModified = this._isCurrentParameterModified(name);
      const autoConst = !wasModified && !constMod ? "const " : "";
      return `${autoConst}${constMod}${type} ${name}${dimStr}`;
    }

    // ADR-040: ISR is already a function pointer typedef, no additional pointer needed
    if (typeName === "ISR") {
      return `${constMod}${type} ${name}`;
    }

    // Float types (f32, f64) use standard C pass-by-value semantics
    if (this._isFloatType(typeName)) {
      return `${constMod}${type} ${name}`;
    }

    // ADR-017: Enum types use standard C pass-by-value semantics
    if (this.symbols!.knownEnums.has(typeName)) {
      return `${constMod}${type} ${name}`;
    }

    // Issue #269: Small unmodified primitives use pass-by-value semantics
    if (
      this.context.currentFunctionName &&
      this._isParameterPassByValueByName(this.context.currentFunctionName, name)
    ) {
      return `${constMod}${type} ${name}`;
    }

    // ADR-045: String parameters (non-array) are passed as char*
    // Issue #551: Handle before unknown type check
    if (ctx.type().stringType() && dims.length === 0) {
      // Issue #268/#558: Add const for unmodified string parameters (uses analysis results)
      const wasModified = this._isCurrentParameterModified(name);
      const autoConst = !wasModified && !constMod ? "const " : "";
      return `${autoConst}${constMod}char* ${name}`;
    }

    // ADR-006: Pass by reference for known struct types and known primitives
    // Issue #551: Unknown types (external enums, typedefs) use pass-by-value
    if (this._isKnownStruct(typeName) || this._isKnownPrimitive(typeName)) {
      // Issue #268/#558: Add const for unmodified pointer parameters (uses analysis results)
      const wasModified = this._isCurrentParameterModified(name);
      const autoConst = !wasModified && !constMod ? "const " : "";
      // Issue #409/#644: In C++ mode, use references (&) instead of pointers (*)
      // This allows C-Next callbacks to match C++ function pointer signatures
      const refOrPtr = this.cppHelper!.refOrPtr();
      return `${autoConst}${constMod}${type}${refOrPtr} ${name}`;
    }

    // Unknown types use pass-by-value (standard C semantics)
    return `${constMod}${type} ${name}`;
  }

  private _generateArrayDimension(ctx: Parser.ArrayDimensionContext): string {
    if (ctx.expression()) {
      // Bug #8: At file scope, resolve const values to numeric literals
      // because C doesn't allow const variables as array sizes at file scope
      if (!this.context.inFunctionBody) {
        const constValue = this._tryEvaluateConstant(ctx.expression()!);
        if (constValue !== undefined) {
          return `[${constValue}]`;
        }
      }
      return `[${this._generateExpression(ctx.expression()!)}]`;
    }
    return "[]";
  }

  /**
   * ADR-036: Generate all array dimensions for multi-dimensional arrays
   * Converts array of ArrayDimensionContext to string like "[4][8]"
   */
  private _generateArrayDimensions(
    dims: Parser.ArrayDimensionContext[],
  ): string {
    return dims.map((d) => this._generateArrayDimension(d)).join("");
  }

  // ========================================================================
  // Variables
  // ========================================================================

  private generateVariableDecl(ctx: Parser.VariableDeclarationContext): string {
    // Issue #375: Check for C++ constructor syntax
    const constructorArgList = ctx.constructorArgumentList();
    if (constructorArgList) {
      return this._generateConstructorDecl(ctx, constructorArgList);
    }

    const constMod = ctx.constModifier() ? "const " : "";
    // ADR-049: Add volatile for atomic variables
    const atomicMod = ctx.atomicModifier() ? "volatile " : "";
    // Explicit volatile modifier
    const volatileMod = ctx.volatileModifier() ? "volatile " : "";
    // Issue #525: Add extern for top-level const in C++ for external linkage
    // In C++, const at file scope has internal linkage by default (like static).
    // To match the extern declaration in the header, we need extern on the definition too.
    const externMod =
      ctx.constModifier() && !this.context.inFunctionBody ? "extern " : "";

    // Error if both atomic and volatile are specified
    if (ctx.atomicModifier() && ctx.volatileModifier()) {
      const line = ctx.start?.line ?? 0;
      throw new Error(
        `Error at line ${line}: Cannot use both 'atomic' and 'volatile' modifiers. ` +
          `Use 'atomic' for ISR-shared variables (includes volatile + atomicity), ` +
          `or 'volatile' for hardware registers and delay loops.`,
      );
    }

    let type = this._generateType(ctx.type());
    const name = ctx.IDENTIFIER().getText();
    const typeCtx = ctx.type();

    // ADR-046: Handle nullable C pointer types (c_ prefix variables)
    // When variable has c_ prefix and is assigned from a struct-pointer-returning
    // function (fopen, freopen, tmpfile), the type needs asterisk (e.g., FILE -> FILE*)
    // Note: char*-returning functions (fgets, strstr) use cstring type instead
    if (name.startsWith("c_") && ctx.expression()) {
      const exprText = ctx.expression()!.getText();
      for (const funcName of NullCheckAnalyzer.getStructPointerFunctions()) {
        if (exprText.includes(`${funcName}(`)) {
          type = `${type}*`;
          break;
        }
      }
    }

    // Track type for bit access and .length support
    // Note: Global variables already registered in registerAllVariableTypes() pass
    // Only track local variables here (declared inside function bodies)
    if (this.context.inFunctionBody) {
      this.trackVariableType(ctx);
      // ADR-016: Track local variables (allowed as bare identifiers inside scopes)
      this.context.localVariables.add(name);

      // Bug #8: Track local const values for array size and bit index resolution
      if (ctx.constModifier() && ctx.expression()) {
        const constValue = this._tryEvaluateConstant(ctx.expression()!);
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
        const capacity = Number.parseInt(intLiteral.getText(), 10);
        const arrayDims = ctx.arrayDimension();

        // Check for string arrays: string<64> arr[4] -> char arr[4][65] = {0};
        if (arrayDims.length > 0) {
          let decl = `${externMod}${constMod}${atomicMod}${volatileMod}char ${name}`;

          // Issue #380: Handle array initializers for string arrays
          if (ctx.expression()) {
            // Reset array init tracking
            this.context.lastArrayInitCount = 0;
            this.context.lastArrayFillValue = undefined;

            // Generate the initializer expression
            const initValue = this._generateExpression(ctx.expression()!);

            // Check if it was an array initializer
            if (
              this.context.lastArrayInitCount > 0 ||
              this.context.lastArrayFillValue !== undefined
            ) {
              const hasEmptyArrayDim = arrayDims.some(
                (dim) => !dim.expression(),
              );

              // Track as local array
              this.context.localArrays.add(name);

              let arraySize: number;
              if (hasEmptyArrayDim) {
                // Size inference: string<10> labels[] <- ["One", "Two"]
                if (this.context.lastArrayFillValue !== undefined) {
                  throw new Error(
                    `Error: Fill-all syntax [${this.context.lastArrayFillValue}*] requires explicit array size`,
                  );
                }
                arraySize = this.context.lastArrayInitCount;
                decl += `[${arraySize}]`;

                // Update type registry with inferred size for .length support
                this.context.typeRegistry.set(name, {
                  baseType: "char",
                  bitWidth: 8,
                  isArray: true,
                  arrayDimensions: [arraySize, capacity + 1],
                  isConst: ctx.constModifier() !== null,
                  isString: true,
                  stringCapacity: capacity,
                });
              } else {
                // Explicit size: string<10> labels[3] <- ["One", "Two", "Three"]
                decl += this._generateArrayDimensions(arrayDims);

                // Validate element count matches declared size
                const firstDimExpr = arrayDims[0].expression();
                if (firstDimExpr) {
                  const sizeText = firstDimExpr.getText();
                  if (/^\d+$/.exec(sizeText)) {
                    const declaredSize = Number.parseInt(sizeText, 10);
                    if (
                      this.context.lastArrayFillValue === undefined &&
                      this.context.lastArrayInitCount !== declaredSize
                    ) {
                      throw new Error(
                        `Error: Array size mismatch - declared [${declaredSize}] but got ${this.context.lastArrayInitCount} elements`,
                      );
                    }
                  }
                }
              }

              decl += `[${capacity + 1}]`; // String capacity + null terminator

              // Handle fill-all syntax: ["Hello"*] -> {"Hello", "Hello", "Hello"}
              let finalInitValue = initValue;
              if (this.context.lastArrayFillValue !== undefined) {
                const firstDimExpr = arrayDims[0].expression();
                if (firstDimExpr) {
                  const sizeText = firstDimExpr.getText();
                  if (/^\d+$/.exec(sizeText)) {
                    const declaredSize = Number.parseInt(sizeText, 10);
                    const fillVal = this.context.lastArrayFillValue;
                    // Only expand if not empty string (C handles {""} correctly for zeroing)
                    if (fillVal !== '""') {
                      const elements = Array(declaredSize).fill(fillVal);
                      finalInitValue = `{${elements.join(", ")}}`;
                    }
                  }
                }
              }

              return `${decl} = ${finalInitValue};`;
            }

            // Non-array-initializer expression (e.g., variable assignment) not supported
            throw new Error(
              `Error: String array initialization from variables not supported`,
            );
          }

          // No initializer - zero-initialize
          decl += this._generateArrayDimensions(arrayDims);
          decl += `[${capacity + 1}]`;
          return `${decl} = {0};`;
        }

        if (ctx.expression()) {
          const exprText = ctx.expression()!.getText();

          // ADR-045: Check for string concatenation
          const concatOps = this._getStringConcatOperands(ctx.expression()!);
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
              ? FormatUtils.indent(this.context.indentLevel)
              : "";
            const lines: string[] = [];
            lines.push(
              `${constMod}char ${name}[${capacity + 1}] = "";`,
              `${indent}strncpy(${name}, ${concatOps.left}, ${capacity});`,
              `${indent}strncat(${name}, ${concatOps.right}, ${capacity} - strlen(${name}));`,
              `${indent}${name}[${capacity}] = ${C_NULL_CHAR};`,
            );
            return lines.join("\n");
          }

          // ADR-045: Check for substring extraction
          const substringOps = this._getSubstringOperands(ctx.expression()!);
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
            const startNum = Number.parseInt(substringOps.start, 10);
            const lengthNum = Number.parseInt(substringOps.length, 10);

            // Only validate bounds if both start and length are compile-time constants
            if (!Number.isNaN(startNum) && !Number.isNaN(lengthNum)) {
              // Bounds check: start + length <= sourceCapacity
              if (startNum + lengthNum > substringOps.sourceCapacity) {
                throw new Error(
                  `Error: Substring bounds [${startNum}, ${lengthNum}] exceed source string<${substringOps.sourceCapacity}> capacity`,
                );
              }
            }

            // Validate destination capacity can hold the substring
            if (!Number.isNaN(lengthNum) && lengthNum > capacity) {
              throw new Error(
                `Error: Substring length ${lengthNum} exceeds destination string<${capacity}> capacity`,
              );
            }

            // Generate safe substring extraction code
            const indent = this.context.inFunctionBody
              ? FormatUtils.indent(this.context.indentLevel)
              : "";
            const lines: string[] = [];
            lines.push(
              `${constMod}char ${name}[${capacity + 1}] = "";`,
              `${indent}strncpy(${name}, ${substringOps.source} + ${substringOps.start}, ${substringOps.length});`,
              `${indent}${name}[${substringOps.length}] = ${C_NULL_CHAR};`,
            );
            return lines.join("\n");
          }

          // Validate string literal fits capacity
          if (exprText.startsWith('"') && exprText.endsWith('"')) {
            // Extract content without quotes, accounting for escape sequences
            const content = this._getStringLiteralLength(exprText);
            if (content > capacity) {
              throw new Error(
                `Error: String literal (${content} chars) exceeds string<${capacity}> capacity`,
              );
            }
          }

          // Check for string variable assignment
          const srcCapacity = this._getStringExprCapacity(exprText);
          if (srcCapacity !== null && srcCapacity > capacity) {
            throw new Error(
              `Error: Cannot assign string<${srcCapacity}> to string<${capacity}> (potential truncation)`,
            );
          }

          return `${externMod}${constMod}char ${name}[${capacity + 1}] = ${this._generateExpression(ctx.expression()!)};`;
        } else {
          // Empty string initialization
          return `${externMod}${constMod}char ${name}[${capacity + 1}] = "";`;
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
        const inferredCapacity = this._getStringLiteralLength(exprText);
        this.requireInclude("string");

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

        return `${externMod}const char ${name}[${inferredCapacity + 1}] = ${exprText};`;
      }
    }

    let decl = `${externMod}${constMod}${atomicMod}${volatileMod}${type} ${name}`;
    // ADR-036: arrayDimension() now returns an array for multi-dimensional support
    const arrayDims = ctx.arrayDimension();
    const isArray = arrayDims.length > 0;
    const hasEmptyArrayDim =
      isArray && arrayDims.some((dim) => !dim.expression());
    let declaredSize: number | null = null;

    // Get first dimension size for simple validation (multi-dim validation is more complex)
    if (isArray && arrayDims[0].expression()) {
      const sizeText = arrayDims[0].expression()!.getText();
      if (/^\d+$/.exec(sizeText)) {
        declaredSize = Number.parseInt(sizeText, 10);
      }
    }

    // ADR-035: Handle array initializers with size inference
    if (isArray && ctx.expression()) {
      // Reset array init tracking
      this.context.lastArrayInitCount = 0;
      this.context.lastArrayFillValue = undefined;

      // Generate the initializer expression (may be array initializer)
      const typeName = this._getTypeName(typeCtx);
      const savedExpectedType = this.context.expectedType;
      this.context.expectedType = typeName;

      const initValue = this._generateExpression(ctx.expression()!);

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
          decl += this._generateArrayDimensions(arrayDims);

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
      decl += this._generateArrayDimensions(arrayDims);
      // ADR-006: Track local arrays (they don't need & when passed to functions)
      this.context.localArrays.add(name);
    }

    if (ctx.expression()) {
      // Explicit initializer provided
      // Set expected type for inferred struct initializers
      const typeName = this._getTypeName(typeCtx);
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
        if (this._isIntegerExpression(ctx.expression()!)) {
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
          // Issue #478: Handle global.Enum.MEMBER pattern
          else if (parts[0] === "global" && parts.length >= 3) {
            // global.ECategory.CAT_A -> ECategory
            const globalEnumName = parts[1];
            if (globalEnumName === typeName) {
              // Valid global.Enum.Member access
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
      if (this._isIntegerType(typeName)) {
        const exprText = ctx.expression()!.getText().trim();
        // Check if it's a direct literal (not a variable or expression)
        if (
          /^-?\d+$/.exec(exprText) ||
          /^0[xX][0-9a-fA-F]+$/.exec(exprText) ||
          /^0[bB][01]+$/.exec(exprText)
        ) {
          this._validateLiteralFitsType(exprText, typeName);
        } else {
          // Not a literal - check for narrowing/sign conversions
          const sourceType = this.getExpressionType(ctx.expression()!);
          this._validateTypeConversion(typeName, sourceType);
        }
      }

      decl += ` = ${this._generateExpression(ctx.expression()!)}`;

      // Restore expected type
      this.context.expectedType = savedExpectedType;
    } else {
      // ADR-015: Zero initialization for uninitialized variables
      decl += ` = ${this._getZeroInitializer(typeCtx, isArray)}`;
    }

    // Issue #517: Emit pending C++ class field assignments
    // Only emit as separate statements inside function bodies - global scope can't have statements
    if (this.pendingCppClassAssignments.length > 0) {
      if (this.context.inFunctionBody) {
        const assignments = this.pendingCppClassAssignments
          .map((a) => `${name}.${a}`)
          .join("\n");
        this.pendingCppClassAssignments = [];
        return `${decl};\n${assignments}`;
      } else {
        // At global scope, we can't emit assignment statements.
        // Clear pending assignments and throw an error for unsupported pattern.
        this.pendingCppClassAssignments = [];
        throw new Error(
          `Error: C++ class '${this._getTypeName(typeCtx)}' with constructor cannot use struct initializer ` +
            `syntax at global scope. Use constructor syntax or initialize fields separately.`,
        );
      }
    }

    return decl + ";";
  }

  /**
   * Issue #375: Generate C++ constructor-style declaration
   * Validates that all arguments are const variables.
   * Example: `Adafruit_MAX31856 thermocouple(pinConst);` -> `Adafruit_MAX31856 thermocouple(pinConst);`
   */
  private _generateConstructorDecl(
    ctx: Parser.VariableDeclarationContext,
    argListCtx: Parser.ConstructorArgumentListContext,
  ): string {
    const type = this._generateType(ctx.type());
    const name = ctx.IDENTIFIER().getText();
    const line = ctx.start?.line ?? 0;

    // Collect and validate all arguments
    const argIdentifiers = argListCtx.IDENTIFIER();
    const resolvedArgs: string[] = [];

    for (const argNode of argIdentifiers) {
      const argName = argNode.getText();

      // Check if it exists in type registry
      const typeInfo = this.context.typeRegistry.get(argName);

      // Also check scoped variables if inside a scope
      let scopedArgName = argName;
      let scopedTypeInfo = typeInfo;
      if (!typeInfo && this.context.currentScope) {
        scopedArgName = `${this.context.currentScope}_${argName}`;
        scopedTypeInfo = this.context.typeRegistry.get(scopedArgName);
      }

      if (!typeInfo && !scopedTypeInfo) {
        throw new Error(
          `Error at line ${line}: Constructor argument '${argName}' is not declared`,
        );
      }

      const finalTypeInfo = typeInfo ?? scopedTypeInfo!;
      const finalArgName = typeInfo ? argName : scopedArgName;

      // Check if it's const
      if (!finalTypeInfo.isConst) {
        throw new Error(
          `Error at line ${line}: Constructor argument '${argName}' must be const. ` +
            `C++ constructors in C-Next only accept const variables.`,
        );
      }

      resolvedArgs.push(finalArgName);
    }

    // Track the variable in type registry (as an external C++ type)
    this.context.typeRegistry.set(name, {
      baseType: type,
      bitWidth: 0, // Unknown for C++ types
      isArray: false,
      arrayDimensions: [],
      isConst: false,
      isExternalCppType: true,
    });

    // Track as local variable if inside function body
    if (this.context.inFunctionBody) {
      this.context.localVariables.add(name);
    }

    return `${type} ${name}(${resolvedArgs.join(", ")});`;
  }

  /**
   * ADR-015: Get the appropriate zero initializer for a type
   * ADR-017: Handle enum types by initializing to first member
   */
  private _getZeroInitializer(
    typeCtx: Parser.TypeContext,
    isArray: boolean,
  ): string {
    // Issue #379: Arrays need element type checking for C++ classes
    // C++ class arrays must use {} instead of {0}
    if (isArray) {
      // Check if element type is a C++ class or template type
      if (typeCtx.userType()) {
        const typeName = typeCtx.userType()!.getText();
        // Use {} for C++ types (external libraries with constructors)
        if (this.isCppType(typeName)) {
          return "{}";
        }
        // In C++ mode, unknown user types may have non-trivial constructors
        if (this.cppMode && !this._isKnownStruct(typeName)) {
          return "{}";
        }
      }
      // Template types are always C++ classes
      if (typeCtx.templateType()) {
        return "{}";
      }
      // Default: POD arrays use {0}
      return "{0}";
    }

    // ADR-016: Check for scoped types (this.Type)
    // These are always struct/enum types defined in a scope
    if (typeCtx.scopedType()) {
      const localTypeName = typeCtx.scopedType()!.IDENTIFIER().getText();
      const fullTypeName = this.context.currentScope
        ? `${this.context.currentScope}_${localTypeName}`
        : localTypeName;

      // Check if it's an enum
      if (this.symbols!.knownEnums.has(fullTypeName)) {
        const members = this.symbols!.enumMembers.get(fullTypeName);
        if (members) {
          for (const [memberName, value] of members.entries()) {
            if (value === 0) {
              return `${fullTypeName}_${memberName}`;
            }
          }
          const firstMember = members.keys().next().value;
          if (firstMember) {
            return `${fullTypeName}_${firstMember}`;
          }
        }
        return `(${fullTypeName})0`;
      }

      // Otherwise it's a struct - use {0}
      return "{0}";
    }

    // Issue #478: Check for global types (global.Type)
    if (typeCtx.globalType()) {
      const fullTypeName = typeCtx.globalType()!.IDENTIFIER().getText();

      // Check if it's an enum
      if (this.symbols!.knownEnums.has(fullTypeName)) {
        const members = this.symbols!.enumMembers.get(fullTypeName);
        if (members) {
          for (const [memberName, value] of members.entries()) {
            if (value === 0) {
              return `${fullTypeName}_${memberName}`;
            }
          }
          const firstMember = members.keys().next().value;
          if (firstMember) {
            return `${fullTypeName}_${firstMember}`;
          }
        }
        return `(${fullTypeName})0`;
      }

      // Otherwise it's a struct - use {0}
      return "{0}";
    }

    // ADR-016: Check for qualified types (Scope.Type)
    // Issue #388: Also handles C++ namespace types (MockLib.Parse.ParseResult)
    if (typeCtx.qualifiedType()) {
      const qualifiedCtx = typeCtx.qualifiedType()!;
      const parts = qualifiedCtx.IDENTIFIER();
      const identifierNames = parts.map((id) => id.getText());
      const fullTypeName = this.resolveQualifiedType(identifierNames);

      // Check if it's an enum
      if (this.symbols!.knownEnums.has(fullTypeName)) {
        const members = this.symbols!.enumMembers.get(fullTypeName);
        if (members) {
          for (const [memberName, value] of members.entries()) {
            if (value === 0) {
              // For C++ enums, use :: separator; for C-Next enums, use _
              const separator = fullTypeName.includes("::") ? "::" : "_";
              return `${fullTypeName}${separator}${memberName}`;
            }
          }
          const firstMember = members.keys().next().value;
          if (firstMember) {
            const separator = fullTypeName.includes("::") ? "::" : "_";
            return `${fullTypeName}${separator}${firstMember}`;
          }
        }
        return `(${fullTypeName})0`;
      }

      // Otherwise it's a struct - use {0}
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

      // Issue #304: C++ types with constructors may fail with {0}
      // Use {} for C++ types, {0} for C types
      if (this.isCppType(typeName)) {
        return "{}";
      }

      // Issue #309: In C++ mode, unknown user types (external libraries)
      // should use {} instead of {0} because they may have non-trivial
      // constructors. Known structs (C-Next or C headers) are POD types
      // where {0} works fine.
      if (this.cppMode && !this._isKnownStruct(typeName)) {
        return "{}";
      }

      return "{0}";
    }

    // Issue #295: C++ template types use value initialization {}
    // Template types like FlexCAN_T4<CAN1, RX_SIZE_256, TX_SIZE_16> are non-trivial
    // class types that cannot be initialized with = 0
    if (typeCtx.templateType()) {
      return "{}";
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
   * @param isF64 If true, generate 64-bit masks with ULL suffix (for f64 bit indexing)
   */
  // ========================================================================
  // Statements
  // Issue #644: _generateBitMask removed, now delegating to BitUtils.generateMask
  // ========================================================================

  private _generateBlock(ctx: Parser.BlockContext): string {
    const lines: string[] = ["{"];
    const innerIndent = "    "; // One level of relative indentation

    for (const stmt of ctx.statement()) {
      // Temporarily increment for any nested context that needs absolute level
      this.context.indentLevel++;
      const stmtCode = this._generateStatement(stmt);
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

  private _generateStatement(ctx: Parser.StatementContext): string {
    let result = "";

    if (ctx.variableDeclaration()) {
      result = this.generateVariableDecl(ctx.variableDeclaration()!);
    } else if (ctx.assignmentStatement()) {
      result = this.generateAssignment(ctx.assignmentStatement()!);
    } else if (ctx.expressionStatement()) {
      result =
        this._generateExpression(ctx.expressionStatement()!.expression()) + ";";
    } else if (ctx.ifStatement()) {
      result = this.generateIf(ctx.ifStatement()!);
    } else if (ctx.whileStatement()) {
      result = this.generateWhile(ctx.whileStatement()!);
    } else if (ctx.doWhileStatement()) {
      result = this.generateDoWhile(ctx.doWhileStatement()!);
    } else if (ctx.forStatement()) {
      result = this.generateFor(ctx.forStatement()!);
    } else if (ctx.switchStatement()) {
      result = this.generateSwitch(ctx.switchStatement()!);
    } else if (ctx.returnStatement()) {
      result = this.generateReturn(ctx.returnStatement()!);
    } else if (ctx.criticalStatement()) {
      // ADR-050: Critical statement for atomic multi-variable operations
      result = this.generateCriticalStatement(ctx.criticalStatement()!);
    } else if (ctx.block()) {
      result = this._generateBlock(ctx.block()!);
    }

    // Issue #250: Prepend any pending temp variable declarations (C++ mode)
    if (this.pendingTempDeclarations.length > 0) {
      const tempDecls = this.pendingTempDeclarations.join("\n");
      this.pendingTempDeclarations = [];
      return tempDecls + "\n" + result;
    }

    return result;
  }

  // ADR-109: Build handler dependencies for assignment dispatch
  private buildHandlerDeps(): IHandlerDeps {
    return {
      symbols: this.symbols!,
      typeRegistry: this.context.typeRegistry,
      currentScope: this.context.currentScope,
      currentParameters: this.context.currentParameters,
      targetCapabilities: this.context.targetCapabilities,
      generateExpression: (ctx) => this._generateExpression(ctx),
      tryEvaluateConstant: (ctx) => this._tryEvaluateConstant(ctx),
      generateAssignmentTarget: (ctx) => this._generateAssignmentTarget(ctx),
      isKnownStruct: (name) => this.isKnownStruct(name),
      isKnownScope: (name) => this.symbols!.knownScopes.has(name),
      getMemberTypeInfo: (structType, memberName) => {
        const fields = this.symbols!.structFields.get(structType);
        const fieldType = fields?.get(memberName);
        if (fieldType) {
          const dims =
            this.symbols!.structFieldDimensions.get(structType)?.get(
              memberName,
            );
          return {
            baseType: fieldType,
            bitWidth: TYPE_WIDTH[fieldType] ?? 32,
            isConst: false,
            isArray:
              this.symbols!.structFieldArrays.get(structType)?.has(
                memberName,
              ) ?? false,
            arrayDimensions: dims ? [...dims] : undefined,
          };
        }
        return null;
      },
      validateBitmapFieldLiteral: (expr, width, fieldName) =>
        this.typeValidator!.validateBitmapFieldLiteral(expr, width, fieldName),
      validateCrossScopeVisibility: (scopeName, memberName) =>
        this.validateCrossScopeVisibility(scopeName, memberName),
      checkArrayBounds: (arrayName, dimensions, indexExprs, line) =>
        this.typeValidator!.checkArrayBounds(
          arrayName,
          [...dimensions],
          [...indexExprs],
          line,
          (expr) => this._tryEvaluateConstant(expr),
        ),
      analyzeMemberChainForBitAccess: (targetCtx) =>
        this.analyzeMemberChainForBitAccess(targetCtx),
      generateFloatBitWrite: (name, typeInfo, bitIndex, width, value) =>
        this.generateFloatBitWrite(name, typeInfo, bitIndex, width, value),
      foldBooleanToInt: (expr) => this.foldBooleanToInt(expr),
      markNeedsString: () => {
        this.requireInclude("string");
      },
      markClampOpUsed: (op, typeName) => this.markClampOpUsed(op, typeName),
      generateAtomicRMW: (target, cOp, value, typeInfo) =>
        this.generateAtomicRMW(target, cOp, value, typeInfo),
    };
  }

  /**
   * Analyze a member chain target to detect bit access at the end.
   * For patterns like grid[2][3].flags[0], detects that [0] is bit access.
   *
   * Uses the same tree-walking approach as generateMemberAccess to correctly
   * track which expressions belong to which identifiers in the chain.
   */
  private analyzeMemberChainForBitAccess(
    targetCtx: Parser.AssignmentTargetContext,
  ): {
    isBitAccess: boolean;
    baseTarget?: string;
    bitIndex?: string;
    baseType?: string;
  } {
    const memberAccessCtx = targetCtx.memberAccess();
    if (!memberAccessCtx) {
      return { isBitAccess: false };
    }

    const parts = memberAccessCtx.IDENTIFIER().map((id) => id.getText());
    const expressions = memberAccessCtx.expression();
    const children = memberAccessCtx.children;

    if (!children || parts.length < 1 || expressions.length === 0) {
      return { isBitAccess: false };
    }

    // Walk the parse tree to determine if the LAST expression is bit access
    // This mirrors the logic in generateMemberAccess
    const firstPart = parts[0];
    const firstTypeInfo = this.context.typeRegistry.get(firstPart);

    let currentStructType: string | undefined;
    if (firstTypeInfo) {
      currentStructType = this.isKnownStruct(firstTypeInfo.baseType)
        ? firstTypeInfo.baseType
        : undefined;
    }

    let result = firstPart;
    let idIndex = 1;
    let exprIndex = 0;
    let lastMemberType: string | undefined;
    let lastMemberIsArray = false;

    let i = 1;
    while (i < children.length) {
      const childText = children[i].getText();

      if (childText === ".") {
        // Dot - next child is identifier
        i++;
        if (i < children.length && idIndex < parts.length) {
          const memberName = parts[idIndex];
          result += `.${memberName}`;
          idIndex++;

          // Update type tracking
          if (currentStructType) {
            const fields = this.symbols!.structFields.get(currentStructType);
            lastMemberType = fields?.get(memberName);
            const arrayFields =
              this.symbols!.structFieldArrays.get(currentStructType);
            lastMemberIsArray = arrayFields?.has(memberName) ?? false;

            if (lastMemberType && this.isKnownStruct(lastMemberType)) {
              currentStructType = lastMemberType;
            } else {
              currentStructType = undefined;
            }
          }
        }
      } else if (childText === "[") {
        // Opening bracket - check if this is bit access
        const isPrimitiveInt =
          lastMemberType &&
          !lastMemberIsArray &&
          TypeCheckUtils.isInteger(lastMemberType);
        const isLastExpr = exprIndex === expressions.length - 1;

        if (isPrimitiveInt && isLastExpr && exprIndex < expressions.length) {
          // This is bit access on a struct member
          const bitIndex = this._generateExpression(expressions[exprIndex]);
          return {
            isBitAccess: true,
            baseTarget: result,
            bitIndex,
            baseType: lastMemberType,
          };
        }

        // Normal array subscript
        if (exprIndex < expressions.length) {
          const expr = this._generateExpression(expressions[exprIndex]);
          result += `[${expr}]`;
          exprIndex++;

          // After subscripting an array, update type tracking
          if (firstTypeInfo?.isArray && exprIndex === 1) {
            const elementType = firstTypeInfo.baseType;
            if (this.isKnownStruct(elementType)) {
              currentStructType = elementType;
            }
          }
        }
        // Skip to closing bracket
        while (i < children.length && children[i].getText() !== "]") {
          i++;
        }
      }
      i++;
    }

    return { isBitAccess: false };
  }

  /**
   * Generate float bit write using shadow variable + memcpy.
   * Returns null if typeInfo is not a float type.
   *
   * For single bit: width is null, uses bitIndex only
   * For bit range: width is provided, uses bitIndex as start position
   */
  private generateFloatBitWrite(
    name: string,
    typeInfo: TTypeInfo,
    bitIndex: string,
    width: string | null,
    value: string,
  ): string | null {
    const isFloatType =
      typeInfo.baseType === "f32" || typeInfo.baseType === "f64";
    if (!isFloatType) {
      return null;
    }

    this.requireInclude("string"); // For memcpy
    this.requireInclude("float_static_assert"); // For size verification

    const isF64 = typeInfo.baseType === "f64";
    const shadowType = isF64 ? "uint64_t" : "uint32_t";
    const shadowName = `__bits_${name}`;
    const maskSuffix = isF64 ? "ULL" : "U";

    // Check if shadow variable needs declaration
    const needsDeclaration = !this.context.floatBitShadows.has(shadowName);
    if (needsDeclaration) {
      this.context.floatBitShadows.add(shadowName);
    }

    // Check if shadow already has current value (skip redundant memcpy read)
    const shadowIsCurrent = this.context.floatShadowCurrent.has(shadowName);

    const decl = needsDeclaration ? `${shadowType} ${shadowName}; ` : "";
    const readMemcpy = shadowIsCurrent
      ? ""
      : `memcpy(&${shadowName}, &${name}, sizeof(${name})); `;

    // Mark shadow as current after this write
    this.context.floatShadowCurrent.add(shadowName);

    if (width === null) {
      // Single bit assignment: floatVar[3] <- true
      return (
        `${decl}${readMemcpy}` +
        `${shadowName} = (${shadowName} & ~(1${maskSuffix} << ${bitIndex})) | ((${shadowType})${this.foldBooleanToInt(value)} << ${bitIndex}); ` +
        `memcpy(&${name}, &${shadowName}, sizeof(${name}));`
      );
    } else {
      // Bit range assignment: floatVar[0, 8] <- b0
      const mask = this.generateBitMask(width, isF64);
      return (
        `${decl}${readMemcpy}` +
        `${shadowName} = (${shadowName} & ~(${mask} << ${bitIndex})) | (((${shadowType})${value} & ${mask}) << ${bitIndex}); ` +
        `memcpy(&${name}, &${shadowName}, sizeof(${name}));`
      );
    }
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

    // Issue #452: Set expected type for member access targets (e.g., config.status <- value)
    // This enables type-aware resolution of unqualified enum members
    // Walk the chain of struct types for nested access (e.g., config.nested.field)
    if (targetCtx.memberAccess()) {
      const memberAccessCtx = targetCtx.memberAccess()!;
      const identifiers = memberAccessCtx.IDENTIFIER();
      if (identifiers.length >= 2) {
        const rootName = identifiers[0].getText();
        const rootTypeInfo = this.context.typeRegistry.get(rootName);
        if (rootTypeInfo && this.isKnownStruct(rootTypeInfo.baseType)) {
          let currentStructType: string | undefined = rootTypeInfo.baseType;
          // Walk through each member in the chain to find the final field's type
          for (let i = 1; i < identifiers.length && currentStructType; i++) {
            const memberName = identifiers[i].getText();
            const structFieldTypes =
              this.symbols!.structFields.get(currentStructType);
            if (structFieldTypes?.has(memberName)) {
              const memberType = structFieldTypes.get(memberName)!;
              if (i === identifiers.length - 1) {
                // Last field in chain - this is the assignment target's type
                this.context.expectedType = memberType;
              } else if (this.isKnownStruct(memberType)) {
                // Intermediate field - continue walking if it's a struct
                currentStructType = memberType;
              } else {
                // Intermediate field is not a struct - can't walk further
                break;
              }
            } else {
              break;
            }
          }
        }
      }
    }

    const value = this._generateExpression(ctx.expression());

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

      // Issue #558: Parameter modification tracking removed - uses analysis-phase results

      // Invalidate float shadow when variable is assigned directly
      const shadowName = `__bits_${id}`;
      this.context.floatShadowCurrent.delete(shadowName);

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
        if (this._isIntegerExpression(ctx.expression())) {
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
          // Issue #478: Handle global.Enum.MEMBER pattern
          else if (parts[0] === "global" && parts.length >= 3) {
            // global.ECategory.CAT_A -> ECategory
            const globalEnumName = parts[1];
            if (globalEnumName !== targetEnumType) {
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
        this._isIntegerType(targetTypeInfo.baseType)
      ) {
        const exprText = ctx.expression().getText().trim();
        // Check if it's a direct literal
        if (
          /^-?\d+$/.exec(exprText) ||
          /^0[xX][0-9a-fA-F]+$/.exec(exprText) ||
          /^0[bB][01]+$/.exec(exprText)
        ) {
          this._validateLiteralFitsType(exprText, targetTypeInfo.baseType);
        } else {
          // Not a literal - check for narrowing/sign conversions
          const sourceType = this.getExpressionType(ctx.expression());
          this._validateTypeConversion(targetTypeInfo.baseType, sourceType);
        }
      }
    }

    // Check array element assignment - validate the array is not const
    if (targetCtx.arrayAccess()) {
      const arrayAccessCtx = targetCtx.arrayAccess()!;
      const arrayName = arrayAccessCtx.IDENTIFIER().getText();
      const constError = this.typeValidator!.checkConstAssignment(arrayName);
      if (constError) {
        throw new Error(`${constError} (array element)`);
      }

      // ADR-036: Compile-time bounds checking for single-dimensional arrays
      const typeInfo = this.context.typeRegistry.get(arrayName);
      if (typeInfo?.isArray && typeInfo.arrayDimensions) {
        this.typeValidator!.checkArrayBounds(
          arrayName,
          typeInfo.arrayDimensions,
          arrayAccessCtx.expression(),
          ctx.start?.line ?? 0,
          (expr) => this._tryEvaluateConstant(expr),
        );
      }

      // Issue #558: Parameter modification tracking removed - uses analysis-phase results
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

        // Issue #558: Parameter modification tracking removed - uses analysis-phase results

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
                  this._isCallbackTypeUsedAsFieldType(funcName),
              );
            }
          }
        }
      }
    }

    // ADR-109: Dispatch to assignment handlers
    // Build context, classify, and dispatch - all patterns handled by handlers
    const assignCtx = buildAssignmentContext(ctx, {
      typeRegistry: this.context.typeRegistry,
      generateExpression: () => value,
    });
    const handlerDeps = this.buildHandlerDeps();
    const classifier = new AssignmentClassifier({
      symbols: handlerDeps.symbols,
      typeRegistry: handlerDeps.typeRegistry,
      currentScope: handlerDeps.currentScope,
      isKnownStruct: handlerDeps.isKnownStruct,
      isKnownScope: handlerDeps.isKnownScope,
      getMemberTypeInfo: handlerDeps.getMemberTypeInfo,
    });
    const assignmentKind = classifier.classify(assignCtx);
    const handler = assignmentHandlers.getHandler(assignmentKind);
    return handler(assignCtx, handlerDeps);
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
    const result = atomicGenerators.generateAtomicRMW(
      target,
      cOp,
      value,
      typeInfo,
      this.context.targetCapabilities,
    );
    this.applyEffects(result.effects);
    return result.code;
  }

  private _generateAssignmentTarget(
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
    // Issue #387: Handle memberAccess and arrayAccess alternatives first
    // These are separate sub-rules in the grammar (not unified with postfixTargetOp)
    if (ctx.memberAccess()) {
      return this.generateMemberAccess(ctx.memberAccess()!);
    }
    if (ctx.arrayAccess()) {
      return this.generateArrayAccess(ctx.arrayAccess()!);
    }

    const hasGlobal = ctx.GLOBAL() !== null;
    const hasThis = ctx.THIS() !== null;
    const identifier = ctx.IDENTIFIER()?.getText();
    const postfixOps = ctx.postfixTargetOp();

    // Handle simple identifier (no postfix operations, no prefix)
    if (!hasGlobal && !hasThis && postfixOps.length === 0) {
      const id = identifier!;

      // ADR-006: Check if it's a function parameter
      const paramInfo = this.context.currentParameters.get(id);
      if (paramInfo) {
        // ADR-029: Callback parameters don't need dereferencing (they're function pointers)
        if (paramInfo.isCallback) {
          return id;
        }
        // Float types use pass-by-value, no dereference needed
        if (this._isFloatType(paramInfo.baseType)) {
          return id;
        }
        // Enum types use pass-by-value, no dereference needed
        if (this.symbols!.knownEnums.has(paramInfo.baseType)) {
          return id;
        }
        // Issue #269: Small unmodified primitives use pass-by-value, no dereference needed
        if (
          this.context.currentFunctionName &&
          this._isParameterPassByValueByName(
            this.context.currentFunctionName,
            id,
          )
        ) {
          return id;
        }
        // Issue #551: Dereference only known primitives (pass-by-reference)
        // - Structs use -> notation for member access (no dereference here)
        // - Unknown types (external enums, typedefs) use pass-by-value
        if (
          !paramInfo.isArray &&
          !paramInfo.isStruct &&
          this._isKnownPrimitive(paramInfo.baseType)
        ) {
          // Issue #558/#644: In C++ mode, primitives that become references don't need dereferencing
          return this.cppHelper!.maybeDereference(id);
        }
        return id;
      }

      // Check if it's a local variable
      const isLocalVariable = this.context.localVariables.has(id);

      // ADR-016: Resolve bare identifier using local -> scope -> global priority
      const resolved = this.typeValidator!.resolveBareIdentifier(
        id,
        isLocalVariable,
        (name: string) => this.isKnownStruct(name),
      );

      // If resolved to a different name, use it
      if (resolved !== null) {
        return resolved;
      }

      return id;
    }

    // Build base identifier with scope prefix if needed
    let result: string;
    let firstId = identifier!;

    if (hasGlobal) {
      // global.x - firstId is x, no prefix needed for code generation
      result = firstId;
    } else if (hasThis) {
      if (!this.context.currentScope) {
        throw new Error("Error: 'this' can only be used inside a scope");
      }
      // this.x - prefix with current scope
      result = `${this.context.currentScope}_${firstId}`;
    } else {
      // Bare identifier with postfix ops
      result = firstId;

      // ADR-006: Check if it's a function parameter (for -> access)
      const paramInfo = this.context.currentParameters.get(firstId);
      if (paramInfo && !paramInfo.isArray && paramInfo.isStruct) {
        // Struct parameter needs (*param) when accessed alone, but -> when accessing members
        // We'll handle the -> separator in the postfix processing
      }
    }

    // No postfix operations - return base
    if (postfixOps.length === 0) {
      return result;
    }

    // Determine separator options for first postfix operation
    const isCrossScope =
      hasGlobal &&
      (this.isKnownScope(firstId) || this.symbols!.knownRegisters.has(firstId));
    const paramInfo = this.context.currentParameters.get(firstId);
    const isStructParam = paramInfo?.isStruct ?? false;
    const isCppAccess = hasGlobal && this.isCppScopeSymbol(firstId);

    // Issue #387: Check if this is a scoped register (this.MOTOR_REG -> Scope_MOTOR_REG)
    const scopedRegName =
      hasThis && this.context.currentScope
        ? `${this.context.currentScope}_${firstId}`
        : null;
    const isScopedRegister =
      scopedRegName && this.symbols!.knownRegisters.has(scopedRegName);

    // Process postfix operations in order
    let identifierChain: string[] = [firstId]; // Track all identifiers for register detection
    let isFirstOp = true;

    for (const op of postfixOps) {
      if (op.IDENTIFIER()) {
        // Member access: .identifier
        const memberName = op.IDENTIFIER()!.getText();
        identifierChain.push(memberName);

        // Determine the appropriate separator
        let separator: string;
        if (isFirstOp) {
          if (isCppAccess) {
            separator = "::";
          } else if (isStructParam) {
            // Issue #409: Use centralized helper for C/C++ struct param access
            separator = memberAccessChain.getStructParamSeparator({
              cppMode: this.cppMode,
            });
          } else if (isCrossScope) {
            separator = "_";
          } else if (
            hasGlobal &&
            this.symbols!.knownRegisters.has(identifierChain[0])
          ) {
            // Register member access: GPIO7.DR_SET -> GPIO7_DR_SET
            separator = "_";
          } else if (hasGlobal && this.isKnownScope(identifierChain[0])) {
            // ADR-016: Validate visibility before allowing cross-scope access
            this.validateCrossScopeVisibility(identifierChain[0], memberName);
            separator = "_";
          } else if (isScopedRegister) {
            // Issue #387: Scoped register member access: this.MOTOR_REG.SPEED -> Scope_MOTOR_REG_SPEED
            separator = "_";
          } else {
            separator = ".";
          }
          isFirstOp = false;
        } else {
          // After first separator, check for register chains (GPIO7_DR) or struct fields
          const chainSoFar = identifierChain.slice(0, -1).join("_");
          if (
            this.symbols!.knownRegisters.has(identifierChain[0]) ||
            this.symbols!.knownRegisters.has(chainSoFar) ||
            (scopedRegName && this.symbols!.knownRegisters.has(scopedRegName))
          ) {
            separator = "_";
          } else {
            separator = ".";
          }
        }

        result += `${separator}${memberName}`;
      } else {
        // Array subscript or bit range: [expr] or [expr, expr]
        const expressions = op.expression();
        if (expressions.length === 1) {
          // Single subscript: array access or single bit
          const indexExpr = this._generateExpression(expressions[0]);
          result += `[${indexExpr}]`;
        } else if (expressions.length === 2) {
          // Bit range: [start, width]
          const start = this._generateExpression(expressions[0]);
          const width = this._generateExpression(expressions[1]);
          result += `[${start}, ${width}]`;
        }
        isFirstOp = false;
      }
    }

    return result;
  }

  // ADR-016: Validate cross-scope visibility (issue #165)
  private _validateCrossScopeVisibility(
    scopeName: string,
    memberName: string,
  ): void {
    // Skip if accessing own scope (via this.)
    if (this.context.currentScope === scopeName) return;

    const visibility =
      this.symbols!.scopeMemberVisibility.get(scopeName)?.get(memberName);
    if (visibility === "private") {
      const context = this.context.currentScope
        ? `from scope '${this.context.currentScope}'`
        : "from outside the scope";
      throw new Error(
        `Cannot access private member '${memberName}' of scope '${scopeName}' ${context}. ` +
          `Only public members are accessible outside their scope.`,
      );
    }
  }

  // Issue #387: Dead methods removed (generateGlobalMemberAccess, generateGlobalArrayAccess,
  // generateThisMemberAccess, generateThisArrayAccess) - now handled by unified doGenerateAssignmentTarget

  private generateIf(ctx: Parser.IfStatementContext): string {
    return this.invokeStatement("if", ctx);
  }

  private generateWhile(ctx: Parser.WhileStatementContext): string {
    return this.invokeStatement("while", ctx);
  }

  private generateDoWhile(ctx: Parser.DoWhileStatementContext): string {
    return this.invokeStatement("do-while", ctx);
  }

  private generateFor(ctx: Parser.ForStatementContext): string {
    return this.invokeStatement("for", ctx);
  }

  private generateReturn(ctx: Parser.ReturnStatementContext): string {
    return this.invokeStatement("return", ctx);
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
    return this.invokeStatement("critical", ctx);
  }

  // Issue #63: validateNoEarlyExits moved to TypeValidator

  // ========================================================================
  // Switch Statements (ADR-025)
  // ========================================================================

  private generateSwitch(ctx: Parser.SwitchStatementContext): string {
    return this.invokeStatement("switch", ctx);
  }

  private generateSwitchCase(ctx: Parser.SwitchCaseContext): string {
    const result = switchGenerators.generateSwitchCase(
      ctx,
      this.getInput(),
      this.getState(),
      this,
    );
    this.applyEffects(result.effects);
    return result.code;
  }

  private generateCaseLabel(ctx: Parser.CaseLabelContext): string {
    const result = switchGenerators.generateCaseLabel(
      ctx,
      this.getInput(),
      this.getState(),
      this,
    );
    this.applyEffects(result.effects);
    return result.code;
  }

  private generateDefaultCase(ctx: Parser.DefaultCaseContext): string {
    const result = switchGenerators.generateDefaultCase(
      ctx,
      this.getInput(),
      this.getState(),
      this,
    );
    this.applyEffects(result.effects);
    return result.code;
  }

  // ========================================================================
  // Expressions
  // ========================================================================

  // ADR-053 A2 Phase 7: Use registry for expression generator
  private _generateExpression(ctx: Parser.ExpressionContext): string {
    return this.invokeExpression("expression", ctx);
  }

  // ADR-022: Ternary operator with safety constraints
  private generateTernaryExpr(ctx: Parser.TernaryExpressionContext): string {
    return this.invokeExpression("ternary", ctx);
  }

  private _generateOrExpr(ctx: Parser.OrExpressionContext): string {
    return this.invokeExpression("or", ctx);
  }

  private generateAndExpr(ctx: Parser.AndExpressionContext): string {
    return this.invokeExpression("and", ctx);
  }

  // ADR-001: = becomes == in C
  // ADR-017: Enum type safety validation
  private generateEqualityExpr(ctx: Parser.EqualityExpressionContext): string {
    return this.invokeExpression("equality", ctx);
  }

  private generateRelationalExpr(
    ctx: Parser.RelationalExpressionContext,
  ): string {
    return this.invokeExpression("relational", ctx);
  }

  private generateBitwiseOrExpr(
    ctx: Parser.BitwiseOrExpressionContext,
  ): string {
    return this.invokeExpression("bitwise-or", ctx);
  }

  private generateBitwiseXorExpr(
    ctx: Parser.BitwiseXorExpressionContext,
  ): string {
    return this.invokeExpression("bitwise-xor", ctx);
  }

  private generateBitwiseAndExpr(
    ctx: Parser.BitwiseAndExpressionContext,
  ): string {
    return this.invokeExpression("bitwise-and", ctx);
  }

  private generateShiftExpr(ctx: Parser.ShiftExpressionContext): string {
    return this.invokeExpression("shift", ctx);
  }

  // Issue #63: validateShiftAmount, getTypeWidth, evaluateShiftAmount,
  //            evaluateUnaryExpression moved to TypeValidator

  /**
   * Get the type of an additive expression.
   */
  private _getAdditiveExpressionType(
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
  private _getOperatorsFromChildren(ctx: ParserRuleContext): string[] {
    const operators: string[] = [];
    for (const child of ctx.children) {
      if (child instanceof TerminalNode) {
        operators.push(child.getText());
      }
    }
    return operators;
  }

  private generateAdditiveExpr(ctx: Parser.AdditiveExpressionContext): string {
    return this.invokeExpression("additive", ctx);
  }

  private generateMultiplicativeExpr(
    ctx: Parser.MultiplicativeExpressionContext,
  ): string {
    return this.invokeExpression("multiplicative", ctx);
  }

  private _generateUnaryExpr(ctx: Parser.UnaryExpressionContext): string {
    return this.invokeExpression("unary", ctx);
  }

  private _generatePostfixExpr(ctx: Parser.PostfixExpressionContext): string {
    // Issue #644: Delegate to extracted PostfixExpressionGenerator
    const result = generatePostfixExpression(
      ctx,
      this.getInput(),
      this.getState(),
      this,
    );
    this.applyEffects(result.effects);
    return result.code;
  }

  private _generatePrimaryExpr(ctx: Parser.PrimaryExpressionContext): string {
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
        if (this._isFloatType(paramInfo.baseType)) {
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
        // Issue #269: Small unmodified primitives use pass-by-value, no dereference needed
        if (
          this.context.currentFunctionName &&
          this._isParameterPassByValueByName(
            this.context.currentFunctionName,
            id,
          )
        ) {
          return id;
        }
        // Issue #551: Dereference only known primitives (pass-by-reference)
        // - Structs use -> notation for member access (no dereference here)
        // - Unknown types (external enums, typedefs) use pass-by-value
        if (
          !paramInfo.isArray &&
          !paramInfo.isStruct &&
          this._isKnownPrimitive(paramInfo.baseType)
        ) {
          // Issue #558/#644: In C++ mode, primitives that become references don't need dereferencing
          return this.cppHelper!.maybeDereference(id);
        }
        return id;
      }

      // Check if it's a local variable (tracked in type registry with no underscore prefix)
      // Local variables are those that were declared inside the current function
      const isLocalVariable = this.context.localVariables.has(id);

      // ADR-016: Resolve bare identifier using local -> scope -> global priority
      const resolved = this.typeValidator!.resolveBareIdentifier(
        id,
        isLocalVariable,
        (name: string) => this.isKnownStruct(name),
      );

      // If resolved to a different name, use it
      if (resolved !== null) {
        return resolved;
      }

      // Issue #452: Check if identifier is an unqualified enum member reference
      // Use expectedType for type-aware resolution when assigning to enum fields
      if (
        this.context.expectedType &&
        this.symbols!.knownEnums.has(this.context.expectedType)
      ) {
        // Type-aware resolution: check only the expected enum type
        const expectedEnum = this.context.expectedType;
        const members = this.symbols!.enumMembers.get(expectedEnum);
        if (members?.has(id)) {
          return `${expectedEnum}${this.getScopeSeparator(false)}${id}`;
        }
      } else {
        // No expected enum type - search all enums but error on ambiguity
        // Note: This path is used for backward compatibility when expectedType is not set
        const matchingEnums: string[] = [];
        for (const [enumName, members] of this.symbols!.enumMembers) {
          if (members.has(id)) {
            matchingEnums.push(enumName);
          }
        }
        if (matchingEnums.length === 1) {
          return `${matchingEnums[0]}${this.getScopeSeparator(false)}${id}`;
        } else if (matchingEnums.length > 1) {
          throw new Error(
            `Error: Ambiguous enum member '${id}' exists in multiple enums: ${matchingEnums.join(", ")}. Use qualified access (e.g., ${matchingEnums[0]}.${id})`,
          );
        }
      }

      return id;
    }
    if (ctx.literal()) {
      // ADR-053 A2: Use extracted literal generator
      const result = generateLiteral(
        ctx.literal()!,
        this.getInput(),
        this.getState(),
        this,
      );
      this.applyEffects(result.effects);

      // Issue #304/#644: Transform NULL → nullptr in C++ mode
      if (result.code === "NULL") {
        return this.cppHelper!.nullLiteral();
      }

      return result.code;
    }
    if (ctx.expression()) {
      return `(${this._generateExpression(ctx.expression()!)})`;
    }
    return "";
  }

  /**
   * ADR-017: Generate cast expression
   * C mode:   (u8)State.IDLE -> (uint8_t)State_IDLE
   * C++ mode: (u8)State.IDLE -> static_cast<uint8_t>(State_IDLE)
   * Issue #267: Use C++ casts when cppMode is enabled
   */
  private generateCastExpression(ctx: Parser.CastExpressionContext): string {
    const targetType = this._generateType(ctx.type());
    const targetTypeName = ctx.type().getText();

    // ADR-024: Validate integer casts for narrowing and sign conversion
    if (this._isIntegerType(targetTypeName)) {
      const sourceType = this.getUnaryExpressionType(ctx.unaryExpression());
      if (sourceType && this._isIntegerType(sourceType)) {
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

    // Issue #632: Float-to-integer casts must clamp to avoid undefined behavior
    // C-Next's default is "clamp" (saturate), so out-of-range values clamp to type limits
    if (this._isIntegerType(targetTypeName)) {
      const sourceType = this.getUnaryExpressionType(ctx.unaryExpression());
      if (sourceType && this._isFloatType(sourceType)) {
        return this.generateFloatToIntClampCast(
          expr,
          targetType,
          targetTypeName,
          sourceType,
        );
      }
    }

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

    // Issue #267/#644: Use C++ casts when cppMode is enabled for MISRA compliance
    return this.cppHelper!.cast(targetType, expr);
  }

  /**
   * Issue #632: Generate clamping cast for float-to-integer conversions
   * In C, casting an out-of-range float to an integer is undefined behavior.
   * C-Next's default overflow behavior is "clamp" (saturate), so we generate
   * explicit bounds checks to ensure safe, deterministic results.
   *
   * @param expr The C expression for the float value
   * @param targetType The C type name (e.g., "uint8_t")
   * @param targetTypeName The C-Next type name (e.g., "u8")
   * @param sourceType The source float type (e.g., "f32")
   * @returns A clamping cast expression
   */
  private generateFloatToIntClampCast(
    expr: string,
    targetType: string,
    targetTypeName: string,
    sourceType: string,
  ): string {
    const maxValue = TYPE_LIMITS.TYPE_MAX[targetTypeName];
    const minValue = TYPE_LIMITS.TYPE_MIN[targetTypeName];

    if (!maxValue) {
      // Unknown type, fall back to raw cast - Issue #644
      return this.cppHelper!.cast(targetType, expr);
    }

    // Mark that we need limits.h for the type limit macros
    this.requireInclude("limits");

    // Use appropriate float suffix for comparisons
    const floatSuffix = sourceType === "f32" ? "f" : "";

    // For unsigned types, minValue is "0", for signed it's a macro like INT8_MIN
    const minComparison =
      minValue === "0"
        ? `0.0${floatSuffix}`
        : `((${sourceType === "f32" ? "float" : "double"})${minValue})`;
    const maxComparison = `((${sourceType === "f32" ? "float" : "double"})${maxValue})`;

    // Generate clamping expression:
    // (expr > MAX) ? MAX : (expr < MIN) ? MIN : (type)(expr)
    // Note: For unsigned targets, MIN is 0 so we check < 0.0
    const finalCast = this.cppHelper!.cast(targetType, `(${expr})`);
    return `((${expr}) > ${maxComparison} ? ${maxValue} : (${expr}) < ${minComparison} ? ${minValue} : ${finalCast})`;
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
          !this.isKnownScope(firstName) &&
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
      const cType = this._generateType(typeCtx);
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

    const exprCode = this._generateExpression(expr);
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
    if (/[a-zA-Z_]\w*\s*\(/.exec(text)) {
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
        parts.length > 2 && this.isKnownScope(firstPart)
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
          const bitIndex = this._generateExpression(expressions[0]);
          return `((${registerName} >> ${bitIndex}) & 1)`;
        } else if (expressions.length === 2) {
          const start = this._generateExpression(expressions[0]);
          const width = this._generateExpression(expressions[1]);
          const mask = BitUtils.generateMask(width);
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
            (expr) => this._tryEvaluateConstant(expr),
          );
        }
      }
      // Future: Add bounds checking for struct.field[i][j] patterns

      const indices = expressions
        .map((e) => this._generateExpression(e))
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
          const isCrossScope = this.isKnownScope(firstPart);

          // ADR-006: Check if first identifier is a struct parameter (needs -> access)
          const paramInfo = this.context.currentParameters.get(firstPart);
          const isStructParam = paramInfo?.isStruct ?? false;

          // ADR-016: Inside a scope, accessing another scope requires global. prefix
          // ADR-057: Cross-scope access allowed without global. prefix (just check self-reference)
          if (isCrossScope && this.context.currentScope) {
            // Self-referential access should use 'this.'
            if (firstPart === this.context.currentScope) {
              throw new Error(
                `Error: Cannot reference own scope '${firstPart}' by name. Use 'this.${parts[1]}' instead of '${firstPart}.${parts[1]}'`,
              );
            }
            // ADR-057: Allow cross-scope access without global. prefix
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
                // ADR-006: Use determineSeparator helper for -> (struct param) / _ (scope) / .
                const separator = memberAccessChain.determineSeparator(
                  { isStructParam, isCrossScope, cppMode: this.cppMode },
                  idIndex,
                );
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
                TypeCheckUtils.isInteger(lastMemberType);
              const isLastExpr = exprIndex === expressions.length - 1;

              if (
                isPrimitiveInt &&
                isLastExpr &&
                exprIndex < expressions.length
              ) {
                // Bug #8: This is bit read on a struct member!
                // e.g., items[0].byte[7] -> ((items[0].byte >> 7) & 1)
                const bitIndex = this._generateExpression(
                  expressions[exprIndex],
                );
                return `((${result} >> ${bitIndex}) & 1)`;
              }

              // Normal array subscript
              if (exprIndex < expressions.length) {
                const expr = this._generateExpression(expressions[exprIndex]);
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
    if (this.isKnownScope(firstPart)) {
      // ADR-016: Inside a scope, accessing another scope requires global. prefix
      // ADR-057: Cross-scope access allowed without global. prefix (just check self-reference)
      if (this.context.currentScope) {
        // Self-referential access should use 'this.'
        if (firstPart === this.context.currentScope) {
          throw new Error(
            `Error: Cannot reference own scope '${firstPart}' by name. Use 'this.${parts[1]}' instead of '${firstPart}.${parts[1]}'`,
          );
        }
        // ADR-057: Allow cross-scope access without global. prefix
      }
      // ADR-016: Validate visibility before allowing cross-scope access
      const memberName = parts[1];
      this.validateCrossScopeVisibility(firstPart, memberName);

      // Check if the scope variable is a struct type - if so, remaining parts
      // are struct field access and should use '.' not '_'
      // e.g., Motor.current.speed -> Motor_current.speed (not Motor_current_speed)
      if (parts.length > 2) {
        const scopeVarName = `${firstPart}_${memberName}`;
        const scopeVarType = this.context.typeRegistry.get(scopeVarName);
        if (scopeVarType && this._isKnownStruct(scopeVarType.baseType)) {
          // Scope variable is a struct - use '.' for field access
          return `${scopeVarName}.${parts.slice(2).join(".")}`;
        }
      }
      return parts.join("_");
    }

    // ADR-006: Check if the first part is a struct parameter
    const paramInfo = this.context.currentParameters.get(firstPart);
    if (paramInfo && paramInfo.isStruct) {
      // Use centralized helper for C/C++ struct param member access
      return memberAccessChain.buildStructParamMemberAccess(
        firstPart,
        parts.slice(1),
        { cppMode: this.cppMode },
      );
    }

    return parts.join(".");
  }

  private generateArrayAccess(ctx: Parser.ArrayAccessContext): string {
    const rawName = ctx.IDENTIFIER().getText();
    const exprs = ctx.expression();

    // ADR-006: Check if the identifier is a parameter
    // For pass-by-pointer parameters, we need to dereference when accessing bits
    // For pass-by-value parameters (Issue #269), use the name directly
    const paramInfo = this.context.currentParameters.get(rawName);
    let name = rawName;
    if (paramInfo && !paramInfo.isArray) {
      // Check if this parameter is pass-by-value
      const isPassByValue =
        this._isFloatType(paramInfo.baseType) ||
        this.symbols!.knownEnums.has(paramInfo.baseType) ||
        (this.context.currentFunctionName &&
          this._isParameterPassByValueByName(
            this.context.currentFunctionName,
            rawName,
          ));

      if (!isPassByValue) {
        // Pass-by-pointer: need to dereference
        name = `(*${rawName})`;
      }
    }

    if (exprs.length === 1) {
      // Single index: array[i] or bit access flags[3]
      // ADR-036: Compile-time bounds checking for constant indices
      // Note: Use rawName for type lookup since typeRegistry uses original names
      const typeInfo = this.context.typeRegistry.get(rawName);

      // Check if this is a bitmap type
      if (typeInfo?.isBitmap && typeInfo.bitmapTypeName) {
        const line = ctx.start?.line ?? 0;
        throw new Error(
          `Error at line ${line}: Cannot use bracket indexing on bitmap type '${typeInfo.bitmapTypeName}'. ` +
            `Use named field access instead (e.g., ${rawName}.FIELD_NAME).`,
        );
      }

      if (typeInfo?.isArray && typeInfo.arrayDimensions) {
        this.typeValidator!.checkArrayBounds(
          rawName,
          typeInfo.arrayDimensions,
          exprs,
          ctx.start?.line ?? 0,
          (expr) => this._tryEvaluateConstant(expr),
        );
      }

      const index = this._generateExpression(exprs[0]);
      return `${name}[${index}]`;
    } else if (exprs.length === 2) {
      // Bit range: flags[start, width]
      const start = this._generateExpression(exprs[0]);
      const width = this._generateExpression(exprs[1]);
      const typeInfo = this.context.typeRegistry.get(rawName);

      // Float bit indexing read: use shadow variable + memcpy
      const isFloatType =
        typeInfo?.baseType === "f32" || typeInfo?.baseType === "f64";
      if (isFloatType) {
        // Global scope float bit reads are not valid C (initializers must be constant)
        if (!this.context.inFunctionBody) {
          throw new Error(
            `Float bit indexing reads (${rawName}[${start}, ${width}]) cannot be used at global scope. ` +
              `Move the initialization inside a function.`,
          );
        }

        this.requireInclude("string"); // For memcpy
        this.requireInclude("float_static_assert"); // For size verification
        const isF64 = typeInfo?.baseType === "f64";
        const shadowType = isF64 ? "uint64_t" : "uint32_t";
        const shadowName = `__bits_${rawName}`;
        const mask = this.generateBitMask(width, isF64);

        // Check if shadow variable needs declaration
        const needsDeclaration = !this.context.floatBitShadows.has(shadowName);
        if (needsDeclaration) {
          this.context.floatBitShadows.add(shadowName);
          // Push declaration to pending - will be emitted before the statement
          this.pendingTempDeclarations.push(`${shadowType} ${shadowName};`);
        }

        // Check if shadow already has current value (skip redundant memcpy read)
        const shadowIsCurrent = this.context.floatShadowCurrent.has(shadowName);

        // Mark shadow as current after this read
        this.context.floatShadowCurrent.add(shadowName);

        // Use comma operator to combine memcpy with expression (no declaration inline)
        if (shadowIsCurrent) {
          // Shadow already has current value - just use it directly
          if (start === "0") {
            return `(${shadowName} & ${mask})`;
          }
          return `((${shadowName} >> ${start}) & ${mask})`;
        }
        if (start === "0") {
          return `(memcpy(&${shadowName}, &${name}, sizeof(${name})), (${shadowName} & ${mask}))`;
        }
        return `(memcpy(&${shadowName}, &${name}, sizeof(${name})), ((${shadowName} >> ${start}) & ${mask}))`;
      }

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
  private _getTypeName(ctx: Parser.TypeContext): string {
    // ADR-016: Handle this.Type for scoped types (e.g., this.State -> Motor_State)
    if (ctx.scopedType()) {
      const typeName = ctx.scopedType()!.IDENTIFIER().getText();
      if (this.context.currentScope) {
        return `${this.context.currentScope}_${typeName}`;
      }
      return typeName;
    }
    // Issue #478: Handle global.Type for global types inside scope
    if (ctx.globalType()) {
      return ctx.globalType()!.IDENTIFIER().getText();
    }
    // ADR-016: Handle Scope.Type from outside scope (e.g., Motor.State -> Motor_State)
    // Issue #388: Also handles C++ namespace types (MockLib.Parse.ParseResult -> MockLib::Parse::ParseResult)
    if (ctx.qualifiedType()) {
      const identifiers = ctx.qualifiedType()!.IDENTIFIER();
      const identifierNames = identifiers.map((id) => id.getText());
      return this.resolveQualifiedType(identifierNames);
    }
    if (ctx.userType()) {
      return ctx.userType()!.getText();
    }
    if (ctx.primitiveType()) {
      return ctx.primitiveType()!.getText();
    }
    return ctx.getText();
  }

  private _generateType(ctx: Parser.TypeContext): string {
    if (ctx.primitiveType()) {
      const type = ctx.primitiveType()!.getText();
      // Track required includes based on type usage
      if (type === "bool") {
        this.requireInclude("stdbool");
      } else if (type === "ISR") {
        this.requireInclude("isr"); // ADR-040: ISR function pointer typedef
      } else if (type in TYPE_MAP && type !== "void") {
        this.requireInclude("stdint");
      }
      return TYPE_MAP[type] || type;
    }
    // ADR-045: Handle bounded string type
    if (ctx.stringType()) {
      this.requireInclude("string");
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
    // Issue #478: Handle global.Type for global types inside scope
    if (ctx.globalType()) {
      return ctx.globalType()!.IDENTIFIER().getText();
    }
    // ADR-016: Handle Scope.Type from outside scope (e.g., Motor.State -> Motor_State)
    // Issue #388: Also handles C++ namespace types (MockLib.Parse.ParseResult -> MockLib::Parse::ParseResult)
    if (ctx.qualifiedType()) {
      const identifiers = ctx.qualifiedType()!.IDENTIFIER();
      const identifierNames = identifiers.map((id) => id.getText());
      const firstName = identifierNames[0];

      // Check if this is a C++ namespace type - no visibility validation needed
      if (this.isCppScopeSymbol(firstName)) {
        return identifierNames.join("::");
      }

      // C-Next scoped type - validate visibility (for 2-part types only)
      if (identifierNames.length === 2) {
        this._validateCrossScopeVisibility(firstName, identifierNames[1]);
      }

      return identifierNames.join("_");
    }
    if (ctx.userType()) {
      const typeName = ctx.userType()!.getText();
      // ADR-046: cstring maps to char* for C library interop
      if (typeName === "cstring") {
        return "char*";
      }
      // Issue #196 Bug 3: Check if this C struct needs 'struct' keyword
      if (this.symbolTable?.checkNeedsStructKeyword(typeName)) {
        return `struct ${typeName}`;
      }
      return typeName;
    }
    if (ctx.arrayType()) {
      const arrCtx = ctx.arrayType()!;
      let baseType: string;
      if (arrCtx.primitiveType()) {
        baseType =
          TYPE_MAP[arrCtx.primitiveType()!.getText()] ||
          arrCtx.primitiveType()!.getText();
      } else {
        const typeName = arrCtx.userType()!.getText();
        // Issue #196 Bug 3: Check if this C struct needs 'struct' keyword
        if (this.symbolTable?.checkNeedsStructKeyword(typeName)) {
          baseType = `struct ${typeName}`;
        } else {
          baseType = typeName;
        }
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

  private _indent(text: string): string {
    const spaces = FormatUtils.indent(this.context.indentLevel);
    return text
      .split("\n")
      .map((line) => spaces + line)
      .join("\n");
  }

  // ========================================================================
  // strlen Optimization - Cache repeated .length accesses
  // Issue #644: Walker methods extracted to StringLengthCounter class
  // ========================================================================

  /**
   * Generate temp variable declarations for string lengths that are accessed 2+ times.
   * Returns the declarations as a string and populates the lengthCache.
   */
  private _setupLengthCache(counts: Map<string, number>): string {
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
  private _clearLengthCache(): void {
    this.context.lengthCache = null;
  }

  // ========================================================================
  // ADR-044: Overflow Helper Functions
  // ========================================================================

  /**
   * Generate all needed overflow helper functions
   * ADR-053 A5: Delegates to HelperGenerator
   */
  private generateOverflowHelpers(): string[] {
    return helperGenerateOverflowHelpers(this.usedClampOps, this.debugMode);
  }

  /**
   * Mark a clamp operation as used (will trigger helper generation)
   */
  private markClampOpUsed(operation: string, cnxType: string): void {
    // Only generate helpers for integer types (not float/bool)
    if (TYPE_WIDTH[cnxType] && TypeCheckUtils.isInteger(cnxType)) {
      this.usedClampOps.add(`${operation}_${cnxType}`);
    }
  }

  // ========================================================================
  // Preprocessor Directive Handling (ADR-037)
  // ========================================================================

  /**
   * Process a preprocessor directive
   * ADR-053 A5: Delegates to IncludeGenerator
   */
  private processPreprocessorDirective(
    ctx: Parser.PreprocessorDirectiveContext,
  ): string | null {
    return includeProcessPreprocessorDirective(ctx);
  }

  // ========================================================================
  // Comment Handling (ADR-043)
  // ADR-053 A5: Delegates to CommentUtils
  // ========================================================================

  /**
   * Get comments that appear before a parse tree node
   */
  private getLeadingComments(ctx: {
    start?: { tokenIndex: number } | null;
  }): IComment[] {
    return commentGetLeadingComments(ctx, this.commentExtractor);
  }

  /**
   * Get inline comments that appear after a parse tree node (same line)
   */
  private getTrailingComments(ctx: {
    stop?: { tokenIndex: number } | null;
  }): IComment[] {
    return commentGetTrailingComments(ctx, this.commentExtractor);
  }

  /**
   * Format leading comments with current indentation
   */
  private formatLeadingComments(comments: IComment[]): string[] {
    const indent = FormatUtils.indent(this.context.indentLevel);
    return commentFormatLeadingComments(
      comments,
      this.commentFormatter,
      indent,
    );
  }

  /**
   * Format a trailing/inline comment
   */
  private formatTrailingComment(comments: IComment[]): string {
    return commentFormatTrailingComment(comments, this.commentFormatter);
  }

  /**
   * ADR-051: Generate safe division helper functions for used integer types only
   * ADR-053 A5: Delegates to HelperGenerator
   */
  private generateSafeDivHelpers(): string[] {
    return helperGenerateSafeDivHelpers(this.usedSafeDivOps);
  }
}
