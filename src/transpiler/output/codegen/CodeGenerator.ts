/**
 * C-Next Code Generator
 * Transforms C-Next AST to clean, readable C code
 */

import { CommonTokenStream, ParserRuleContext } from "antlr4ng";
import * as Parser from "../../logic/parser/grammar/CNextParser";

import CommentExtractor from "../../logic/analysis/CommentExtractor";
import TypeRegistrationEngine from "./helpers/TypeRegistrationEngine";
import CommentFormatter from "./CommentFormatter";
import IncludeDiscovery from "../../data/IncludeDiscovery";
import IComment from "../../types/IComment";
import TYPE_WIDTH from "./types/TYPE_WIDTH";
import TYPE_MAP from "./types/TYPE_MAP";
import TYPE_LIMITS from "./types/TYPE_LIMITS";
// Issue #60: BITMAP_SIZE and BITMAP_BACKING_TYPE moved to SymbolCollector
import TTypeInfo from "./types/TTypeInfo";
import TParameterInfo from "./types/TParameterInfo";
import ICodeGeneratorOptions from "./types/ICodeGeneratorOptions";
import TypeResolver from "./TypeResolver";
import ICodeGenSymbols from "../../types/ICodeGenSymbols";
import TypeValidator from "./TypeValidator";
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
// ADR-109: Assignment decomposition (Phase 2)
import AssignmentHandlerRegistry from "./assignment/index";
import AssignmentClassifier from "./assignment/AssignmentClassifier";
import buildAssignmentContext from "./assignment/AssignmentContextBuilder";
// IHandlerDeps removed - handlers now use CodeGenState.generator directly
// Issue #461: LiteralUtils for parsing const values from symbol table
import LiteralUtils from "../../../utils/LiteralUtils";
// Issue #644: Extracted string length counter for strlen caching optimization
import StringLengthCounter from "./analysis/StringLengthCounter";
// Issue #644: C/C++ mode helper for consolidated mode-specific patterns
import CppModeHelper from "./helpers/CppModeHelper";
// Issue #644: Array dimension parsing helper for consolidation
import ArrayDimensionParser from "./helpers/ArrayDimensionParser";
// Issue #644: Member chain analyzer for bit access pattern detection
import MemberChainAnalyzer from "./analysis/MemberChainAnalyzer";
// Issue #644: Float bit write helper for shadow variable pattern
import FloatBitHelper from "./helpers/FloatBitHelper";
// Issue #644: String declaration helper for bounded/array/concat strings
// Note: StringDeclHelper is now used via VariableDeclHelper
// Issue #794: Argument generation helper for ADR-006 semantics
import ArgumentGenerator from "./helpers/ArgumentGenerator";
// Issue #644: Enum assignment validator for type-safe enum assignments
import EnumAssignmentValidator from "./helpers/EnumAssignmentValidator";
// Issue #644: Array initialization helper for size inference and fill-all
// Note: ArrayInitHelper is now used via VariableDeclHelper
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
// Note: VariableModifierBuilder is now used via VariableDeclHelper
// Issue #792: Variable declaration helper
import VariableDeclHelper from "./helpers/VariableDeclHelper";
// String operation detection and extraction
import StringOperationsHelper from "./helpers/StringOperationsHelper";
// PR #681: Extracted separator and dereference resolution utilities
import MemberSeparatorResolver from "./helpers/MemberSeparatorResolver";
import ParameterDereferenceResolver from "./helpers/ParameterDereferenceResolver";
// SonarCloud S3776: Extracted helpers for assignment target generation
import PostfixChainBuilder from "./helpers/PostfixChainBuilder";
import SimpleIdentifierResolver from "./helpers/SimpleIdentifierResolver";
import BaseIdentifierBuilder from "./helpers/BaseIdentifierBuilder";
import ISimpleIdentifierDeps from "./types/ISimpleIdentifierDeps";
import IPostfixChainDeps from "./types/IPostfixChainDeps";
import IPostfixOperation from "./types/IPostfixOperation";
// Issue #707: Expression unwrapping utility for reducing duplication
import ExpressionUnwrapper from "../../../utils/ExpressionUnwrapper";
// Stateless parser utilities extracted from CodeGenerator
import CodegenParserUtils from "./utils/CodegenParserUtils";
import IMemberSeparatorDeps from "./types/IMemberSeparatorDeps";
import IParameterDereferenceDeps from "./types/IParameterDereferenceDeps";
import ISeparatorContext from "./types/ISeparatorContext";
// Issue #269: Transitive modification propagation for const inference (used by analyzeModificationsOnly)
import TransitiveModificationPropagator from "../../logic/analysis/helpers/TransitiveModificationPropagator";
// Phase 3: Type generation helper for improved testability
import TypeGenerationHelper from "./helpers/TypeGenerationHelper";
// Phase 5: Cast validation helper for improved testability
import CastValidator from "./helpers/CastValidator";
// Issue #793: Function context lifecycle and parameter processing helper
import FunctionContextManager from "./helpers/FunctionContextManager";
import IFunctionContextCallbacks from "./types/IFunctionContextCallbacks";
// Global state for code generation (simplifies debugging, eliminates DI complexity)
import CodeGenState from "../../state/CodeGenState";
// Issue #269: Pass-by-value analysis extracted from CodeGenerator
import PassByValueAnalyzer from "../../logic/analysis/PassByValueAnalyzer";
// Unified parameter generation (Phase 1)
import ParameterInputAdapter from "./helpers/ParameterInputAdapter";
import ParameterSignatureBuilder from "./helpers/ParameterSignatureBuilder";
// Issue #895: Parse typedef signatures to determine pointer vs value params
// Extracted resolvers that use CodeGenState
import SizeofResolver from "./resolution/SizeofResolver";
import EnumTypeResolver from "./resolution/EnumTypeResolver";
import ScopeResolver from "./resolution/ScopeResolver";
// Issue #797: Centralized C-style name generation
import QualifiedNameGenerator from "./utils/QualifiedNameGenerator";

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

  /** Token stream for comment extraction (ADR-043) */
  private tokenStream: CommonTokenStream | null = null;

  private commentExtractor: CommentExtractor | null = null;

  private readonly commentFormatter: CommentFormatter = new CommentFormatter();

  /** Type resolution and classification - now a static class, no instance needed */

  /** Symbol collection - ADR-055: Now uses ISymbolInfo from TSymbolInfoAdapter */
  public symbols: ICodeGenSymbols | null = null;

  /** Issue #644: String declaration helper for bounded/array/concat strings */

  /** Issue #644: Array initialization helper for size inference and fill-all */

  /** Generator registry for modular code generation (ADR-053) */
  private readonly registry: GeneratorRegistry = new GeneratorRegistry();

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
      symbolTable: CodeGenState.symbolTable,
      symbols: CodeGenState.symbols,
      typeRegistry: CodeGenState.getTypeRegistryView(),
      functionSignatures: CodeGenState.functionSignatures,
      knownFunctions: CodeGenState.knownFunctions,
      knownStructs: CodeGenState.symbols?.knownStructs ?? new Set(),
      constValues: CodeGenState.constValues,
      callbackTypes: CodeGenState.callbackTypes,
      callbackFieldTypes: CodeGenState.callbackFieldTypes,
      targetCapabilities: CodeGenState.targetCapabilities,
      debugMode: CodeGenState.debugMode,
    };
  }

  /**
   * Get a snapshot of the current generation state.
   * Represents where we are in the AST traversal.
   */
  getState(): IGeneratorState {
    return {
      currentScope: CodeGenState.currentScope,
      indentLevel: CodeGenState.indentLevel,
      inFunctionBody: CodeGenState.inFunctionBody,
      currentParameters: CodeGenState.currentParameters,
      localVariables: CodeGenState.localVariables,
      localArrays: CodeGenState.localArrays,
      expectedType: CodeGenState.expectedType,
      selfIncludeAdded: CodeGenState.selfIncludeAdded, // Issue #369
      // Issue #644: Postfix expression state
      scopeMembers: CodeGenState.getAllScopeMembers(),
      mainArgsName: CodeGenState.mainArgsName,
      floatBitShadows: CodeGenState.floatBitShadows,
      floatShadowCurrent: CodeGenState.floatShadowCurrent,
      lengthCache: CodeGenState.lengthCache,
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
          CodeGenState.usedClampOps.add(
            `${effect.operation}_${effect.cnxType}`,
          );
          break;
        case "safe-div":
          CodeGenState.usedSafeDivOps.add(
            `${effect.operation}_${effect.cnxType}`,
          );
          break;

        // Type registration effects
        case "register-type":
          CodeGenState.setVariableTypeInfo(effect.name, effect.info);
          break;
        case "register-local":
          CodeGenState.localVariables.add(effect.name);
          if (effect.isArray) {
            CodeGenState.localArrays.add(effect.name);
          }
          break;
        case "register-const-value":
          CodeGenState.constValues.set(effect.name, effect.value);
          break;

        // Scope effects (ADR-016)
        case "set-scope":
          CodeGenState.currentScope = effect.name;
          break;

        // Function body effects
        case "enter-function-body":
          CodeGenState.inFunctionBody = true;
          CodeGenState.localVariables.clear();
          CodeGenState.localArrays.clear();
          CodeGenState.floatBitShadows.clear();
          CodeGenState.floatShadowCurrent.clear();
          break;
        case "exit-function-body":
          CodeGenState.inFunctionBody = false;
          CodeGenState.localVariables.clear();
          CodeGenState.localArrays.clear();
          CodeGenState.floatBitShadows.clear();
          CodeGenState.floatShadowCurrent.clear();
          break;
        case "set-parameters":
          CodeGenState.currentParameters = new Map(effect.params);
          break;
        case "clear-parameters":
          CodeGenState.currentParameters.clear();
          break;

        // Callback effects
        case "register-callback-field":
          CodeGenState.callbackFieldTypes.set(effect.key, effect.typeName);
          break;

        // Array initializer effects
        case "set-array-init-count":
          CodeGenState.lastArrayInitCount = effect.count;
          break;
        case "set-array-fill-value":
          CodeGenState.lastArrayFillValue = effect.value;
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
        CodeGenState.needsStdint = true;
        break;
      case "stdbool":
        CodeGenState.needsStdbool = true;
        break;
      case "string":
        CodeGenState.needsString = true;
        break;
      case "cmsis":
        CodeGenState.needsCMSIS = true;
        break;
      case "limits":
        CodeGenState.needsLimits = true;
        break;
      case "isr":
        CodeGenState.needsISR = true;
        break;
      case "float_static_assert":
        CodeGenState.needsFloatStaticAssert = true;
        break;
      case "irq_wrappers":
        CodeGenState.needsIrqWrappers = true;
        break;
    }
  }

  /**
   * Get the current indentation string.
   */
  getIndent(): string {
    return FormatUtils.indent(CodeGenState.indentLevel);
  }

  /**
   * Resolve an identifier to its fully-scoped name.
   * Part of IOrchestrator interface.
   * ADR-016: Inside a scope, checks if the identifier is a scope member first.
   * Otherwise returns the identifier unchanged (global scope).
   */
  resolveIdentifier(identifier: string): string {
    // Check current scope first (inner scope shadows outer)
    if (CodeGenState.currentScope) {
      const members = CodeGenState.getScopeMembers(CodeGenState.currentScope);
      if (members?.has(identifier)) {
        return `${CodeGenState.currentScope}_${identifier}`;
      }
    }

    // Fall back to global scope
    return identifier;
  }

  // === Expression Generation (ADR-053 A2) ===

  /**
   * Generate a C expression from any expression context.
   * Part of IOrchestrator interface.
   */
  generateExpression(ctx: Parser.ExpressionContext): string {
    return this.invokeExpression("expression", ctx);
  }

  /**
   * Issue #477: Generate expression with a specific expected type context.
   * Used by return statements to resolve unqualified enum values.
   */
  generateExpressionWithExpectedType(
    ctx: Parser.ExpressionContext,
    expectedType: string | null,
  ): string {
    const savedExpectedType = CodeGenState.expectedType;
    CodeGenState.expectedType = expectedType;
    const result = this.generateExpression(ctx);
    CodeGenState.expectedType = savedExpectedType;
    return result;
  }

  /**
   * Generate type translation (C-Next type -> C type).
   * Part of IOrchestrator interface.
   */
  generateType(ctx: Parser.TypeContext): string {
    // Track required includes based on type usage
    const requiredInclude = TypeGenerationHelper.getRequiredInclude(ctx);
    if (requiredInclude) {
      this.requireInclude(requiredInclude);
    }

    // Generate the C type using the helper with dependencies
    return TypeGenerationHelper.generate(ctx, {
      currentScope: CodeGenState.currentScope,
      isCppScopeSymbol: (name) => this.isCppScopeSymbol(name),
      checkNeedsStructKeyword: (name) =>
        CodeGenState.symbolTable.checkNeedsStructKeyword(name),
      validateCrossScopeVisibility: (scope, member) =>
        ScopeResolver.validateCrossScopeVisibility(scope, member),
    });
  }

  /**
   * Generate a unary expression.
   * Part of IOrchestrator interface.
   */
  generateUnaryExpr(ctx: Parser.UnaryExpressionContext): string {
    return this.invokeExpression("unary", ctx);
  }

  /**
   * Generate a postfix expression.
   * Part of IOrchestrator interface.
   * Issue #644: Delegates to extracted PostfixExpressionGenerator.
   */
  generatePostfixExpr(ctx: Parser.PostfixExpressionContext): string {
    const result = generatePostfixExpression(
      ctx,
      this.getInput(),
      this.getState(),
      this,
    );
    this.applyEffects(result.effects);
    return result.code;
  }

  /**
   * Generate the full precedence chain from or-expression down.
   * Part of IOrchestrator interface.
   */
  generateOrExpr(ctx: Parser.OrExpressionContext): string {
    return this.invokeExpression("or", ctx);
  }

  // === Type Utilities ===

  /**
   * Check if a type name is a known struct.
   * Part of IOrchestrator interface.
   */
  isKnownStruct(typeName: string): boolean {
    return SymbolLookupHelper.isKnownStruct(
      CodeGenState.symbols?.knownStructs,
      CodeGenState.symbols?.knownBitmaps,
      CodeGenState.symbolTable,
      typeName,
    );
  }

  /**
   * Check if a type is a float type.
   * Part of IOrchestrator interface - delegates to TypeResolver.
   */
  isFloatType(typeName: string): boolean {
    return TypeResolver.isFloatType(typeName);
  }

  /**
   * Check if a type is an integer type.
   * Part of IOrchestrator interface - delegates to TypeResolver.
   */
  isIntegerType(typeName: string): boolean {
    return TypeResolver.isIntegerType(typeName);
  }

  /**
   * Check if a function is defined in C-Next.
   * Part of IOrchestrator interface.
   */
  isCNextFunction(name: string): boolean {
    return SymbolLookupHelper.isCNextFunctionCombined(
      CodeGenState.knownFunctions,
      CodeGenState.symbolTable,
      name,
    );
  }

  // === Expression Analysis ===

  /**
   * Get the enum type of an expression.
   * Part of IOrchestrator interface - delegates to private implementation.
   */
  getExpressionEnumType(
    ctx: Parser.ExpressionContext | Parser.RelationalExpressionContext,
  ): string | null {
    return EnumTypeResolver.resolve(ctx);
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
   * Part of IOrchestrator interface.
   * ADR-045: Used to detect string comparisons and generate strcmp().
   * Issue #137: Extended to handle array element access (e.g., names[0])
   */
  isStringExpression(ctx: Parser.RelationalExpressionContext): boolean {
    const text = ctx.getText();

    // Check for string literals
    if (text.startsWith('"') && text.endsWith('"')) {
      return true;
    }

    // Check if it's a simple variable of string type
    if (/^[a-zA-Z_]\w*$/.exec(text)) {
      const typeInfo = CodeGenState.getVariableTypeInfo(text);
      if (typeInfo?.isString) {
        return true;
      }
    }

    // Issue #137: Check for array element access (e.g., names[0], arr[i])
    return this._isArrayAccessStringExpression(text);
  }

  /**
   * Check if array access expression evaluates to a string.
   * Extracted from isStringExpression to reduce cognitive complexity.
   */
  private _isArrayAccessStringExpression(text: string): boolean {
    // Pattern: identifier[expression] or identifier[expression][expression]...
    // BUT NOT if accessing properties that return numbers, not strings
    const arrayAccessMatch = /^([a-zA-Z_]\w*)\[/.exec(text);
    if (!arrayAccessMatch) {
      return false;
    }

    // ADR-045/ADR-058: String/array properties return numeric values, not strings
    // ADR-058: .length deprecated, replaced by .bit_length, .byte_length,
    // .element_count, .char_count
    if (
      text.endsWith(".length") ||
      text.endsWith(".capacity") ||
      text.endsWith(".size") ||
      text.endsWith(".bit_length") ||
      text.endsWith(".byte_length") ||
      text.endsWith(".element_count") ||
      text.endsWith(".char_count")
    ) {
      return false;
    }

    const arrayName = arrayAccessMatch[1];
    const typeInfo = CodeGenState.getVariableTypeInfo(arrayName);
    if (!typeInfo) {
      return false;
    }

    // Check if it's an ARRAY OF STRINGS (not a single string being indexed)
    // A single string<50> has arrayDimensions=[51] (just the char buffer)
    // An array of strings string<50>[10] has arrayDimensions=[10, 51]
    // Single string indexing (e.g., userName[i]) returns a char, not a string
    // Array of strings indexing (e.g., names[0]) returns a string
    if (typeInfo.isString) {
      // For strings, only treat as string expression if it's an array of strings
      // (arrayDimensions.length > 1 means it's string<N>[M], not just string<N>)
      const dims = typeInfo.arrayDimensions;
      return Array.isArray(dims) && dims.length > 1;
    }

    // Non-string array with string base type
    return Boolean(
      typeInfo.isArray &&
      typeInfo.baseType &&
      TypeCheckUtils.isString(typeInfo.baseType),
    );
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
   * Part of IOrchestrator interface - delegates to CodegenParserUtils.
   */
  getOperatorsFromChildren(ctx: ParserRuleContext): string[] {
    return CodegenParserUtils.getOperatorsFromChildren(ctx);
  }

  // === Validation ===

  /**
   * Validate cross-scope member visibility.
   * Part of IOrchestrator interface - delegates to private implementation.
   */
  validateCrossScopeVisibility(
    scopeName: string,
    memberName: string,
    isGlobalAccess: boolean = false,
  ): void {
    ScopeResolver.validateCrossScopeVisibility(
      scopeName,
      memberName,
      isGlobalAccess,
    );
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
    TypeValidator.validateShiftAmount(leftType, rightExpr, op, ctx);
  }

  /**
   * Validate ternary condition is a comparison (ADR-022).
   * Part of IOrchestrator interface - delegates to TypeValidator.
   */
  validateTernaryCondition(condition: Parser.OrExpressionContext): void {
    TypeValidator.validateTernaryCondition(condition);
  }

  /**
   * Validate no nested ternary expressions (ADR-022).
   * Part of IOrchestrator interface - delegates to TypeValidator.
   */
  validateNoNestedTernary(
    expr: Parser.OrExpressionContext,
    branchName: string,
  ): void {
    TypeValidator.validateNoNestedTernary(expr, branchName);
  }

  // === Function Call Helpers (ADR-053 A2 Phase 5) ===

  /**
   * Get simple identifier from expression, or null if complex.
   * Part of IOrchestrator interface - delegates to CodegenParserUtils.
   */
  getSimpleIdentifier(ctx: Parser.ExpressionContext): string | null {
    return CodegenParserUtils.getSimpleIdentifier(ctx);
  }

  /**
   * Generate function argument with pass-by-reference handling.
   * Part of IOrchestrator interface - delegates to ArgumentGenerator.
   */
  generateFunctionArg(
    ctx: Parser.ExpressionContext,
    targetParamBaseType?: string,
  ): string {
    const simpleId = CodegenParserUtils.getSimpleIdentifier(ctx);
    return ArgumentGenerator.generateArg(ctx, simpleId, targetParamBaseType, {
      getLvalueType: (c) => this.getLvalueType(c),
      getMemberAccessArrayStatus: (c) => this.getMemberAccessArrayStatus(c),
      needsCppMemberConversion: (c, t) => this.needsCppMemberConversion(c, t),
      isStringSubscriptAccess: (c) => this.isStringSubscriptAccess(c),
      generateExpression: (c) => this.generateExpression(c),
    });
  }

  /**
   * Check if a value is const.
   * Part of IOrchestrator interface - delegates to TypeValidator.
   */
  isConstValue(name: string): boolean {
    return TypeValidator.isConstValue(name);
  }

  /**
   * Get known enums set for pass-by-value detection.
   * Part of IOrchestrator interface.
   */
  getKnownEnums(): ReadonlySet<string> {
    return CodeGenState.symbols!.knownEnums;
  }

  /**
   * Issue #304: Check if we're generating C++ output.
   * Part of IOrchestrator interface.
   */
  isCppMode(): boolean {
    return CodeGenState.cppMode;
  }

  /**
   * Issue #304: Check if a type is a C++ enum class (scoped enum).
   * These require explicit casts to integer types in C++.
   * Part of IOrchestrator interface.
   */
  isCppEnumClass(typeName: string): boolean {
    return SymbolLookupHelper.isCppEnumClass(
      CodeGenState.symbolTable,
      typeName,
    );
  }

  /**
   * Issue #304: Get the type of an expression.
   * Part of IOrchestrator interface.
   */
  getExpressionType(ctx: Parser.ExpressionContext): string | null {
    return TypeResolver.getExpressionType(ctx);
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
      CodeGenState.indentLevel++;
      const stmtCode = this.generateStatement(stmt);
      CodeGenState.indentLevel--;

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
    TypeValidator.validateNoEarlyExits(ctx);
  }

  /**
   * Generate a single statement.
   * Part of IOrchestrator interface (ADR-053 A3).
   */
  generateStatement(ctx: Parser.StatementContext): string {
    let result = "";

    if (ctx.variableDeclaration()) {
      result = this.generateVariableDecl(ctx.variableDeclaration()!);
    } else if (ctx.assignmentStatement()) {
      result = this.generateAssignment(ctx.assignmentStatement()!);
    } else if (ctx.expressionStatement()) {
      result =
        this.generateExpression(ctx.expressionStatement()!.expression()) + ";";
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
    if (CodeGenState.pendingTempDeclarations.length > 0) {
      const tempDecls = CodeGenState.pendingTempDeclarations.join("\n");
      CodeGenState.pendingTempDeclarations = [];
      return tempDecls + "\n" + result;
    }

    return result;
  }

  /**
   * Issue #250: Flush pending temp variable declarations.
   * Returns declarations as a single string and clears the pending list.
   * Part of IOrchestrator interface.
   */
  flushPendingTempDeclarations(): string {
    if (CodeGenState.pendingTempDeclarations.length === 0) {
      return "";
    }
    const decls = CodeGenState.pendingTempDeclarations.join("\n");
    CodeGenState.pendingTempDeclarations = [];
    return decls;
  }

  /**
   * Get indentation string for current level.
   * Part of IOrchestrator interface (ADR-053 A3).
   */
  indent(text: string): string {
    return FormatUtils.indentAllLines(text, CodeGenState.indentLevel);
  }

  /**
   * Validate switch statement.
   * Part of IOrchestrator interface (ADR-053 A3).
   */
  validateSwitchStatement(
    ctx: Parser.SwitchStatementContext,
    switchExpr: Parser.ExpressionContext,
  ): void {
    TypeValidator.validateSwitchStatement(ctx, switchExpr);
  }

  /**
   * Validate condition is a boolean expression (ADR-027, Issue #884).
   * Part of IOrchestrator interface (ADR-053 A3).
   */
  validateConditionIsBoolean(
    ctx: Parser.ExpressionContext,
    conditionType: string,
  ): void {
    TypeValidator.validateConditionIsBoolean(ctx, conditionType);
  }

  /**
   * Issue #254: Validate no function calls in condition (E0702).
   * Part of IOrchestrator interface (ADR-053 A3).
   */
  validateConditionNoFunctionCall(
    ctx: Parser.ExpressionContext,
    conditionType: string,
  ): void {
    TypeValidator.validateConditionNoFunctionCall(ctx, conditionType);
  }

  /**
   * Issue #254: Validate no function calls in ternary condition (E0702).
   * Part of IOrchestrator interface (ADR-053 A2).
   */
  validateTernaryConditionNoFunctionCall(
    ctx: Parser.OrExpressionContext,
  ): void {
    TypeValidator.validateTernaryConditionNoFunctionCall(ctx);
  }

  /**
   * Generate an assignment target.
   * Part of IOrchestrator interface (ADR-053 A3).
   * Issue #387: Unified postfix chain - all patterns now use IDENTIFIER postfixTargetOp*
   */
  generateAssignmentTarget(ctx: Parser.AssignmentTargetContext): string {
    const hasGlobal = ctx.GLOBAL() !== null;
    const hasThis = ctx.THIS() !== null;
    const identifier = ctx.IDENTIFIER()?.getText();
    const postfixOps = ctx.postfixTargetOp();

    // SonarCloud S3776: Use SimpleIdentifierResolver for simple identifier case
    if (!hasGlobal && !hasThis && postfixOps.length === 0 && identifier) {
      return SimpleIdentifierResolver.resolve(
        identifier,
        this._buildSimpleIdentifierDeps(),
      );
    }

    // Issue #779: Resolve bare scope member identifiers before postfix chain processing
    // This ensures scope members get their prefix even with array/member access.
    // Skip parameters - they don't need scope resolution and shouldn't be dereferenced
    // when used with array indexing (buf[idx] is valid C for pointer params).
    // Also skip known registers - they should be handled by the postfix chain builder
    // to enable proper register validation (requiring global. when shadowed).
    let resolvedIdentifier = identifier ?? "";
    if (!hasGlobal && !hasThis && identifier) {
      const isParameter = CodeGenState.currentParameters.has(identifier);
      const isLocalVariable = CodeGenState.localVariables.has(identifier);
      const isKnownRegister =
        CodeGenState.symbols?.knownRegisters.has(identifier);
      if (!isParameter && !isLocalVariable && !isKnownRegister) {
        const resolved = TypeValidator.resolveBareIdentifier(
          identifier,
          false, // not local
          (name: string) => this.isKnownStruct(name),
        );
        if (resolved !== null) {
          resolvedIdentifier = resolved;
        }
      }
    }

    // SonarCloud S3776: Use BaseIdentifierBuilder for base identifier
    const safeIdentifier = identifier ?? "";
    const { result: baseResult, firstId } = BaseIdentifierBuilder.build(
      hasGlobal || hasThis ? safeIdentifier : resolvedIdentifier,
      hasGlobal,
      hasThis,
      CodeGenState.currentScope,
    );

    // No postfix operations - return base
    if (postfixOps.length === 0) {
      return baseResult;
    }

    // SonarCloud S3776: Use PostfixChainBuilder for postfix operations
    const operations = this._extractPostfixOperations(postfixOps);
    const postfixDeps = this._buildPostfixChainDeps(
      firstId,
      hasGlobal,
      hasThis,
    );

    return PostfixChainBuilder.build(
      baseResult,
      firstId,
      operations,
      postfixDeps,
    );
  }

  /**
   * Generate array dimensions.
   * Part of IOrchestrator interface (ADR-053 A3).
   */
  generateArrayDimensions(dims: Parser.ArrayDimensionContext[]): string {
    return dims.map((d) => this.generateArrayDimension(d)).join("");
  }

  // === strlen Optimization (ADR-053 A3) ===

  /**
   * Count string length accesses for caching.
   * Part of IOrchestrator interface (ADR-053 A3).
   */
  countStringLengthAccesses(
    ctx: Parser.ExpressionContext,
  ): Map<string, number> {
    // Issue #644: Delegate to extracted StringLengthCounter (now static)
    return StringLengthCounter.countExpression(ctx);
  }

  /**
   * Count block length accesses.
   * Part of IOrchestrator interface (ADR-053 A3).
   */
  countBlockLengthAccesses(
    ctx: Parser.BlockContext,
    counts: Map<string, number>,
  ): void {
    // Issue #644: Delegate to extracted StringLengthCounter (now static)
    StringLengthCounter.countBlockInto(ctx, counts);
  }

  /**
   * Setup length cache and return declarations.
   * Part of IOrchestrator interface (ADR-053 A3).
   */
  setupLengthCache(counts: Map<string, number>): string {
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
      CodeGenState.lengthCache = cache;
      return declarations.join("\n") + "\n";
    }

    return "";
  }

  /**
   * Clear length cache.
   * Part of IOrchestrator interface (ADR-053 A3).
   */
  clearLengthCache(): void {
    CodeGenState.lengthCache = null;
  }

  /**
   * Register a local variable.
   * Part of IOrchestrator interface (ADR-053 A3).
   */
  registerLocalVariable(name: string): void {
    CodeGenState.localVariables.add(name);
  }

  // === Declaration Generation (ADR-053 A4) ===

  /** Generate single array dimension */
  generateArrayDimension(dim: Parser.ArrayDimensionContext): string {
    if (dim.expression()) {
      // Bug #8: At file scope, resolve const values to numeric literals
      // because C doesn't allow const variables as array sizes at file scope
      if (!CodeGenState.inFunctionBody) {
        const constValue = this.tryEvaluateConstant(dim.expression()!);
        if (constValue !== undefined) {
          return `[${constValue}]`;
        }
      }
      return `[${this.generateExpression(dim.expression()!)}]`;
    }
    return "[]";
  }

  /** Generate parameter list for function signature */
  generateParameterList(ctx: Parser.ParameterListContext): string {
    return ctx
      .parameter()
      .map((p, index) => this.generateParameter(p, index))
      .join(", ");
  }

  /** Get the raw type name without C conversion */
  getTypeName(ctx: Parser.TypeContext): string {
    // ADR-016: Handle this.Type for scoped types (e.g., this.State -> Motor_State)
    if (ctx.scopedType()) {
      const typeName = ctx.scopedType()!.IDENTIFIER().getText();
      if (CodeGenState.currentScope) {
        return `${CodeGenState.currentScope}_${typeName}`;
      }
      return typeName;
    }
    // Issue #478: Handle global.Type for global types inside scope
    if (ctx.globalType()) {
      return ctx.globalType()!.IDENTIFIER().getText();
    }
    // ADR-016: Handle Scope.Type from outside scope (e.g., Motor.State -> Motor_State)
    // Issue #388: Also handles C++ namespace types
    if (ctx.qualifiedType()) {
      const identifiers = ctx.qualifiedType()!.IDENTIFIER();
      const identifierNames = identifiers.map((id) => id.getText());
      return this.resolveQualifiedType(identifierNames);
    }
    // Handle C-Next array type syntax (Type[N]) - return base type without dimension
    if (ctx.arrayType()) {
      const arrayTypeCtx = ctx.arrayType()!;
      if (arrayTypeCtx.primitiveType()) {
        return arrayTypeCtx.primitiveType()!.getText();
      }
      if (arrayTypeCtx.userType()) {
        return arrayTypeCtx.userType()!.getText();
      }
    }
    if (ctx.userType()) {
      return ctx.userType()!.getText();
    }
    if (ctx.primitiveType()) {
      return ctx.primitiveType()!.getText();
    }
    return ctx.getText();
  }

  /** Try to evaluate a constant expression at compile time */
  tryEvaluateConstant(ctx: Parser.ExpressionContext): number | undefined {
    return ArrayDimensionParser.parseSingleDimension(ctx, {
      constValues: CodeGenState.constValues,
      typeWidths: TYPE_WIDTH,
      isKnownStruct: (name) => this.isKnownStruct(name),
    });
  }

  /**
   * Get zero initializer for a type.
   * ADR-015: Get the appropriate zero initializer for a type
   * ADR-017: Handle enum types by initializing to first member
   */
  getZeroInitializer(typeCtx: Parser.TypeContext, isArray: boolean): string {
    // Issue #379: Arrays need element type checking for C++ classes
    if (isArray) {
      return this._getArrayZeroInitializer(typeCtx);
    }

    // Handle named types (scoped, global, qualified, user)
    const resolved = this._resolveTypeNameFromContext(typeCtx);
    if (resolved) {
      // Check if enum
      if (CodeGenState.symbols!.knownEnums.has(resolved.name)) {
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
    return StringUtils.literalLength(literal);
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
    return StringOperationsHelper.getStringExprCapacity(exprCode);
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
    for (const callbackType of CodeGenState.callbackFieldTypes.values()) {
      if (callbackType === funcName) {
        return true;
      }
    }
    return false;
  }

  // === Scope Management (A4) ===

  setCurrentScope(name: string | null): void {
    CodeGenState.currentScope = name;
    CodeGenState.currentScope = name;
  }

  /**
   * Issue #269: Set the current function name for pass-by-value lookup.
   * Part of IOrchestrator interface.
   */
  setCurrentFunctionName(name: string | null): void {
    CodeGenState.currentFunctionName = name;
    CodeGenState.currentFunctionName = name;
  }

  /**
   * Issue #477: Get the current function's return type for enum inference.
   * Used by return statement generation to set expectedType.
   */
  getCurrentFunctionReturnType(): string | null {
    return CodeGenState.currentFunctionReturnType;
  }

  /**
   * Issue #477: Set the current function's return type for enum inference.
   */
  setCurrentFunctionReturnType(returnType: string | null): void {
    CodeGenState.currentFunctionReturnType = returnType;
    CodeGenState.currentFunctionReturnType = returnType;
  }

  // === Function Body Management (A4) ===

  /**
   * Enter function body - clears local variables and sets inFunctionBody flag.
   * Issue #793: Delegates to FunctionContextManager.
   */
  enterFunctionBody(): void {
    FunctionContextManager.enterFunctionBody();
  }

  /**
   * Exit function body - clears local variables and inFunctionBody flag.
   * Issue #793: Delegates to FunctionContextManager.
   */
  exitFunctionBody(): void {
    FunctionContextManager.exitFunctionBody();
  }

  setMainArgsName(name: string | null): void {
    CodeGenState.mainArgsName = name;
    CodeGenState.mainArgsName = name;
  }

  isMainFunctionWithArgs(
    name: string,
    paramList: Parser.ParameterListContext | null,
  ): boolean {
    return CodegenParserUtils.isMainFunctionWithArgs(name, paramList);
  }

  /**
   * ADR-029: Generate typedef for callback type
   */
  generateCallbackTypedef(funcName: string): string | null {
    const callbackInfo = CodeGenState.callbackTypes.get(funcName);
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
                // In C++ mode, use reference (&) instead of pointer (*)
                const ptrOrRef = this.isCppMode() ? "&" : "*";
                return `${constMod}${p.type}${ptrOrRef}`;
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
   * Issue #268: Get unmodified parameters info for all functions.
   * Returns map of function name -> Set of unmodified parameter names.
   * Computed on-demand from functionSignatures and modifiedParameters.
   */
  getFunctionUnmodifiedParams(): ReadonlyMap<string, Set<string>> {
    return CodeGenState.getUnmodifiedParameters();
  }

  /**
   * Issue #268: Update symbol parameters with auto-const info.
   * Now a no-op - unmodified params are computed on-demand from CodeGenState.
   * Kept for IOrchestrator interface compatibility.
   */
  updateFunctionParamsAutoConst(_functionName: string): void {
    // No-op: Unmodified parameters are now computed on-demand from
    // CodeGenState.functionSignatures and CodeGenState.modifiedParameters
    // via CodeGenState.getUnmodifiedParameters().
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
    const funcName = CodeGenState.currentFunctionName;
    if (!funcName) return false;
    return (
      CodeGenState.modifiedParameters.get(funcName)?.has(paramName) ?? false
    );
  }

  /**
   * Issue #558: Get the modified parameters map for cross-file propagation.
   * Returns function name -> set of modified parameter names.
   */
  getModifiedParameters(): ReadonlyMap<string, Set<string>> {
    return CodeGenState.modifiedParameters;
  }

  /**
   * Issue #558: Set cross-file modification data to inject during analyzePassByValue.
   * Called by Pipeline before generate() to share modifications from previously processed files.
   */
  setCrossFileModifications(
    modifications: ReadonlyMap<string, ReadonlySet<string>>,
    paramLists: ReadonlyMap<string, readonly string[]>,
  ): void {
    CodeGenState.pendingCrossFileModifications = modifications;
    CodeGenState.pendingCrossFileParamLists = paramLists;
  }

  /**
   * Issue #558: Get the function parameter lists for cross-file propagation.
   */
  getFunctionParamLists(): ReadonlyMap<string, string[]> {
    return CodeGenState.functionParamLists;
  }

  /**
   * Issue #561: Analyze modifications in a parse tree without full code generation.
   * Used by the transpile() pipeline to collect modification info from includes
   * for cross-file const inference.
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
    const savedModifications = new Map(CodeGenState.modifiedParameters);
    const savedParamLists = new Map(CodeGenState.functionParamLists);
    const savedCallGraph = new Map(CodeGenState.functionCallGraph);

    // Clear for fresh analysis
    CodeGenState.modifiedParameters.clear();
    CodeGenState.functionParamLists.clear();
    CodeGenState.functionCallGraph.clear();

    // Issue #565: Inject cross-file data BEFORE collecting this file's info
    this.injectCrossFileData(crossFileModifications, crossFileParamLists);

    // Track which functions were injected (not from this file)
    const injectedFuncs = new Set(crossFileModifications?.keys() ?? []);

    // Run modification analysis on the tree (adds to what was injected)
    PassByValueAnalyzer.collectFunctionParametersAndModifications(tree);

    // Issue #565: Run transitive propagation with full context
    TransitiveModificationPropagator.propagate(
      CodeGenState.functionCallGraph,
      CodeGenState.functionParamLists,
      CodeGenState.modifiedParameters,
    );

    // Capture results - only include functions NOT from cross-file injection
    const modifications = this.extractThisFileModifications(
      crossFileModifications,
      injectedFuncs,
    );
    const paramLists = this.extractThisFileParamLists(crossFileParamLists);

    // Restore previous state
    this.restoreMapState(CodeGenState.modifiedParameters, savedModifications);
    this.restoreMapState(CodeGenState.functionParamLists, savedParamLists);
    this.restoreMapState(CodeGenState.functionCallGraph, savedCallGraph);

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
        CodeGenState.modifiedParameters.set(funcName, new Set(params));
      }
    }
    if (crossFileParamLists) {
      for (const [funcName, params] of crossFileParamLists) {
        CodeGenState.functionParamLists.set(funcName, [...params]);
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

    for (const [funcName, params] of CodeGenState.modifiedParameters) {
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
      SetMapHelper.filterExclude(
        CodeGenState.functionParamLists,
        crossFileParamLists,
      ),
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
    // Get the parameter name at the given index from the function signature
    const sig = CodeGenState.functionSignatures.get(funcName);
    if (!sig || paramIndex >= sig.parameters.length) {
      // Callee not yet processed - conservatively return false (assume unmodified)
      return false;
    }

    const paramName = sig.parameters[paramIndex].name;
    // Check directly if the parameter is in the modified set
    return CodeGenState.isParameterModified(funcName, paramName);
  }

  /**
   * Issue #268: Check if a name is a parameter of the current function.
   */
  isCurrentParameter(name: string): boolean {
    return CodeGenState.currentParameters.has(name);
  }

  // === Postfix Expression Helpers (Issue #644) ===

  /**
   * Generate a primary expression.
   * Part of IOrchestrator interface for PostfixExpressionGenerator.
   */
  generatePrimaryExpr(ctx: Parser.PrimaryExpressionContext): string {
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
      return `(${this.generateExpression(ctx.expression()!)})`;
    }
    return "";
  }

  /**
   * Check if a name is a known scope.
   * Part of IOrchestrator interface.
   */
  isKnownScope(name: string): boolean {
    return SymbolLookupHelper.isKnownScope(
      CodeGenState.symbols?.knownScopes,
      CodeGenState.symbolTable,
      name,
    );
  }

  /**
   * Check if a symbol is a C++ scope symbol (namespace, class, enum).
   * Part of IOrchestrator interface.
   */
  isCppScopeSymbol(name: string): boolean {
    return CppNamespaceUtils.isCppNamespace(
      name,
      CodeGenState.symbolTable ?? undefined,
    );
  }

  /**
   * Get the separator for scope access (:: for C++, _ for C-Next).
   * Part of IOrchestrator interface - delegates to FormatUtils.
   */
  getScopeSeparator(isCppAccess: boolean): string {
    return FormatUtils.getScopeSeparator(isCppAccess);
  }

  /**
   * Get struct field info for .length calculations.
   * Part of IOrchestrator interface.
   *
   * Issue #831: SymbolTable is the single source of truth for struct fields
   * (both C-Next and C header structs).
   */
  getStructFieldInfo(
    structType: string,
    fieldName: string,
  ): { type: string; dimensions?: (number | string)[] } | null {
    const fieldInfo = CodeGenState.symbolTable?.getStructFieldInfo(
      structType,
      fieldName,
    );
    if (fieldInfo) {
      return {
        type: fieldInfo.type,
        dimensions: fieldInfo.arrayDimensions,
      };
    }
    return null;
  }

  /**
   * Get member type info for struct access chains.
   * Part of IOrchestrator interface.
   */
  getMemberTypeInfo(structType: string, memberName: string): TTypeInfo | null {
    const fieldInfo = this.getStructFieldInfo(structType, memberName);
    if (!fieldInfo) return null;

    const isArray =
      (fieldInfo.dimensions !== undefined && fieldInfo.dimensions.length > 0) ||
      (CodeGenState.symbols!.structFieldArrays.get(structType)?.has(
        memberName,
      ) ??
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
    CodeGenState.pendingTempDeclarations.push(declaration);
  }

  /**
   * Register a float bit shadow variable.
   * Part of IOrchestrator interface.
   */
  registerFloatBitShadow(shadowName: string): void {
    CodeGenState.floatBitShadows.add(shadowName);
  }

  /**
   * Mark a float shadow as having current value (skip redundant memcpy).
   * Part of IOrchestrator interface.
   */
  markFloatShadowCurrent(shadowName: string): void {
    CodeGenState.floatShadowCurrent.add(shadowName);
  }

  /**
   * Check if a float shadow has been declared.
   * Part of IOrchestrator interface.
   */
  hasFloatBitShadow(shadowName: string): boolean {
    return CodeGenState.floatBitShadows.has(shadowName);
  }

  /**
   * Check if a float shadow has current value.
   * Part of IOrchestrator interface.
   */
  isFloatShadowCurrent(shadowName: string): boolean {
    return CodeGenState.floatShadowCurrent.has(shadowName);
  }

  // ===========================================================================
  // End IOrchestrator Implementation
  // ===========================================================================

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
      knownEnums: CodeGenState.symbols!.knownEnums,
      isParameterPassByValue: (funcName: string, paramName: string) =>
        PassByValueAnalyzer.isParameterPassByValueByName(funcName, paramName),
      currentFunctionName: CodeGenState.currentFunctionName,
      maybeDereference: (id: string) => CppModeHelper.maybeDereference(id),
    };
  }

  /**
   * PR #681: Build dependencies for member separator resolution.
   * Used by MemberSeparatorResolver to determine appropriate separators.
   */
  private _buildMemberSeparatorDeps(): IMemberSeparatorDeps {
    return {
      isKnownScope: (name: string) => this.isKnownScope(name),
      isKnownRegister: (name: string) =>
        CodeGenState.symbols!.knownRegisters.has(name),
      validateCrossScopeVisibility: (scopeName: string, memberName: string) =>
        this.validateCrossScopeVisibility(scopeName, memberName),
      validateRegisterAccess: (
        registerName: string,
        memberName: string,
        hasGlobal: boolean,
      ) => this._validateRegisterAccess(registerName, memberName, hasGlobal),
      getStructParamSeparator: () =>
        memberAccessChain.getStructParamSeparator({
          cppMode: CodeGenState.cppMode,
        }),
    };
  }

  /**
   * Validate register access from inside a scope requires global. prefix.
   *
   * Issue #779: Use ambiguity-aware validation - only require global. when
   * the register name is ACTUALLY shadowed by a local or scope member.
   *
   * Exceptions (no global. required):
   * 1. Scoped registers defined within the current scope
   * 2. Unambiguous access - no local/scope member with the same name
   */
  private _validateRegisterAccess(
    registerName: string,
    memberName: string,
    hasGlobal: boolean,
  ): void {
    // Only validate when inside a scope and accessing without global. prefix
    if (CodeGenState.currentScope && !hasGlobal) {
      // Check if this is a scoped register (defined within the current scope)
      // The registerName may already be the fully qualified name (e.g., "GPIO_PORTA")
      // if accessed as PORTA from inside scope GPIO
      const scopePrefix = `${CodeGenState.currentScope}_`;
      if (registerName.startsWith(scopePrefix)) {
        // This is a scoped register - allow bare access
        return;
      }

      // Issue #779: Ambiguity-aware validation
      // Only require global. if the register name is shadowed by:
      // 1. A local variable in the current function
      // 2. A member of the current scope
      const isShadowedByLocal = CodeGenState.localVariables.has(registerName);
      const isShadowedByScope = CodeGenState.isCurrentScopeMember(registerName);

      if (!isShadowedByLocal && !isShadowedByScope) {
        // Unambiguous - allow bare access
        return;
      }

      throw new Error(
        `Error: Use 'global.${registerName}.${memberName}' to access register '${registerName}' ` +
          `from inside scope '${CodeGenState.currentScope}'`,
      );
    }
  }

  /**
   * Issue #517: Check if a type is a C++ class with a user-defined constructor.
   * C++ classes with user-defined constructors are NOT aggregate types,
   * so designated initializers { .field = value } don't work with them.
   * We check for the existence of a constructor symbol (TypeName::ClassName).
   */
  private _isCppClassWithConstructor(typeName: string): boolean {
    return CppConstructorHelper.hasConstructor(
      typeName,
      CodeGenState.symbolTable,
    );
  }

  private foldBooleanToInt(expr: string): string {
    return BooleanHelper.foldBooleanToInt(expr);
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
    return SymbolLookupHelper.isCppType(CodeGenState.symbolTable, typeName);
  }

  /**
   * Generate C code from a C-Next program
   * @param tree The parsed C-Next program
   * @param tokenStream Optional token stream for comment preservation (ADR-043)
   * @param options Optional code generator options (e.g., debugMode)
   */
  generate(
    tree: Parser.ProgramContext,
    tokenStream?: CommonTokenStream,
    options?: ICodeGeneratorOptions,
  ): string {
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

    // Reset state for fresh generation (must be before any state assignments)
    this.resetGeneratorState(targetCapabilities);

    // Initialize options and configuration (after reset)
    this.initializeGenerateOptions(options, tokenStream);

    // ADR-055: Use pre-collected symbolInfo from Pipeline (TSymbolInfoAdapter)
    if (!options?.symbolInfo) {
      throw new Error(
        "symbolInfo is required - use CNextResolver + TSymbolInfoAdapter",
      );
    }
    CodeGenState.symbols = options.symbolInfo;

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
    CodeGenState.debugMode = options?.debugMode ?? false;
    CodeGenState.sourcePath = options?.sourcePath ?? null;
    CodeGenState.includeDirs = options?.includeDirs ?? [];
    CodeGenState.inputs = options?.inputs ?? [];
    CodeGenState.cppMode = options?.cppMode ?? false;
    CodeGenState.pendingTempDeclarations = [];
    CodeGenState.tempVarCounter = 0;
    CodeGenState.pendingCppClassAssignments = [];

    this.tokenStream = tokenStream ?? null;
    this.commentExtractor = this.tokenStream
      ? new CommentExtractor(this.tokenStream)
      : null;
  }

  /**
   * Reset all generator state for a fresh generation pass.
   */
  private resetGeneratorState(targetCapabilities: TargetCapabilities): void {
    // Reset global state (CodeGenState.reset() handles all field initialization)
    CodeGenState.reset(targetCapabilities);

    // Set generator reference for handlers to use
    CodeGenState.generator = this;
  }

  /**
   * Initialize symbol data and const values from symbol table.
   */
  private initializeSymbolData(): void {
    const symbols = CodeGenState.symbols!;

    // Copy symbol data to CodeGenState.scopeMembers
    for (const [scopeName, members] of symbols.scopeMembers) {
      CodeGenState.setScopeMembers(scopeName, new Set(members));
    }

    // Issue #461: Initialize constValues from symbol table
    // Only C-Next TSymbols have initialValue property
    CodeGenState.constValues = new Map();
    if (CodeGenState.symbolTable) {
      for (const symbol of CodeGenState.symbolTable.getAllTSymbols()) {
        if (
          symbol.kind === "variable" &&
          symbol.isConst &&
          symbol.initialValue !== undefined
        ) {
          const value = LiteralUtils.parseIntegerLiteral(symbol.initialValue);
          if (value !== undefined) {
            CodeGenState.constValues.set(symbol.name, value);
          }
        }
      }
    }
  }

  /**
   * Initialize all helper objects needed for code generation.
   */
  private initializeHelperObjects(tree: Parser.ProgramContext): void {
    // Collect function/callback information
    this.collectFunctionsAndCallbacks(tree);
    PassByValueAnalyzer.analyze(tree);
  }

  /**
   * Assemble the final generated output.
   */
  private assembleGeneratedOutput(
    tree: Parser.ProgramContext,
    options: ICodeGeneratorOptions | undefined,
  ): string {
    const output: string[] = [];
    const symbols = CodeGenState.symbols!;
    // Add header comment
    output.push(
      "/**",
      " * Generated by C-Next Transpiler",
      " * A safer C for embedded systems",
      " */",
      "",
    );

    // Self-include for extern "C" linkage
    if (symbols.hasPublicSymbols() && CodeGenState.sourcePath) {
      const pathToUse =
        options?.sourceRelativePath ||
        CodeGenState.sourcePath.replace(/^.*[\\/]/, "");
      const headerName = pathToUse.replace(/\.cnx$|\.cnext$/, ".h");
      output.push(`#include "${headerName}"`, "");
      CodeGenState.selfIncludeAdded = true;
    }

    // Process include directives
    this.processIncludeDirectives(tree, output);

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
  ): void {
    const includePaths = CodeGenState.sourcePath
      ? IncludeDiscovery.discoverIncludePaths(CodeGenState.sourcePath)
      : [];

    for (const includeDir of tree.includeDirective()) {
      const leadingComments = this.getLeadingComments(includeDir);
      output.push(...this.formatLeadingComments(leadingComments));

      const lineNumber = includeDir.start?.line ?? 0;
      TypeValidator.validateIncludeNotImplementationFile(
        includeDir.getText(),
        lineNumber,
      );
      TypeValidator.validateIncludeNoCnxAlternative(
        includeDir.getText(),
        lineNumber,
        CodeGenState.sourcePath,
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

    if (CodeGenState.needsStdint) autoIncludes.push("#include <stdint.h>");
    if (CodeGenState.needsStdbool) autoIncludes.push("#include <stdbool.h>");
    if (CodeGenState.needsString) autoIncludes.push("#include <string.h>");
    if (CodeGenState.needsCMSIS) autoIncludes.push("#include <cmsis_gcc.h>");
    if (CodeGenState.needsLimits) autoIncludes.push("#include <limits.h>");

    if (autoIncludes.length > 0) {
      output.push(...autoIncludes, "");
    }
  }

  /**
   * Add generated helpers (static asserts, IRQ wrappers, typedefs, etc.).
   */
  private addGeneratedHelpers(output: string[]): void {
    if (CodeGenState.needsFloatStaticAssert) {
      // Use static_assert for C++ (standard), _Static_assert for C11
      const assertKeyword = this.isCppMode()
        ? "static_assert"
        : "_Static_assert";
      output.push(
        `${assertKeyword}(sizeof(float) == 4, "Float bit indexing requires 32-bit float");`,
        `${assertKeyword}(sizeof(double) == 8, "Float bit indexing requires 64-bit double");`,
        "",
      );
    }

    if (CodeGenState.needsIrqWrappers) {
      output.push(...this.generateIrqWrappers());
    }

    if (CodeGenState.needsISR) {
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
      sourcePath: CodeGenState.sourcePath,
      includeDirs: CodeGenState.includeDirs,
      inputs: CodeGenState.inputs,
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
    const savedScope = CodeGenState.currentScope;
    CodeGenState.currentScope = scopeName;

    for (const member of scopeDecl.scopeMember()) {
      if (member.functionDeclaration()) {
        const funcDecl = member.functionDeclaration()!;
        const funcName = funcDecl.IDENTIFIER().getText();
        // Track fully qualified function name: Scope_function
        const fullName = QualifiedNameGenerator.forFunctionStrings(
          scopeName,
          funcName,
        );
        CodeGenState.knownFunctions.add(fullName);
        // ADR-013: Track function signature for const checking
        const sig = this.extractFunctionSignature(
          fullName,
          funcDecl.parameterList() ?? null,
        );
        CodeGenState.functionSignatures.set(fullName, sig);
        // ADR-029: Register scoped function as callback type
        this.registerCallbackType(fullName, funcDecl);
      }
    }

    // Restore previous scope context
    CodeGenState.currentScope = savedScope;
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
      const fieldType = this.getTypeName(member.type());

      // Track callback field types (needed for typedef generation)
      if (CodeGenState.callbackTypes.has(fieldType)) {
        CodeGenState.callbackFieldTypes.set(
          `${structName}.${fieldName}`,
          fieldType,
        );
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
    CodeGenState.knownFunctions.add(name);
    // ADR-013: Track function signature for const checking
    const sig = this.extractFunctionSignature(
      name,
      funcDecl.parameterList() ?? null,
    );
    CodeGenState.functionSignatures.set(name, sig);
    // ADR-029: Register function as callback type
    this.registerCallbackType(name, funcDecl);
  }

  /**
   * Second pass: register all variable types in the type registry
   * This ensures type information is available before generating any code,
   * allowing .length and other type-dependent operations to work regardless
   * of declaration order (e.g., scope functions can reference globals declared later)
   * SonarCloud S3776: Refactored to use helper methods.
   */
  private registerAllVariableTypes(tree: Parser.ProgramContext): void {
    TypeRegistrationEngine.register(tree, {
      tryEvaluateConstant: (ctx) => this.tryEvaluateConstant(ctx),
      requireInclude: (header) => this.requireInclude(header),
      resolveQualifiedType: (ids) => this.resolveQualifiedType(ids),
    });
  }

  // Issue #60: collectEnum and collectBitmap methods removed - now in SymbolCollector

  // Issue #63: validateBitmapFieldLiteral moved to TypeValidator
  // Issue #60: evaluateConstantExpression method removed - now in SymbolCollector

  // Issue #269: Pass-by-value analysis extracted to PassByValueAnalyzer

  /**
   * Issue #269: Check if a parameter should be passed by value (by index).
   * Part of IOrchestrator interface - used by CallExprGenerator.
   * Delegates to PassByValueAnalyzer.
   */
  isParameterPassByValue(funcName: string, paramIndex: number): boolean {
    return PassByValueAnalyzer.isParameterPassByValue(funcName, paramIndex);
  }

  /**
   * Issue #269: Get all pass-by-value parameters.
   * Returns a Map from function name to Set of parameter names that should be pass-by-value.
   * Used by HeaderGenerator to ensure header and implementation signatures match.
   */
  getPassByValueParams(): ReadonlyMap<string, ReadonlySet<string>> {
    return CodeGenState.passByValueParams;
  }

  /**
   * Issue #322: Check if a type name is a user-defined struct
   * Part of IOrchestrator interface.
   */
  isStructType(typeName: string): boolean {
    return TypeResolver.isStructType(typeName);
  }

  /**
   * Set up parameter tracking for a function.
   * Issue #793: Delegates to FunctionContextManager.
   */
  private _setParameters(params: Parser.ParameterListContext | null): void {
    FunctionContextManager.processParameterList(
      params,
      this._getFunctionContextCallbacks(),
    );
  }

  /**
   * Clear parameter tracking when leaving a function.
   * Issue #793: Delegates to FunctionContextManager.
   */
  private _clearParameters(): void {
    FunctionContextManager.clearParameters();
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
        // Also check C-Next style array type (e.g., u8[8] param)
        const isArray =
          param.arrayDimension().length > 0 ||
          param.type().arrayType() !== null;
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
        const arrayTypeCtx = param.type().arrayType();
        const isArray = dims.length > 0 || arrayTypeCtx !== null;

        // ADR-029: Check if parameter type is itself a callback type
        const isCallbackParam = CodeGenState.callbackTypes.has(typeName);

        let paramType: string;
        let isPointer: boolean;

        if (isCallbackParam) {
          // Use the callback typedef name
          const cbInfo = CodeGenState.callbackTypes.get(typeName)!;
          paramType = cbInfo.typedefName;
          isPointer = false; // Function pointers are already pointers
        } else {
          paramType = this.generateType(param.type());
          // ADR-006: Non-array parameters become pointers
          isPointer = !isArray;
        }

        let arrayDims: string;
        if (dims.length > 0) {
          arrayDims = dims.map((d) => this.generateArrayDimension(d)).join("");
        } else if (arrayTypeCtx) {
          // Generate all dimensions from arrayType (supports multi-dimensional)
          arrayDims = arrayTypeCtx
            .arrayTypeDimension()
            .map((d) => {
              const expr = d.expression();
              return expr ? `[${this.generateExpression(expr)}]` : "[]";
            })
            .join("");
        } else {
          arrayDims = "";
        }
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

    CodeGenState.callbackTypes.set(name, {
      functionName: name,
      returnType,
      parameters,
      typedefName: `${name}_fp`,
    });
  }

  /**
   * ADR-029: Check if a function is used as a callback type (field type in a struct)
   */
  // Issue #63: validateCallbackAssignment, callbackSignaturesMatch, isConstValue,
  //            and validateBareIdentifierInScope moved to TypeValidator

  // EnumTypeResolver now handles: _getEnumTypeFromThisEnum, _getEnumTypeFromGlobalEnum,
  // _getEnumTypeFromThisVariable, _getEnumTypeFromScopedEnum, _getEnumTypeFromMemberAccess,
  // _getExpressionEnumType, _getFunctionCallEnumType
  /**
   * ADR-017: Check if an expression represents an integer literal or numeric type.
   * Used to detect comparisons between enums and integers.
   */
  private _isIntegerExpression(
    ctx: Parser.ExpressionContext | Parser.RelationalExpressionContext,
  ): boolean {
    return EnumAssignmentValidator.isIntegerExpression(ctx);
  }

  /**
   * ADR-045: Check if an expression is a string concatenation.
   * Delegates to StringOperationsHelper.
   */
  private _getStringConcatOperands(ctx: Parser.ExpressionContext): {
    left: string;
    right: string;
    leftCapacity: number;
    rightCapacity: number;
  } | null {
    return StringOperationsHelper.getStringConcatOperands(ctx);
  }

  /**
   * ADR-045: Check if an expression is a substring extraction.
   * Delegates to StringOperationsHelper.
   */
  private _getSubstringOperands(ctx: Parser.ExpressionContext): {
    source: string;
    start: string;
    length: string;
    sourceCapacity: number;
  } | null {
    return StringOperationsHelper.getSubstringOperands(ctx, {
      generateExpression: (exprCtx) => this.generateExpression(exprCtx),
    });
  }

  // ========================================================================
  // ADR-024: Type Classification and Validation Helpers
  // ========================================================================

  // NOTE: Public isIntegerType and isFloatType moved to IOrchestrator interface (ADR-053 A2)
  // Private versions kept for internal use
  private _isIntegerType(typeName: string): boolean {
    return TypeResolver.isIntegerType(typeName);
  }

  private _isFloatType(typeName: string): boolean {
    return TypeResolver.isFloatType(typeName);
  }

  /**
   * ADR-024: Check if conversion from sourceType to targetType is narrowing
   * Narrowing occurs when target type has fewer bits than source type
   */
  private isNarrowingConversion(
    sourceType: string,
    targetType: string,
  ): boolean {
    return TypeResolver.isNarrowingConversion(sourceType, targetType);
  }

  /**
   * ADR-024: Check if conversion involves a sign change
   * Sign change occurs when converting between signed and unsigned types
   */
  private isSignConversion(sourceType: string, targetType: string): boolean {
    return TypeResolver.isSignConversion(sourceType, targetType);
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
    TypeResolver.validateLiteralFitsType(literalText, targetType);
  }

  /**
   * ADR-024: Get the type of a unary expression (for cast validation).
   */
  private getUnaryExpressionType(
    ctx: Parser.UnaryExpressionContext,
  ): string | null {
    return TypeResolver.getUnaryExpressionType(ctx);
  }

  /**
   * ADR-024: Validate that a type conversion is allowed.
   * Throws error for narrowing or sign-changing conversions.
   */
  private _validateTypeConversion(
    targetType: string,
    sourceType: string | null,
  ): void {
    TypeResolver.validateTypeConversion(targetType, sourceType);
  }

  // Issue #63: checkConstAssignment moved to TypeValidator

  /**
   * Check if an expression is an lvalue that needs & when passed to functions.
   * This includes member access (cursor.x) and array access (arr[i]).
   * Returns the type of lvalue or null if not an lvalue.
   */
  private getLvalueType(
    ctx: Parser.ExpressionContext,
  ): "member" | "array" | null {
    const postfix = ExpressionUnwrapper.getPostfixExpression(ctx);
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
    if (!CodeGenState.cppMode) return false;
    if (!targetParamBaseType) return false;

    const postfix = ExpressionUnwrapper.getPostfixExpression(ctx);
    if (!postfix) return false;

    const primary = postfix.primaryExpression();
    if (!primary) return false;
    const baseId = primary.IDENTIFIER()?.getText();
    if (!baseId) return false;

    const ops = postfix.postfixOp();

    // Case 1: Direct parameter member access (cfg.value)
    const paramInfo = CodeGenState.currentParameters.get(baseId);
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
    const typeInfo = CodeGenState.getVariableTypeInfo(baseId);
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
    const postfix = ExpressionUnwrapper.getPostfixExpression(ctx);
    if (!postfix) return false;

    const ops = postfix.postfixOp();
    const hasPostfixOps = ops.length > 0;
    const lastOpHasExpression =
      hasPostfixOps && ops.at(-1)!.expression() !== null;

    // Get the base identifier
    const primary = postfix.primaryExpression();
    const baseId = primary.IDENTIFIER()?.getText();
    if (!baseId) return false;

    const typeInfo = CodeGenState.getVariableTypeInfo(baseId);
    const paramInfo = CodeGenState.currentParameters.get(baseId);

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
    const postfix = ExpressionUnwrapper.getPostfixExpression(ctx);
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

    const typeInfo = CodeGenState.getVariableTypeInfo(baseId);
    if (typeInfo) {
      structType = typeInfo.baseType;
    } else {
      const paramInfo = CodeGenState.currentParameters.get(baseId);
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
      if (CodeGenState.selfIncludeAdded) {
        return ""; // Definition will come from header
      }
      return this.generateStruct(ctx.structDeclaration()!);
    }
    // ADR-017: Handle enum declarations
    if (ctx.enumDeclaration()) {
      if (CodeGenState.selfIncludeAdded) {
        return ""; // Definition will come from header
      }
      return this.generateEnum(ctx.enumDeclaration()!);
    }
    // ADR-034: Handle bitmap declarations
    if (ctx.bitmapDeclaration()) {
      if (CodeGenState.selfIncludeAdded) {
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
    CodeGenState.currentScope = name;

    const lines: string[] = [];
    lines.push(`/* Scope: ${name} */`);

    for (const member of ctx.scopeMember()) {
      this._generateScopeMember(member, name, lines);
    }

    lines.push("");
    CodeGenState.currentScope = null;
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
    const type = this.generateType(varDecl.type());
    const varName = varDecl.IDENTIFIER().getText();
    const fullName = QualifiedNameGenerator.forMember(scopeName, varName);
    const prefix = isPrivate ? "static " : "";

    const arrayDims = varDecl.arrayDimension();
    const hasArrayTypeSyntax = varDecl.type().arrayType() !== null;
    const isArray = arrayDims.length > 0 || hasArrayTypeSyntax;

    let decl = `${prefix}${type} ${fullName}`;

    // Handle arrayType dimension (C-Next style: u8[16] data)
    if (hasArrayTypeSyntax) {
      decl += VariableDeclHelper.getArrayTypeDimension(varDecl.type(), {
        tryEvaluateConstant: (exprCtx) => this.tryEvaluateConstant(exprCtx),
        generateExpression: (exprCtx) => this.generateExpression(exprCtx),
      });
    }

    // Handle arrayDimension (C-style or additional dimensions)
    if (arrayDims.length > 0) {
      decl += this.generateArrayDimensions(arrayDims);
    }

    // ADR-045: Add string capacity dimension for string arrays
    decl += this._getStringCapacityDimension(varDecl.type());

    if (varDecl.expression()) {
      decl += ` = ${this.generateExpression(varDecl.expression()!)}`;
    } else {
      // ADR-015: Zero initialization for uninitialized scope variables
      decl += ` = ${this.getZeroInitializer(varDecl.type(), isArray)}`;
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
    const returnType = this.generateType(funcDecl.type());
    const funcName = funcDecl.IDENTIFIER().getText();
    const fullName = QualifiedNameGenerator.forFunctionStrings(
      scopeName,
      funcName,
    );
    const prefix = isPrivate ? "static " : "";

    // Issue #269: Set current function name for pass-by-value lookup
    CodeGenState.currentFunctionName = fullName;
    // Issue #477: Set return type for enum inference in return statements
    CodeGenState.currentFunctionReturnType = funcDecl.type().getText();

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
      ? this.generateParameterList(funcDecl.parameterList()!)
      : "void";

    // ADR-016: Exit function body context
    this.exitFunctionBody();
    CodeGenState.currentFunctionName = null;
    CodeGenState.currentFunctionReturnType = null;
    this._clearParameters();

    lines.push("", `${prefix}${returnType} ${fullName}(${params}) ${body}`);

    // ADR-029: Generate callback typedef only if used as a type
    if (this.isCallbackTypeUsedAsFieldType(fullName)) {
      const typedef = this.generateCallbackTypedef(fullName);
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
    // ADR-053: Delegates to extracted StructGenerator
    const generator = this.registry.getDeclaration("struct");
    if (!generator) {
      throw new Error("Error: struct generator not registered");
    }
    const result = generator(ctx, this.getInput(), this.getState(), this);
    this.applyEffects(result.effects);
    return result.code;
  }

  // ========================================================================
  // Enum (ADR-017: Type-safe enums)
  // ========================================================================

  /**
   * ADR-017: Generate enum declaration
   * enum State { IDLE, RUNNING, ERROR <- 255 }
   * -> typedef enum { State_IDLE = 0, State_RUNNING = 1, State_ERROR = 255 } State;
   *
   * ADR-053: Delegates to extracted EnumGenerator.
   */
  private generateEnum(ctx: Parser.EnumDeclarationContext): string {
    const generator = this.registry.getDeclaration("enum");
    if (!generator) {
      throw new Error("Error: enum generator not registered");
    }
    const result = generator(ctx, this.getInput(), this.getState(), this);
    this.applyEffects(result.effects);
    return result.code;
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
    const prefix = CodeGenState.currentScope
      ? `${CodeGenState.currentScope}_`
      : "";
    const fullName = `${prefix}${name}`;

    const backingType = CodeGenState.symbols!.bitmapBackingType.get(fullName);
    if (!backingType) {
      throw new Error(`Error: Bitmap ${fullName} not found in registry`);
    }

    this.requireInclude("stdint");

    const lines: string[] = [];

    // Generate comment with field layout
    lines.push(`/* Bitmap: ${fullName} */`);

    const fields = CodeGenState.symbols!.bitmapFields.get(fullName);
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
    if (ctx.IDENTIFIER() && CodeGenState.expectedType) {
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
    } else if (CodeGenState.expectedType) {
      typeName = CodeGenState.expectedType;
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
      CodeGenState.cppMode && this._isCppClassWithConstructor(typeName);

    // Issue #834: For named struct tags (no typedef), we need 'struct' prefix in C mode
    const needsStructKeyword =
      !CodeGenState.cppMode &&
      CodeGenState.symbolTable.checkNeedsStructKeyword(typeName);
    const castType = TypeGenerationHelper.generateUserType(
      typeName,
      needsStructKeyword,
    );

    if (!fieldList) {
      // Empty initializer: Point {} -> (Point){ 0 } or {} for C++ classes
      return isCppClass ? "{}" : `(${castType}){ 0 }`;
    }

    // Get field type info for nested initializers
    // Issue #831: SymbolTable is the single source of truth for struct fields
    // (both C-Next and C/C++ header structs)
    const structFieldTypes =
      CodeGenState.symbolTable?.getStructFieldTypes(typeName);

    const fields = fieldList.fieldInitializer().map((field) => {
      const fieldName = field.IDENTIFIER().getText();

      // Set expected type for nested initializers
      const savedExpectedType = CodeGenState.expectedType;
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
        CodeGenState.expectedType = fieldType;
      }

      const value = this.generateExpression(field.expression());

      // Restore expected type
      CodeGenState.expectedType = savedExpectedType;

      return { fieldName, value };
    });

    // Issue #517: For C++ classes, store assignments for later and return {}
    if (isCppClass) {
      for (const { fieldName, value } of fields) {
        CodeGenState.pendingCppClassAssignments.push(
          `${fieldName} = ${value};`,
        );
      }
      return "{}";
    }

    // For C-Next/C structs, generate designated initializer
    const fieldInits = fields.map((f) => `.${f.fieldName} = ${f.value}`);

    // Issue #882: In C++ mode, anonymous structs/unions must use plain brace init.
    // Compound literals like (struct { ... }){ ... } create incompatible types in C++
    // because each struct { ... } definition creates a distinct nominal type.
    if (
      CodeGenState.cppMode &&
      (typeName.startsWith("struct {") || typeName.startsWith("union {"))
    ) {
      return `{ ${fieldInits.join(", ")} }`;
    }

    return `(${castType}){ ${fieldInits.join(", ")} }`;
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
      CodeGenState.lastArrayInitCount = 0;
      CodeGenState.lastArrayFillValue = fillValue;
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
    CodeGenState.lastArrayInitCount = generatedElements.length;
    CodeGenState.lastArrayFillValue = undefined;

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
    const returnType = this.generateType(ctx.type());
    const name = ctx.IDENTIFIER().getText();

    // Set up function context
    this._setupFunctionContext(name, ctx);

    // Check for main function with args parameter (u8 args[][])
    const isMainWithArgs = CodegenParserUtils.isMainFunctionWithArgs(
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
      params = this.generateParameterList(ctx.parameterList()!);
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
   * Set up context for function generation.
   * Issue #793: Delegates to FunctionContextManager.
   */
  private _setupFunctionContext(
    name: string,
    ctx: Parser.FunctionDeclarationContext,
  ): void {
    FunctionContextManager.setupFunctionContext(
      name,
      ctx,
      this._getFunctionContextCallbacks(),
    );
  }

  /**
   * Issue #793: Create callbacks for FunctionContextManager.
   */
  private _getFunctionContextCallbacks(): IFunctionContextCallbacks {
    return {
      isStructType: (typeName: string) => this.isStructType(typeName),
      resolveQualifiedType: (identifiers: string[]) =>
        this.resolveQualifiedType(identifiers),
    };
  }

  /**
   * Resolve return type and initial params for function.
   * Issue #793: Delegates to FunctionContextManager.
   */
  private _resolveReturnTypeAndParams(
    name: string,
    returnType: string,
    isMainWithArgs: boolean,
    ctx: Parser.FunctionDeclarationContext,
  ): { actualReturnType: string; initialParams: string } {
    return FunctionContextManager.resolveReturnTypeAndParams(
      name,
      returnType,
      isMainWithArgs,
      ctx,
    );
  }

  /**
   * Clean up context after function generation.
   * Issue #793: Delegates to FunctionContextManager.
   */
  private _cleanupFunctionContext(): void {
    FunctionContextManager.cleanupFunctionContext();
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

    if (!this.isCallbackTypeUsedAsFieldType(name)) {
      return functionCode;
    }

    const typedef = this.generateCallbackTypedef(name);
    return typedef ? functionCode + typedef : functionCode;
  }

  private generateParameter(
    ctx: Parser.ParameterContext,
    paramIndex?: number,
  ): string {
    const typeName = this.getTypeName(ctx.type());
    const name = ctx.IDENTIFIER().getText();

    // Validate: Reject C-style array parameters
    this._validateCStyleArrayParam(ctx, typeName, name);

    // Validate: Reject unbounded array dimensions
    this._validateUnboundedArrayParam(ctx);

    // Pre-compute CodeGenState-dependent values
    const isModified = this._isCurrentParameterModified(name);

    // Issue #895: For callback-compatible functions, determine pointer/value
    // from the typedef signature, not from normal C-Next pass-by-value rules
    const callbackInfo =
      paramIndex === undefined
        ? null
        : FunctionContextManager.getCallbackTypedefParamInfo(paramIndex);
    const isPassByValue = callbackInfo
      ? !callbackInfo.shouldBePointer
      : this._isPassByValueType(typeName, name);
    const isCallbackCompatible = callbackInfo !== null;

    // Build normalized input using adapter
    // Issue #895: Force pass-by-reference and const from typedef signature
    const forcePassByReference = callbackInfo?.shouldBePointer ?? false;
    const forceConst = callbackInfo?.shouldBeConst ?? false;
    const input = ParameterInputAdapter.fromAST(ctx, {
      getTypeName: (t) => this.getTypeName(t),
      generateType: (t) => this.generateType(t),
      generateExpression: (e) => this.generateExpression(e),
      callbackTypes: CodeGenState.callbackTypes,
      isKnownStruct: (t) => this.isKnownStruct(t),
      typeMap: TYPE_MAP,
      isModified,
      isPassByValue,
      isCallbackCompatible,
      forcePassByReference,
      forceConst,
    });

    // Use shared builder with C/C++ mode
    return ParameterSignatureBuilder.build(input, CppModeHelper.refOrPtr());
  }

  /**
   * Validate: Reject C-style array parameters
   * C-style: u8 data[8], u8 data[4][4], u8 data[]
   * C-Next:  u8[8] data, u8[4][4] data, u8[] data
   */
  private _validateCStyleArrayParam(
    ctx: Parser.ParameterContext,
    typeName: string,
    name: string,
  ): void {
    const dims = ctx.arrayDimension();
    if (dims.length > 0) {
      const dimensions = dims
        .map((dim) => `[${dim.expression()?.getText() ?? ""}]`)
        .join("");
      const line = ctx.start?.line ?? 0;
      const col = ctx.start?.column ?? 0;
      throw new Error(
        `${line}:${col} C-style array parameter is not allowed. ` +
          `Use '${typeName}${dimensions} ${name}' instead of '${typeName} ${name}${dimensions}'`,
      );
    }
  }

  /**
   * Validate: Reject unbounded array dimensions for memory safety
   */
  private _validateUnboundedArrayParam(ctx: Parser.ParameterContext): void {
    const arrayTypeCtx = ctx.type().arrayType();
    if (!arrayTypeCtx) return;

    const allDims = arrayTypeCtx.arrayTypeDimension();
    const hasUnboundedDim = allDims.some((d) => !d.expression());
    if (hasUnboundedDim) {
      const line = ctx.start?.line ?? 0;
      const col = ctx.start?.column ?? 0;
      throw new Error(
        `${line}:${col} Unbounded array parameters are not allowed. ` +
          `All dimensions must have explicit sizes for memory safety.`,
      );
    }
  }

  /**
   * Check if type should use pass-by-value semantics
   */
  private _isPassByValueType(typeName: string, name: string): boolean {
    // ISR, float, enum types
    if (typeName === "ISR") return true;
    if (this._isFloatType(typeName)) return true;
    if (CodeGenState.symbols?.knownEnums.has(typeName)) return true;

    // Small unmodified primitives
    if (
      CodeGenState.currentFunctionName &&
      PassByValueAnalyzer.isParameterPassByValueByName(
        CodeGenState.currentFunctionName,
        name,
      )
    ) {
      return true;
    }

    // Callback-compatible functions: struct params become pass-by-value
    // to match C function pointer typedef signatures
    // NOTE: This assumes the C typedef expects pass-by-value structs.
    // Issue #895 describes cases where the typedef expects pointers instead.
    // A full fix requires parsing the typedef signature to determine which.
    if (
      CodeGenState.currentFunctionName &&
      CodeGenState.callbackCompatibleFunctions.has(
        CodeGenState.currentFunctionName,
      ) &&
      this.isKnownStruct(typeName)
    ) {
      return true;
    }

    return false;
  }

  // ========================================================================
  // Variables
  // ========================================================================

  private generateVariableDecl(ctx: Parser.VariableDeclarationContext): string {
    // Issue #792: Delegate to VariableDeclHelper
    return VariableDeclHelper.generateVariableDecl(ctx, {
      generateExpression: (exprCtx) => this.generateExpression(exprCtx),
      generateType: (typeCtx) => this.generateType(typeCtx),
      getTypeName: (typeCtx) => this.getTypeName(typeCtx),
      generateArrayDimensions: (dims) => this.generateArrayDimensions(dims),
      tryEvaluateConstant: (exprCtx) => this.tryEvaluateConstant(exprCtx),
      getZeroInitializer: (typeCtx, isArray) =>
        this.getZeroInitializer(typeCtx, isArray),
      getExpressionType: (exprCtx) => this.getExpressionType(exprCtx),
      inferVariableType: (varCtx, name) =>
        this._inferVariableType(varCtx, name),
      trackLocalVariable: (varCtx, name) =>
        this._trackLocalVariable(varCtx, name),
      markVariableAsPointer: (name) => this._markVariableAsPointer(name),
      getStringConcatOperands: (concatCtx) =>
        this._getStringConcatOperands(concatCtx),
      getSubstringOperands: (substrCtx) =>
        this._getSubstringOperands(substrCtx),
      getStringExprCapacity: (exprCode) => this.getStringExprCapacity(exprCode),
      requireStringInclude: () => this.requireInclude("string"),
    });
  }

  /**
   * Issue #696: Infer variable type, handling nullable C pointer types.
   * Issue #895 Bug B: Infer pointer type from C function return type.
   */
  private _inferVariableType(
    ctx: Parser.VariableDeclarationContext,
    name: string,
  ): string {
    const type = this.generateType(ctx.type());

    if (!ctx.expression()) {
      return type;
    }

    // Issue #895 Bug B: Check if initializer is a C function call returning pointer
    const pointerType = this._inferPointerTypeFromFunctionCall(
      ctx.expression()!,
      type,
    );
    if (pointerType) {
      return pointerType;
    }

    // ADR-046: Handle nullable C pointer types (c_ prefix variables)
    if (name.startsWith("c_")) {
      const exprText = ctx.expression()!.getText();
      for (const funcName of NullCheckAnalyzer.getStructPointerFunctions()) {
        if (exprText.includes(`${funcName}(`)) {
          return `${type}*`;
        }
      }
    }

    return type;
  }

  /**
   * Issue #895 Bug B: Infer pointer type from C function return type.
   * If initializer is a call to a C function that returns T*, and declared
   * type is T, return T* instead of T.
   */
  private _inferPointerTypeFromFunctionCall(
    expr: Parser.ExpressionContext,
    declaredType: string,
  ): string | null {
    // Extract function name from C function call patterns
    const funcName = this._extractCFunctionName(expr);
    if (!funcName) {
      return null;
    }

    // Look up C function in symbol table
    const cFunc = CodeGenState.symbolTable?.getCSymbol(funcName);
    if (cFunc?.kind !== "function") {
      return null;
    }

    // Check if return type is a pointer to the declared type
    const returnType = cFunc.type;
    if (!returnType.endsWith("*")) {
      return null;
    }

    // Check if the base return type matches the declared type
    // e.g., "widget_t *" or "widget_t*" matches declared "widget_t"
    const returnBaseType = returnType.replace(/\s*\*\s*$/, "").trim();
    if (returnBaseType === declaredType) {
      return `${declaredType}*`;
    }

    return null;
  }

  /**
   * Extract C function name from expression patterns.
   * Handles both:
   * - global.funcName(...) - explicit global access
   * - funcName(...) - direct call (if funcName is a known C function)
   * Returns null if expression doesn't match these patterns.
   */
  private _extractCFunctionName(expr: Parser.ExpressionContext): string | null {
    const postfix = ExpressionUnwrapper.getPostfixExpression(expr);
    if (!postfix) {
      return null;
    }

    const primary = postfix.primaryExpression();
    const ops = postfix.postfixOp();

    // Pattern 1: global.funcName(...)
    if (primary.GLOBAL()) {
      return this._extractGlobalPatternFuncName(ops);
    }

    // Pattern 2: funcName(...) - direct call
    const identifier = primary.IDENTIFIER();
    if (identifier) {
      return this._extractDirectCallFuncName(identifier.getText(), ops);
    }

    return null;
  }

  /**
   * Extract function name from global.funcName(...) pattern.
   */
  private _extractGlobalPatternFuncName(
    ops: Parser.PostfixOpContext[],
  ): string | null {
    if (ops.length < 2) {
      return null;
    }

    const memberOp = ops[0];
    if (!memberOp.IDENTIFIER()) {
      return null;
    }

    const callOp = ops[1];
    if (!this._isCallOp(callOp)) {
      return null;
    }

    return memberOp.IDENTIFIER()!.getText();
  }

  /**
   * Extract function name from direct funcName(...) call if it's a C function.
   */
  private _extractDirectCallFuncName(
    funcName: string,
    ops: Parser.PostfixOpContext[],
  ): string | null {
    if (ops.length < 1) {
      return null;
    }

    if (!this._isCallOp(ops[0])) {
      return null;
    }

    // Verify this is actually a C function (not a C-Next scope function)
    const cFunc = CodeGenState.symbolTable?.getCSymbol(funcName);
    if (cFunc?.kind === "function") {
      return funcName;
    }

    return null;
  }

  /**
   * Check if a postfix op is a function call.
   */
  private _isCallOp(op: Parser.PostfixOpContext): boolean {
    return Boolean(op.argumentList() || op.getText().startsWith("("));
  }

  /**
   * Issue #696: Track local variable for type registry and const values.
   */
  private _trackLocalVariable(
    ctx: Parser.VariableDeclarationContext,
    name: string,
  ): void {
    if (!CodeGenState.inFunctionBody) {
      return;
    }

    TypeRegistrationEngine.trackVariable(ctx, {
      tryEvaluateConstant: (expr) => this.tryEvaluateConstant(expr),
      requireInclude: (header) => this.requireInclude(header),
      resolveQualifiedType: (ids) => this.resolveQualifiedType(ids),
    });
    CodeGenState.localVariables.add(name);

    // Bug #8: Track local const values for array size and bit index resolution
    if (ctx.constModifier() && ctx.expression()) {
      const constValue = this.tryEvaluateConstant(ctx.expression()!);
      if (constValue !== undefined) {
        CodeGenState.constValues.set(name, constValue);
      }
    }
  }

  /**
   * Issue #895 Bug B: Mark variable as a pointer in the type registry.
   * Called when type inference detects that a variable should be a pointer
   * (e.g., initialized from a C function returning T*).
   */
  private _markVariableAsPointer(name: string): void {
    const typeInfo = CodeGenState.getVariableTypeInfo(name);
    if (typeInfo) {
      CodeGenState.setVariableTypeInfo(name, {
        ...typeInfo,
        isPointer: true,
      });
    }
  }

  // Issue #792: Methods _handleArrayDeclaration, _getArrayTypeDimension, _parseArrayTypeDimension,
  // _parseFirstArrayDimension, _validateArrayDeclarationSyntax, _extractBaseTypeName,
  // _generateVariableInitializer, _validateIntegerInitializer, _finalizeCppClassAssignments,
  // and _generateConstructorDecl have been extracted to VariableDeclHelper.ts

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
    // Also check C-Next style array type (e.g., CppClass[4]) where
    // the userType is nested inside arrayType.
    if (typeCtx.arrayType()?.userType()) {
      const typeName = typeCtx.arrayType()!.userType()!.getText();
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
    const members = CodeGenState.symbols!.enumMembers.get(enumName);
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
      const name = CodeGenState.currentScope
        ? `${CodeGenState.currentScope}_${localName}`
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
    return CodeGenState.cppMode && !this.isKnownStruct(typeName);
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

  // ADR-109: buildHandlerDeps removed - handlers now use CodeGenState.generator directly

  /**
   * Analyze a member chain target to detect bit access at the end.
   * Issue #644: Delegates to MemberChainAnalyzer.
   */
  /** Public for handler access via CodeGenState.generator */
  analyzeMemberChainForBitAccess(targetCtx: Parser.AssignmentTargetContext): {
    isBitAccess: boolean;
    baseTarget?: string;
    bitIndex?: string;
    baseType?: string;
  } {
    // Issue #644: MemberChainAnalyzer is now static, pass generateExpression callback
    return MemberChainAnalyzer.analyze(targetCtx, (ctx) =>
      this.generateExpression(ctx),
    );
  }

  /**
   * Generate float bit write using shadow variable + memcpy.
   * Issue #644: Delegates to FloatBitHelper.
   */
  /** Public for handler access via CodeGenState.generator */
  generateFloatBitWrite(
    name: string,
    typeInfo: TTypeInfo,
    bitIndex: string,
    width: string | null,
    value: string,
  ): string | null {
    // Issue #644: FloatBitHelper is now static, pass callbacks
    return FloatBitHelper.generateFloatBitWrite(
      name,
      typeInfo,
      bitIndex,
      width,
      value,
      {
        generateBitMask: (w, is64Bit) => this.generateBitMask(w, is64Bit),
        foldBooleanToInt: (expr) => this.foldBooleanToInt(expr),
        requireInclude: (header) => this.requireInclude(header),
      },
    );
  }

  // ADR-001: <- becomes = in C, with compound assignment operators
  private generateAssignment(ctx: Parser.AssignmentStatementContext): string {
    const targetCtx = ctx.assignmentTarget();

    // Issue #644: Set expected type for inferred struct initializers and overflow behavior
    // Delegated to AssignmentExpectedTypeResolver helper
    const savedExpectedType = CodeGenState.expectedType;
    const savedAssignmentContext = { ...CodeGenState.assignmentContext };

    // Issue #644: AssignmentExpectedTypeResolver is now static
    const resolved = AssignmentExpectedTypeResolver.resolve(targetCtx);
    if (resolved.expectedType) {
      CodeGenState.expectedType = resolved.expectedType;
    }
    if (resolved.assignmentContext) {
      CodeGenState.assignmentContext = resolved.assignmentContext;
    }

    const value = this.generateExpression(ctx.expression());

    // Restore expected type and assignment context
    CodeGenState.expectedType = savedExpectedType;
    CodeGenState.assignmentContext = savedAssignmentContext;

    // Get the assignment operator and map to C equivalent
    const operatorCtx = ctx.assignmentOperator();
    const cnextOp = operatorCtx.getText();
    const cOp = ASSIGNMENT_OPERATOR_MAP[cnextOp] || "=";
    const isCompound = cOp !== "=";

    // Issue #644: Validate assignment (const, enum, integer, array bounds, callbacks)
    // Delegated to AssignmentValidator helper to reduce cognitive complexity
    AssignmentValidator.validate(
      targetCtx,
      ctx.expression(),
      isCompound,
      ctx.start?.line ?? 0,
      {
        getExpressionType: (exprCtx) => this.getExpressionType(exprCtx),
        tryEvaluateConstant: (exprCtx) => this.tryEvaluateConstant(exprCtx),
        isCallbackTypeUsedAsFieldType: (name) =>
          this.isCallbackTypeUsedAsFieldType(name),
      },
    );

    // ADR-109: Dispatch to assignment handlers
    // Build context, classify, and dispatch - all patterns handled by handlers
    const assignCtx = buildAssignmentContext(ctx, {
      typeRegistry: CodeGenState.getTypeRegistryView(),
      generateExpression: () => value,
      generateAssignmentTarget: (targetCtx) =>
        this.generateAssignmentTarget(targetCtx),
      isKnownRegister: (name) => CodeGenState.symbols!.knownRegisters.has(name),
      currentScope: CodeGenState.currentScope,
    });
    // ADR-109: Handlers access CodeGenState directly, no deps needed
    const assignmentKind = AssignmentClassifier.classify(assignCtx);
    const handler = AssignmentHandlerRegistry.getHandler(assignmentKind);
    return handler(assignCtx);
  }

  /**
   * ADR-049: Generate atomic Read-Modify-Write operation
   * Uses LDREX/STREX on platforms that support it, otherwise PRIMASK
   */
  /** Public for handler access via CodeGenState.generator */
  generateAtomicRMW(
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
      CodeGenState.targetCapabilities,
    );
    this.applyEffects(result.effects);
    return result.code;
  }

  /**
   * Build dependencies for SimpleIdentifierResolver
   */
  private _buildSimpleIdentifierDeps(): ISimpleIdentifierDeps {
    return {
      getParameterInfo: (name: string) =>
        CodeGenState.currentParameters.get(name),
      resolveParameter: (name: string, paramInfo: TParameterInfo) =>
        ParameterDereferenceResolver.resolve(
          name,
          paramInfo,
          this._buildParameterDereferenceDeps(),
        ),
      isLocalVariable: (name: string) => CodeGenState.localVariables.has(name),
      resolveBareIdentifier: (name: string, isLocal: boolean) =>
        TypeValidator.resolveBareIdentifier(name, isLocal, (n: string) =>
          this.isKnownStruct(n),
        ),
    };
  }

  /**
   * Extract postfix operations from parser contexts
   */
  private _extractPostfixOperations(
    postfixOps: Parser.PostfixTargetOpContext[],
  ): IPostfixOperation[] {
    return postfixOps.map((op) => ({
      memberName: op.IDENTIFIER()?.getText() ?? null,
      expressions: op.expression(),
    }));
  }

  /**
   * Build dependencies for PostfixChainBuilder
   */
  private _buildPostfixChainDeps(
    firstId: string,
    hasGlobal: boolean,
    hasThis: boolean,
  ): IPostfixChainDeps {
    const paramInfo = CodeGenState.currentParameters.get(firstId);
    const isStructParam = paramInfo?.isStruct ?? false;
    const isCppAccess = hasGlobal && this.isCppScopeSymbol(firstId);
    const separatorDeps = this._buildMemberSeparatorDeps();
    // Issue #895: Callback-compatible params need pointer semantics even in C++ mode
    const forcePointerSemantics = paramInfo?.forcePointerSemantics ?? false;

    const separatorCtx: ISeparatorContext =
      MemberSeparatorResolver.buildContext(
        {
          firstId,
          hasGlobal,
          hasThis,
          currentScope: CodeGenState.currentScope,
          isStructParam,
          isCppAccess,
          forcePointerSemantics,
        },
        separatorDeps,
      );

    return {
      generateExpression: (expr: unknown) =>
        this.generateExpression(expr as Parser.ExpressionContext),
      getSeparator: (
        isFirstOp: boolean,
        identifierChain: string[],
        memberName: string,
      ) =>
        MemberSeparatorResolver.getSeparator(
          isFirstOp,
          identifierChain,
          memberName,
          separatorCtx,
          separatorDeps,
        ),
    };
  }

  // ADR-016: _validateCrossScopeVisibility moved to ScopeResolver

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
   * Resolve 'this' keyword to scope marker
   * ADR-016: 'this' returns a marker that postfixOps will transform to Scope_member
   */
  private _resolveThisKeyword(): string {
    if (!CodeGenState.currentScope) {
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
    if (CodeGenState.mainArgsName && id === CodeGenState.mainArgsName) {
      return "argv";
    }

    // ADR-006: Check if it's a function parameter
    const paramInfo = CodeGenState.currentParameters.get(id);
    if (paramInfo) {
      return ParameterDereferenceResolver.resolve(
        id,
        paramInfo,
        this._buildParameterDereferenceDeps(),
      );
    }

    // ADR-016: Resolve bare identifier using local -> scope -> global priority
    const isLocalVariable = CodeGenState.localVariables.has(id);
    const resolved = TypeValidator.resolveBareIdentifier(
      id,
      isLocalVariable,
      (name: string) => this.isKnownStruct(name),
    );
    if (resolved !== null) {
      // Issue #741: Check if this is a private const that should be inlined
      const constValue =
        CodeGenState.symbols!.scopePrivateConstValues.get(resolved);
      if (constValue !== undefined) {
        return constValue;
      }
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
      CodeGenState.expectedType &&
      CodeGenState.symbols!.knownEnums.has(CodeGenState.expectedType)
    ) {
      const members = CodeGenState.symbols!.enumMembers.get(
        CodeGenState.expectedType,
      );
      if (members?.has(id)) {
        return `${CodeGenState.expectedType}${this.getScopeSeparator(false)}${id}`;
      }
      return null;
    }

    // No expected enum type - bare enum members are not allowed without context
    const matchingEnums: string[] = [];
    for (const [enumName, members] of CodeGenState.symbols!.enumMembers) {
      if (members.has(id)) {
        matchingEnums.push(enumName);
      }
    }

    if (matchingEnums.length === 1) {
      throw new Error(
        `error[E0424]: '${id}' is not defined; did you mean '${matchingEnums[0]}.${id}'?`,
      );
    }
    if (matchingEnums.length > 1) {
      const suggestions = matchingEnums.map((e) => `'${e}.${id}'`).join(" or ");
      throw new Error(
        `error[E0424]: '${id}' is not defined; did you mean ${suggestions}?`,
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
      return CppModeHelper.nullLiteral();
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
    const targetType = this.generateType(ctx.type());
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
    const sourceType = this.getUnaryExpressionType(ctx.unaryExpression());
    if (CastValidator.requiresClampingCast(sourceType, targetTypeName)) {
      return this.generateFloatToIntClampCast(
        expr,
        targetType,
        targetTypeName,
        sourceType!,
      );
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
    return CppModeHelper.cast(targetType, expr);
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
      return CppModeHelper.cast(targetType, expr);
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
    const finalCast = CppModeHelper.cast(targetType, `(${expr})`);
    return `((${expr}) > ${maxComparison} ? ${maxValue} : (${expr}) < ${minComparison} ? ${minValue} : ${finalCast})`;
  }

  /**
   * ADR-023: Generate sizeof expression
   * Delegates to SizeofResolver which uses CodeGenState.
   */
  private generateSizeofExpr(ctx: Parser.SizeofExpressionContext): string {
    return SizeofResolver.generate(ctx, {
      generateType: (typeCtx) => this.generateType(typeCtx),
      generateExpression: (exprCtx) => this.generateExpression(exprCtx),
      hasSideEffects: (exprCtx) => this.hasSideEffects(exprCtx),
    });
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

  // NOTE: generateMemberAccess and generateArrayAccess removed in grammar consolidation
  // These methods referenced MemberAccessContext and ArrayAccessContext which no longer
  // exist after unifying to assignmentTarget: IDENTIFIER postfixTargetOp*

  // ========================================================================
  // strlen Optimization - Cache repeated .length accesses
  // Issue #644: Walker methods extracted to StringLengthCounter class
  // ========================================================================

  /**
   * Generate temp variable declarations for string lengths that are accessed 2+ times.
   * Returns the declarations as a string and populates the lengthCache.
   */
  // ========================================================================
  // ADR-044: Overflow Helper Functions
  // ========================================================================

  /**
   * Generate all needed overflow helper functions
   * ADR-053 A5: Delegates to HelperGenerator
   */
  private generateOverflowHelpers(): string[] {
    return helperGenerateOverflowHelpers(
      CodeGenState.usedClampOps,
      CodeGenState.debugMode,
    );
  }

  /**
   * Generate platform-portable IRQ wrappers for critical sections (ADR-050, Issue #778)
   *
   * Generates code that works on:
   * - ARM platforms (bare-metal or Arduino): Uses inline assembly for PRIMASK access
   * - AVR Arduino: Uses SREG save/restore pattern
   * - Other platforms: Falls back to CMSIS intrinsics
   *
   * This avoids dependencies on CMSIS headers which may not be available on all platforms
   * (e.g., Teensy 4.x via Arduino.h doesn't expose __get_PRIMASK/__set_PRIMASK).
   */
  private generateIrqWrappers(): string[] {
    return [
      "// ADR-050: Platform-portable IRQ wrappers for critical sections",
      "#if defined(__arm__) || defined(__ARM_ARCH)",
      "// ARM platforms (including ARM Arduino like Teensy 4.x, Due, Zero)",
      "// Provide inline assembly PRIMASK access to avoid CMSIS header dependencies",
      "__attribute__((always_inline)) static inline uint32_t __cnx_get_PRIMASK(void) {",
      "    uint32_t result;",
      '    __asm volatile ("MRS %0, primask" : "=r" (result));',
      "    return result;",
      "}",
      "__attribute__((always_inline)) static inline void __cnx_set_PRIMASK(uint32_t mask) {",
      '    __asm volatile ("MSR primask, %0" :: "r" (mask) : "memory");',
      "}",
      "#if defined(ARDUINO)",
      "static inline void __cnx_disable_irq(void) { noInterrupts(); }",
      "#else",
      "__attribute__((always_inline)) static inline void __cnx_disable_irq(void) {",
      '    __asm volatile ("cpsid i" ::: "memory");',
      "}",
      "#endif",
      "#elif defined(__AVR__)",
      "// AVR Arduino: use SREG for interrupt state",
      "// Note: Uses PRIMASK naming for API consistency across platforms (AVR has no PRIMASK)",
      "// Returns uint8_t which is implicitly widened to uint32_t at call sites - this is intentional",
      "static inline uint8_t __cnx_get_PRIMASK(void) { return SREG; }",
      "static inline void __cnx_set_PRIMASK(uint8_t mask) { SREG = mask; }",
      "static inline void __cnx_disable_irq(void) { cli(); }",
      "#else",
      "// Fallback: assume CMSIS is available",
      "static inline void __cnx_disable_irq(void) { __disable_irq(); }",
      "static inline uint32_t __cnx_get_PRIMASK(void) { return __get_PRIMASK(); }",
      "static inline void __cnx_set_PRIMASK(uint32_t mask) { __set_PRIMASK(mask); }",
      "#endif",
      "",
    ];
  }

  /**
   * Mark a clamp operation as used (will trigger helper generation)
   */
  private markClampOpUsed(operation: string, cnxType: string): void {
    // Only generate helpers for integer types (not float/bool)
    if (TYPE_WIDTH[cnxType] && TypeCheckUtils.isInteger(cnxType)) {
      CodeGenState.usedClampOps.add(`${operation}_${cnxType}`);
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
    const indent = FormatUtils.indent(CodeGenState.indentLevel);
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
    return helperGenerateSafeDivHelpers(CodeGenState.usedSafeDivOps);
  }
}
