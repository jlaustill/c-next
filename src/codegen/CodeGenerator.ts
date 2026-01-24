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
import IncludeDiscovery from "../lib/IncludeDiscovery";
import IComment from "./types/IComment";
import TYPE_WIDTH from "./types/TYPE_WIDTH";
import C_TYPE_WIDTH from "./types/C_TYPE_WIDTH";
import TYPE_MAP from "./types/TYPE_MAP";
// Issue #60: BITMAP_SIZE and BITMAP_BACKING_TYPE moved to SymbolCollector
import TTypeInfo from "./types/TTypeInfo";
import TParameterInfo from "./types/TParameterInfo";
import TOverflowBehavior from "./types/TOverflowBehavior";
import ICodeGeneratorOptions from "./types/ICodeGeneratorOptions";
import TypeResolver from "./TypeResolver";
import SymbolCollector from "./SymbolCollector";
import TypeValidator from "./TypeValidator";
import IOrchestrator from "./generators/IOrchestrator";
import IGeneratorInput from "./generators/IGeneratorInput";
import IGeneratorState from "./generators/IGeneratorState";
import TGeneratorEffect from "./generators/TGeneratorEffect";
import GeneratorRegistry from "./generators/GeneratorRegistry";
// ADR-053: Expression generators (A2)
import generateLiteral from "./generators/expressions/LiteralGenerator";
import binaryExprGenerators from "./generators/expressions/BinaryExprGenerator";
import generateUnaryExpr from "./generators/expressions/UnaryExprGenerator";
import generateFunctionCall from "./generators/expressions/CallExprGenerator";
import accessGenerators from "./generators/expressions/AccessExprGenerator";
import expressionGenerators from "./generators/expressions/ExpressionGenerator";
// ADR-053: Statement generators (A3)
import statementGenerators from "./generators/statements";
// ADR-053: Declaration generators (A4)
import enumGenerator from "./generators/declarationGenerators/EnumGenerator";
import bitmapGenerator from "./generators/declarationGenerators/BitmapGenerator";
import registerGenerator from "./generators/declarationGenerators/RegisterGenerator";
import scopedRegisterGenerator from "./generators/declarationGenerators/ScopedRegisterGenerator";
import structGenerator from "./generators/declarationGenerators/StructGenerator";
import functionGenerator from "./generators/declarationGenerators/FunctionGenerator";
import scopeGenerator from "./generators/declarationGenerators/ScopeGenerator";
// ADR-053: Support generators (A5)
import helperGenerators from "./generators/support/HelperGenerator";
import includeGenerators from "./generators/support/IncludeGenerator";
import commentUtils from "./generators/support/CommentUtils";
// ADR-046: NullCheckAnalyzer for nullable C pointer type detection
import NullCheckAnalyzer from "../analysis/NullCheckAnalyzer";
// ADR-006: Helper for building member access chains with proper separators
import memberAccessChain from "./memberAccessChain";

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
  indentLevel: number;
  scopeMembers: Map<string, Set<string>>; // scope -> member names (ADR-016)
  currentParameters: Map<string, TParameterInfo>; // ADR-006: track params for pointer semantics
  modifiedParameters: Set<string>; // Issue #268: track modified params for auto-const inference
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
 *
 * Implements IOrchestrator to support modular generator extraction (ADR-053).
 */
export default class CodeGenerator implements IOrchestrator {
  /** ADR-044: Debug mode generates panic-on-overflow helpers */
  private debugMode: boolean = false;

  private context: GeneratorContext = {
    currentScope: null, // ADR-016: renamed from currentNamespace
    currentFunctionName: null, // Issue #269: track current function for pass-by-value lookup
    indentLevel: 0,
    scopeMembers: new Map(), // ADR-016: renamed from namespaceMembers
    currentParameters: new Map(),
    modifiedParameters: new Set(),
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

  /** Issue #349: Include directories for resolving angle-bracket .cnx includes */
  private includeDirs: string[] = [];

  /** Issue #349: Input directories for calculating relative paths */
  private inputs: string[] = [];

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

  /** Generator registry for modular code generation (ADR-053) */
  private registry: GeneratorRegistry = new GeneratorRegistry();

  /** Issue #250: C++ mode - use temp vars instead of compound literals */
  private cppMode: boolean = false;

  /** Issue #250: Pending temp variable declarations for C++ mode */
  private pendingTempDeclarations: string[] = [];

  /** Issue #250: Counter for unique temp variable names */
  private tempVarCounter: number = 0;

  /**
   * Issue #269: Tracks which parameters are modified (directly or transitively)
   * Map of functionName -> Set of modified parameter names
   */
  private modifiedParameters: Map<string, Set<string>> = new Map();

  /**
   * Issue #269: Tracks which parameters should pass by value
   * Map of functionName -> Set of passByValue parameter names
   */
  private passByValueParams: Map<string, Set<string>> = new Map();

  /**
   * Issue #269: Tracks function call relationships for transitive modification analysis
   * Map of functionName -> Array of {callee, paramIndex, argParamName}
   * where argParamName is the caller's parameter passed as argument
   */
  private functionCallGraph: Map<
    string,
    Array<{ callee: string; paramIndex: number; argParamName: string }>
  > = new Map();

  /**
   * Issue #269: Tracks function parameter lists for call graph analysis
   * Map of functionName -> Array of parameter names in order
   */
  private functionParamLists: Map<string, string[]> = new Map();

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
    };
  }

  /**
   * Process effects returned by generators, updating internal state.
   * This centralizes all side-effect handling.
   */
  applyEffects(effects: readonly TGeneratorEffect[]): void {
    for (const effect of effects) {
      switch (effect.type) {
        // Include effects
        case "include":
          switch (effect.header) {
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
          }
          break;
        case "isr":
          this.needsISR = true;
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
          break;
        case "exit-function-body":
          this.context.inFunctionBody = false;
          this.context.localVariables.clear();
          this.context.localArrays.clear();
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
   * Get the current indentation string.
   */
  getIndent(): string {
    return "    ".repeat(this.context.indentLevel);
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
    return this._countStringLengthAccesses(ctx);
  }

  /**
   * Count block length accesses.
   * Part of IOrchestrator interface (ADR-053 A3).
   */
  countBlockLengthAccesses(
    ctx: Parser.BlockContext,
    counts: Map<string, number>,
  ): void {
    this._countBlockLengthAccesses(ctx, counts);
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

  // === Function Body Management (A4) ===

  enterFunctionBody(): void {
    this.context.localVariables.clear();
    this.context.modifiedParameters.clear(); // Issue #268: Clear for new function
    this.context.inFunctionBody = true;
  }

  exitFunctionBody(): void {
    this.context.inFunctionBody = false;
    this.context.localVariables.clear();
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
  private functionUnmodifiedParams: Map<string, Set<string>> = new Map();

  /**
   * Issue #268: Get unmodified parameters info for all functions.
   * Returns map of function name -> Set of unmodified parameter names.
   */
  getFunctionUnmodifiedParams(): ReadonlyMap<string, Set<string>> {
    return this.functionUnmodifiedParams;
  }

  /**
   * Issue #268: Update symbol parameters with auto-const info.
   * Call after generating function body to track unmodified parameters.
   */
  updateFunctionParamsAutoConst(functionName: string): void {
    // Collect unmodified parameters for this function
    const unmodifiedParams = new Set<string>();
    for (const [paramName] of this.context.currentParameters) {
      if (!this.context.modifiedParameters.has(paramName)) {
        unmodifiedParams.add(paramName);
      }
    }
    this.functionUnmodifiedParams.set(functionName, unmodifiedParams);
  }

  /**
   * Issue #268: Mark a parameter as modified for auto-const tracking.
   */
  markParameterModified(paramName: string): void {
    if (this.context.currentParameters.has(paramName)) {
      this.context.modifiedParameters.add(paramName);
    }
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
  private _isKnownStruct(typeName: string): boolean {
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
   * Fold literal boolean values to integer constants for bitmap bit assignments.
   * Issue #200: Avoid generating (true ? 1 : 0) when we can just use 1.
   * - 'true'  → '1'
   * - 'false' → '0'
   * - anything else → '(expr ? 1 : 0)' (runtime ternary needed)
   */
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
  private isKnownScope(name: string): boolean {
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
   */
  private isCppScopeSymbol(name: string): boolean {
    if (!this.symbolTable) {
      return false;
    }

    const symbols = this.symbolTable.getOverloads(name);
    for (const sym of symbols) {
      // Only consider C++ symbols
      if (sym.sourceLanguage !== ESourceLanguage.Cpp) {
        continue;
      }

      // C++ namespaces, classes, and enums (enum class) need :: syntax
      if (
        sym.kind === ESymbolKind.Namespace ||
        sym.kind === ESymbolKind.Class ||
        sym.kind === ESymbolKind.Enum
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Issue #304: Get the appropriate scope separator for C++ vs C/C-Next.
   * C++ uses :: for scope resolution, C/C-Next uses _ (underscore).
   */
  private getScopeSeparator(isCppContext: boolean): string {
    return isCppContext ? "::" : "_";
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
    // Reset temp var state for each generation
    this.pendingTempDeclarations = [];
    this.tempVarCounter = 0;

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
      indentLevel: 0,
      scopeMembers: new Map(), // ADR-016
      currentParameters: new Map(),
      modifiedParameters: new Set(),
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

    // Issue #230: Self-include for extern "C" linkage
    // When file has public symbols and headers are being generated,
    // include own header to ensure proper C linkage
    // Issue #339: Use relative path from source root when available
    if (
      options?.generateHeaders &&
      this.symbols!.hasPublicSymbols() &&
      this.sourcePath
    ) {
      // Issue #339: Prefer sourceRelativePath for correct directory structure
      // Otherwise fall back to basename for backward compatibility
      const pathToUse =
        options.sourceRelativePath || this.sourcePath.replace(/^.*[\\/]/, "");
      const headerName = pathToUse.replace(/\.cnx$|\.cnext$/, ".h");
      output.push(`#include "${headerName}"`);
      output.push("");
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
   * Walk a statement recursively looking for modifications and calls.
   */
  private walkStatementForModifications(
    funcName: string,
    paramSet: Set<string>,
    stmt: Parser.StatementContext,
  ): void {
    // Check for assignment statements
    if (stmt.assignmentStatement()) {
      const assign = stmt.assignmentStatement()!;
      // Get the target - use assignmentTarget() which has IDENTIFIER()
      const target = assign.assignmentTarget();
      if (target && target.IDENTIFIER()) {
        // Simple identifier assignment (not array/member access)
        if (!target.arrayAccess() && !target.memberAccess()) {
          const targetName = target.IDENTIFIER()!.getText();
          if (paramSet.has(targetName)) {
            // Direct assignment to parameter
            this.modifiedParameters.get(funcName)!.add(targetName);
          }
        }
      }
    }

    // Check for expressions that contain function calls
    if (stmt.expressionStatement()) {
      this.walkExpressionForCalls(
        funcName,
        paramSet,
        stmt.expressionStatement()!.expression(),
      );
    }

    // Recurse into control flow statements
    if (stmt.ifStatement()) {
      const ifStmt = stmt.ifStatement()!;
      // ifStatement has statement() children, not block()
      for (const childStmt of ifStmt.statement()) {
        if (childStmt.block()) {
          this.walkBlockForModifications(
            funcName,
            [...paramSet],
            childStmt.block()!,
          );
        } else {
          this.walkStatementForModifications(funcName, paramSet, childStmt);
        }
      }
      // Check condition for calls
      this.walkExpressionForCalls(funcName, paramSet, ifStmt.expression());
    }

    if (stmt.whileStatement()) {
      const whileStmt = stmt.whileStatement()!;
      // whileStatement has a single statement() child
      const bodyStmt = whileStmt.statement();
      if (bodyStmt.block()) {
        this.walkBlockForModifications(
          funcName,
          [...paramSet],
          bodyStmt.block()!,
        );
      } else {
        this.walkStatementForModifications(funcName, paramSet, bodyStmt);
      }
      this.walkExpressionForCalls(funcName, paramSet, whileStmt.expression());
    }

    if (stmt.forStatement()) {
      const forStmt = stmt.forStatement()!;
      // forStatement has a single statement() child
      const bodyStmt = forStmt.statement();
      if (bodyStmt.block()) {
        this.walkBlockForModifications(
          funcName,
          [...paramSet],
          bodyStmt.block()!,
        );
      } else {
        this.walkStatementForModifications(funcName, paramSet, bodyStmt);
      }
      // Check condition and update for calls
      if (forStmt.expression()) {
        this.walkExpressionForCalls(funcName, paramSet, forStmt.expression()!);
      }
    }

    if (stmt.doWhileStatement()) {
      const doWhile = stmt.doWhileStatement()!;
      // doWhileStatement has block()
      this.walkBlockForModifications(funcName, [...paramSet], doWhile.block());
      this.walkExpressionForCalls(funcName, paramSet, doWhile.expression());
    }

    // Check return statement for calls
    if (stmt.returnStatement()) {
      const retStmt = stmt.returnStatement()!;
      if (retStmt.expression()) {
        this.walkExpressionForCalls(funcName, paramSet, retStmt.expression()!);
      }
    }

    // Check variable declaration for calls in initializer
    if (stmt.variableDeclaration()) {
      const varDecl = stmt.variableDeclaration()!;
      if (varDecl.expression()) {
        this.walkExpressionForCalls(funcName, paramSet, varDecl.expression()!);
      }
    }

    // Issue #269: Handle switch statements - modifications can occur in any case
    if (stmt.switchStatement()) {
      const switchStmt = stmt.switchStatement()!;
      // Check switch expression for calls
      this.walkExpressionForCalls(funcName, paramSet, switchStmt.expression());
      // Walk each case block
      for (const caseCtx of switchStmt.switchCase()) {
        this.walkBlockForModifications(
          funcName,
          [...paramSet],
          caseCtx.block(),
        );
      }
      // Walk default case if present
      const defaultCase = switchStmt.defaultCase();
      if (defaultCase) {
        this.walkBlockForModifications(
          funcName,
          [...paramSet],
          defaultCase.block(),
        );
      }
    }

    // ADR-050: Handle critical statements - recurse into the block
    if (stmt.criticalStatement()) {
      const criticalStmt = stmt.criticalStatement()!;
      this.walkBlockForModifications(
        funcName,
        [...paramSet],
        criticalStmt.block(),
      );
    }

    // Recurse into nested blocks
    if (stmt.block()) {
      this.walkBlockForModifications(funcName, [...paramSet], stmt.block()!);
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
   * Walk an orExpression tree for function calls.
   */
  private walkOrExpressionForCalls(
    funcName: string,
    paramSet: Set<string>,
    orExpr: Parser.OrExpressionContext,
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
                        this.walkUnaryExpressionForCalls(
                          funcName,
                          paramSet,
                          unaryExpr,
                        );
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

    // Check for scope-qualified calls: Scope.func(...)
    // primaryExpression could be 'global' or 'this' with member access
    // For now, handle the simple case where we see IDENTIFIER.IDENTIFIER(...)

    // Recurse into primary expression if it's a parenthesized expression
    if (primary.expression()) {
      this.walkExpressionForCalls(funcName, paramSet, primary.expression()!);
    }

    // Walk arguments in any postfix function call ops
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
          if (calleeModified && calleeModified.has(calleeParamName)) {
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
          const isSmallPrimitive = smallPrimitives.has(paramSig.baseType);
          const isArray = paramSig.isArray ?? false;
          const isModified = modified.has(paramName);

          if (isSmallPrimitive && !isArray && !isModified) {
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
      // Issue #201: Handle bitmap arrays - check for array dimensions before early return
      if (this.symbols!.knownBitmaps.has(baseType)) {
        if (arrayDim && arrayDim.length > 0) {
          // Bitmap array - need to track array dimensions too
          const bitmapArrayDimensions: number[] = [];
          for (const dim of arrayDim) {
            const sizeExpr = dim.expression();
            if (sizeExpr) {
              const size = this._tryEvaluateConstant(sizeExpr);
              if (size !== undefined && size > 0) {
                bitmapArrayDimensions.push(size);
              }
            }
          }
          this.context.typeRegistry.set(name, {
            baseType,
            bitWidth: this.symbols!.bitmapBitWidth.get(baseType) || 0,
            isArray: true,
            arrayDimensions:
              bitmapArrayDimensions.length > 0
                ? bitmapArrayDimensions
                : undefined,
            isConst,
            isBitmap: true,
            bitmapTypeName: baseType,
            overflowBehavior, // ADR-044
            isAtomic, // ADR-049
          });
          return;
        }
        this.context.typeRegistry.set(name, {
          baseType,
          bitWidth: this.symbols!.bitmapBitWidth.get(baseType) || 0,
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
      // Issue #201: Handle bitmap arrays - check for array dimensions before early return
      if (this.symbols!.knownBitmaps.has(baseType)) {
        if (arrayDim && arrayDim.length > 0) {
          // Bitmap array - need to track array dimensions too
          const bitmapArrayDimensions: number[] = [];
          for (const dim of arrayDim) {
            const sizeExpr = dim.expression();
            if (sizeExpr) {
              const size = this._tryEvaluateConstant(sizeExpr);
              if (size !== undefined && size > 0) {
                bitmapArrayDimensions.push(size);
              }
            }
          }
          this.context.typeRegistry.set(name, {
            baseType,
            bitWidth: this.symbols!.bitmapBitWidth.get(baseType) || 0,
            isArray: true,
            arrayDimensions:
              bitmapArrayDimensions.length > 0
                ? bitmapArrayDimensions
                : undefined,
            isConst,
            isBitmap: true,
            bitmapTypeName: baseType,
            overflowBehavior, // ADR-044
            isAtomic, // ADR-049
          });
          return;
        }
        this.context.typeRegistry.set(name, {
          baseType,
          bitWidth: this.symbols!.bitmapBitWidth.get(baseType) || 0,
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
      // Issue #201: Handle bitmap arrays - check for array dimensions before early return
      if (this.symbols!.knownBitmaps.has(baseType)) {
        if (arrayDim && arrayDim.length > 0) {
          // Bitmap array - need to track array dimensions too
          const bitmapArrayDimensions: number[] = [];
          for (const dim of arrayDim) {
            const sizeExpr = dim.expression();
            if (sizeExpr) {
              const size = this._tryEvaluateConstant(sizeExpr);
              if (size !== undefined && size > 0) {
                bitmapArrayDimensions.push(size);
              }
            }
          }
          this.context.typeRegistry.set(name, {
            baseType,
            bitWidth: this.symbols!.bitmapBitWidth.get(baseType) || 0,
            isArray: true,
            arrayDimensions:
              bitmapArrayDimensions.length > 0
                ? bitmapArrayDimensions
                : undefined,
            isConst,
            isBitmap: true,
            bitmapTypeName: baseType,
            overflowBehavior, // ADR-044
            isAtomic, // ADR-049
          });
          return;
        }
        this.context.typeRegistry.set(name, {
          baseType,
          bitWidth: this.symbols!.bitmapBitWidth.get(baseType) || 0,
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

      // ADR-034: Check if this is a bitmap type
      // Issue #201: Handle bitmap arrays - check for array dimensions before early return
      if (this.symbols!.knownBitmaps.has(baseType)) {
        if (arrayDim && arrayDim.length > 0) {
          // Bitmap array - need to track array dimensions too
          const bitmapArrayDimensions: number[] = [];
          for (const dim of arrayDim) {
            const sizeExpr = dim.expression();
            if (sizeExpr) {
              const size = this._tryEvaluateConstant(sizeExpr);
              if (size !== undefined && size > 0) {
                bitmapArrayDimensions.push(size);
              }
            }
          }
          this.context.typeRegistry.set(registryName, {
            baseType,
            bitWidth: this.symbols!.bitmapBitWidth.get(baseType) || 0,
            isArray: true,
            arrayDimensions:
              bitmapArrayDimensions.length > 0
                ? bitmapArrayDimensions
                : undefined,
            isConst,
            isBitmap: true,
            bitmapTypeName: baseType,
            overflowBehavior, // ADR-044
            isAtomic, // ADR-049
          });
          return;
        }
        this.context.typeRegistry.set(registryName, {
          baseType,
          bitWidth: this.symbols!.bitmapBitWidth.get(baseType) || 0,
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

      // ADR-034: Check if this is a bitmap type
      // Issue #201: Handle bitmap arrays - check for array dimensions before early return
      if (this.symbols!.knownBitmaps.has(baseType)) {
        if (arrayDim && arrayDim.length > 0) {
          // Bitmap array - need to track array dimensions too
          const bitmapArrayDimensions: number[] = [];
          for (const dim of arrayDim) {
            const sizeExpr = dim.expression();
            if (sizeExpr) {
              const size = this._tryEvaluateConstant(sizeExpr);
              if (size !== undefined && size > 0) {
                bitmapArrayDimensions.push(size);
              }
            }
          }
          this.context.typeRegistry.set(registryName, {
            baseType,
            bitWidth: this.symbols!.bitmapBitWidth.get(baseType) || 0,
            isArray: true,
            arrayDimensions:
              bitmapArrayDimensions.length > 0
                ? bitmapArrayDimensions
                : undefined,
            isConst,
            isBitmap: true,
            bitmapTypeName: baseType,
            overflowBehavior, // ADR-044
            isAtomic, // ADR-049
          });
          return;
        }
        this.context.typeRegistry.set(registryName, {
          baseType,
          bitWidth: this.symbols!.bitmapBitWidth.get(baseType) || 0,
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

      // ADR-034: Check if this is a bitmap type
      // Issue #201: Handle bitmap arrays - check for array dimensions before early return
      if (this.symbols!.knownBitmaps.has(baseType)) {
        if (arrayDim && arrayDim.length > 0) {
          // Bitmap array - need to track array dimensions too
          const bitmapArrayDimensions: number[] = [];
          for (const dim of arrayDim) {
            const sizeExpr = dim.expression();
            if (sizeExpr) {
              const size = this._tryEvaluateConstant(sizeExpr);
              if (size !== undefined && size > 0) {
                bitmapArrayDimensions.push(size);
              }
            }
          }
          this.context.typeRegistry.set(registryName, {
            baseType,
            bitWidth: this.symbols!.bitmapBitWidth.get(baseType) || 0,
            isArray: true,
            arrayDimensions:
              bitmapArrayDimensions.length > 0
                ? bitmapArrayDimensions
                : undefined,
            isConst,
            isBitmap: true,
            bitmapTypeName: baseType,
            overflowBehavior, // ADR-044
            isAtomic, // ADR-049
          });
          return;
        }
        this.context.typeRegistry.set(registryName, {
          baseType,
          bitWidth: this.symbols!.bitmapBitWidth.get(baseType) || 0,
          isArray: false,
          isConst,
          isBitmap: true,
          bitmapTypeName: baseType,
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
          const size = this._tryEvaluateConstant(sizeExpr);
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
  private _isIntegerExpression(
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
  private _isStringExpression(
    ctx: Parser.RelationalExpressionContext,
  ): boolean {
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
      const lastOp = ops[ops.length - 1];
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
    const lastOp = ops[ops.length - 1];
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
    const lastOp = ops[ops.length - 1];
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
          // Use static_cast for C++ type safety
          this.pendingTempDeclarations.push(
            `${cType} ${tempName} = static_cast<${cType}>(${value});`,
          );
          return `&${tempName}`;
        }
      }

      // Generate the expression and wrap with &
      const expr = `&${this._generateExpression(ctx)}`;

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
          if (this.cppMode) {
            return `reinterpret_cast<${cType}*>(${expr})`;
          }
          return `(${cType}*)${expr}`;
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

        // Issue #250: In C++ mode, compound literals are rvalues and can't have their
        // address taken. Use temporary variables instead.
        if (this.cppMode) {
          const tempName = `_cnx_tmp_${this.tempVarCounter++}`;
          this.pendingTempDeclarations.push(`${cType} ${tempName} = ${value};`);
          return `&${tempName}`;
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
            const capacity = parseInt(intLiteral.getText(), 10);
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
        this._clearParameters();

        lines.push("");
        lines.push(`${prefix}${returnType} ${fullName}(${params}) ${body}`);

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

    lines.push(`} ${fullName};`);
    lines.push("");

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

      const value = this._generateExpression(field.expression());

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

    // Track parameters for ADR-006 pointer semantics
    this._setParameters(ctx.parameterList() ?? null);

    // Issue #268: Clear modified parameters tracking for this function
    this.context.modifiedParameters.clear();

    // ADR-016: Clear local variables and mark that we're in a function body
    this.context.localVariables.clear();
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
    this.context.mainArgsName = null;
    this.context.currentFunctionName = null; // Issue #269: Clear function name
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
        ? parseInt(stringType.INTEGER_LITERAL()!.getText(), 10)
        : 256; // Default capacity
      const dimStr = dims.map((d) => this._generateArrayDimension(d)).join("");
      return `${constMod}char ${name}${dimStr}[${capacity + 1}]`;
    }

    // Arrays pass naturally as pointers
    if (dims.length > 0) {
      const dimStr = dims.map((d) => this._generateArrayDimension(d)).join("");
      // Issue #268: Add const for unmodified array parameters
      const wasModified = this.context.modifiedParameters.has(name);
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

    // ADR-006: Pass by reference for non-array types
    // Add pointer for primitive types to enable pass-by-reference semantics
    // Issue #268: Add const for unmodified pointer parameters
    const wasModified = this.context.modifiedParameters.has(name);
    const autoConst = !wasModified && !constMod ? "const " : "";
    return `${autoConst}${constMod}${type}* ${name}`;
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
        const capacity = parseInt(intLiteral.getText(), 10);
        const arrayDims = ctx.arrayDimension();

        // Check for string arrays: string<64> arr[4] -> char arr[4][65] = {0};
        if (arrayDims.length > 0) {
          let decl = `${constMod}${atomicMod}${volatileMod}char ${name}`;
          decl += this._generateArrayDimensions(arrayDims); // [4]
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

          return `${constMod}char ${name}[${capacity + 1}] = ${this._generateExpression(ctx.expression()!)};`;
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
        const inferredCapacity = this._getStringLiteralLength(exprText);
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
          exprText.match(/^-?\d+$/) ||
          exprText.match(/^0[xX][0-9a-fA-F]+$/) ||
          exprText.match(/^0[bB][01]+$/)
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

    return decl + ";";
  }

  /**
   * ADR-015: Get the appropriate zero initializer for a type
   * ADR-017: Handle enum types by initializing to first member
   */
  private _getZeroInitializer(
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

      // Issue #268: Track parameter modification for auto-const inference
      if (this.context.currentParameters.has(id)) {
        this.context.modifiedParameters.add(id);
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
          exprText.match(/^-?\d+$/) ||
          exprText.match(/^0[xX][0-9a-fA-F]+$/) ||
          exprText.match(/^0[bB][01]+$/)
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
      const arrayName = targetCtx.arrayAccess()!.IDENTIFIER().getText();
      const constError = this.typeValidator!.checkConstAssignment(arrayName);
      if (constError) {
        throw new Error(`${constError} (array element)`);
      }

      // Issue #268: Track parameter modification for auto-const inference (array element)
      if (this.context.currentParameters.has(arrayName)) {
        this.context.modifiedParameters.add(arrayName);
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

        // Issue #268: Track parameter modification for auto-const inference (member access)
        if (this.context.currentParameters.has(rootName)) {
          this.context.modifiedParameters.add(rootName);
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
                  this._isCallbackTypeUsedAsFieldType(funcName),
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
              return `${varName} = (${varName} & ~(1 << ${fieldInfo.offset})) | (${this.foldBooleanToInt(value)} << ${fieldInfo.offset});`;
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
                return `${fullRegMember} = (${fullRegMember} & ~(1 << ${fieldInfo.offset})) | (${this.foldBooleanToInt(value)} << ${fieldInfo.offset});`;
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
                  return `${memberPath} = (${memberPath} & ~(1 << ${structFieldInfo.offset})) | (${this.foldBooleanToInt(value)} << ${structFieldInfo.offset});`;
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
        if (this.isKnownScope(scopeName)) {
          // ADR-016: Validate visibility before allowing cross-scope access
          this.validateCrossScopeVisibility(scopeName, regName);
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
                    return `${fullRegMember} = (${this.foldBooleanToInt(value)} << ${fieldInfo.offset});`;
                  } else {
                    return `${fullRegMember} = ((${value} & ${maskHex}) << ${fieldInfo.offset});`;
                  }
                } else {
                  // Read-write register: use read-modify-write pattern
                  if (fieldInfo.width === 1) {
                    return `${fullRegMember} = (${fullRegMember} & ~(1 << ${fieldInfo.offset})) | (${this.foldBooleanToInt(value)} << ${fieldInfo.offset});`;
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
            (expr) => this._tryEvaluateConstant(expr),
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
                .map((e) => `[${this._generateExpression(e)}]`)
                .join("");
              const bitIndex = this._generateExpression(exprs[numDims]);
              const arrayElement = `${arrayName}${arrayIndices}`;

              // Generate: arr[i][j] = (arr[i][j] & ~(1 << bitIndex)) | ((value ? 1 : 0) << bitIndex)
              return `${arrayElement} = (${arrayElement} & ~(1 << ${bitIndex})) | (${this.foldBooleanToInt(value)} << ${bitIndex});`;
            }
          }
        }

        // Generate all subscript indices
        const indices = exprs
          .map((e) => this._generateExpression(e))
          .join("][");
        return `${arrayName}[${indices}] ${cOp} ${value};`;
      }

      // ADR-036: Struct member multi-dimensional array access (e.g., screen.pixels[0][0])
      // Has 2+ identifiers (struct.field), subscripts, and first identifier is NOT a register or scope
      const firstId = identifiers[0].getText();
      // Check if this is a scoped register: Scope.Register.Member[bit]
      const scopedRegName =
        identifiers.length >= 3 && this.isKnownScope(firstId)
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
          const isCrossScope = this.isKnownScope(firstId);

          // ADR-006: Check if first identifier is a struct parameter (needs -> access)
          const paramInfo = this.context.currentParameters.get(firstId);
          const isStructParam = paramInfo?.isStruct ?? false;

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
                // ADR-006: Use determineSeparator helper for -> (struct param) / _ (scope) / .
                const separator = memberAccessChain.determineSeparator(
                  { isStructParam, isCrossScope },
                  idIndex,
                );
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
                const bitIndex = this._generateExpression(exprs[exprIndex]);
                // Use 1ULL for 64-bit types to avoid undefined behavior on large shifts
                const one =
                  lastMemberType === "u64" || lastMemberType === "i64"
                    ? "1ULL"
                    : "1";
                return `${result} = (${result} & ~(${one} << ${bitIndex})) | ((${value} ? ${one} : 0) << ${bitIndex});`;
              }

              // Normal array subscript
              if (exprIndex < exprs.length) {
                const expr = this._generateExpression(exprs[exprIndex]);
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
                const index = this._generateExpression(exprs[0]);
                return `strncpy(${structName}.${fieldName}[${index}], ${value}, ${capacity});`;
              }
            }
          }

          // Issue #201: Check if this is a bitmap array element field assignment
          // Pattern: arr[index].field where arr is a bitmap array
          if (identifiers.length === 2 && exprs.length === 1) {
            const arrayName = firstId;
            const fieldName = identifiers[1].getText();

            // Check if this is a bitmap array
            if (firstTypeInfo?.isBitmap && firstTypeInfo?.isArray) {
              const bitmapType = firstTypeInfo.bitmapTypeName;
              if (bitmapType) {
                const fields = this.symbols!.bitmapFields.get(bitmapType);
                if (fields && fields.has(fieldName)) {
                  const fieldInfo = fields.get(fieldName)!;

                  // Compound operators not supported for bitmap field access
                  if (isCompound) {
                    throw new Error(
                      `Compound assignment operators not supported for bitmap field access: ${cnextOp}`,
                    );
                  }

                  // Validate compile-time literal overflow
                  this.typeValidator!.validateBitmapFieldLiteral(
                    ctx.expression(),
                    fieldInfo.width,
                    fieldName,
                  );

                  const mask = (1 << fieldInfo.width) - 1;
                  const maskHex = `0x${mask.toString(16).toUpperCase()}`;
                  const index = this._generateExpression(exprs[0]);
                  const arrayElement = `${arrayName}[${index}]`;

                  if (fieldInfo.width === 1) {
                    // Single bit write: arr[i] = (arr[i] & ~(1 << offset)) | ((value ? 1 : 0) << offset)
                    return `${arrayElement} = (${arrayElement} & ~(1 << ${fieldInfo.offset})) | (${this.foldBooleanToInt(value)} << ${fieldInfo.offset});`;
                  } else {
                    // Multi-bit write: arr[i] = (arr[i] & ~(mask << offset)) | ((value & mask) << offset)
                    return `${arrayElement} = (${arrayElement} & ~(${maskHex} << ${fieldInfo.offset})) | ((${value} & ${maskHex}) << ${fieldInfo.offset});`;
                  }
                }
              }
            }
          }

          return `${result} ${cOp} ${value};`;
        }

        // Fallback for simple cases (shouldn't normally reach here)
        const indices = exprs
          .map((e) => this._generateExpression(e))
          .join("][");
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
        if (this.isKnownScope(leadingId) && identifiers.length >= 3) {
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
          const bitIndex = this._generateExpression(exprs[0]);
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
            return `${fullName} = (${fullName} & ~(1 << ${bitIndex})) | (${this.foldBooleanToInt(value)} << ${bitIndex});`;
          }
        } else if (exprs.length === 2) {
          const start = this._generateExpression(exprs[0]);
          const width = this._generateExpression(exprs[1]);
          const mask = this.generateBitMask(width);
          if (isWriteOnly) {
            // Write-only: assigning 0 is semantically meaningless
            if (value === "0") {
              throw new Error(
                `Cannot assign 0 to write-only register bits ${fullName}[${start}, ${width}]. ` +
                  `Use the corresponding CLEAR register to clear bits.`,
              );
            }

            // Issue #187: Check if we can use width-appropriate memory access
            const startConst = this._tryEvaluateConstant(exprs[0]);
            const widthConst = this._tryEvaluateConstant(exprs[1]);

            if (
              startConst !== undefined &&
              widthConst !== undefined &&
              startConst % 8 === 0 && // byte-aligned
              [8, 16, 32].includes(widthConst) // standard width
            ) {
              // Issue #187: Generate width-appropriate memory access
              // Determine register name for base address lookup
              let regName: string;
              if (this.isKnownScope(leadingId) && identifiers.length >= 3) {
                regName = `${leadingId}_${identifiers[1].getText()}`;
              } else {
                regName = leadingId;
              }

              const baseAddr = this.symbols!.registerBaseAddresses.get(regName);
              const memberOffset =
                this.symbols!.registerMemberOffsets.get(fullName);
              const byteOffset = startConst / 8;

              if (baseAddr !== undefined && memberOffset !== undefined) {
                const accessType = `uint${widthConst}_t`;
                const totalOffset =
                  byteOffset === 0
                    ? memberOffset
                    : `${memberOffset} + ${byteOffset}`;
                return `*((volatile ${accessType}*)(${baseAddr} + ${totalOffset})) = (${value});`;
              }
            }

            // Fallback: write the value shifted to position
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
      const expressions = globalArrayAccessCtx.expression();
      const firstId = parts[0];

      // Handle single vs multi-expression (bit range) syntax
      let indexExpr: string;
      const isBitRange = expressions.length === 2;
      if (isBitRange) {
        const start = this._generateExpression(expressions[0]);
        const width = this._generateExpression(expressions[1]);
        indexExpr = `${start}, ${width}`;
      } else {
        indexExpr = this._generateExpression(expressions[0]);
      }

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
          return `${regName} = (${regName} & ~(1 << ${bitIndex})) | (${this.foldBooleanToInt(value)} << ${bitIndex});`;
        }
      } else if (this.isKnownScope(firstId)) {
        // ADR-016: Validate visibility before allowing cross-scope access
        const memberName = parts[1];
        this.validateCrossScopeVisibility(firstId, memberName);
        // Scope member array access: global.Counter.data[0] -> Counter_data[0]
        // or bit range: global.Scope.reg[start, width] -> Scope_reg[start, width]
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
          const start = this._generateExpression(expressions[0]);
          const width = this._generateExpression(expressions[1]);
          const mask = `((1U << ${width}) - 1)`;

          if (isWriteOnly) {
            // Write-only: assigning 0 is semantically meaningless for multi-bit
            if (value === "0") {
              throw new Error(
                `Cannot assign 0 to write-only register bits ${regName}[${start}, ${width}]. ` +
                  `Use the corresponding CLEAR register to clear bits.`,
              );
            }

            // Issue #187: Check if we can use width-appropriate memory access
            const startConst = this._tryEvaluateConstant(expressions[0]);
            const widthConst = this._tryEvaluateConstant(expressions[1]);

            if (
              startConst !== undefined &&
              widthConst !== undefined &&
              startConst % 8 === 0 && // byte-aligned
              [8, 16, 32].includes(widthConst) // standard width
            ) {
              const baseAddr =
                this.symbols!.registerBaseAddresses.get(scopedRegName);
              const memberOffset =
                this.symbols!.registerMemberOffsets.get(regName);
              const byteOffset = startConst / 8;

              if (baseAddr !== undefined && memberOffset !== undefined) {
                const accessType = `uint${widthConst}_t`;
                const totalOffset =
                  byteOffset === 0
                    ? memberOffset
                    : `${memberOffset} + ${byteOffset}`;
                return `*((volatile ${accessType}*)(${baseAddr} + ${totalOffset})) = (${value});`;
              }
            }

            // Fallback: write the value shifted to position
            return `${regName} = ((${value} & ${mask}) << ${start});`;
          } else {
            // Read-write: need read-modify-write
            return `${regName} = (${regName} & ~(${mask} << ${start})) | ((${value} & ${mask}) << ${start});`;
          }
        } else {
          // Single bit access: this.GPIO7.DR_SET[LED_BIT] <- true
          const bitIndex = this._generateExpression(expressions[0]);

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
            return `${regName} = (${regName} & ~(1 << ${bitIndex})) | (${this.foldBooleanToInt(value)} << ${bitIndex});`;
          }
        }
      } else {
        // Non-register scoped array access
        const expr = this._generateExpression(expressions[0]);
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
                  return `${fullRegMember} = (${this.foldBooleanToInt(value)} << ${fieldInfo.offset});`;
                } else {
                  return `${fullRegMember} = ((${value} & ${maskHex}) << ${fieldInfo.offset});`;
                }
              } else {
                // Read-write register: use read-modify-write pattern
                if (fieldInfo.width === 1) {
                  return `${fullRegMember} = (${fullRegMember} & ~(1 << ${fieldInfo.offset})) | (${this.foldBooleanToInt(value)} << ${fieldInfo.offset});`;
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

      // Issue #368: Check if this is an array parameter (e.g., void foo(u8 data[]))
      // Array parameters may not have arrayDimensions in typeRegistry (for unsized params),
      // but they ARE arrays and should use array indexing, not bit manipulation.
      const paramInfo = this.context.currentParameters.get(name);
      const isArrayParameter = paramInfo?.isArray ?? false;

      // ADR-040: ISR arrays use normal array indexing, not bit manipulation
      // Also handle any array type that isn't an integer scalar
      // Issue #213: String parameters (isString=true) should also use memcpy for slice assignment
      // Issue #368: Array parameters (even unsized like u8 data[]) should use array indexing
      const isActualArray =
        (typeInfo?.isArray &&
          typeInfo.arrayDimensions &&
          typeInfo.arrayDimensions.length > 0) ||
        typeInfo?.isString ||
        isArrayParameter;
      const isISRType = typeInfo?.baseType === "ISR";

      if (isActualArray || isISRType) {
        // Check for slice assignment: array[offset, length] <- value
        if (exprs.length === 2) {
          // Issue #234: Slice assignment requires compile-time constant offset and length
          // to ensure bounds safety at compile time, not runtime
          const offsetValue = this._tryEvaluateConstant(exprs[0]);
          const lengthValue = this._tryEvaluateConstant(exprs[1]);

          const line = exprs[0].start?.line ?? arrayAccessCtx.start?.line ?? 0;

          // Issue #234: Reject slice assignment on multi-dimensional arrays
          // Slice assignment is only valid on 1D arrays (the innermost dimension)
          // For multi-dimensional arrays like board[4][8], use board[row][offset, length]
          // (Note: grammar currently doesn't support this - tracked as future work)
          if (
            typeInfo?.arrayDimensions &&
            typeInfo.arrayDimensions.length > 1
          ) {
            throw new Error(
              `${line}:0 Error: Slice assignment is only valid on one-dimensional arrays. ` +
                `'${name}' has ${typeInfo.arrayDimensions.length} dimensions. ` +
                `Access the innermost dimension first (e.g., ${name}[index][offset, length]).`,
            );
          }

          // Validate offset is compile-time constant
          if (offsetValue === undefined) {
            throw new Error(
              `${line}:0 Error: Slice assignment offset must be a compile-time constant. ` +
                `Runtime offsets are not allowed to ensure bounds safety.`,
            );
          }

          // Validate length is compile-time constant
          if (lengthValue === undefined) {
            throw new Error(
              `${line}:0 Error: Slice assignment length must be a compile-time constant. ` +
                `Runtime lengths are not allowed to ensure bounds safety.`,
            );
          }

          // Compound operators not supported for slice assignment
          if (cOp !== "=") {
            throw new Error(
              `Compound assignment operators not supported for slice assignment: ${cnextOp}`,
            );
          }

          // Determine buffer capacity for compile-time bounds check
          let capacity: number;
          if (
            typeInfo?.isString &&
            typeInfo.stringCapacity &&
            !typeInfo.isArray
          ) {
            capacity = typeInfo.stringCapacity + 1;
          } else if (typeInfo?.arrayDimensions && typeInfo.arrayDimensions[0]) {
            capacity = typeInfo.arrayDimensions[0];
          } else {
            // Can't determine capacity at compile time - this shouldn't happen
            // for properly tracked arrays, but fall back to error
            throw new Error(
              `${line}:0 Error: Cannot determine buffer size for '${name}' at compile time.`,
            );
          }

          // Issue #234: Compile-time bounds validation
          if (offsetValue + lengthValue > capacity) {
            throw new Error(
              `${line}:0 Error: Slice assignment out of bounds: ` +
                `offset(${offsetValue}) + length(${lengthValue}) = ${offsetValue + lengthValue} ` +
                `exceeds buffer capacity(${capacity}) for '${name}'.`,
            );
          }

          if (offsetValue < 0) {
            throw new Error(
              `${line}:0 Error: Slice assignment offset cannot be negative: ${offsetValue}`,
            );
          }

          if (lengthValue <= 0) {
            throw new Error(
              `${line}:0 Error: Slice assignment length must be positive: ${lengthValue}`,
            );
          }

          // Set flag to include string.h for memcpy
          this.needsString = true;

          // Generate memcpy without runtime bounds check (already validated at compile time)
          return `memcpy(&${name}[${offsetValue}], &${value}, ${lengthValue});`;
        }

        // Normal array element assignment (single index)
        const index = this._generateExpression(exprs[0]);

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
        const bitIndex = this._generateExpression(exprs[0]);
        // Generate: name = (name & ~(1 << index)) | ((value ? 1 : 0) << index)
        return `${name} = (${name} & ~(1 << ${bitIndex})) | (${this.foldBooleanToInt(value)} << ${bitIndex});`;
      } else if (exprs.length === 2) {
        // Bit range assignment: flags[0, 3] <- 5
        const start = this._generateExpression(exprs[0]);
        const width = this._generateExpression(exprs[1]);
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
                .map((e) => `[${this._generateExpression(e)}]`)
                .join("");
              const bitIndex = this._generateExpression(exprs[numDims]);
              const arrayElement = `${arrayName}${arrayIndices}`;

              // Generate: arr[i][j] = (arr[i][j] & ~(1 << bitIndex)) | ((value ? 1 : 0) << bitIndex)
              return `${arrayElement} = (${arrayElement} & ~(1 << ${bitIndex})) | (${this.foldBooleanToInt(value)} << ${bitIndex});`;
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
            const index = this._generateExpression(exprs[0]);
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
    const result = statementGenerators.generateAtomicRMW(
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
        this._isParameterPassByValueByName(this.context.currentFunctionName, id)
      ) {
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

  // ADR-016: Generate global member access for assignment targets
  private generateGlobalMemberAccess(
    ctx: Parser.GlobalMemberAccessContext,
  ): string {
    const identifiers = ctx.IDENTIFIER();
    const parts = identifiers.map((id) => id.getText());
    const firstId = parts[0];
    // Issue #304: Check if first identifier is a C++ scope symbol
    const isCppAccess = this.isCppScopeSymbol(firstId);
    // Check if first identifier is a register
    if (this.symbols!.knownRegisters.has(firstId)) {
      // Register member access: GPIO7.DR_SET -> GPIO7_DR_SET
      return parts.join("_");
    }
    // Check if first identifier is a scope
    if (this.isKnownScope(firstId)) {
      // ADR-016: Validate visibility before allowing cross-scope access
      const memberName = parts[1];
      this.validateCrossScopeVisibility(firstId, memberName);
      // Issue #304: Use :: for C++ namespaces, _ for C-Next scopes
      return parts.join(this.getScopeSeparator(isCppAccess));
    }
    // Issue #304: C++ class/enum access uses ::
    if (isCppAccess) {
      return parts.join("::");
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
    const expressions = ctx.expression();
    const firstId = parts[0];
    // Issue #304: Check if first identifier is a C++ scope symbol
    const isCppAccess = this.isCppScopeSymbol(firstId);

    // Handle single vs multi-expression (bit range) syntax
    let indexExpr: string;
    if (expressions.length === 1) {
      indexExpr = this._generateExpression(expressions[0]);
    } else {
      // Bit range: [start, width]
      const start = this._generateExpression(expressions[0]);
      const width = this._generateExpression(expressions[1]);
      indexExpr = `${start}, ${width}`;
    }

    if (this.symbols!.knownRegisters.has(firstId)) {
      // Register bit access: GPIO7.DR_SET[idx] -> GPIO7_DR_SET |= (1 << idx) (handled elsewhere)
      // For assignment target, just generate the left-hand side representation
      const regName = parts.join("_");
      return `${regName}[${indexExpr}]`;
    }

    // Check if first identifier is a scope
    if (this.isKnownScope(firstId)) {
      // ADR-016: Validate visibility before allowing cross-scope access
      const memberName = parts[1];
      this.validateCrossScopeVisibility(firstId, memberName);
      // Issue #304: Use :: for C++ namespaces, _ for C-Next scopes
      const scopedName = parts.join(this.getScopeSeparator(isCppAccess));
      return `${scopedName}[${indexExpr}]`;
    }

    // Issue #304: C++ class/enum access uses ::
    if (isCppAccess) {
      const baseName = parts.join("::");
      return `${baseName}[${indexExpr}]`;
    }

    // Non-register, non-scope array access
    const baseName = parts.join(".");
    return `${baseName}[${indexExpr}]`;
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
        const offset = this._generateExpression(expressions[0]);
        const width = this._generateExpression(expressions[1]);
        return `${regName}[${offset}, ${width}]`;
      } else {
        const expr = this._generateExpression(expressions[0]);
        return `${regName}[${expr}]`;
      }
    }

    // Non-register scoped array access
    const expr = this._generateExpression(expressions[0]);
    if (parts.length === 1) {
      return `${scopeName}_${parts[0]}[${expr}]`;
    }
    return `${scopeName}_${parts[0]}.${parts.slice(1).join(".")}[${expr}]`;
  }

  private generateIf(ctx: Parser.IfStatementContext): string {
    const result = statementGenerators.generateIf(
      ctx,
      this.getInput(),
      this.getState(),
      this,
    );
    this.applyEffects(result.effects);
    return result.code;
  }

  private generateWhile(ctx: Parser.WhileStatementContext): string {
    const result = statementGenerators.generateWhile(
      ctx,
      this.getInput(),
      this.getState(),
      this,
    );
    this.applyEffects(result.effects);
    return result.code;
  }

  private generateDoWhile(ctx: Parser.DoWhileStatementContext): string {
    const result = statementGenerators.generateDoWhile(
      ctx,
      this.getInput(),
      this.getState(),
      this,
    );
    this.applyEffects(result.effects);
    return result.code;
  }

  private generateFor(ctx: Parser.ForStatementContext): string {
    const result = statementGenerators.generateFor(
      ctx,
      this.getInput(),
      this.getState(),
      this,
    );
    this.applyEffects(result.effects);
    return result.code;
  }

  private generateReturn(ctx: Parser.ReturnStatementContext): string {
    const result = statementGenerators.generateReturn(
      ctx,
      this.getInput(),
      this.getState(),
      this,
    );
    this.applyEffects(result.effects);
    return result.code;
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
    const result = statementGenerators.generateCriticalStatement(
      ctx,
      this.getInput(),
      this.getState(),
      this,
    );
    this.applyEffects(result.effects);
    return result.code;
  }

  // Issue #63: validateNoEarlyExits moved to TypeValidator

  // ========================================================================
  // Switch Statements (ADR-025)
  // ========================================================================

  private generateSwitch(ctx: Parser.SwitchStatementContext): string {
    const result = statementGenerators.generateSwitch(
      ctx,
      this.getInput(),
      this.getState(),
      this,
    );
    this.applyEffects(result.effects);
    return result.code;
  }

  private generateSwitchCase(ctx: Parser.SwitchCaseContext): string {
    const result = statementGenerators.generateSwitchCase(
      ctx,
      this.getInput(),
      this.getState(),
      this,
    );
    this.applyEffects(result.effects);
    return result.code;
  }

  private generateCaseLabel(ctx: Parser.CaseLabelContext): string {
    const result = statementGenerators.generateCaseLabel(
      ctx,
      this.getInput(),
      this.getState(),
      this,
    );
    this.applyEffects(result.effects);
    return result.code;
  }

  private generateDefaultCase(ctx: Parser.DefaultCaseContext): string {
    const result = statementGenerators.generateDefaultCase(
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

  // ADR-053 A2 Phase 7: Use extracted expression generator
  private _generateExpression(ctx: Parser.ExpressionContext): string {
    const result = expressionGenerators.generateExpression(
      ctx,
      this.getInput(),
      this.getState(),
      this,
    );
    this.applyEffects(result.effects);
    return result.code;
  }

  // ADR-022: Ternary operator with safety constraints
  // ADR-053 A2 Phase 7: Use extracted ternary generator
  private generateTernaryExpr(ctx: Parser.TernaryExpressionContext): string {
    const result = expressionGenerators.generateTernaryExpr(
      ctx,
      this.getInput(),
      this.getState(),
      this,
    );
    this.applyEffects(result.effects);
    return result.code;
  }

  private _generateOrExpr(ctx: Parser.OrExpressionContext): string {
    // ADR-053 A2: Use extracted binary expression generator
    const result = binaryExprGenerators.generateOrExpr(
      ctx,
      this.getInput(),
      this.getState(),
      this,
    );
    this.applyEffects(result.effects);
    return result.code;
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
      if (leftEnumType && this._isIntegerExpression(exprs[1])) {
        throw new Error(
          `Error: Cannot compare ${leftEnumType} enum to integer`,
        );
      }
      if (rightEnumType && this._isIntegerExpression(exprs[0])) {
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

  private _generateUnaryExpr(ctx: Parser.UnaryExpressionContext): string {
    // ADR-053 A2: Use extracted unary expression generator
    const result = generateUnaryExpr(
      ctx,
      this.getInput(),
      this.getState(),
      this,
    );
    this.applyEffects(result.effects);
    return result.code;
  }

  private _generatePostfixExpr(ctx: Parser.PostfixExpressionContext): string {
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
    // Issue #304: Track if we're accessing C++ symbols that need :: syntax
    let isCppAccessChain = false;

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
          // Issue #304: Check if this is a C++ scope symbol (namespace, class, enum)
          // These require :: syntax for member access. Variable symbols (including
          // object instances like Arduino's extern HardwareSerial Serial;) should
          // use . syntax, not :: syntax.
          // Issue #321: Removed || this.cppMode override - it was causing all symbols
          // to use :: in C++ mode, even object instances that need . syntax.
          if (this.isCppScopeSymbol(memberName)) {
            isCppAccessChain = true;
          }
          // Check if this first identifier is a register
          if (this.symbols!.knownRegisters.has(memberName)) {
            isRegisterChain = true;
          }
          continue; // Skip further processing, this just sets the base identifier
        }

        // Issue #212: Check if 'length' is a scope variable before treating it as a property accessor
        // When accessing this.length, we need to check if 'length' is a scope variable name
        // If so, transform it to the scope variable (e.g., Scope_length) instead of treating
        // it as the .length property accessor
        if (result === "__THIS_SCOPE__" && memberName === "length") {
          if (!this.context.currentScope) {
            throw new Error("Error: 'this' can only be used inside a scope");
          }
          const members = this.context.scopeMembers.get(
            this.context.currentScope,
          );
          if (members && members.has("length")) {
            // This is a scope variable named 'length', not a property accessor
            result = `${this.context.currentScope}_${memberName}`;
            currentIdentifier = result;
            // Set struct type for chained access if applicable
            const resolvedTypeInfo = this.context.typeRegistry.get(result);
            if (
              resolvedTypeInfo &&
              this.isKnownStruct(resolvedTypeInfo.baseType)
            ) {
              currentStructType = resolvedTypeInfo.baseType;
            }
            continue; // Skip the .length property handler
          }
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
                  // Try C-Next types first, then C types, then enum types
                  let bitWidth =
                    TYPE_WIDTH[memberType] || C_TYPE_WIDTH[memberType] || 0;
                  // Issue #208: Check if it's a typed enum
                  if (bitWidth === 0 && this.symbolTable) {
                    const enumWidth =
                      this.symbolTable.getEnumBitWidth(memberType);
                    if (enumWidth) bitWidth = enumWidth;
                  }
                  if (bitWidth > 0) {
                    result = String(bitWidth);
                  } else {
                    result = `/* .length: unsupported element type ${memberType} */0`;
                  }
                } else {
                  // Non-array member -> return bit width
                  // Try C-Next types first, then C types, then enum types
                  let bitWidth =
                    TYPE_WIDTH[memberType] || C_TYPE_WIDTH[memberType] || 0;
                  // Issue #208: Check if it's a typed enum
                  if (bitWidth === 0 && this.symbolTable) {
                    const enumWidth =
                      this.symbolTable.getEnumBitWidth(memberType);
                    if (enumWidth) bitWidth = enumWidth;
                  }
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
                  // Try primitive type first
                  let elementBitWidth = TYPE_WIDTH[typeInfo.baseType] || 0;
                  // Issue #201: Also check bitmap types
                  if (
                    elementBitWidth === 0 &&
                    typeInfo.isBitmap &&
                    typeInfo.bitmapTypeName
                  ) {
                    elementBitWidth =
                      this.symbols!.bitmapBitWidth.get(
                        typeInfo.bitmapTypeName,
                      ) || 0;
                  }
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
        // Extracted to AccessExprGenerator (ADR-053 A2 Phase 6)
        else if (memberName === "capacity") {
          const typeInfo = primaryId
            ? this.context.typeRegistry.get(primaryId)
            : undefined;
          const capResult = accessGenerators.generateCapacityProperty(typeInfo);
          this.applyEffects(capResult.effects);
          result = capResult.code;
        }
        // ADR-045: Handle .size property for strings (buffer size = capacity + 1)
        // Extracted to AccessExprGenerator (ADR-053 A2 Phase 6)
        else if (memberName === "size") {
          const typeInfo = primaryId
            ? this.context.typeRegistry.get(primaryId)
            : undefined;
          const sizeResult = accessGenerators.generateSizeProperty(typeInfo);
          this.applyEffects(sizeResult.effects);
          result = sizeResult.code;
        }
        // ADR-034: Handle bitmap field read access: flags.Running -> ((flags >> 0) & 1)
        // Partially extracted to AccessExprGenerator (ADR-053 A2 Phase 6)
        else if (primaryId) {
          const typeInfo = this.context.typeRegistry.get(primaryId);
          if (typeInfo?.isBitmap && typeInfo.bitmapTypeName) {
            const bitmapType = typeInfo.bitmapTypeName;
            const fields = this.symbols!.bitmapFields.get(bitmapType);
            if (fields && fields.has(memberName)) {
              const fieldInfo = fields.get(memberName)!;
              // Use extracted generator for bitmap field access
              const bitmapResult = accessGenerators.generateBitmapFieldAccess(
                result,
                fieldInfo,
              );
              this.applyEffects(bitmapResult.effects);
              result = bitmapResult.code;
            } else {
              throw new Error(
                `Error: Unknown bitmap field '${memberName}' on type '${bitmapType}'`,
              );
            }
          }
          // Check if this is a scope member access: Scope.member (ADR-016)
          else if (this.isKnownScope(result)) {
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
            // ADR-016: Validate visibility before allowing cross-scope access
            this.validateCrossScopeVisibility(result, memberName);
            // Issue #304: Use :: for C++ namespaces, _ for C-Next scopes
            result = `${result}${this.getScopeSeparator(isCppAccessChain)}${memberName}`;
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
            // Issue #304: Use :: for C++ enum classes, _ for C-Next enums
            result = `${result}${this.getScopeSeparator(isCppAccessChain)}${memberName}`;
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
          // Extracted to AccessExprGenerator (ADR-053 A2 Phase 6)
          else if (this.symbols!.registerMemberTypes.has(result)) {
            const bitmapType = this.symbols!.registerMemberTypes.get(result)!;
            const fields = this.symbols!.bitmapFields.get(bitmapType);
            if (fields && fields.has(memberName)) {
              const fieldInfo = fields.get(memberName)!;
              const bitmapResult = accessGenerators.generateBitmapFieldAccess(
                result,
                fieldInfo,
              );
              this.applyEffects(bitmapResult.effects);
              result = bitmapResult.code;
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
            // Extracted to AccessExprGenerator (ADR-053 A2 Phase 6)
            const bitmapFieldsPtr = this.symbols!.bitmapFields.get(
              currentStructType || "",
            );
            if (bitmapFieldsPtr && bitmapFieldsPtr.has(memberName)) {
              const fieldInfo = bitmapFieldsPtr.get(memberName)!;
              const bitmapResult = accessGenerators.generateBitmapFieldAccess(
                result,
                fieldInfo,
              );
              this.applyEffects(bitmapResult.effects);
              result = bitmapResult.code;
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
            // Extracted to AccessExprGenerator (ADR-053 A2 Phase 6)
            const bitmapFields = this.symbols!.bitmapFields.get(
              currentStructType || "",
            );
            if (bitmapFields && bitmapFields.has(memberName)) {
              const fieldInfo = bitmapFields.get(memberName)!;
              const bitmapResult = accessGenerators.generateBitmapFieldAccess(
                result,
                fieldInfo,
              );
              this.applyEffects(bitmapResult.effects);
              result = bitmapResult.code;
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

            // Issue #282: Check if this is a private const - if so, inline the value
            const fullName = `${this.context.currentScope}_${memberName}`;
            const constValue =
              this.symbols!.scopePrivateConstValues.get(fullName);
            if (constValue !== undefined) {
              // Inline the const value directly
              result = constValue;
              currentIdentifier = fullName; // Track for .length lookups
            } else {
              // Transform this.member to Scope_member
              result = fullName;
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
            }
          } else if (this.isKnownScope(result)) {
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
            // ADR-016: Validate visibility before allowing cross-scope access
            this.validateCrossScopeVisibility(result, memberName);
            // Issue #304: Use :: for C++ namespaces, _ for C-Next scopes
            result = `${result}${this.getScopeSeparator(isCppAccessChain)}${memberName}`;
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
            // Issue #304: Use :: for C++ enum classes, _ for C-Next enums
            result = `${result}${this.getScopeSeparator(isCppAccessChain)}${memberName}`;
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
          // Extracted to AccessExprGenerator (ADR-053 A2 Phase 6)
          else if (this.symbols!.registerMemberTypes.has(result)) {
            const bitmapType = this.symbols!.registerMemberTypes.get(result)!;
            const fields = this.symbols!.bitmapFields.get(bitmapType);
            if (fields && fields.has(memberName)) {
              const fieldInfo = fields.get(memberName)!;
              const bitmapResult = accessGenerators.generateBitmapFieldAccess(
                result,
                fieldInfo,
              );
              this.applyEffects(bitmapResult.effects);
              result = bitmapResult.code;
            } else {
              throw new Error(
                `Error: Unknown bitmap field '${memberName}' on type '${bitmapType}'`,
              );
            }
          }
          // Issue #304: C++ class/namespace static member access uses :: (e.g., CommandHandler::execute)
          // Also handles nested namespaces (hw::nested::configure) by checking if result already contains ::
          // Issue #314: Also use :: for global.X.method() in C++ mode with undeclared external classes
          // (e.g., Arduino's Serial class) - the global. prefix explicitly requests C++ static access
          else if (
            isCppAccessChain &&
            (this.isCppScopeSymbol(result) ||
              result.includes("::") ||
              isGlobalAccess)
          ) {
            result = `${result}::${memberName}`;
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
          const index = this._generateExpression(exprs[0]);

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
          const start = this._generateExpression(exprs[0]);
          const width = this._generateExpression(exprs[1]);
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
      // Function call (extracted to CallExprGenerator - ADR-053 A2 Phase 5)
      // Handles both argumentList() case and empty function call ()
      else {
        // Delegate to extracted function call generator
        const callResult = generateFunctionCall(
          result,
          op.argumentList() || null,
          this.getInput(),
          this.getState(),
          this,
        );
        this.applyEffects(callResult.effects);
        result = callResult.code;
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
      // ADR-053 A2: Use extracted literal generator
      const result = generateLiteral(
        ctx.literal()!,
        this.getInput(),
        this.getState(),
        this,
      );
      this.applyEffects(result.effects);

      // Issue #304: Transform NULL → nullptr in C++ mode
      if (result.code === "NULL" && this.cppMode) {
        return "nullptr";
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

    // Issue #267: Use C++ casts when cppMode is enabled for MISRA compliance
    if (this.cppMode) {
      return `static_cast<${targetType}>(${expr})`;
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
            (expr) => this._tryEvaluateConstant(expr),
          );
        }
      }
      // TODO: Add bounds checking for struct.field[i][j] patterns

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
                // ADR-006: Use determineSeparator helper for -> (struct param) / _ (scope) / .
                const separator = memberAccessChain.determineSeparator(
                  { isStructParam, isCrossScope },
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
      // ADR-016: Validate visibility before allowing cross-scope access
      const memberName = parts[1];
      this.validateCrossScopeVisibility(firstPart, memberName);
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

  private _generateType(ctx: Parser.TypeContext): string {
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
  private _countStringLengthAccesses(
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
  private _countBlockLengthAccesses(
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
      this._countBlockLengthAccesses(ctx.block()!, counts);
    }
  }

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
    if (TYPE_WIDTH[cnxType] && !cnxType.startsWith("f") && cnxType !== "bool") {
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
    const indent = "    ".repeat(this.context.indentLevel);
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
