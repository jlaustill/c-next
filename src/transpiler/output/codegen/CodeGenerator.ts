/**
 * C-Next Code Generator
 * Transforms C-Next AST to clean, readable C code
 */

import { CommonTokenStream, ParserRuleContext, TerminalNode } from "antlr4ng";
import * as Parser from "../../logic/parser/grammar/CNextParser";
import SymbolTable from "../../logic/symbols/SymbolTable";
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
import ExpressionUtils from "../../../utils/ExpressionUtils";
// ADR-053: Support generators (A5)
import helperGenerators from "./generators/support/HelperGenerator";
import includeGenerators from "./generators/support/IncludeGenerator";
import commentUtils from "./generators/support/CommentUtils";
// ADR-046: NullCheckAnalyzer for nullable C pointer type detection
import NullCheckAnalyzer from "../../logic/analysis/NullCheckAnalyzer";
// ADR-006: Helper for building member access chains with proper separators
import memberAccessChain from "./memberAccessChain";
// Shared member access validation (ADR-013/016/057)
import MemberAccessValidator from "./helpers/MemberAccessValidator";
// ADR-109: Assignment decomposition (Phase 2)
import AssignmentHandlerRegistry from "./assignment/index";
import AssignmentClassifier from "./assignment/AssignmentClassifier";
import buildAssignmentContext from "./assignment/AssignmentContextBuilder";
import IHandlerDeps from "./assignment/handlers/IHandlerDeps";
// Issue #461: LiteralUtils for parsing const values from symbol table
import LiteralUtils from "../../../utils/LiteralUtils";
// Issue #644: Extracted string length counter for strlen caching optimization
import StringLengthCounter from "./analysis/StringLengthCounter";
// Issue #644: C/C++ mode helper for consolidated mode-specific patterns
import CppModeHelper from "./helpers/CppModeHelper";
// PR #715: Bit range access helper for improved testability
import BitRangeHelper from "./helpers/BitRangeHelper";
// PR #715: Centralized error messages for improved testability
import CodeGenErrors from "./helpers/CodeGenErrors";
// Issue #644: Array dimension parsing helper for consolidation
import ArrayDimensionParser from "./helpers/ArrayDimensionParser";
// Issue #644: Member chain analyzer for bit access pattern detection
import MemberChainAnalyzer from "./analysis/MemberChainAnalyzer";
// Issue #644: Float bit write helper for shadow variable pattern
import FloatBitHelper from "./helpers/FloatBitHelper";
// Issue #644: String declaration helper for bounded/array/concat strings
import StringDeclHelper from "./helpers/StringDeclHelper";
// Issue #644: Enum assignment validator for type-safe enum assignments
import EnumAssignmentValidator from "./helpers/EnumAssignmentValidator";
// Issue #644: Array initialization helper for size inference and fill-all
import ArrayInitHelper from "./helpers/ArrayInitHelper";
// Issue #644: Assignment expected type resolution helper
import AssignmentExpectedTypeResolver from "./helpers/AssignmentExpectedTypeResolver";
// PR #715: C++ member conversion helper for improved testability
import CppMemberHelper from "./helpers/CppMemberHelper";
import IPostfixOp from "./helpers/types/IPostfixOp";
// PR #715: Boolean conversion helper for improved testability
import BooleanHelper from "./helpers/BooleanHelper";
// PR #715: C++ constructor detection helper for improved testability
import CppConstructorHelper from "./helpers/CppConstructorHelper";
// PR #715: Set/Map utilities for improved testability
import SetMapHelper from "./helpers/SetMapHelper";
// PR #715: Symbol lookup utilities for improved testability
import SymbolLookupHelper from "./helpers/SymbolLookupHelper";
// Issue #644: Assignment validation coordinator helper
import AssignmentValidator from "./helpers/AssignmentValidator";
// Issue #696: Variable modifier extraction helper
import VariableModifierBuilder from "./helpers/VariableModifierBuilder";
// PR #681: Extracted separator and dereference resolution utilities
import MemberSeparatorResolver from "./helpers/MemberSeparatorResolver";
import ParameterDereferenceResolver from "./helpers/ParameterDereferenceResolver";
// Issue #707: Expression unwrapping utility for reducing duplication
import ExpressionUnwrapper from "./utils/ExpressionUnwrapper";
import IMemberSeparatorDeps from "./types/IMemberSeparatorDeps";
import IParameterDereferenceDeps from "./types/IParameterDereferenceDeps";
import ISeparatorContext from "./types/ISeparatorContext";

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
  formatLeadingComments: commentFormatLeadingComments,
} = commentUtils;

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
  /** Lookup map for primitive type zero initializers */
  private static readonly PRIMITIVE_ZERO_VALUES: ReadonlyMap<string, string> =
    new Map([
      ["bool", "false"],
      ["f32", "0.0f"],
      ["f64", "0.0"],
    ]);

  /** ADR-044: Debug mode generates panic-on-overflow helpers */
  private debugMode: boolean = false;

  private context: GeneratorContext =
    CodeGenerator.createDefaultContext(DEFAULT_TARGET);

  /**
   * Create a fresh GeneratorContext with default values.
   */
  private static createDefaultContext(
    targetCapabilities: TargetCapabilities,
  ): GeneratorContext {
    return {
      currentScope: null,
      currentFunctionName: null,
      currentFunctionReturnType: null,
      indentLevel: 0,
      scopeMembers: new Map(),
      currentParameters: new Map(),
      localArrays: new Set(),
      localVariables: new Set(),
      floatBitShadows: new Set(),
      floatShadowCurrent: new Set(),
      inFunctionBody: false,
      typeRegistry: new Map(),
      expectedType: null,
      mainArgsName: null,
      assignmentContext: {
        targetName: null,
        targetType: null,
        overflowBehavior: "clamp",
      },
      lastArrayInitCount: 0,
      lastArrayFillValue: undefined,
      lengthCache: null,
      targetCapabilities,
    };
  }

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

  /** Issue #644: Member chain analyzer for bit access pattern detection */
  private memberChainAnalyzer: MemberChainAnalyzer | null = null;

  /** Issue #644: Float bit write helper for shadow variable pattern */
  private floatBitHelper: FloatBitHelper | null = null;

  /** Issue #644: String declaration helper for bounded/array/concat strings */
  private stringDeclHelper: StringDeclHelper | null = null;

  /** Issue #644: Enum assignment validator for type-safe enum assignments */
  private enumValidator: EnumAssignmentValidator | null = null;

  /** Issue #644: Array initialization helper for size inference and fill-all */
  private arrayInitHelper: ArrayInitHelper | null = null;

  /** Issue #644: Assignment expected type resolution helper */
  private expectedTypeResolver: AssignmentExpectedTypeResolver | null = null;

  /** Issue #644: Assignment validation coordinator helper */
  private assignmentValidator: AssignmentValidator | null = null;

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
    return SymbolLookupHelper.isCppEnumClass(this.symbolTable, typeName);
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
    const lines: string[] = ["{"];
    const innerIndent = FormatUtils.indent(1); // One level of relative indentation

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
    this.injectCrossFileData(crossFileModifications, crossFileParamLists);

    // Track which functions were injected (not from this file)
    const injectedFuncs = new Set(crossFileModifications?.keys() ?? []);

    // Run modification analysis on the tree (adds to what was injected)
    this.collectFunctionParametersAndModifications(tree);

    // Issue #565: Run transitive propagation with full context
    this.propagateTransitiveModifications();

    // Capture results - only include functions NOT from cross-file injection
    const modifications = this.extractThisFileModifications(
      crossFileModifications,
      injectedFuncs,
    );
    const paramLists = this.extractThisFileParamLists(crossFileParamLists);

    // Restore previous state
    this.restoreMapState(this.modifiedParameters, savedModifications);
    this.restoreMapState(this.functionParamLists, savedParamLists);
    this.restoreMapState(this.functionCallGraph, savedCallGraph);

    return { modifications, paramLists };
  }

  /**
   * Inject cross-file modification data for transitive propagation.
   */
  private injectCrossFileData(
    crossFileModifications?: ReadonlyMap<string, ReadonlySet<string>>,
    crossFileParamLists?: ReadonlyMap<string, readonly string[]>,
  ): void {
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
  }

  /**
   * Extract modifications discovered in this file (excluding injected cross-file data).
   */
  private extractThisFileModifications(
    crossFileModifications:
      | ReadonlyMap<string, ReadonlySet<string>>
      | undefined,
    injectedFuncs: Set<string>,
  ): Map<string, Set<string>> {
    const modifications = new Map<string, Set<string>>();

    for (const [funcName, params] of this.modifiedParameters) {
      if (!injectedFuncs.has(funcName)) {
        // Function defined in this file - include all its modifications
        modifications.set(funcName, new Set(params));
        continue;
      }

      // Check if we discovered new modifications for an injected function
      const injectedParams = crossFileModifications?.get(funcName);
      if (!injectedParams) continue;

      const newParams = this.findNewParams(params, injectedParams);
      if (newParams.size > 0) {
        modifications.set(funcName, newParams);
      }
    }

    return modifications;
  }

  /**
   * Find params that are in current set but not in injected set.
   */
  private findNewParams(
    params: Set<string>,
    injectedParams: ReadonlySet<string>,
  ): Set<string> {
    return SetMapHelper.findNewItems(params, injectedParams);
  }

  /**
   * Extract param lists discovered in this file (excluding injected cross-file data).
   */
  private extractThisFileParamLists(
    crossFileParamLists?: ReadonlyMap<string, readonly string[]>,
  ): Map<string, string[]> {
    return SetMapHelper.copyArrayValues(
      SetMapHelper.filterExclude(this.functionParamLists, crossFileParamLists),
    );
  }

  /**
   * Restore a map's state by clearing and repopulating from saved data.
   */
  private restoreMapState<K, V>(target: Map<K, V>, saved: Map<K, V>): void {
    SetMapHelper.restoreMapState(target, saved);
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
  getMemberTypeInfo(structType: string, memberName: string): TTypeInfo | null {
    return this._getFullMemberTypeInfo(structType, memberName);
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
   * PR #681: Build dependencies for parameter dereference resolution.
   * Used by ParameterDereferenceResolver to determine if parameters need dereferencing.
   */
  private _buildParameterDereferenceDeps(): IParameterDereferenceDeps {
    return {
      isFloatType: (typeName: string) => this._isFloatType(typeName),
      isKnownPrimitive: (typeName: string) => this._isKnownPrimitive(typeName),
      knownEnums: this.symbols!.knownEnums,
      isParameterPassByValue: (funcName: string, paramName: string) =>
        this._isParameterPassByValueByName(funcName, paramName),
      currentFunctionName: this.context.currentFunctionName,
      maybeDereference: (id: string) => this.cppHelper!.maybeDereference(id),
    };
  }

  /**
   * PR #681: Build dependencies for member separator resolution.
   * Used by MemberSeparatorResolver to determine appropriate separators.
   */
  private _buildMemberSeparatorDeps(): IMemberSeparatorDeps {
    return {
      isKnownScope: (name: string) => this.isKnownScope(name),
      isKnownRegister: (name: string) => this.symbols!.knownRegisters.has(name),
      validateCrossScopeVisibility: (scopeName: string, memberName: string) =>
        this.validateCrossScopeVisibility(scopeName, memberName),
      getStructParamSeparator: () =>
        memberAccessChain.getStructParamSeparator({ cppMode: this.cppMode }),
    };
  }

  /**
   * Issue #517: Check if a type is a C++ class with a user-defined constructor.
   * C++ classes with user-defined constructors are NOT aggregate types,
   * so designated initializers { .field = value } don't work with them.
   * We check for the existence of a constructor symbol (TypeName::ClassName).
   */
  private _isCppClassWithConstructor(typeName: string): boolean {
    return CppConstructorHelper.hasConstructor(typeName, this.symbolTable);
  }

  private foldBooleanToInt(expr: string): string {
    return BooleanHelper.foldBooleanToInt(expr);
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
    return SymbolLookupHelper.isCNextFunction(this.symbolTable, name);
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
   * Issue #304: Check if a type name is from a C++ header
   * Used to determine whether to use {} or {0} for initialization.
   * C++ types with constructors may fail with {0} but work with {}.
   */
  private isCppType(typeName: string): boolean {
    return SymbolLookupHelper.isCppType(this.symbolTable, typeName);
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

    // Initialize options and configuration
    this.initializeGenerateOptions(options, tokenStream);

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

    // Reset state for fresh generation
    this.resetGeneratorState(targetCapabilities);

    // ADR-055: Use pre-collected symbolInfo from Pipeline (TSymbolInfoAdapter)
    if (!options?.symbolInfo) {
      throw new Error(
        "symbolInfo is required - use CNextResolver + TSymbolInfoAdapter",
      );
    }
    this.symbols = options.symbolInfo;

    // Initialize symbol data and const values
    this.initializeSymbolData();

    // Initialize all helper objects
    this.initializeHelperObjects(tree);

    // Second pass: register all variable types in the type registry
    this.registerAllVariableTypes(tree);

    // Assemble and return the output
    return this.assembleGeneratedOutput(tree, options);
  }

  /**
   * Initialize options and configuration for generate().
   */
  private initializeGenerateOptions(
    options: ICodeGeneratorOptions | undefined,
    tokenStream: CommonTokenStream | undefined,
  ): void {
    this.debugMode = options?.debugMode ?? false;
    this.sourcePath = options?.sourcePath ?? null;
    this.includeDirs = options?.includeDirs ?? [];
    this.inputs = options?.inputs ?? [];
    this.cppMode = options?.cppMode ?? false;
    this.cppHelper = new CppModeHelper({ cppMode: this.cppMode });
    this.pendingTempDeclarations = [];
    this.tempVarCounter = 0;
    this.pendingCppClassAssignments = [];

    this.tokenStream = tokenStream ?? null;
    this.commentExtractor = this.tokenStream
      ? new CommentExtractor(this.tokenStream)
      : null;
  }

  /**
   * Reset all generator state for a fresh generation pass.
   */
  private resetGeneratorState(targetCapabilities: TargetCapabilities): void {
    this.context = CodeGenerator.createDefaultContext(targetCapabilities);

    this.knownFunctions = new Set();
    this.functionSignatures = new Map();
    this.callbackTypes = new Map();
    this.callbackFieldTypes = new Map();
    this.usedClampOps = new Set();
    this.usedSafeDivOps = new Set();
    this.needsStdint = false;
    this.needsStdbool = false;
    this.needsString = false;
    this.needsFloatStaticAssert = false;
    this.needsISR = false;
    this.needsCMSIS = false;
    this.needsLimits = false;
    this.needsIrqWrappers = false;
    this.selfIncludeAdded = false;
  }

  /**
   * Initialize symbol data and const values from symbol table.
   */
  private initializeSymbolData(): void {
    const symbols = this.symbols!;

    // Copy symbol data to context.scopeMembers
    for (const [scopeName, members] of symbols.scopeMembers) {
      this.context.scopeMembers.set(scopeName, new Set(members));
    }

    // Issue #461: Initialize constValues from symbol table
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
  }

  /**
   * Initialize all helper objects needed for code generation.
   */
  private initializeHelperObjects(tree: Parser.ProgramContext): void {
    const symbols = this.symbols!;

    // Initialize type resolver
    this.typeResolver = new TypeResolver({
      symbols: symbols,
      symbolTable: this.symbolTable,
      typeRegistry: this.context.typeRegistry,
      resolveIdentifier: (name: string) => this.resolveIdentifier(name),
    });

    // Collect function/callback information
    this.collectFunctionsAndCallbacks(tree);
    this.analyzePassByValue(tree);

    // Initialize type validator
    this.typeValidator = new TypeValidator({
      symbols: symbols,
      symbolTable: this.symbolTable,
      typeRegistry: this.context.typeRegistry,
      typeResolver: this.typeResolver,
      callbackTypes: this.callbackTypes,
      knownFunctions: this.knownFunctions,
      knownGlobals: new Set(),
      getCurrentScope: () => this.context.currentScope,
      getScopeMembers: () => this.context.scopeMembers,
      getCurrentParameters: () => this.context.currentParameters,
      getLocalVariables: () => this.context.localVariables,
      resolveIdentifier: (name: string) => this.resolveIdentifier(name),
      getExpressionType: (ctx: unknown) =>
        this.getExpressionType(ctx as Parser.ExpressionContext),
    });

    // Initialize remaining helpers
    this.initializeAnalysisHelpers(symbols);
  }

  /**
   * Initialize analysis and generation helpers.
   */
  private initializeAnalysisHelpers(symbols: ICodeGenSymbols): void {
    this.stringLengthCounter = new StringLengthCounter((name: string) =>
      this.context.typeRegistry.get(name),
    );

    this.memberChainAnalyzer = new MemberChainAnalyzer({
      typeRegistry: this.context.typeRegistry,
      structFields: symbols.structFields,
      structFieldArrays: symbols.structFieldArrays,
      isKnownStruct: (name) => this.isKnownStruct(name),
      generateExpression: (ctx) => this._generateExpression(ctx),
    });

    this.floatBitHelper = new FloatBitHelper({
      cppMode: this.cppMode,
      state: {
        floatBitShadows: this.context.floatBitShadows,
        floatShadowCurrent: this.context.floatShadowCurrent,
      },
      generateBitMask: (width, is64Bit) => this.generateBitMask(width, is64Bit),
      foldBooleanToInt: (expr) => this.foldBooleanToInt(expr),
      requireInclude: (header) => this.requireInclude(header),
    });

    // Create arrayInitState proxy
    const context = this.context;
    const arrayInitState = {
      get lastArrayInitCount() {
        return context.lastArrayInitCount;
      },
      set lastArrayInitCount(val: number) {
        context.lastArrayInitCount = val;
      },
      get lastArrayFillValue() {
        return context.lastArrayFillValue;
      },
      set lastArrayFillValue(val: string | undefined) {
        context.lastArrayFillValue = val;
      },
    };

    this.stringDeclHelper = new StringDeclHelper({
      typeRegistry: this.context.typeRegistry,
      getInFunctionBody: () => this.context.inFunctionBody,
      getIndentLevel: () => this.context.indentLevel,
      arrayInitState,
      localArrays: this.context.localArrays,
      generateExpression: (ctx) => this._generateExpression(ctx),
      generateArrayDimensions: (dims) => this._generateArrayDimensions(dims),
      getStringConcatOperands: (ctx) => this._getStringConcatOperands(ctx),
      getSubstringOperands: (ctx) => this._getSubstringOperands(ctx),
      getStringLiteralLength: (literal) =>
        this._getStringLiteralLength(literal),
      getStringExprCapacity: (exprCode) =>
        this._getStringExprCapacity(exprCode),
      requireStringInclude: () => this.requireInclude("string"),
    });

    this.enumValidator = new EnumAssignmentValidator({
      knownEnums: symbols.knownEnums,
      getCurrentScope: () => this.context.currentScope,
      getExpressionEnumType: (ctx) => this.getExpressionEnumType(ctx),
      isIntegerExpression: (ctx) => this._isIntegerExpression(ctx),
    });

    this.arrayInitHelper = new ArrayInitHelper({
      typeRegistry: this.context.typeRegistry,
      localArrays: this.context.localArrays,
      arrayInitState: arrayInitState,
      getExpectedType: () => this.context.expectedType,
      setExpectedType: (type) => {
        this.context.expectedType = type;
      },
      generateExpression: (ctx) => this._generateExpression(ctx),
      getTypeName: (ctx) => this._getTypeName(ctx),
      generateArrayDimensions: (dims) => this._generateArrayDimensions(dims),
    });

    this.expectedTypeResolver = new AssignmentExpectedTypeResolver({
      typeRegistry: this.context.typeRegistry,
      structFields: symbols.structFields,
      isKnownStruct: (name) => this.isKnownStruct(name),
    });

    this.assignmentValidator = new AssignmentValidator({
      typeValidator: this.typeValidator!,
      enumValidator: this.enumValidator,
      typeRegistry: this.context.typeRegistry,
      floatShadowCurrent: this.context.floatShadowCurrent,
      registerMemberAccess: symbols.registerMemberAccess,
      callbackFieldTypes: this.callbackFieldTypes,
      isKnownStruct: (name) => this.isKnownStruct(name),
      isIntegerType: (name) => this._isIntegerType(name),
      getExpressionType: (ctx) => this.getExpressionType(ctx),
      tryEvaluateConstant: (ctx) => this._tryEvaluateConstant(ctx),
      isCallbackTypeUsedAsFieldType: (name) =>
        this._isCallbackTypeUsedAsFieldType(name),
    });
  }

  /**
   * Assemble the final generated output.
   */
  private assembleGeneratedOutput(
    tree: Parser.ProgramContext,
    options: ICodeGeneratorOptions | undefined,
  ): string {
    const output: string[] = [];
    const symbols = this.symbols!;
    const typeValidator = this.typeValidator!;

    // Add header comment
    output.push(
      "/**",
      " * Generated by C-Next Transpiler",
      " * A safer C for embedded systems",
      " */",
      "",
    );

    // Self-include for extern "C" linkage
    if (symbols.hasPublicSymbols() && this.sourcePath) {
      const pathToUse =
        options?.sourceRelativePath || this.sourcePath.replace(/^.*[\\/]/, "");
      const headerName = pathToUse.replace(/\.cnx$|\.cnext$/, ".h");
      output.push(`#include "${headerName}"`, "");
      this.selfIncludeAdded = true;
    }

    // Process include directives
    this.processIncludeDirectives(tree, output, typeValidator);

    // Process preprocessor directives
    this.processPreprocessorDirectives(tree, output);

    // Generate declarations
    const declarations = this.generateAllDeclarations(tree);

    // Add auto-includes and helpers
    this.addAutoIncludes(output);
    this.addGeneratedHelpers(output);

    // Add the declarations
    output.push(...declarations);

    return output.join("\n");
  }

  /**
   * Process all include directives and add to output.
   */
  private processIncludeDirectives(
    tree: Parser.ProgramContext,
    output: string[],
    typeValidator: TypeValidator,
  ): void {
    const includePaths = this.sourcePath
      ? IncludeDiscovery.discoverIncludePaths(this.sourcePath)
      : [];

    for (const includeDir of tree.includeDirective()) {
      const leadingComments = this.getLeadingComments(includeDir);
      output.push(...this.formatLeadingComments(leadingComments));

      const lineNumber = includeDir.start?.line ?? 0;
      typeValidator.validateIncludeNotImplementationFile(
        includeDir.getText(),
        lineNumber,
      );
      typeValidator.validateIncludeNoCnxAlternative(
        includeDir.getText(),
        lineNumber,
        this.sourcePath,
        includePaths,
      );

      output.push(this.transformIncludeDirective(includeDir.getText()));
    }

    if (tree.includeDirective().length > 0) {
      output.push("");
    }
  }

  /**
   * Process all preprocessor directives and add to output.
   */
  private processPreprocessorDirectives(
    tree: Parser.ProgramContext,
    output: string[],
  ): void {
    for (const ppDir of tree.preprocessorDirective()) {
      const leadingComments = this.getLeadingComments(ppDir);
      output.push(...this.formatLeadingComments(leadingComments));
      const result = this.processPreprocessorDirective(ppDir);
      if (result) {
        output.push(result);
      }
    }

    if (tree.preprocessorDirective().length > 0) {
      output.push("");
    }
  }

  /**
   * Generate all declarations from the tree.
   */
  private generateAllDeclarations(tree: Parser.ProgramContext): string[] {
    const declarations: string[] = [];

    for (const decl of tree.declaration()) {
      const leadingComments = this.getLeadingComments(decl);
      declarations.push(...this.formatLeadingComments(leadingComments));

      const code = this.generateDeclaration(decl);
      if (code) {
        declarations.push(code);
      }
    }

    return declarations;
  }

  /**
   * Add auto-generated includes based on usage.
   */
  private addAutoIncludes(output: string[]): void {
    const autoIncludes: string[] = [];

    if (this.needsStdint) autoIncludes.push("#include <stdint.h>");
    if (this.needsStdbool) autoIncludes.push("#include <stdbool.h>");
    if (this.needsString) autoIncludes.push("#include <string.h>");
    if (this.needsCMSIS) autoIncludes.push("#include <cmsis_gcc.h>");
    if (this.needsLimits) autoIncludes.push("#include <limits.h>");

    if (autoIncludes.length > 0) {
      output.push(...autoIncludes, "");
    }
  }

  /**
   * Add generated helpers (static asserts, IRQ wrappers, typedefs, etc.).
   */
  private addGeneratedHelpers(output: string[]): void {
    if (this.needsFloatStaticAssert) {
      output.push(
        '_Static_assert(sizeof(float) == 4, "Float bit indexing requires 32-bit float");',
        '_Static_assert(sizeof(double) == 8, "Float bit indexing requires 64-bit double");',
        "",
      );
    }

    if (this.needsIrqWrappers) {
      output.push(
        "// ADR-050: IRQ wrappers to avoid macro collisions with platform headers",
        "static inline void __cnx_disable_irq(void) { __disable_irq(); }",
        "static inline uint32_t __cnx_get_PRIMASK(void) { return __get_PRIMASK(); }",
        "static inline void __cnx_set_PRIMASK(uint32_t mask) { __set_PRIMASK(mask); }",
        "",
      );
    }

    if (this.needsISR) {
      output.push(
        "/* ADR-040: ISR function pointer type */",
        "typedef void (*ISR)(void);",
        "",
      );
    }

    const helpers = this.generateOverflowHelpers();
    if (helpers.length > 0) {
      output.push(...helpers);
    }

    const safeDivHelpers = this.generateSafeDivHelpers();
    if (safeDivHelpers.length > 0) {
      output.push(...safeDivHelpers);
    }
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
        this._collectScopeFunctions(decl.scopeDeclaration()!);
        continue;
      }

      // ADR-029: Track callback field types in structs
      if (decl.structDeclaration()) {
        this._collectStructCallbackFields(decl.structDeclaration()!);
        continue;
      }

      // Track top-level functions
      if (decl.functionDeclaration()) {
        this._collectTopLevelFunction(decl.functionDeclaration()!);
      }
    }
  }

  /**
   * Collect scoped functions and their callback types
   */
  private _collectScopeFunctions(
    scopeDecl: Parser.ScopeDeclarationContext,
  ): void {
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

  /**
   * Collect callback field types from struct declaration
   */
  private _collectStructCallbackFields(
    structDecl: Parser.StructDeclarationContext,
  ): void {
    const structName = structDecl.IDENTIFIER().getText();

    for (const member of structDecl.structMember()) {
      const fieldName = member.IDENTIFIER().getText();
      const fieldType = this._getTypeName(member.type());

      // Track callback field types (needed for typedef generation)
      if (this.callbackTypes.has(fieldType)) {
        this.callbackFieldTypes.set(`${structName}.${fieldName}`, fieldType);
      }
    }
  }

  /**
   * Collect top-level function and register as callback type
   */
  private _collectTopLevelFunction(
    funcDecl: Parser.FunctionDeclarationContext,
  ): void {
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
   * Helper: Classify a child statement as block or statement.
   */
  private _classifyChildStatement(
    childStmt: Parser.StatementContext,
    statements: Parser.StatementContext[],
    blocks: Parser.BlockContext[],
  ): void {
    if (childStmt.block()) {
      blocks.push(childStmt.block()!);
    } else {
      statements.push(childStmt);
    }
  }

  /**
   * Helper: Collect children from loop body (while/for).
   */
  private _collectLoopBody(
    bodyStmt: Parser.StatementContext,
    statements: Parser.StatementContext[],
    blocks: Parser.BlockContext[],
  ): void {
    this._classifyChildStatement(bodyStmt, statements, blocks);
  }

  /**
   * Helper: Collect children from switch statement.
   */
  private _collectSwitchChildren(
    switchStmt: Parser.SwitchStatementContext,
    blocks: Parser.BlockContext[],
  ): void {
    for (const caseCtx of switchStmt.switchCase()) {
      blocks.push(caseCtx.block());
    }
    if (switchStmt.defaultCase()) {
      blocks.push(switchStmt.defaultCase()!.block());
    }
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
        this._classifyChildStatement(childStmt, statements, blocks);
      }
    }

    // while statement: single statement() child
    if (stmt.whileStatement()) {
      this._collectLoopBody(
        stmt.whileStatement()!.statement(),
        statements,
        blocks,
      );
    }

    // for statement: single statement() child
    if (stmt.forStatement()) {
      this._collectLoopBody(
        stmt.forStatement()!.statement(),
        statements,
        blocks,
      );
    }

    // do-while statement: has block() directly
    if (stmt.doWhileStatement()) {
      blocks.push(stmt.doWhileStatement()!.block());
    }

    // switch statement: case blocks and optional default block
    if (stmt.switchStatement()) {
      this._collectSwitchChildren(stmt.switchStatement()!, blocks);
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
    orExpr
      .andExpression()
      .flatMap((and) => and.equalityExpression())
      .flatMap((eq) => eq.relationalExpression())
      .flatMap((rel) => rel.bitwiseOrExpression())
      .flatMap((bor) => bor.bitwiseXorExpression())
      .flatMap((bxor) => bxor.bitwiseAndExpression())
      .flatMap((band) => band.shiftExpression())
      .flatMap((shift) => shift.additiveExpression())
      .flatMap((add) => add.multiplicativeExpression())
      .flatMap((mul) => mul.unaryExpression())
      .forEach(handler);
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

    // Handle simple function calls: IDENTIFIER followed by '(' ... ')'
    this.handleSimpleFunctionCall(funcName, paramSet, primary, postfixOps);

    // Issue #365: Handle scope-qualified calls: Scope.method(...) or global.Scope.method(...)
    this.handleScopeQualifiedCalls(funcName, paramSet, primary, postfixOps);

    // Recurse into primary expression if it's a parenthesized expression
    if (primary.expression()) {
      this.walkExpressionForCalls(funcName, paramSet, primary.expression()!);
    }

    // Walk arguments in any postfix function call ops (for nested calls)
    this.walkPostfixOpsRecursively(funcName, paramSet, postfixOps);
  }

  /**
   * Handle simple function calls: IDENTIFIER followed by '(' ... ')'
   */
  private handleSimpleFunctionCall(
    funcName: string,
    paramSet: Set<string>,
    primary: Parser.PrimaryExpressionContext,
    postfixOps: Parser.PostfixOpContext[],
  ): void {
    if (!primary.IDENTIFIER() || postfixOps.length === 0) return;

    const firstOp = postfixOps[0];
    if (!firstOp.LPAREN()) return;

    const calleeName = primary.IDENTIFIER()!.getText();
    this.recordCallsFromArgList(funcName, paramSet, calleeName, firstOp);
  }

  /**
   * Handle scope-qualified calls: Scope.method(...) or global.Scope.method(...)
   * Track member accesses to build the mangled callee name (e.g., Storage_load)
   */
  private handleScopeQualifiedCalls(
    funcName: string,
    paramSet: Set<string>,
    primary: Parser.PrimaryExpressionContext,
    postfixOps: Parser.PostfixOpContext[],
  ): void {
    if (postfixOps.length === 0) return;

    const memberNames = this.collectInitialMemberNames(funcName, primary);

    for (const op of postfixOps) {
      if (op.IDENTIFIER()) {
        memberNames.push(op.IDENTIFIER()!.getText());
      } else if (op.LPAREN() && memberNames.length >= 1) {
        const calleeName = memberNames.join("_");
        this.recordCallsFromArgList(funcName, paramSet, calleeName, op);
        memberNames.length = 0; // Reset for potential chained calls
      } else if (op.expression().length > 0) {
        memberNames.length = 0; // Array subscript breaks scope chain
      }
    }
  }

  /**
   * Collect initial member names from primary expression for scope resolution.
   * Issue #561: When 'this' is used, resolve to the current scope name from funcName.
   */
  private collectInitialMemberNames(
    funcName: string,
    primary: Parser.PrimaryExpressionContext,
  ): string[] {
    const memberNames: string[] = [];
    const primaryId = primary.IDENTIFIER()?.getText();

    if (primaryId && primaryId !== "global") {
      memberNames.push(primaryId);
    } else if (primary.THIS()) {
      const scopeName = funcName.split("_")[0];
      if (scopeName && scopeName !== funcName) {
        memberNames.push(scopeName);
      }
    }
    return memberNames;
  }

  /**
   * Record function calls to the call graph from an argument list.
   * Also recurses into argument expressions.
   */
  private recordCallsFromArgList(
    funcName: string,
    paramSet: Set<string>,
    calleeName: string,
    op: Parser.PostfixOpContext,
  ): void {
    const argList = op.argumentList();
    if (!argList) return;

    const args = argList.expression();
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      const argName = ExpressionUtils.extractIdentifier(arg);
      if (argName && paramSet.has(argName)) {
        this.functionCallGraph.get(funcName)!.push({
          callee: calleeName,
          paramIndex: i,
          argParamName: argName,
        });
      }
      this.walkExpressionForCalls(funcName, paramSet, arg);
    }
  }

  /**
   * Walk postfix ops recursively for nested calls and array subscripts.
   */
  private walkPostfixOpsRecursively(
    funcName: string,
    paramSet: Set<string>,
    postfixOps: Parser.PostfixOpContext[],
  ): void {
    for (const op of postfixOps) {
      if (op.argumentList()) {
        for (const argExpr of op.argumentList()!.expression()) {
          this.walkExpressionForCalls(funcName, paramSet, argExpr);
        }
      }
      for (const expr of op.expression()) {
        this.walkExpressionForCalls(funcName, paramSet, expr);
      }
    }
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
   * Issue #644: Delegates to ArrayDimensionParser for consolidated implementation.
   */
  private _tryEvaluateConstant(
    ctx: Parser.ExpressionContext,
  ): number | undefined {
    return ArrayDimensionParser.parseSingleDimension(ctx, {
      constValues: this.constValues,
      typeWidths: TYPE_WIDTH,
      isKnownStruct: (name) => this.isKnownStruct(name),
    });
  }

  // Issue #63: checkArrayBounds moved to TypeValidator

  /**
   * Evaluate array dimensions from ArrayDimensionContext[] to number[].
   * Used for bitmap array registration.
   * Issue #644: Delegates to ArrayDimensionParser for consolidated implementation.
   */
  private _evaluateArrayDimensions(
    arrayDim: Parser.ArrayDimensionContext[] | null,
  ): number[] | undefined {
    return ArrayDimensionParser.parseAllDimensions(arrayDim, {
      constValues: this.constValues,
      typeWidths: TYPE_WIDTH,
      isKnownStruct: (name) => this.isKnownStruct(name),
    });
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
   * Extract type info from a variable declaration and register it.
   * Delegates to trackVariableTypeWithName using the variable's identifier.
   */
  private trackVariableType(varDecl: Parser.VariableDeclarationContext): void {
    const name = varDecl.IDENTIFIER().getText();
    this.trackVariableTypeWithName(varDecl, name);
  }

  // =========================================================================
  // Type Registration Helpers - Extracted to reduce cognitive complexity
  // =========================================================================

  /**
   * Extract array dimensions from ArrayDimensionContext array (simple parseInt version)
   * Used for string array dimensions where const evaluation is not needed.
   * Issue #644: Delegates to ArrayDimensionParser for consolidated implementation.
   */
  private extractArrayDimensionsSimple(
    arrayDim: Parser.ArrayDimensionContext[] | null,
  ): number[] {
    return ArrayDimensionParser.parseSimpleDimensions(arrayDim);
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
      this._registerArrayTypeVariable(
        registryName,
        typeCtx.arrayType()!,
        arrayDim,
        isConst,
        overflowBehavior,
        isAtomic,
      );
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
    this._registerStandardType(
      registryName,
      baseType,
      arrayDim,
      isConst,
      overflowBehavior,
      isAtomic,
    );
  }

  /**
   * Register an array type variable (u8[10] syntax)
   */
  private _registerArrayTypeVariable(
    registryName: string,
    arrayTypeCtx: Parser.ArrayTypeContext,
    arrayDim: Parser.ArrayDimensionContext[] | null,
    isConst: boolean,
    overflowBehavior: TOverflowBehavior,
    isAtomic: boolean,
  ): void {
    let baseType = "";
    let bitWidth = 0;

    if (arrayTypeCtx.primitiveType()) {
      baseType = arrayTypeCtx.primitiveType()!.getText();
      bitWidth = TYPE_WIDTH[baseType] || 0;
    }

    if (!baseType) {
      return;
    }

    const arrayDimensions = this._collectArrayDimensions(
      arrayTypeCtx,
      arrayDim,
    );

    this.context.typeRegistry.set(registryName, {
      baseType,
      bitWidth,
      isArray: true,
      arrayDimensions: arrayDimensions.length > 0 ? arrayDimensions : undefined,
      isConst,
      overflowBehavior,
      isAtomic,
    });
  }

  /**
   * Collect array dimensions from array type and additional dimensions
   */
  private _collectArrayDimensions(
    arrayTypeCtx: Parser.ArrayTypeContext,
    arrayDim: Parser.ArrayDimensionContext[] | null,
  ): number[] {
    const arrayDimensions: number[] = [];

    // Get dimension from array type syntax
    const sizeExpr = arrayTypeCtx.expression();
    if (sizeExpr) {
      const size = Number.parseInt(sizeExpr.getText(), 10);
      if (!Number.isNaN(size)) {
        arrayDimensions.push(size);
      }
    }

    // Add additional dimensions using const evaluation
    const additionalDims = this._evaluateArrayDimensions(arrayDim);
    if (additionalDims) {
      arrayDimensions.push(...additionalDims);
    }

    return arrayDimensions;
  }

  /**
   * Register a standard (non-array-syntax, non-special) type
   */
  private _registerStandardType(
    registryName: string,
    baseType: string,
    arrayDim: Parser.ArrayDimensionContext[] | null,
    isConst: boolean,
    overflowBehavior: TOverflowBehavior,
    isAtomic: boolean,
  ): void {
    const bitWidth = TYPE_WIDTH[baseType] || 0;
    // Issue #665: Check array syntax presence first, then try to resolve dimensions
    // This matches the pattern in trackVariableType() - unresolved dimensions (e.g., enum
    // members like EIndex.COUNT) should still mark the variable as an array
    const isArray = arrayDim !== null && arrayDim.length > 0;
    const arrayDimensions = isArray
      ? this._evaluateArrayDimensions(arrayDim)
      : undefined;

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
      this._processParameter(param);
    }
  }

  /**
   * Process a single parameter declaration
   */
  private _processParameter(param: Parser.ParameterContext): void {
    const name = param.IDENTIFIER().getText();
    const isArray = param.arrayDimension().length > 0;
    const isConst = param.constModifier() !== null;
    const typeCtx = param.type();

    // Resolve type information
    const typeInfo = this._resolveParameterTypeInfo(typeCtx);

    // Register in currentParameters
    this.context.currentParameters.set(name, {
      name,
      baseType: typeInfo.typeName,
      isArray,
      isStruct: typeInfo.isStruct,
      isConst,
      isCallback: typeInfo.isCallback,
      isString: typeInfo.isString,
    });

    // Register in typeRegistry
    this._registerParameterType(name, typeInfo, param, isArray, isConst);
  }

  /**
   * Resolve type name and flags from a type context
   */
  private _resolveParameterTypeInfo(typeCtx: Parser.TypeContext): {
    typeName: string;
    isStruct: boolean;
    isCallback: boolean;
    isString: boolean;
  } {
    if (typeCtx.primitiveType()) {
      return {
        typeName: typeCtx.primitiveType()!.getText(),
        isStruct: false,
        isCallback: false,
        isString: false,
      };
    }

    if (typeCtx.userType()) {
      const typeName = typeCtx.userType()!.getText();
      return {
        typeName,
        isStruct: this.isStructType(typeName),
        isCallback: this.callbackTypes.has(typeName),
        isString: false,
      };
    }

    if (typeCtx.qualifiedType()) {
      const identifierNames = typeCtx
        .qualifiedType()!
        .IDENTIFIER()
        .map((id) => id.getText());
      const typeName = this.resolveQualifiedType(identifierNames);
      return {
        typeName,
        isStruct: this.isStructType(typeName),
        isCallback: false,
        isString: false,
      };
    }

    if (typeCtx.scopedType()) {
      const localTypeName = typeCtx.scopedType()!.IDENTIFIER().getText();
      const typeName = this.context.currentScope
        ? `${this.context.currentScope}_${localTypeName}`
        : localTypeName;
      return {
        typeName,
        isStruct: this.isStructType(typeName),
        isCallback: false,
        isString: false,
      };
    }

    if (typeCtx.globalType()) {
      const typeName = typeCtx.globalType()!.IDENTIFIER().getText();
      return {
        typeName,
        isStruct: this.isStructType(typeName),
        isCallback: false,
        isString: false,
      };
    }

    if (typeCtx.stringType()) {
      return {
        typeName: "string",
        isStruct: false,
        isCallback: false,
        isString: true,
      };
    }

    // Fallback
    return {
      typeName: typeCtx.getText(),
      isStruct: false,
      isCallback: false,
      isString: false,
    };
  }

  /**
   * Register a parameter in the type registry
   */
  private _registerParameterType(
    name: string,
    typeInfo: { typeName: string; isString: boolean },
    param: Parser.ParameterContext,
    isArray: boolean,
    isConst: boolean,
  ): void {
    const { typeName, isString } = typeInfo;
    const typeCtx = param.type();

    const isEnum = this.symbols!.knownEnums.has(typeName);
    const isBitmap = this.symbols!.knownBitmaps.has(typeName);

    // Extract array dimensions
    const arrayDimensions = isArray
      ? ArrayDimensionParser.parseForParameters(param.arrayDimension())
      : [];

    // Get string capacity if applicable
    const stringCapacity = this._getStringCapacity(typeCtx, isString);
    if (isArray && stringCapacity !== undefined) {
      arrayDimensions.push(stringCapacity + 1);
    }

    this.context.typeRegistry.set(name, {
      baseType: typeName,
      bitWidth: isBitmap
        ? this.symbols!.bitmapBitWidth.get(typeName) || 0
        : TYPE_WIDTH[typeName] || 0,
      isArray,
      arrayDimensions: arrayDimensions.length > 0 ? arrayDimensions : undefined,
      isConst,
      isEnum,
      enumTypeName: isEnum ? typeName : undefined,
      isBitmap,
      bitmapTypeName: isBitmap ? typeName : undefined,
      isString,
      stringCapacity,
      isParameter: true,
    });
  }

  /**
   * Extract string capacity from a string type context
   */
  private _getStringCapacity(
    typeCtx: Parser.TypeContext,
    isString: boolean,
  ): number | undefined {
    if (!isString || !typeCtx.stringType()) return undefined;
    const intLiteral = typeCtx.stringType()!.INTEGER_LITERAL();
    if (!intLiteral) return undefined;
    return Number.parseInt(intLiteral.getText(), 10);
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
   * ADR-016: Check this.State.IDLE pattern (this.Enum.Member inside scope)
   */
  private _getEnumTypeFromThisEnum(parts: string[]): string | null {
    if (parts[0] !== "this" || !this.context.currentScope || parts.length < 3) {
      return null;
    }
    const enumName = parts[1];
    const scopedEnumName = `${this.context.currentScope}_${enumName}`;
    return this.symbols!.knownEnums.has(scopedEnumName) ? scopedEnumName : null;
  }

  /**
   * Issue #478: Check global.Enum.Member pattern (global.ECategory.CAT_A)
   */
  private _getEnumTypeFromGlobalEnum(parts: string[]): string | null {
    if (parts[0] !== "global" || parts.length < 3) {
      return null;
    }
    const enumName = parts[1];
    return this.symbols!.knownEnums.has(enumName) ? enumName : null;
  }

  /**
   * ADR-016: Check this.variable pattern (this.varName where varName is enum type)
   */
  private _getEnumTypeFromThisVariable(parts: string[]): string | null {
    if (
      parts[0] !== "this" ||
      !this.context.currentScope ||
      parts.length !== 2
    ) {
      return null;
    }
    const varName = parts[1];
    const scopedVarName = `${this.context.currentScope}_${varName}`;
    const typeInfo = this.context.typeRegistry.get(scopedVarName);
    if (typeInfo?.isEnum && typeInfo.enumTypeName) {
      return typeInfo.enumTypeName;
    }
    return null;
  }

  /**
   * Check scoped enum: Motor.State.IDLE -> Motor_State
   */
  private _getEnumTypeFromScopedEnum(parts: string[]): string | null {
    if (parts.length < 3) {
      return null;
    }
    const scopeName = parts[0];
    const enumName = parts[1];
    const scopedEnumName = `${scopeName}_${enumName}`;
    return this.symbols!.knownEnums.has(scopedEnumName) ? scopedEnumName : null;
  }

  /**
   * Check if parts represent an enum member access and return the enum type.
   */
  private _getEnumTypeFromMemberAccess(parts: string[]): string | null {
    if (parts.length < 2) {
      return null;
    }

    // ADR-016: Check this.State.IDLE pattern
    const thisEnumType = this._getEnumTypeFromThisEnum(parts);
    if (thisEnumType) return thisEnumType;

    // Issue #478: Check global.Enum.Member pattern
    const globalEnumType = this._getEnumTypeFromGlobalEnum(parts);
    if (globalEnumType) return globalEnumType;

    // ADR-016: Check this.variable pattern
    const thisVarType = this._getEnumTypeFromThisVariable(parts);
    if (thisVarType) return thisVarType;

    // Check simple enum: State.IDLE
    const possibleEnum = parts[0];
    if (this.symbols!.knownEnums.has(possibleEnum)) {
      return possibleEnum;
    }

    // Check scoped enum: Motor.State.IDLE -> Motor_State
    return this._getEnumTypeFromScopedEnum(parts);
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
  private _getExpressionEnumType(
    ctx: Parser.ExpressionContext | Parser.RelationalExpressionContext,
  ): string | null {
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

    // Check member access patterns: EnumType.MEMBER, Scope.EnumType.MEMBER, etc.
    return this._getEnumTypeFromMemberAccess(text.split("."));
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
   * Issue #707: Uses ExpressionUnwrapper for tree navigation.
   */
  private _getSubstringOperands(ctx: Parser.ExpressionContext): {
    source: string;
    start: string;
    length: string;
    sourceCapacity: number;
  } | null {
    // Navigate to the postfix expression level using shared utility
    const postfix = ExpressionUnwrapper.getPostfixExpression(ctx);
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

  // NOTE: Public isIntegerType and isFloatType moved to IOrchestrator interface (ADR-053 A2)
  // Private versions kept for internal use
  private _isIntegerType(typeName: string): boolean {
    return this.typeResolver!.isIntegerType(typeName);
  }

  private _isFloatType(typeName: string): boolean {
    return this.typeResolver!.isFloatType(typeName);
  }

  /**
   * Get full type info for a struct member field.
   * Single source of truth for both expression path (IOrchestrator) and
   * assignment path (IHandlerDeps). Checks SymbolTable first for C header
   * structs, then falls back to C-Next struct fields.
   */
  private _getFullMemberTypeInfo(
    structType: string,
    memberName: string,
  ): TTypeInfo | null {
    const fieldInfo = this._getStructFieldInfo(structType, memberName);
    if (!fieldInfo) return null;

    // Check dimensions first, then fall back to structFieldArrays for fields
    // with unresolved dimension expressions (e.g., u8 data[SOME_CONSTANT])
    const isArray =
      (fieldInfo.dimensions !== undefined && fieldInfo.dimensions.length > 0) ||
      (this.symbols!.structFieldArrays.get(structType)?.has(memberName) ??
        false);
    const dims = fieldInfo.dimensions?.filter(
      (d): d is number => typeof d === "number",
    );

    return {
      baseType: fieldInfo.type,
      bitWidth: TYPE_WIDTH[fieldInfo.type] ?? 32,
      isConst: false,
      isArray,
      arrayDimensions: dims && dims.length > 0 ? dims : undefined,
    };
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
   * ADR-024: Get the type of a unary expression (for cast validation).
   */
  private getUnaryExpressionType(
    ctx: Parser.UnaryExpressionContext,
  ): string | null {
    return this.typeResolver!.getUnaryExpressionType(ctx);
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
   * Issue #707: Delegates to ExpressionUnwrapper utility.
   */
  private getPostfixExpression(
    ctx: Parser.ExpressionContext,
  ): Parser.PostfixExpressionContext | null {
    return ExpressionUnwrapper.getPostfixExpression(ctx);
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
    const result = CppMemberHelper.getLastPostfixOpType(
      this._toPostfixOps(ops),
    );

    // Function calls are not lvalues
    if (result === "function") return null;
    return result;
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

    const primary = postfix.primaryExpression();
    if (!primary) return false;
    const baseId = primary.IDENTIFIER()?.getText();
    if (!baseId) return false;

    const ops = postfix.postfixOp();

    // Case 1: Direct parameter member access (cfg.value)
    const paramInfo = this.context.currentParameters.get(baseId);
    if (paramInfo) {
      return this._needsParamMemberConversion(paramInfo, targetParamBaseType);
    }

    // Case 2: Array element or function return member access
    return this._needsComplexMemberConversion(ops, baseId, targetParamBaseType);
  }

  /**
   * Case 1: Direct parameter member access needs conversion?
   * Issue #251: Const struct parameter needs temp to break const chain
   * Issue #252: External C structs may have bool/enum members
   */
  private _needsParamMemberConversion(
    paramInfo: { baseType: string; isStruct?: boolean; isConst?: boolean },
    targetParamBaseType: string,
  ): boolean {
    return CppMemberHelper.needsParamMemberConversion(
      paramInfo,
      targetParamBaseType,
    );
  }

  /**
   * Convert parser PostfixOpContext to IPostfixOp interface for CppMemberHelper.
   */
  private _toPostfixOps(ops: Parser.PostfixOpContext[]): IPostfixOp[] {
    return ops.map((op) => ({
      hasExpression: op.expression() !== null,
      hasIdentifier: op.IDENTIFIER() !== null,
      hasArgumentList: op.argumentList() !== null,
      textEndsWithParen: op.getText().endsWith(")"),
    }));
  }

  /**
   * Case 2: Array element or function return member access needs conversion?
   * Issue #256: arr[i].member or getConfig().member patterns
   */
  private _needsComplexMemberConversion(
    ops: Parser.PostfixOpContext[],
    baseId: string,
    targetParamBaseType: string,
  ): boolean {
    const typeInfo = this.context.typeRegistry.get(baseId);
    return CppMemberHelper.needsComplexMemberConversion(
      this._toPostfixOps(ops),
      typeInfo,
      targetParamBaseType,
    );
  }

  /**
   * Issue #246: Check if an expression is a subscript access on a string variable.
   * For example, buf[0] where buf is a string<N>.
   * Used to determine when to cast char* to uint8_t* etc.
   */
  private isStringSubscriptAccess(ctx: Parser.ExpressionContext): boolean {
    const postfix = this.getPostfixExpression(ctx);
    if (!postfix) return false;

    const ops = postfix.postfixOp();
    const hasPostfixOps = ops.length > 0;
    const lastOpHasExpression =
      hasPostfixOps && ops.at(-1)!.expression() !== null;

    // Get the base identifier
    const primary = postfix.primaryExpression();
    const baseId = primary.IDENTIFIER()?.getText();
    if (!baseId) return false;

    const typeInfo = this.context.typeRegistry.get(baseId);
    const paramInfo = this.context.currentParameters.get(baseId);

    return CppMemberHelper.isStringSubscriptPattern(
      hasPostfixOps,
      lastOpHasExpression,
      typeInfo,
      paramInfo?.isString ?? false,
    );
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
   * Generate a function argument with proper ADR-006 semantics.
   * - Local variables get & (address-of)
   * - Member access (cursor.x) gets & (address-of)
   * - Array access (arr[i]) gets & (address-of)
   * - Parameters are passed as-is (already pointers)
   * - Arrays are passed as-is (naturally decay to pointers)
   * - Literals use compound literals for pointer params: &(type){value}
   * - Complex expressions are passed as-is
   */
  private _generateFunctionArg(
    ctx: Parser.ExpressionContext,
    targetParamBaseType?: string,
  ): string {
    const id = this._getSimpleIdentifier(ctx);
    if (id) {
      return this._handleIdentifierArg(id);
    }

    const lvalueType = this.getLvalueType(ctx);
    if (lvalueType) {
      return this._handleLvalueArg(ctx, lvalueType, targetParamBaseType);
    }

    return this._handleRvalueArg(ctx, targetParamBaseType);
  }

  /**
   * Handle simple identifier argument (parameter, local array, scope member, or variable)
   */
  private _handleIdentifierArg(id: string): string {
    // Parameters are already pointers
    if (this.context.currentParameters.get(id)) {
      return id;
    }

    // Local arrays decay to pointers
    if (this.context.localArrays.has(id)) {
      return id;
    }

    // Scope member - may need prefixing
    if (this.context.currentScope) {
      const members = this.context.scopeMembers.get(this.context.currentScope);
      if (members?.has(id)) {
        const scopedName = `${this.context.currentScope}_${id}`;
        return this.cppHelper!.maybeAddressOf(scopedName);
      }
    }

    // Local variable - add & (except in C++ mode)
    return this.cppHelper!.maybeAddressOf(id);
  }

  /**
   * Handle lvalue argument (member access or array access)
   */
  private _handleLvalueArg(
    ctx: Parser.ExpressionContext,
    lvalueType: string,
    targetParamBaseType?: string,
  ): string {
    // Member access to array field - arrays decay to pointers
    if (lvalueType === "member") {
      const memberResult = this._handleMemberAccessArg(
        ctx,
        targetParamBaseType,
      );
      if (memberResult) return memberResult;
    }

    // Generate expression with address-of
    const generatedExpr = this._generateExpression(ctx);
    const expr = this.cppHelper!.maybeAddressOf(generatedExpr);

    // String subscript access may need cast
    if (lvalueType === "array") {
      return this._maybeCastStringSubscript(ctx, expr, targetParamBaseType);
    }

    return expr;
  }

  /**
   * Handle member access argument - may need special handling for arrays or C++ conversions
   */
  private _handleMemberAccessArg(
    ctx: Parser.ExpressionContext,
    targetParamBaseType?: string,
  ): string | null {
    const arrayStatus = this.getMemberAccessArrayStatus(ctx);

    // Array member - no address-of needed
    if (arrayStatus === "array") {
      return this._generateExpression(ctx);
    }

    // C++ mode may need temp variable for type conversion
    if (
      arrayStatus === "not-array" &&
      this.needsCppMemberConversion(ctx, targetParamBaseType)
    ) {
      return this._createCppMemberConversionTemp(ctx, targetParamBaseType!);
    }

    return null; // Fall through to default lvalue handling
  }

  /**
   * Create temp variable for C++ member conversion
   */
  private _createCppMemberConversionTemp(
    ctx: Parser.ExpressionContext,
    targetParamBaseType: string,
  ): string {
    const cType = TYPE_MAP[targetParamBaseType] || "uint8_t";
    const value = this._generateExpression(ctx);
    const tempName = `_cnx_tmp_${this.tempVarCounter++}`;
    const castExpr = this.cppHelper!.cast(cType, value);
    this.pendingTempDeclarations.push(`${cType} ${tempName} = ${castExpr};`);
    return this.cppHelper!.maybeAddressOf(tempName);
  }

  /**
   * Maybe cast string subscript access for integer pointer parameters
   */
  private _maybeCastStringSubscript(
    ctx: Parser.ExpressionContext,
    expr: string,
    targetParamBaseType?: string,
  ): string {
    if (!targetParamBaseType || !this.isStringSubscriptAccess(ctx)) {
      return expr;
    }

    const cType = TYPE_MAP[targetParamBaseType];
    if (cType && !["float", "double", "bool", "void"].includes(cType)) {
      return this.cppHelper!.reinterpretCast(`${cType}*`, expr);
    }

    return expr;
  }

  /**
   * Handle rvalue argument (literals or complex expressions)
   */
  private _handleRvalueArg(
    ctx: Parser.ExpressionContext,
    targetParamBaseType?: string,
  ): string {
    if (!targetParamBaseType) {
      return this._generateExpression(ctx);
    }

    const cType = TYPE_MAP[targetParamBaseType];
    if (!cType || cType === "void") {
      return this._generateExpression(ctx);
    }

    const value = this._generateExpression(ctx);

    // C++ mode: rvalues can bind to const T&
    if (this.cppMode) {
      return value;
    }

    // C mode: Use compound literal syntax
    return `&(${cType}){${value}}`;
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
      this._generateScopeMember(member, name, lines);
    }

    lines.push("");
    this.context.currentScope = null;
    return lines.join("\n");
  }

  /**
   * Generate code for a single scope member
   */
  private _generateScopeMember(
    member: Parser.ScopeMemberContext,
    scopeName: string,
    lines: string[],
  ): void {
    const visibility = member.visibilityModifier()?.getText() || "private";
    const isPrivate = visibility === "private";

    if (member.variableDeclaration()) {
      this._generateScopeVariable(
        member.variableDeclaration()!,
        scopeName,
        isPrivate,
        lines,
      );
    } else if (member.functionDeclaration()) {
      this._generateScopeFunction(
        member.functionDeclaration()!,
        scopeName,
        isPrivate,
        lines,
      );
    } else if (member.enumDeclaration()) {
      lines.push("", this.generateEnum(member.enumDeclaration()!));
    } else if (member.bitmapDeclaration()) {
      lines.push("", this.generateBitmap(member.bitmapDeclaration()!));
    } else if (member.registerDeclaration()) {
      lines.push(
        "",
        this.generateScopedRegister(member.registerDeclaration()!, scopeName),
      );
    }
  }

  /**
   * Generate code for a scope variable declaration
   */
  private _generateScopeVariable(
    varDecl: Parser.VariableDeclarationContext,
    scopeName: string,
    isPrivate: boolean,
    lines: string[],
  ): void {
    const type = this._generateType(varDecl.type());
    const varName = varDecl.IDENTIFIER().getText();
    const fullName = `${scopeName}_${varName}`;
    const prefix = isPrivate ? "static " : "";

    const arrayDims = varDecl.arrayDimension();
    const isArray = arrayDims.length > 0;

    let decl = `${prefix}${type} ${fullName}`;
    if (isArray) {
      decl += this._generateArrayDimensions(arrayDims);
    }

    // ADR-045: Add string capacity dimension for string arrays
    decl += this._getStringCapacityDimension(varDecl.type());

    if (varDecl.expression()) {
      decl += ` = ${this._generateExpression(varDecl.expression()!)}`;
    } else {
      // ADR-015: Zero initialization for uninitialized scope variables
      decl += ` = ${this._getZeroInitializer(varDecl.type(), isArray)}`;
    }
    lines.push(decl + ";");
  }

  /**
   * Get string capacity dimension if type is string<N>
   */
  private _getStringCapacityDimension(typeCtx: Parser.TypeContext): string {
    if (!typeCtx.stringType()) return "";
    const intLiteral = typeCtx.stringType()!.INTEGER_LITERAL();
    if (!intLiteral) return "";
    const capacity = Number.parseInt(intLiteral.getText(), 10);
    return `[${capacity + 1}]`;
  }

  /**
   * Generate code for a scope function declaration
   */
  private _generateScopeFunction(
    funcDecl: Parser.FunctionDeclarationContext,
    scopeName: string,
    isPrivate: boolean,
    lines: string[],
  ): void {
    const returnType = this._generateType(funcDecl.type());
    const funcName = funcDecl.IDENTIFIER().getText();
    const fullName = `${scopeName}_${funcName}`;
    const prefix = isPrivate ? "static " : "";

    // Issue #269: Set current function name for pass-by-value lookup
    this.context.currentFunctionName = fullName;
    // Issue #477: Set return type for enum inference in return statements
    this.context.currentFunctionReturnType = funcDecl.type().getText();

    // Track parameters for ADR-006 pointer semantics
    this._setParameters(funcDecl.parameterList() ?? null);

    // ADR-016: Enter function body context (also clears modifiedParameters for Issue #281)
    this.enterFunctionBody();

    // Issue #281: Generate body FIRST to track parameter modifications
    const body = this.generateBlock(funcDecl.block());

    // Issue #281: Update symbol's parameter info with auto-const before generating params
    this.updateFunctionParamsAutoConst(fullName);

    // Now generate parameter list (can use modifiedParameters for auto-const)
    const params = funcDecl.parameterList()
      ? this._generateParameterList(funcDecl.parameterList()!)
      : "void";

    // ADR-016: Exit function body context
    this.exitFunctionBody();
    this.context.currentFunctionName = null;
    this.context.currentFunctionReturnType = null;
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

    // Set up function context
    this._setupFunctionContext(name, ctx);

    // Check for main function with args parameter (u8 args[][])
    const isMainWithArgs = this._isMainFunctionWithArgs(
      name,
      ctx.parameterList(),
    );

    // Get return type and params, handling main with args special case
    const { actualReturnType, initialParams } =
      this._resolveReturnTypeAndParams(name, returnType, isMainWithArgs, ctx);

    // Generate body first (this populates modifiedParameters)
    const body = this.generateBlock(ctx.block());

    // Issue #268: Update symbol's parameter info with auto-const before clearing
    this.updateFunctionParamsAutoConst(name);

    // Now generate parameter list (can use modifiedParameters for auto-const)
    let params: string;
    if (isMainWithArgs) {
      params = initialParams;
    } else if (ctx.parameterList()) {
      params = this._generateParameterList(ctx.parameterList()!);
    } else {
      params = "void";
    }

    // Clean up function context
    this._cleanupFunctionContext();

    const functionCode = `${actualReturnType} ${name}(${params}) ${body}\n`;

    // ADR-029: Generate callback typedef only if this function is used as a type
    return this._appendCallbackTypedefIfNeeded(name, functionCode);
  }

  /**
   * Set up context for function generation
   */
  private _setupFunctionContext(
    name: string,
    ctx: Parser.FunctionDeclarationContext,
  ): void {
    // Issue #269: Set current function name for pass-by-value lookup
    const fullFuncName = this.context.currentScope
      ? `${this.context.currentScope}_${name}`
      : name;
    this.context.currentFunctionName = fullFuncName;
    // Issue #477: Set return type for enum inference in return statements
    this.context.currentFunctionReturnType = ctx.type().getText();

    // Track parameters for ADR-006 pointer semantics
    this._setParameters(ctx.parameterList() ?? null);

    // ADR-016: Clear local variables and mark that we're in a function body
    this.context.localVariables.clear();
    this.context.floatBitShadows.clear();
    this.context.floatShadowCurrent.clear();
    this.context.inFunctionBody = true;
  }

  /**
   * Resolve return type and initial params for function
   */
  private _resolveReturnTypeAndParams(
    name: string,
    returnType: string,
    isMainWithArgs: boolean,
    ctx: Parser.FunctionDeclarationContext,
  ): { actualReturnType: string; initialParams: string } {
    if (isMainWithArgs) {
      // Special case: main(u8 args[][]) -> int main(int argc, char *argv[])
      const argsParam = ctx.parameterList()!.parameter()[0];
      this.context.mainArgsName = argsParam.IDENTIFIER().getText();
      return {
        actualReturnType: "int",
        initialParams: "int argc, char *argv[]",
      };
    }

    // For main() without args, always use int return type for C++ compatibility
    const actualReturnType = name === "main" ? "int" : returnType;
    return { actualReturnType, initialParams: "" };
  }

  /**
   * Clean up context after function generation
   */
  private _cleanupFunctionContext(): void {
    this.context.inFunctionBody = false;
    this.context.localVariables.clear();
    this.context.floatBitShadows.clear();
    this.context.floatShadowCurrent.clear();
    this.context.mainArgsName = null;
    this.context.currentFunctionName = null;
    this.context.currentFunctionReturnType = null;
    this._clearParameters();
  }

  /**
   * Append callback typedef if function is used as a field type
   */
  private _appendCallbackTypedefIfNeeded(
    name: string,
    functionCode: string,
  ): string {
    if (name === "main") {
      return functionCode;
    }

    if (!this._isCallbackTypeUsedAsFieldType(name)) {
      return functionCode;
    }

    const typedef = this._generateCallbackTypedef(name);
    return typedef ? functionCode + typedef : functionCode;
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
      return `${callbackInfo.typedefName} ${name}`;
    }

    const type = this._generateType(ctx.type());

    // Try special cases first
    const stringArrayResult = this._tryGenerateStringArrayParam(
      ctx,
      constMod,
      name,
      dims,
    );
    if (stringArrayResult) return stringArrayResult;

    const arrayResult = this._tryGenerateArrayParam(constMod, type, name, dims);
    if (arrayResult) return arrayResult;

    // Pass-by-value types
    if (this._isPassByValueType(typeName, name)) {
      return `${constMod}${type} ${name}`;
    }

    // Non-array string parameters
    const stringResult = this._tryGenerateStringParam(
      ctx,
      constMod,
      name,
      dims,
    );
    if (stringResult) return stringResult;

    // Pass-by-reference types
    const refResult = this._tryGenerateRefParam(constMod, type, typeName, name);
    if (refResult) return refResult;

    // Unknown types use pass-by-value (standard C semantics)
    return `${constMod}${type} ${name}`;
  }

  /**
   * Try to generate string array parameter: string<N>[] -> char arr[n][N+1]
   */
  private _tryGenerateStringArrayParam(
    ctx: Parser.ParameterContext,
    constMod: string,
    name: string,
    dims: Parser.ArrayDimensionContext[],
  ): string | null {
    if (!ctx.type().stringType() || dims.length === 0) {
      return null;
    }

    const stringType = ctx.type().stringType()!;
    const capacity = stringType.INTEGER_LITERAL()
      ? Number.parseInt(stringType.INTEGER_LITERAL()!.getText(), 10)
      : 256;
    const dimStr = dims.map((d) => this._generateArrayDimension(d)).join("");
    return `${constMod}char ${name}${dimStr}[${capacity + 1}]`;
  }

  /**
   * Try to generate array parameter with auto-const
   */
  private _tryGenerateArrayParam(
    constMod: string,
    type: string,
    name: string,
    dims: Parser.ArrayDimensionContext[],
  ): string | null {
    if (dims.length === 0) {
      return null;
    }

    const dimStr = dims.map((d) => this._generateArrayDimension(d)).join("");
    const wasModified = this._isCurrentParameterModified(name);
    const autoConst = !wasModified && !constMod ? "const " : "";
    return `${autoConst}${constMod}${type} ${name}${dimStr}`;
  }

  /**
   * Check if type should use pass-by-value semantics
   */
  private _isPassByValueType(typeName: string, name: string): boolean {
    // ISR, float, enum types
    if (typeName === "ISR") return true;
    if (this._isFloatType(typeName)) return true;
    if (this.symbols!.knownEnums.has(typeName)) return true;

    // Small unmodified primitives
    if (
      this.context.currentFunctionName &&
      this._isParameterPassByValueByName(this.context.currentFunctionName, name)
    ) {
      return true;
    }

    return false;
  }

  /**
   * Try to generate non-array string parameter: string<N> -> char*
   */
  private _tryGenerateStringParam(
    ctx: Parser.ParameterContext,
    constMod: string,
    name: string,
    dims: Parser.ArrayDimensionContext[],
  ): string | null {
    if (!ctx.type().stringType() || dims.length !== 0) {
      return null;
    }

    const wasModified = this._isCurrentParameterModified(name);
    const autoConst = !wasModified && !constMod ? "const " : "";
    return `${autoConst}${constMod}char* ${name}`;
  }

  /**
   * Try to generate pass-by-reference parameter for known types
   */
  private _tryGenerateRefParam(
    constMod: string,
    type: string,
    typeName: string,
    name: string,
  ): string | null {
    if (!this._isKnownStruct(typeName) && !this._isKnownPrimitive(typeName)) {
      return null;
    }

    const wasModified = this._isCurrentParameterModified(name);
    const autoConst = !wasModified && !constMod ? "const " : "";
    const refOrPtr = this.cppHelper!.refOrPtr();
    return `${autoConst}${constMod}${type}${refOrPtr} ${name}`;
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
    // Issue #375: Check for C++ constructor syntax - early return
    const constructorArgList = ctx.constructorArgumentList();
    if (constructorArgList) {
      return this._generateConstructorDecl(ctx, constructorArgList);
    }

    // Issue #696: Use helper for modifier extraction and validation
    const modifiers = VariableModifierBuilder.build(
      ctx,
      this.context.inFunctionBody,
    );

    const name = ctx.IDENTIFIER().getText();
    const typeCtx = ctx.type();
    const type = this._inferVariableType(ctx, name);

    // Track local variable metadata
    this._trackLocalVariable(ctx, name);

    // ADR-045: Handle bounded string type specially - early return
    const stringResult = this.stringDeclHelper!.generateStringDecl(
      typeCtx,
      name,
      ctx.expression() ?? null,
      ctx.arrayDimension(),
      modifiers,
      ctx.constModifier() !== null,
    );
    if (stringResult.handled) {
      return stringResult.code;
    }

    // Build base declaration
    const modifierPrefix = VariableModifierBuilder.toPrefix(modifiers);
    let decl = `${modifierPrefix}${type} ${name}`;

    // Handle array declarations - early return if array init handled
    const arrayResult = this._handleArrayDeclaration(ctx, typeCtx, name, decl);
    if (arrayResult.handled) {
      return arrayResult.code;
    }
    decl = arrayResult.decl;

    // Handle initialization
    decl = this._generateVariableInitializer(
      ctx,
      typeCtx,
      decl,
      arrayResult.isArray,
    );

    // Handle pending C++ class field assignments
    return this._finalizeCppClassAssignments(ctx, typeCtx, name, decl);
  }

  /**
   * Issue #696: Infer variable type, handling nullable C pointer types.
   */
  private _inferVariableType(
    ctx: Parser.VariableDeclarationContext,
    name: string,
  ): string {
    let type = this._generateType(ctx.type());

    // ADR-046: Handle nullable C pointer types (c_ prefix variables)
    if (!name.startsWith("c_") || !ctx.expression()) {
      return type;
    }

    const exprText = ctx.expression()!.getText();
    for (const funcName of NullCheckAnalyzer.getStructPointerFunctions()) {
      if (exprText.includes(`${funcName}(`)) {
        return `${type}*`;
      }
    }
    return type;
  }

  /**
   * Issue #696: Track local variable for type registry and const values.
   */
  private _trackLocalVariable(
    ctx: Parser.VariableDeclarationContext,
    name: string,
  ): void {
    if (!this.context.inFunctionBody) {
      return;
    }

    this.trackVariableType(ctx);
    this.context.localVariables.add(name);

    // Bug #8: Track local const values for array size and bit index resolution
    if (ctx.constModifier() && ctx.expression()) {
      const constValue = this._tryEvaluateConstant(ctx.expression()!);
      if (constValue !== undefined) {
        this.constValues.set(name, constValue);
      }
    }
  }

  /**
   * Issue #696: Handle array declaration with dimension parsing and init.
   */
  private _handleArrayDeclaration(
    ctx: Parser.VariableDeclarationContext,
    typeCtx: Parser.TypeContext,
    name: string,
    decl: string,
  ): { handled: boolean; code: string; decl: string; isArray: boolean } {
    const arrayDims = ctx.arrayDimension();
    const isArray = arrayDims.length > 0;

    if (!isArray) {
      return { handled: false, code: "", decl, isArray: false };
    }

    const hasEmptyArrayDim = arrayDims.some((dim) => !dim.expression());
    const declaredSize = this._parseFirstArrayDimension(arrayDims);

    // ADR-035: Handle array initializers with size inference
    if (ctx.expression()) {
      const arrayInitResult = this.arrayInitHelper!.processArrayInit(
        name,
        typeCtx,
        ctx.expression()!,
        arrayDims,
        hasEmptyArrayDim,
        declaredSize,
      );
      if (arrayInitResult) {
        return {
          handled: true,
          code: `${decl}${arrayInitResult.dimensionSuffix} = ${arrayInitResult.initValue};`,
          decl,
          isArray: true,
        };
      }
    }

    // Generate dimensions and track as local array
    const newDecl = decl + this._generateArrayDimensions(arrayDims);
    this.context.localArrays.add(name);

    return { handled: false, code: "", decl: newDecl, isArray: true };
  }

  /**
   * Issue #696: Parse first array dimension for validation.
   */
  private _parseFirstArrayDimension(
    arrayDims: Parser.ArrayDimensionContext[],
  ): number | null {
    if (arrayDims.length === 0 || !arrayDims[0].expression()) {
      return null;
    }
    const sizeText = arrayDims[0].expression()!.getText();
    if (/^\d+$/.exec(sizeText)) {
      return Number.parseInt(sizeText, 10);
    }
    return null;
  }

  /**
   * Issue #696: Generate variable initializer with validation.
   */
  private _generateVariableInitializer(
    ctx: Parser.VariableDeclarationContext,
    typeCtx: Parser.TypeContext,
    decl: string,
    isArray: boolean,
  ): string {
    if (!ctx.expression()) {
      // ADR-015: Zero initialization for uninitialized variables
      return `${decl} = ${this._getZeroInitializer(typeCtx, isArray)}`;
    }

    const typeName = this._getTypeName(typeCtx);
    const savedExpectedType = this.context.expectedType;
    this.context.expectedType = typeName;

    // ADR-017: Validate enum type for initialization
    this.enumValidator!.validateEnumAssignment(typeName, ctx.expression()!);

    // ADR-024: Validate integer literals and type conversions
    this._validateIntegerInitializer(ctx, typeName);

    const result = `${decl} = ${this._generateExpression(ctx.expression()!)}`;
    this.context.expectedType = savedExpectedType;

    return result;
  }

  /**
   * Issue #696: Validate integer initializer using helper.
   */
  private _validateIntegerInitializer(
    ctx: Parser.VariableDeclarationContext,
    typeName: string,
  ): void {
    if (!this._isIntegerType(typeName)) {
      return;
    }

    const exprText = ctx.expression()!.getText().trim();
    const line = ctx.start?.line ?? 0;
    const col = ctx.start?.column ?? 0;
    const isLiteral = LiteralUtils.parseIntegerLiteral(exprText) !== undefined;

    try {
      if (isLiteral) {
        // Direct literal - validate it fits in the target type
        this._validateLiteralFitsType(exprText, typeName);
      } else {
        // Not a literal - check for narrowing/sign conversions
        const sourceType = this.getExpressionType(ctx.expression()!);
        this._validateTypeConversion(typeName, sourceType);
      }
    } catch (validationError) {
      const msg =
        validationError instanceof Error
          ? validationError.message
          : String(validationError);
      throw new Error(`${line}:${col} ${msg}`, { cause: validationError });
    }
  }

  /**
   * Issue #696: Handle pending C++ class field assignments.
   */
  private _finalizeCppClassAssignments(
    _ctx: Parser.VariableDeclarationContext,
    typeCtx: Parser.TypeContext,
    name: string,
    decl: string,
  ): string {
    if (this.pendingCppClassAssignments.length === 0) {
      return `${decl};`;
    }

    if (this.context.inFunctionBody) {
      const assignments = this.pendingCppClassAssignments
        .map((a) => `${name}.${a}`)
        .join("\n");
      this.pendingCppClassAssignments = [];
      return `${decl};\n${assignments}`;
    }

    // At global scope, we can't emit assignment statements.
    this.pendingCppClassAssignments = [];
    throw new Error(
      `Error: C++ class '${this._getTypeName(typeCtx)}' with constructor cannot use struct initializer ` +
        `syntax at global scope. Use constructor syntax or initialize fields separately.`,
    );
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
    if (isArray) {
      return this._getArrayZeroInitializer(typeCtx);
    }

    // Handle named types (scoped, global, qualified, user)
    const resolved = this._resolveTypeNameFromContext(typeCtx);
    if (resolved) {
      // Check if enum
      if (this.symbols!.knownEnums.has(resolved.name)) {
        return this._getEnumZeroValue(resolved.name, resolved.separator);
      }
      // Check if C++ type needing {} (only for userType, not qualified/scoped/global)
      if (resolved.checkCppType && this._needsEmptyBraceInit(resolved.name)) {
        return "{}";
      }
      return "{0}";
    }

    // Issue #295: C++ template types use value initialization {}
    if (typeCtx.templateType()) {
      return "{}";
    }

    // Primitive types use lookup map
    if (typeCtx.primitiveType()) {
      const primType = typeCtx.primitiveType()!.getText();
      return CodeGenerator.PRIMITIVE_ZERO_VALUES.get(primType) ?? "0";
    }

    // Default fallback
    return "0";
  }

  /**
   * Get zero initializer for array types.
   * Issue #379: C++ class arrays must use {} instead of {0}
   */
  private _getArrayZeroInitializer(typeCtx: Parser.TypeContext): string {
    // Check if element type is a C++ class or template type
    if (typeCtx.userType()) {
      const typeName = typeCtx.userType()!.getText();
      if (this._needsEmptyBraceInit(typeName)) {
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

  /**
   * Get zero initializer for an enum type.
   * Returns member with value 0, or first member, or casted 0.
   * ADR-017: Enums initialize to first member
   */
  private _getEnumZeroValue(enumName: string, separator: string = "_"): string {
    const members = this.symbols!.enumMembers.get(enumName);
    if (!members) {
      return `(${enumName})0`;
    }

    // Find member with explicit value 0
    for (const [memberName, value] of members.entries()) {
      if (value === 0) {
        return `${enumName}${separator}${memberName}`;
      }
    }

    // Fall back to first member
    const firstMember = members.keys().next().value;
    if (firstMember) {
      return `${enumName}${separator}${firstMember}`;
    }

    return `(${enumName})0`;
  }

  /**
   * Resolve full type name from any TypeContext variant.
   * Returns { name, separator, checkCppType } or null if not a named type.
   * ADR-016: Handles scoped, global, qualified, and user types
   * checkCppType: only true for userType (original behavior preserved)
   */
  private _resolveTypeNameFromContext(
    typeCtx: Parser.TypeContext,
  ): { name: string; separator: string; checkCppType: boolean } | null {
    // ADR-016: Check for scoped types (this.Type)
    if (typeCtx.scopedType()) {
      const localName = typeCtx.scopedType()!.IDENTIFIER().getText();
      const name = this.context.currentScope
        ? `${this.context.currentScope}_${localName}`
        : localName;
      return { name, separator: "_", checkCppType: false };
    }

    // Issue #478: Check for global types (global.Type)
    if (typeCtx.globalType()) {
      return {
        name: typeCtx.globalType()!.IDENTIFIER().getText(),
        separator: "_",
        checkCppType: false,
      };
    }

    // ADR-016: Check for qualified types (Scope.Type)
    // Issue #388: Also handles C++ namespace types (MockLib.Parse.ParseResult)
    if (typeCtx.qualifiedType()) {
      const parts = typeCtx.qualifiedType()!.IDENTIFIER();
      const name = this.resolveQualifiedType(parts.map((id) => id.getText()));
      const separator = name.includes("::") ? "::" : "_";
      return { name, separator, checkCppType: false };
    }

    // Check for user-defined types (structs/classes/enums)
    if (typeCtx.userType()) {
      return {
        name: typeCtx.userType()!.getText(),
        separator: "_",
        checkCppType: true,
      };
    }

    return null;
  }

  /**
   * Check if a type needs empty brace initialization {}.
   * Issue #304: C++ types with constructors may fail with {0}
   * Issue #309: Unknown user types in C++ mode may have non-trivial constructors
   */
  private _needsEmptyBraceInit(typeName: string): boolean {
    // C++ types (external libraries with constructors)
    if (this.isCppType(typeName)) {
      return true;
    }
    // In C++ mode, unknown user types may have non-trivial constructors
    // Known structs (C-Next or C headers) are POD types where {0} works
    return this.cppMode && !this._isKnownStruct(typeName);
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
      result = this.generateBlock(ctx.block()!);
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
      isKnownScope: (name) => this.isKnownScope(name),
      getMemberTypeInfo: (structType, memberName) =>
        this._getFullMemberTypeInfo(structType, memberName),
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
   * Issue #644: Delegates to MemberChainAnalyzer.
   */
  private analyzeMemberChainForBitAccess(
    targetCtx: Parser.AssignmentTargetContext,
  ): {
    isBitAccess: boolean;
    baseTarget?: string;
    bitIndex?: string;
    baseType?: string;
  } {
    return this.memberChainAnalyzer!.analyze(targetCtx);
  }

  /**
   * Generate float bit write using shadow variable + memcpy.
   * Issue #644: Delegates to FloatBitHelper.
   */
  private generateFloatBitWrite(
    name: string,
    typeInfo: TTypeInfo,
    bitIndex: string,
    width: string | null,
    value: string,
  ): string | null {
    return this.floatBitHelper!.generateFloatBitWrite(
      name,
      typeInfo,
      bitIndex,
      width,
      value,
    );
  }

  // ADR-001: <- becomes = in C, with compound assignment operators
  private generateAssignment(ctx: Parser.AssignmentStatementContext): string {
    const targetCtx = ctx.assignmentTarget();

    // Issue #644: Set expected type for inferred struct initializers and overflow behavior
    // Delegated to AssignmentExpectedTypeResolver helper
    const savedExpectedType = this.context.expectedType;
    const savedAssignmentContext = { ...this.context.assignmentContext };

    const resolved = this.expectedTypeResolver!.resolve(targetCtx);
    if (resolved.expectedType) {
      this.context.expectedType = resolved.expectedType;
    }
    if (resolved.assignmentContext) {
      this.context.assignmentContext = resolved.assignmentContext;
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

    // Issue #644: Validate assignment (const, enum, integer, array bounds, callbacks)
    // Delegated to AssignmentValidator helper to reduce cognitive complexity
    this.assignmentValidator!.validate(
      targetCtx,
      ctx.expression(),
      isCompound,
      ctx.start?.line ?? 0,
    );

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
    const handler = AssignmentHandlerRegistry.getHandler(assignmentKind);
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
      // PR #681: Use extracted ParameterDereferenceResolver for pass-by-value determination
      const paramInfo = this.context.currentParameters.get(id);
      if (paramInfo) {
        return ParameterDereferenceResolver.resolve(
          id,
          paramInfo,
          this._buildParameterDereferenceDeps(),
        );
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

    // PR #681: Build separator context and dependencies using extracted utilities
    const paramInfo = this.context.currentParameters.get(firstId);
    const isStructParam = paramInfo?.isStruct ?? false;
    const isCppAccess = hasGlobal && this.isCppScopeSymbol(firstId);
    const separatorDeps = this._buildMemberSeparatorDeps();

    const separatorCtx: ISeparatorContext =
      MemberSeparatorResolver.buildContext(
        firstId,
        hasGlobal,
        hasThis,
        this.context.currentScope,
        isStructParam,
        separatorDeps,
        isCppAccess,
      );

    // Process postfix operations in order
    let identifierChain: string[] = [firstId]; // Track all identifiers for register detection
    let isFirstOp = true;

    for (const op of postfixOps) {
      if (op.IDENTIFIER()) {
        // Member access: .identifier
        const memberName = op.IDENTIFIER()!.getText();
        identifierChain.push(memberName);

        // PR #681: Use extracted MemberSeparatorResolver for separator determination
        const separator = MemberSeparatorResolver.getSeparator(
          isFirstOp,
          identifierChain,
          memberName,
          separatorCtx,
          separatorDeps,
        );
        isFirstOp = false;

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

  // ========================================================================
  // Expressions
  // ========================================================================

  // ADR-053 A2 Phase 7: Use registry for expression generator
  private _generateExpression(ctx: Parser.ExpressionContext): string {
    return this.invokeExpression("expression", ctx);
  }

  private _generateOrExpr(ctx: Parser.OrExpressionContext): string {
    return this.invokeExpression("or", ctx);
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
    const text = ctx.getText();
    if (text === "this") {
      return this._resolveThisKeyword();
    }

    // ADR-016: Handle 'global' keyword for global reference
    if (text === "global") {
      return "__GLOBAL_PREFIX__";
    }

    if (ctx.IDENTIFIER()) {
      return this._resolveIdentifierExpression(ctx.IDENTIFIER()!.getText());
    }
    if (ctx.literal()) {
      return this._generateLiteralExpression(ctx.literal()!);
    }
    if (ctx.expression()) {
      return `(${this._generateExpression(ctx.expression()!)})`;
    }
    return "";
  }

  /**
   * Resolve 'this' keyword to scope marker
   * ADR-016: 'this' returns a marker that postfixOps will transform to Scope_member
   */
  private _resolveThisKeyword(): string {
    if (!this.context.currentScope) {
      throw new Error("Error: 'this' can only be used inside a scope");
    }
    return "__THIS_SCOPE__";
  }

  /**
   * Resolve an identifier in a primary expression context
   * Handles: main args, parameters, local variables, scope resolution, enum members
   */
  private _resolveIdentifierExpression(id: string): string {
    // Special case: main function's args parameter -> argv
    if (this.context.mainArgsName && id === this.context.mainArgsName) {
      return "argv";
    }

    // ADR-006: Check if it's a function parameter
    const paramInfo = this.context.currentParameters.get(id);
    if (paramInfo) {
      return ParameterDereferenceResolver.resolve(
        id,
        paramInfo,
        this._buildParameterDereferenceDeps(),
      );
    }

    // ADR-016: Resolve bare identifier using local -> scope -> global priority
    const isLocalVariable = this.context.localVariables.has(id);
    const resolved = this.typeValidator!.resolveBareIdentifier(
      id,
      isLocalVariable,
      (name: string) => this.isKnownStruct(name),
    );
    if (resolved !== null) {
      return resolved;
    }

    // Issue #452: Check if identifier is an unqualified enum member reference
    const enumResolved = this._resolveUnqualifiedEnumMember(id);
    if (enumResolved !== null) {
      return enumResolved;
    }

    return id;
  }

  /**
   * Resolve an unqualified identifier as an enum member
   * Issue #452: Uses expectedType for type-aware resolution, falls back to searching all enums
   * @returns The qualified enum member access, or null if not an enum member
   */
  private _resolveUnqualifiedEnumMember(id: string): string | null {
    // Type-aware resolution: check only the expected enum type
    if (
      this.context.expectedType &&
      this.symbols!.knownEnums.has(this.context.expectedType)
    ) {
      const members = this.symbols!.enumMembers.get(this.context.expectedType);
      if (members?.has(id)) {
        return `${this.context.expectedType}${this.getScopeSeparator(false)}${id}`;
      }
      return null;
    }

    // No expected enum type - search all enums but error on ambiguity
    const matchingEnums: string[] = [];
    for (const [enumName, members] of this.symbols!.enumMembers) {
      if (members.has(id)) {
        matchingEnums.push(enumName);
      }
    }

    if (matchingEnums.length === 1) {
      return `${matchingEnums[0]}${this.getScopeSeparator(false)}${id}`;
    }
    if (matchingEnums.length > 1) {
      throw new Error(
        `Error: Ambiguous enum member '${id}' exists in multiple enums: ${matchingEnums.join(", ")}. Use qualified access (e.g., ${matchingEnums[0]}.${id})`,
      );
    }

    return null;
  }

  /**
   * Generate a literal expression with C++ mode handling
   * ADR-053 A2: Uses extracted literal generator
   */
  private _generateLiteralExpression(ctx: Parser.LiteralContext): string {
    const result = generateLiteral(ctx, this.getInput(), this.getState(), this);
    this.applyEffects(result.effects);

    // Issue #304/#644: Transform NULL → nullptr in C++ mode
    if (result.code === "NULL") {
      return this.cppHelper!.nullLiteral();
    }

    return result.code;
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

    // Use appropriate float suffix and type for comparisons
    const floatSuffix = sourceType === "f32" ? "f" : "";
    const floatCastType = sourceType === "f32" ? "float" : "double";

    // For unsigned types, minValue is "0", for signed it's a macro like INT8_MIN
    const minComparison =
      minValue === "0"
        ? `0.0${floatSuffix}`
        : `((${floatCastType})${minValue})`;
    const maxComparison = `((${floatCastType})${maxValue})`;

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
      return this._sizeofType(ctx.type()!);
    }
    return this._sizeofExpression(ctx.expression()!);
  }

  /**
   * Handle sizeof(type) - may actually be sizeof(variable) due to grammar ambiguity
   */
  private _sizeofType(typeCtx: Parser.TypeContext): string {
    // qualifiedType matches IDENTIFIER.IDENTIFIER, could be struct.member
    if (typeCtx.qualifiedType()) {
      const result = this._sizeofQualifiedType(typeCtx.qualifiedType()!);
      if (result) return result;
      // Fall through to generateType for actual type references (Scope.Type)
    }

    // userType is just IDENTIFIER, could be a variable reference
    if (typeCtx.userType()) {
      return this._sizeofUserType(typeCtx.getText());
    }

    // It's a primitive or other type - generate normally
    return `sizeof(${this._generateType(typeCtx)})`;
  }

  /**
   * Handle sizeof(qualified.type) - may be struct.member access
   * Returns null if this is actually a type reference (Scope.Type)
   */
  private _sizeofQualifiedType(
    qualifiedCtx: Parser.QualifiedTypeContext,
  ): string | null {
    const identifiers = qualifiedCtx.IDENTIFIER();
    const firstName = identifiers[0].getText();
    const memberName = identifiers[1].getText();

    // Check if first identifier is a local variable (struct instance)
    if (this.context.localVariables.has(firstName)) {
      return `sizeof(${firstName}.${memberName})`;
    }

    // Check if first identifier is a parameter (struct parameter)
    const paramInfo = this.context.currentParameters.get(firstName);
    if (paramInfo) {
      const sep = paramInfo.isStruct ? "->" : ".";
      return `sizeof(${firstName}${sep}${memberName})`;
    }

    // Check if first identifier is a global variable
    // If not a scope or enum, it's likely a global struct variable
    if (
      !this.isKnownScope(firstName) &&
      !this.symbols!.knownEnums.has(firstName)
    ) {
      return `sizeof(${firstName}.${memberName})`;
    }

    // It's an actual type reference (Scope.Type), return null to fall through
    return null;
  }

  /**
   * Handle sizeof(identifier) - could be variable or type name
   */
  private _sizeofUserType(varName: string): string {
    // Check if it's a known parameter
    const paramInfo = this.context.currentParameters.get(varName);
    if (paramInfo) {
      return this._sizeofParameter(varName, paramInfo);
    }

    // Check if it's a known local variable, struct type, or enum type
    // For all these cases, generate sizeof(name) directly
    // Unknown identifiers are also treated as variables for safety
    return `sizeof(${varName})`;
  }

  /**
   * Handle sizeof on a parameter - validates and generates appropriate code
   */
  private _sizeofParameter(
    varName: string,
    paramInfo: { isArray?: boolean; isCallback?: boolean; isStruct?: boolean },
  ): string {
    // E0601: Array parameters decay to pointers
    if (paramInfo.isArray) {
      this._throwArrayParamSizeofError(varName);
    }
    // For pass-by-reference parameters (non-array, non-callback, non-struct),
    // use pointer dereference
    if (!paramInfo.isCallback && !paramInfo.isStruct) {
      return `sizeof(*${varName})`;
    }
    return `sizeof(${varName})`;
  }

  /**
   * Throw E0601 error for sizeof on array parameter
   */
  private _throwArrayParamSizeofError(varName: string): never {
    throw new Error(
      `Error[E0601]: sizeof() on array parameter '${varName}' returns pointer size. ` +
        `Use ${varName}.length for element count or sizeof(elementType) * ${varName}.length for bytes`,
    );
  }

  /**
   * Handle sizeof(expression) with validation
   */
  private _sizeofExpression(expr: Parser.ExpressionContext): string {
    // E0601: Check if expression is an array parameter
    const varName = this.getSingleIdentifierFromExpr(expr);
    if (varName) {
      const paramInfo = this.context.currentParameters.get(varName);
      if (paramInfo?.isArray) {
        this._throwArrayParamSizeofError(varName);
      }
    }

    // E0602: Check for side effects
    if (this.hasSideEffects(expr)) {
      throw new Error(
        `Error[E0602]: sizeof() operand must not have side effects (MISRA C:2012 Rule 13.6)`,
      );
    }

    return `sizeof(${this._generateExpression(expr)})`;
  }

  /**
   * ADR-023: Extract simple identifier from expression for parameter checking
   * Returns the identifier name if expression is a simple variable reference, null otherwise
   * Issue #707: Delegates to ExpressionUnwrapper utility.
   */
  private getSingleIdentifierFromExpr(
    expr: Parser.ExpressionContext,
  ): string | null {
    return ExpressionUnwrapper.getSimpleIdentifier(expr);
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
    return ExpressionUtils.hasFunctionCall(expr);
  }

  private generateMemberAccess(ctx: Parser.MemberAccessContext): string {
    const parts = ctx.IDENTIFIER().map((id) => id.getText());
    const expressions = ctx.expression();
    if (expressions.length > 0) {
      // Note: Register bit access in assignment targets (GPIO.DR[3] <- true) is handled
      // by AssignmentClassifier dispatch, not here. The memberAccess grammar rule only
      // appears in assignmentTarget, and register bit patterns are classified as
      // REGISTER_BIT/REGISTER_BIT_RANGE before reaching this code.
      return this.generateSubscriptMemberAccess(ctx, parts, expressions);
    }
    return this.generatePlainMemberAccess(parts);
  }

  /**
   * Generate member access with subscript expressions using child-walking
   * via buildMemberAccessChain (Bug #8, Issue #644).
   */
  private generateSubscriptMemberAccess(
    ctx: Parser.MemberAccessContext,
    parts: string[],
    expressions: Parser.ExpressionContext[],
  ): string {
    const firstPart = parts[0];
    const isCrossScope = this.isKnownScope(firstPart);
    const paramInfo = this.context.currentParameters.get(firstPart);
    const isStructParam = paramInfo?.isStruct ?? false;

    if (isCrossScope) {
      MemberAccessValidator.validateNotSelfScopeReference(
        firstPart,
        parts[1],
        this.context.currentScope,
      );
    }

    const firstTypeInfo = this.context.typeRegistry.get(firstPart);

    const chainResult = memberAccessChain.buildMemberAccessChain({
      firstId: firstPart,
      identifiers: parts,
      expressions,
      children: ctx.children!,
      separatorOptions: {
        isStructParam,
        isCrossScope,
        cppMode: this.cppMode,
      },
      generateExpression: (expr) => this._generateExpression(expr),
      initialTypeInfo: firstTypeInfo
        ? {
            isArray: firstTypeInfo.isArray,
            baseType: firstTypeInfo.baseType,
          }
        : undefined,
      typeTracking: {
        getStructFields: (structType) =>
          this.symbols!.structFields.get(structType),
        getStructArrayFields: (structType) =>
          this.symbols!.structFieldArrays.get(structType),
        isKnownStruct: (name) => this.isKnownStruct(name),
      },
      onBitAccess: (result, bitIndex) => `((${result} >> ${bitIndex}) & 1)`,
    });

    return chainResult.code;
  }

  // --- Plain member access helpers ---

  /**
   * Generate plain register member access: GPIO7.DR -> GPIO7_DR
   */
  private generatePlainRegisterAccess(parts: string[]): string {
    const firstPart = parts[0];

    // ADR-016: Inside a scope, accessing a global register requires global. prefix
    if (this.context.currentScope) {
      throw new Error(
        `Error: Use 'global.${parts.join(".")}' to access register '${firstPart}' from inside scope '${this.context.currentScope}'`,
      );
    }

    // memberAccess grammar guarantees parts.length >= 2: IDENTIFIER ('.' IDENTIFIER)+
    const memberName = parts[1];
    MemberAccessValidator.validateRegisterReadAccess(
      `${firstPart}_${memberName}`,
      memberName,
      `${firstPart}.${memberName}`,
      this.symbols!.registerMemberAccess,
      this.inAssignmentTarget,
    );
    return parts.join("_");
  }

  /**
   * Generate plain scope member access: Timing.tickCount -> Timing_tickCount (ADR-016)
   */
  private generatePlainScopeAccess(parts: string[]): string {
    const firstPart = parts[0];

    MemberAccessValidator.validateNotSelfScopeReference(
      firstPart,
      parts[1],
      this.context.currentScope,
    );

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
        return `${scopeVarName}.${parts.slice(2).join(".")}`;
      }
    }
    return parts.join("_");
  }

  /**
   * Coordinator for plain member access (no subscripts).
   */
  private generatePlainMemberAccess(parts: string[]): string {
    const firstPart = parts[0];

    // Register member access: GPIO7.DR -> GPIO7_DR
    if (this.symbols!.knownRegisters.has(firstPart)) {
      return this.generatePlainRegisterAccess(parts);
    }

    // Scope member access: Timing.tickCount -> Timing_tickCount (ADR-016)
    if (this.isKnownScope(firstPart)) {
      return this.generatePlainScopeAccess(parts);
    }

    // ADR-006: Struct parameter member access
    const paramInfo = this.context.currentParameters.get(firstPart);
    if (paramInfo?.isStruct) {
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
    const name = this._resolveArrayAccessName(rawName);

    if (exprs.length === 1) {
      return this._generateSingleIndexAccess(rawName, name, exprs[0], ctx);
    }
    if (exprs.length === 2) {
      return this._generateBitRangeAccess(rawName, name, exprs);
    }
    return `${name}[/* error */]`;
  }

  /**
   * Resolve the access name for array/bit access, handling parameter dereferencing
   */
  private _resolveArrayAccessName(rawName: string): string {
    const paramInfo = this.context.currentParameters.get(rawName);
    if (!paramInfo || paramInfo.isArray) return rawName;

    const isPassByValue =
      this._isFloatType(paramInfo.baseType) ||
      this.symbols!.knownEnums.has(paramInfo.baseType) ||
      (this.context.currentFunctionName &&
        this._isParameterPassByValueByName(
          this.context.currentFunctionName,
          rawName,
        ));

    return isPassByValue ? rawName : `(*${rawName})`;
  }

  /**
   * Generate single index access: array[i] or bit access flags[3]
   */
  private _generateSingleIndexAccess(
    rawName: string,
    name: string,
    indexExpr: Parser.ExpressionContext,
    ctx: Parser.ArrayAccessContext,
  ): string {
    const typeInfo = this.context.typeRegistry.get(rawName);

    // Check if this is a bitmap type
    if (typeInfo?.isBitmap && typeInfo.bitmapTypeName) {
      const line = ctx.start?.line ?? 0;
      throw CodeGenErrors.bitmapBracketIndexing(
        line,
        typeInfo.bitmapTypeName,
        rawName,
      );
    }

    // ADR-036: Compile-time bounds checking
    if (typeInfo?.isArray && typeInfo.arrayDimensions) {
      this.typeValidator!.checkArrayBounds(
        rawName,
        typeInfo.arrayDimensions,
        [indexExpr],
        ctx.start?.line ?? 0,
        (expr) => this._tryEvaluateConstant(expr),
      );
    }

    const index = this._generateExpression(indexExpr);
    return `${name}[${index}]`;
  }

  /**
   * Generate bit range access: flags[start, width]
   */
  private _generateBitRangeAccess(
    rawName: string,
    name: string,
    exprs: Parser.ExpressionContext[],
  ): string {
    const start = this._generateExpression(exprs[0]);
    const width = this._generateExpression(exprs[1]);
    const typeInfo = this.context.typeRegistry.get(rawName);

    // Float bit indexing read: use shadow variable + memcpy
    const isFloatType =
      typeInfo?.baseType === "f32" || typeInfo?.baseType === "f64";
    if (isFloatType && typeInfo) {
      return this._generateFloatBitRangeRead(
        rawName,
        name,
        start,
        width,
        typeInfo,
      );
    }

    return this._generateIntegerBitRangeRead(name, start, width);
  }

  /**
   * Generate float bit range read with shadow variable
   */
  private _generateFloatBitRangeRead(
    rawName: string,
    name: string,
    start: string,
    width: string,
    typeInfo: { baseType: string },
  ): string {
    if (!this.context.inFunctionBody) {
      throw CodeGenErrors.floatBitIndexingAtGlobalScope(rawName, start, width);
    }

    this.requireInclude("string");
    this.requireInclude("float_static_assert");

    const isF64 = typeInfo.baseType === "f64";
    const shadowType = isF64 ? "uint64_t" : "uint32_t";
    const shadowName = `__bits_${rawName}`;
    const mask = this.generateBitMask(width, isF64);

    // Ensure shadow variable is declared
    if (!this.context.floatBitShadows.has(shadowName)) {
      this.context.floatBitShadows.add(shadowName);
      this.pendingTempDeclarations.push(`${shadowType} ${shadowName};`);
    }

    const shadowIsCurrent = this.context.floatShadowCurrent.has(shadowName);
    this.context.floatShadowCurrent.add(shadowName);

    return this._buildFloatBitReadExpr(
      shadowName,
      name,
      start,
      mask,
      shadowIsCurrent,
    );
  }

  /**
   * Build the bit read expression for floats.
   * Delegates to BitRangeHelper for testability.
   */
  private _buildFloatBitReadExpr(
    shadowName: string,
    name: string,
    start: string,
    mask: string,
    shadowIsCurrent: boolean,
  ): string {
    return BitRangeHelper.buildFloatBitReadExpr({
      shadowName,
      varName: name,
      start,
      mask,
      shadowIsCurrent,
    });
  }

  /**
   * Generate integer bit range read: ((value >> start) & mask)
   * Delegates to BitRangeHelper for testability.
   */
  private _generateIntegerBitRangeRead(
    name: string,
    start: string,
    width: string,
  ): string {
    const mask = this.generateBitMask(width);
    return BitRangeHelper.buildIntegerBitReadExpr({
      varName: name,
      start,
      mask,
    });
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
        throw CodeGenErrors.scopedTypeOutsideScope();
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
   * ADR-051: Generate safe division helper functions for used integer types only
   * ADR-053 A5: Delegates to HelperGenerator
   */
  private generateSafeDivHelpers(): string[] {
    return helperGenerateSafeDivHelpers(this.usedSafeDivOps);
  }
}
