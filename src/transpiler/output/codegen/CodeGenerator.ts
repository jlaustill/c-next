/**
 * C-Next Code Generator
 * Transforms C-Next AST to clean, readable C code
 */

import type ISubstringOps from "./types/ISubstringOps";
import { basename } from "node:path";
import ReservedCnxName from "../../../utils/ReservedCnxName";
import { CommonTokenStream, ParserRuleContext } from "antlr4ng";
import * as Parser from "../../logic/parser/grammar/CNextParser";

import CommentExtractor from "../../logic/analysis/CommentExtractor";
import TypeRegistrationEngine from "./helpers/TypeRegistrationEngine";
import CommentFormatter from "./CommentFormatter";
import IncludeDiscovery from "../../data/IncludeDiscovery";
import IComment from "../../types/IComment";
import TYPE_WIDTH from "../../constants/TYPE_WIDTH";
import TYPE_MAP from "./types/TYPE_MAP";
import TYPE_LIMITS from "./types/TYPE_LIMITS";
// Issue #60: BITMAP_SIZE and BITMAP_BACKING_TYPE moved to SymbolCollector
import TTypeInfo from "../../types/TTypeInfo";
import TParameterInfo from "../../types/TParameterInfo";
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
// Expression generators
import generateLiteral from "./generators/expressions/LiteralGenerator";
import binaryExprGenerators from "./generators/expressions/BinaryExprGenerator";
import generateUnaryExpr from "./generators/expressions/UnaryExprGenerator";
import expressionGenerators from "./generators/expressions/ExpressionGenerator";
import generatePostfixExpression from "./generators/expressions/PostfixExpressionGenerator";
// Statement generators
import controlFlowGenerators from "./generators/statements/ControlFlowGenerator";
import generateCriticalStatement from "./generators/statements/CriticalGenerator";
import atomicGenerators from "./generators/statements/AtomicGenerator";
import switchGenerators from "./generators/statements/SwitchGenerator";
// Declaration generators
import enumGenerator from "./generators/declarationGenerators/EnumGenerator";
import bitmapGenerator from "./generators/declarationGenerators/BitmapGenerator";
import registerGenerator from "./generators/declarationGenerators/RegisterGenerator";
import structGenerator from "./generators/declarationGenerators/StructGenerator";
import functionGenerator from "./generators/declarationGenerators/FunctionGenerator";
import scopeGenerator from "./generators/declarationGenerators/ScopeGenerator";
// ADR-065: Extracted utilities
import BitUtils from "../../../utils/BitUtils";
import CppNamespaceUtils from "../../../utils/CppNamespaceUtils";
import FormatUtils from "../../../utils/FormatUtils";
import StringUtils from "../../../utils/StringUtils";
import TypeCheckUtils from "../../../utils/TypeCheckUtils";
import ExpressionUtils from "../../../utils/ExpressionUtils";
// Support generators
import helperGenerators from "./generators/support/HelperGenerator";
import includeGenerators from "./generators/support/IncludeGenerator";
import commentUtils from "./generators/support/CommentUtils";
// ADR-046: NullCheckAnalyzer for nullable C pointer type detection
import NullCheckAnalyzer from "../../logic/analysis/NullCheckAnalyzer";
// ADR-006: Helper for building member access chains with proper separators
import memberAccessChain from "./memberAccessChain";
// ADR-065: Assignment decomposition (Phase 2)
import AssignmentHandlerRegistry from "./assignment/index";
import AssignmentClassifier from "./assignment/AssignmentClassifier";
import buildAssignmentContext from "./assignment/AssignmentContextBuilder";
// IHandlerDeps removed - handlers now use CodeGenState.generator directly
// Issue #644: Extracted string length counter for strlen caching optimization
import StringLengthCounter from "./analysis/StringLengthCounter";
// Issue #644: C/C++ mode helper for consolidated mode-specific patterns
import CppModeHelper from "./helpers/CppModeHelper";
// Issue #644: Array dimension parsing helper for consolidation
import ArrayDimensionParser from "../../../utils/ArrayDimensionParser";
import dimensionEvalOptions from "./helpers/dimensionEvalOptions";
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
// Phase 3: Type generation helper for improved testability
import TypeGenerationHelper from "./helpers/TypeGenerationHelper";
// Phase 5: Cast validation helper for improved testability
import CastValidator from "./helpers/CastValidator";
// Issue #793: Function context lifecycle and parameter processing helper
import FunctionContextManager from "./helpers/FunctionContextManager";
import IFunctionContextCallbacks from "./types/IFunctionContextCallbacks";
// Global state for code generation (simplifies debugging, eliminates DI complexity)
import type IScopeSymbol from "../../types/symbols/IScopeSymbol";
import CodeGenState from "../../state/CodeGenState";
import AdrProvenance from "../../state/AdrProvenance";
import SymbolRegistry from "../../state/SymbolRegistry";
import CallbackTypedefFormatter from "./helpers/CallbackTypedefFormatter";
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
import MisraSuppressionUtils from "../MisraSuppressionUtils";
import QualifiedCName from "../../../utils/QualifiedCName";
import type TRequirementKey from "../../types/TRequirementKey";
import type IRecordedRequirement from "../../types/IRecordedRequirement";
import ToolchainRequirementUtils from "../../../utils/ToolchainRequirementUtils";
import ScopeUtils from "../../../utils/ScopeUtils";
import TypeBinding from "../../logic/symbols/TypeBinding";
import REJECTED_KEYWORDS from "../../constants/REJECTED_KEYWORDS";
import type ITargetCapabilities from "../../types/ITargetCapabilities";
import DEFAULT_TARGET from "../../constants/DEFAULT_TARGET";
import TargetResolver from "../../../utils/TargetResolver";

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
 * Issue #1143: The requirements carried by generateIrqWrappers()'s output.
 *
 * One key per arm of the emitted #if/#elif/#else chain, consumed by
 * addGeneratedHelpers(). Declaring them as one list means adding a platform arm
 * without stating its cost shows up as a list that no longer matches the
 * emitter -- and the probe invariant test fails on the mismatch.
 */
const IRQ_WRAPPER_REQUIREMENTS: readonly TRequirementKey[] = [
  "critical-arm-gnu",
  "critical-arduino",
  "critical-avr-libc",
  "critical-cmsis-fallback",
];

/**
 * Code Generator - Transpiles C-Next to C
 *
 * Implements IOrchestrator to support modular generator extraction.
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

  /** Generator registry for modular code generation */
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

    // Phase 2: Medium complexity generators
    this.registry.registerDeclaration("struct", structGenerator);

    // Phase 3: Complex generators
    this.registry.registerDeclaration("function", functionGenerator);

    // Phase 4: Composite generators
    this.registry.registerDeclaration("scope", scopeGenerator);

    // Statement generators
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
    this.registry.registerStatement(
      "forever",
      controlFlowGenerators.generateForever,
    );
    this.registry.registerStatement("switch", switchGenerators.generateSwitch);
    this.registry.registerStatement("critical", generateCriticalStatement);

    // Expression generators
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
  // IOrchestrator Implementation
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
          this.requireInclude(effect.header, effect.line ?? null);
          break;
        case "isr":
          this.requireInclude("isr");
          break;

        // Toolchain requirement effects (Issue #1143)
        case "requires":
          CodeGenState.requireToolchain(effect.key, [
            { sourcePath: CodeGenState.sourcePath ?? "", line: effect.line },
          ]);
          break;

        // Helper function effects
        case "helper":
          // Route through the single marker rather than writing the set
          // directly, so helper-op bookkeeping has one entry point (#1143).
          CodeGenState.markClampOpUsed(effect.operation, effect.cnxType);
          break;
        case "safe-div":
          // Internal helper-op key, not a scope-qualified C name
          CodeGenState.usedSafeDivOps.add(
            `${effect.operation}_${effect.cnxType}`,
          );
          // ADR-051 safe-div helpers return a bool error flag. Route that
          // dependency through the single include path (#1108) rather than
          // letting the helper emit its own #include <stdbool.h>.
          this.requireInclude("stdbool");
          break;

        // Type registration effects
        case "register-type":
          CodeGenState.setVariableTypeInfo(effect.name, effect.info);
          break;
        case "register-local":
          CodeGenState.registerLocalVariable(effect.name, effect.isArray);
          break;
        case "register-const-value":
          CodeGenState.constValues.set(effect.name, effect.value);
          break;

        // Scope effects (ADR-016)
        case "set-scope":
          CodeGenState.setCurrentScopeByPath(effect.name);
          break;

        // Function body effects
        case "enter-function-body":
          CodeGenState.enterFunctionBody();
          break;
        case "exit-function-body":
          CodeGenState.exitFunctionBody();
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
   * Issue #1143: Snapshot the toolchain requirements recorded during the last
   * generate() call.
   *
   * Must be read before the next file's CodeGenState.reset(), which clears the
   * recording map.
   */
  getToolchainRequirements(): readonly IRecordedRequirement[] {
    return Array.from(CodeGenState.recordedRequirements.entries()).map(
      ([key, sites]) => ({ key, sites: [...sites] }),
    );
  }

  /**
   * Register a required include header. Centralizes all include flag management
   * to reduce scattered assignments throughout the codebase.
   *
   * @param header - The header to require (stdint, stdbool, string, etc.)
   */
  private requireInclude(
    header: TIncludeHeader,
    line: number | null = null,
  ): void {
    // Issue #1143: three of these "headers" are really deferred code-emission
    // requests. Record where they were asked for, so the emitter that finally
    // produces the block can attribute its requirement to a .cnx line. No
    // requirement is recorded here -- the code does not exist yet, and
    // recording a requirement for text that may never be emitted is exactly
    // the mistake that made #1141's guard fire on files without the construct.
    // Only the two headers that have a claiming emitter. "isr" was noted here
    // and never read: takeDeferredSites is called for float_static_assert and
    // irq_wrappers alone, and the ISR typedef carries no requirement. Keeping
    // the deferred keys equal to the set that gets claimed is the property the
    // rest of this design leans on.
    if (header === "irq_wrappers" || header === "float_static_assert") {
      CodeGenState.noteDeferredSite(header, line);
    }

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
    // Delegates to CodeGenState, which owns scope membership. This method used to
    // be a byte-identical copy of CodeGenState.resolveIdentifier, so the two
    // could drift apart silently.
    return CodeGenState.resolveIdentifier(identifier);
  }

  // === Expression Generation ===

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
   * Note: Uses explicit save/restore (not withExpectedType) to support null values.
   */
  generateExpressionWithExpectedType(
    ctx: Parser.ExpressionContext,
    expectedType: string | null,
  ): string {
    const saved = CodeGenState.expectedType;
    CodeGenState.expectedType = expectedType;
    try {
      return this.generateExpression(ctx);
    } finally {
      CodeGenState.expectedType = saved;
    }
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
      isScopeType: (qn) => CodeGenState.isScopeType(qn),
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
   * Issue #1030: Extended to handle struct member access (e.g., person.name)
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

    // Issue #1030: Check for struct member access (e.g., person.name)
    if (this._isStructMemberStringExpression(text)) {
      return true;
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
   * Check if struct member access expression evaluates to a string.
   * Issue #1030: Handles patterns like person.name, config.key
   */
  private _isStructMemberStringExpression(text: string): boolean {
    // Pattern: identifier.identifier (simple member access)
    // Must not end with a property that returns a number
    if (
      text.endsWith(".char_count") ||
      text.endsWith(".capacity") ||
      text.endsWith(".size") ||
      text.endsWith(".length") ||
      text.endsWith(".bit_length") ||
      text.endsWith(".byte_length") ||
      text.endsWith(".element_count")
    ) {
      return false;
    }

    // Match simple struct.member pattern
    const memberMatch = /^([a-zA-Z_]\w*)\.([a-zA-Z_]\w*)$/.exec(text);
    if (!memberMatch) {
      return false;
    }

    const [, varName, fieldName] = memberMatch;

    // Get the struct variable's type
    const typeInfo = CodeGenState.getVariableTypeInfo(varName);
    if (!typeInfo) {
      return false;
    }

    // Get the struct type name - it might be directly the baseType
    // or we might need to look it up by the variable's type
    const structTypeName = typeInfo.baseType;
    if (!structTypeName) {
      return false;
    }

    // Look up the field type from the struct
    const fieldType = CodeGenState.getStructFieldType(
      structTypeName,
      fieldName,
    );
    if (!fieldType) {
      return false;
    }

    // Check if the field is a string type (e.g., "string<64>")
    return fieldType.startsWith("string");
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

  // === Function Call Helpers ===

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
   * Part of IOrchestrator interface.
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
   * Part of IOrchestrator interface.
   */
  validateNoEarlyExits(ctx: Parser.BlockContext): void {
    TypeValidator.validateNoEarlyExits(ctx);
  }

  /**
   * Generate a single statement.
   * Part of IOrchestrator interface.
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
    } else if (ctx.foreverStatement()) {
      result = this.generateForever(ctx.foreverStatement()!);
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
   * Part of IOrchestrator interface.
   */
  indent(text: string): string {
    return FormatUtils.indentAllLines(text, CodeGenState.indentLevel);
  }

  /**
   * Validate switch statement.
   * Part of IOrchestrator interface.
   */
  validateSwitchStatement(
    ctx: Parser.SwitchStatementContext,
    switchExpr: Parser.ExpressionContext,
  ): void {
    TypeValidator.validateSwitchStatement(ctx, switchExpr);
  }

  /**
   * Validate condition is a boolean expression (ADR-027, Issue #884).
   * Part of IOrchestrator interface.
   */
  validateConditionIsBoolean(
    ctx: Parser.ExpressionContext,
    conditionType: string,
  ): void {
    TypeValidator.validateConditionIsBoolean(ctx, conditionType);
  }

  /**
   * ADR-068 / #1075: reject an always-true literal loop condition (E0707).
   * Part of IOrchestrator interface.
   */
  validateLoopConditionNotAlwaysTrue(ctx: Parser.ExpressionContext): void {
    TypeValidator.validateLoopConditionNotAlwaysTrue(ctx);
  }

  /**
   * Issue #254: Validate no function calls in condition (E0702).
   * Part of IOrchestrator interface.
   */
  validateConditionNoFunctionCall(
    ctx: Parser.ExpressionContext,
    conditionType: string,
  ): void {
    TypeValidator.validateConditionNoFunctionCall(ctx, conditionType);
  }

  /**
   * Issue #254: Validate no function calls in ternary condition (E0702).
   * Part of IOrchestrator interface.
   */
  validateTernaryConditionNoFunctionCall(
    ctx: Parser.OrExpressionContext,
  ): void {
    TypeValidator.validateTernaryConditionNoFunctionCall(ctx);
  }

  /**
   * Generate an assignment target.
   * Part of IOrchestrator interface.
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
        ctx.start?.line,
      );
    }

    // Issue #779: Resolve bare scope member identifiers before postfix chain processing
    // This ensures scope members get their prefix even with array/member access.
    // Also skip known registers - they should be handled by the postfix chain builder
    // to enable proper register validation (requiring global. when shadowed).
    let resolvedIdentifier = identifier ?? "";
    if (!hasGlobal && !hasThis && identifier) {
      const isParameter = CodeGenState.currentParameters.has(identifier);
      const isLocalVariable = CodeGenState.localVariables.has(identifier);
      const isKnownRegister =
        CodeGenState.symbols?.knownRegisters.has(identifier);
      // Issue #1100: Parameters with postfix ops (array/bit subscript, member
      // access) must resolve through the same dereference logic as a bare
      // parameter reference (ParameterDereferenceResolver), not skip it.
      // For array/struct/string/etc. parameters this is a no-op (they're
      // already pointer-like, matching the prior behavior verbatim — e.g.
      // `buf[idx]` stays `buf[idx]`). For a scalar parameter that became a
      // pointer because it's modified elsewhere in the function, a bit
      // access (`v[4] <- true`) now correctly dereferences to `(*v)[4]`
      // (which AssignmentContextBuilder reduces to base identifier `(*v)`)
      // instead of assigning through the raw pointer.
      if (isParameter) {
        const paramInfo = CodeGenState.currentParameters.get(identifier)!;
        resolvedIdentifier = ParameterDereferenceResolver.resolve(
          identifier,
          paramInfo,
          this._buildParameterDereferenceDeps(),
        );
      } else if (!isKnownRegister) {
        // ADR-057: pass the REAL locality. Hardcoding `false` and skipping
        // locals entirely made this the write-side twin of
        // TypeValidator.resolveBareIdentifier rather than a caller of it, so a
        // shadowing local kept its bare name here while every read was
        // renamed -- `data[1] <- 5` wrote the global and `return data[1]` read
        // the local, in the same function, compiling clean.
        const resolved = TypeValidator.resolveBareIdentifier(
          identifier,
          isLocalVariable,
          (name: string) => this.isKnownStruct(name),
          ctx.start?.line,
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
   * Part of IOrchestrator interface.
   */
  generateArrayDimensions(dims: Parser.ArrayDimensionContext[]): string {
    return dims.map((d) => this.generateArrayDimension(d)).join("");
  }

  // === strlen Optimization ===

  /**
   * Count string length accesses for caching.
   * Part of IOrchestrator interface.
   */
  countStringLengthAccesses(
    ctx: Parser.ExpressionContext,
  ): Map<string, number> {
    // Issue #644: Delegate to extracted StringLengthCounter (now static)
    return StringLengthCounter.countExpression(ctx);
  }

  /**
   * Count block length accesses.
   * Part of IOrchestrator interface.
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
   * Part of IOrchestrator interface.
   */
  setupLengthCache(counts: Map<string, number>): string {
    const declarations: string[] = [];
    const cache = new Map<string, string>();

    for (const [varName, count] of counts) {
      if (count >= 2) {
        const tempVar = ReservedCnxName.stringLengthCache(varName);
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
   * Part of IOrchestrator interface.
   */
  clearLengthCache(): void {
    CodeGenState.lengthCache = null;
  }

  /**
   * Register a local variable.
   * Part of IOrchestrator interface.
   */
  registerLocalVariable(name: string): string {
    CodeGenState.registerLocalVariable(name);
    return CodeGenState.emittedLocalName(name);
  }

  // === Declaration Generation ===

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
    // #1285: one ladder. This was the largest of seven copies, and the only one
    // that handled `arrayType` by peeking at two of its six element
    // alternatives -- TypeBinding recurses into all of them.
    const resolved = TypeBinding.resolveName(ctx, CodeGenState.currentScope, {
      isScopeType: (qualifiedName) => CodeGenState.isScopeType(qualifiedName),
      resolveQualifiedType: (identifiers) =>
        this.resolveQualifiedType(identifiers),
    });
    return resolved ?? ctx.getText();
  }

  /** Try to evaluate a constant expression at compile time */
  tryEvaluateConstant(ctx: Parser.ExpressionContext): number | undefined {
    // Issue #1127: the shared builder, not a fourth inline copy of the same
    // three lookups. This is the orchestrator entry point that
    // ArrayDimensionUtils uses to emit declaration dimensions, so it is on the
    // hot path for exactly the divergences this work closes.
    return ArrayDimensionParser.parseSingleDimension(
      ctx,
      dimensionEvalOptions(),
    );
  }

  /**
   * Get zero initializer for a type.
   * ADR-015: Get the appropriate zero initializer for a type
   * ADR-017: Handle enum types by initializing to first member
   */
  getZeroInitializer(typeCtx: Parser.TypeContext, isArray: boolean): string {
    // Issue #379 / #1004: arrays zero-init with the aggregate brace ({} in
    // C++, {0} in C) regardless of element type.
    if (isArray) {
      return this._getAggregateZeroInitBrace();
    }

    // Handle named types (scoped, global, qualified, user)
    const resolved = this._resolveTypeNameFromContext(typeCtx);
    if (resolved) {
      // Check if enum
      if (CodeGenState.symbols!.knownEnums.has(resolved.name)) {
        return this._getEnumZeroValue(resolved.name, resolved.separator);
      }
      // Issue #1004: struct/class zero-init. C++ value-initialization ({})
      // works for every aggregate (including ones whose first field is an
      // enum, where {0} is an invalid int->enum narrowing); C uses {0}.
      return this._getAggregateZeroInitBrace();
    }

    // Issue #295: C++ template types use value initialization {}
    if (typeCtx.templateType()) {
      return "{}";
    }

    // Issue #1019: string<N> types use empty string initializer
    if (typeCtx.stringType()) {
      return '""';
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
  getSubstringOperands(ctx: Parser.ExpressionContext): ISubstringOps | null {
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

  /**
   * Issue #1200: the `_fp` typedef name for a callback type, or null if the
   * name is not one. Exposed so renderers do not re-derive the `${name}_fp`
   * convention that registerCallbackType owns.
   */
  getCallbackTypedefName(typeName: string): string | null {
    return CodeGenState.callbackTypes.get(typeName)?.typedefName ?? null;
  }

  /**
   * Issues #1200, #1201: does this callback type need its `_fp` typedef emitted?
   *
   * True when the type is referenced by any field or parameter, not only by a
   * field of a top-level struct. Reading callbackFieldTypes alone missed
   * scope-nested struct fields, scope members and parameters, each of which
   * produced C that referenced a typedef nothing had emitted.
   *
   * Deliberately separate from isCallbackTypeUsedAsFieldType below. The two
   * answer different questions and only this one is about code generation.
   * Merging them widened ADR-029's nominal-typing rule as a side effect,
   * rejecting a callback assignment that transpiles on main.
   */
  /**
   * ADR-029 / Issues #1201, #1212: record that this function needs a callback
   * `_fp` typedef, if it does.
   *
   * The single owner of that decision. It was previously spelled out at each of
   * the four sites that emit a function -- two here, plus FunctionGenerator and
   * ScopeGenerator -- so deferring the typedefs meant changing all four, and
   * missing one left a whole construct still emitting inline. Every caller now
   * states the intent ("this function was emitted") and nothing re-derives the
   * consequences.
   */
  recordCallbackTypedef(funcName: string): void {
    if (funcName === "main") {
      return;
    }
    if (!this.isCallbackTypeReferenced(funcName)) {
      return;
    }
    const typedef = this.generateCallbackTypedef(funcName);
    if (typedef) {
      CodeGenState.pendingCallbackTypedefs.push(typedef);
    }
  }

  private isCallbackTypeReferenced(funcName: string): boolean {
    return CodeGenState.callbackTypeReferences.has(funcName);
  }

  /**
   * ADR-029 nominal typing: is this function used as a STRUCT FIELD type?
   *
   * Every top-level function is registered in callbackTypes, so this narrower
   * predicate is what separates "a plain function with a compatible signature"
   * from "a function used as a type" when validating a callback assignment.
   * Widening it changes what C-Next accepts, which needs an ADR, so it stays
   * derived from callbackFieldTypes.
   */
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
    // The assignment was written twice on main; the second was dead.
    CodeGenState.setCurrentScopeByPath(name);
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

    // Issue #1164: the included header already declares this one.
    if (
      CodeGenState.selfIncludeAdded &&
      CodeGenState.headerOwnsCallbackTypedef(funcName)
    ) {
      return null;
    }

    return `\n${CallbackTypedefFormatter.format(
      callbackInfo.returnType,
      callbackInfo.typedefName,
      callbackInfo.parameters,
      this.isCppMode(),
    )}\n`;
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

    // Issue #565: Run transitive propagation with full context.
    // Issue #1178: through PassByValueAnalyzer so this pass and the standalone
    // one resolve an unresolvable callee identically.
    PassByValueAnalyzer.propagateModifications();

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
      const id = ctx.IDENTIFIER()!.getText();
      // Issue #1011: break/continue are not part of C-Next - use structured conditions
      // ADR-026 (Status: Rejected) explicitly excludes break/continue from the language
      if (REJECTED_KEYWORDS.has(id)) {
        const line = ctx.start?.line ?? 0;
        const col = ctx.start?.column ?? 0;
        throw new Error(
          `${line}:${col} error[E0703]: '${id}' is not supported in C-Next - use structured conditions instead`,
        );
      }
      return this._resolveIdentifierExpression(id, ctx.start?.line);
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

  /**
   * Issue #948: Check if a type is an opaque (forward-declared) struct type.
   * Opaque types can only be used as pointers (cannot be instantiated).
   * Part of IOrchestrator interface.
   */
  isOpaqueType(typeName: string): boolean {
    return CodeGenState.isOpaqueType(typeName);
  }

  /**
   * Issue #958: Check if a type is an external typedef struct type.
   * Used for scope variables which should always be pointers for external struct types.
   * Part of IOrchestrator interface.
   */
  isTypedefStructType(typeName: string): boolean {
    return CodeGenState.isTypedefStructType(typeName);
  }

  /**
   * Issue #948: Mark a scope variable as having an opaque type.
   * These variables are generated as pointers with NULL initialization.
   * Part of IOrchestrator interface.
   */
  markOpaqueScopeVariable(qualifiedName: string): void {
    CodeGenState.markOpaqueScopeVariable(qualifiedName);
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
      if (
        QualifiedCName.isInScope(registerName, CodeGenState.currentScope.name)
      ) {
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
          `from inside scope '${CodeGenState.currentScope!.cnxScopedName}'`,
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
    return QualifiedCName.fromParts(identifiers);
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

    // Initialize generators (once per CodeGenerator instance)
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
    // #1241: Transpiler._transpileFile sets the provenance file before
    // analyzers run; re-assert it here for API callers that drive the
    // generator directly and never go through that path.
    AdrProvenance.beginFile(CodeGenState.sourcePath);
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
  private resetGeneratorState(targetCapabilities: ITargetCapabilities): void {
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

    // Issue #461: Initialize constValues from symbol table.
    // Issue #1220: derived by SymbolTable.getConstValues() rather than walked
    // again here -- this loop and SymbolTable's were two implementations of one
    // rule, and only one of them was reachable from the analyzers.
    CodeGenState.constValues =
      CodeGenState.symbolTable?.getConstValues() ?? new Map();
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

    // Issue #1143: every file carries its mode's baseline. Recorded here rather
    // than assumed by consumers, so "what does this file need?" has exactly one
    // answer source even for the trivial case.
    CodeGenState.requireToolchain(
      CodeGenState.cppMode ? "baseline-cpp" : "baseline-c",
    );

    // Self-include for extern "C" linkage
    // Issue #1164: this used to ask a second predicate that saw only scope
    // members, so a file exporting types, consts or top-level functions got a
    // header nothing included. Same question, same answer source as the header
    // itself.
    if (symbols.hasPublicInterface && CodeGenState.sourcePath) {
      const pathToUse =
        options?.sourceRelativePath ||
        CodeGenState.sourcePath.replace(/^.*[\\/]/, "");
      // Issue #933: Use .hpp extension in C++ mode to match header file
      // Issue #1319: read the run's extension; do not re-derive it from the mode
      const ext = CodeGenState.outputExtensions.header;
      const headerName = pathToUse.replace(/\.cnx$|\.cnext$/, ext);
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

    // Issue #1143: the banner is built last and prepended, because none of the
    // requirement state exists until generateAllDeclarations() above has run.
    // Computing it at the top -- where the banner used to be pushed -- could
    // only ever describe an empty requirement set.
    return [...this.buildBanner(), ...output].join("\n");
  }

  /**
   * The file's own header comment, including what its output costs.
   *
   * Only requirements above the mode's baseline are listed, so an ordinary C99
   * file is unchanged. The point is that the requirement travels with the
   * artifact: someone handed a generated .c can see what it needs without
   * having the .cnx, the transpiler, or this repository.
   *
   * Emitted on the .c/.cpp only. The companion header does not contain the
   * constructs -- the IRQ wrappers, the static asserts and the helpers are all
   * emitted into the implementation file -- so repeating the line there would
   * claim a cost the header does not carry.
   */
  private buildBanner(): readonly string[] {
    const sourcePath = CodeGenState.sourcePath;
    const generatedLine = sourcePath
      ? ` * Generated by C-Next Transpiler from: ${basename(sourcePath)}`
      : " * Generated by C-Next Transpiler";

    const lines = ["/**", generatedLine, " * A safer C for embedded systems"];

    const requires = ToolchainRequirementUtils.describeForBanner(
      this.getToolchainRequirements(),
      CodeGenState.cppMode ? "cpp" : "c",
    );
    for (const line of requires) {
      lines.push(` * ${line}`);
    }

    lines.push(" */", "");
    return lines;
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

      // Issue #850: Add MISRA suppression for banned headers
      const includeText = includeDir.getText();
      const suppression =
        MisraSuppressionUtils.getMisraSuppressionComment(includeText);
      if (suppression) {
        output.push(suppression);
      }
      output.push(this.transformIncludeDirective(includeText));
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
    // Issue #1212: where the callback typedef block belongs -- after the type
    // declarations it may depend on, before the first function that may use it.
    let firstFunctionIndex: number | null = null;

    for (const decl of tree.declaration()) {
      const leadingComments = this.getLeadingComments(decl);
      declarations.push(...this.formatLeadingComments(leadingComments));

      if (
        firstFunctionIndex === null &&
        (decl.functionDeclaration() !== null ||
          decl.scopeDeclaration() !== null)
      ) {
        firstFunctionIndex = declarations.length;
      }

      const code = this.generateDeclaration(decl);
      if (code) {
        declarations.push(code);
      }
    }

    const typedefs = CodeGenState.pendingCallbackTypedefs;
    if (typedefs.length > 0) {
      declarations.splice(
        firstFunctionIndex ?? declarations.length,
        0,
        ...typedefs,
      );
      CodeGenState.pendingCallbackTypedefs = [];
    }

    return declarations;
  }

  /**
   * Add auto-generated includes based on usage.
   */
  private addAutoIncludes(output: string[]): void {
    // Issue #1108: dedup auto-includes against passthrough source includes
    // (processIncludeDirectives runs first). A source that already
    // `#include`s e.g. <stdint.h> must not have it emitted a second time.
    const present = new Set(
      output
        .map((line) => CodeGenerator.extractIncludeTarget(line))
        .filter((target): target is string => target !== null),
    );

    const autoIncludes: string[] = [];
    const addInclude = (target: string): void => {
      if (present.has(target)) return;
      autoIncludes.push(`#include ${target}`);
      present.add(target);
    };

    if (CodeGenState.needsStdint) addInclude("<stdint.h>");
    if (CodeGenState.needsStdbool) addInclude("<stdbool.h>");
    if (CodeGenState.needsString) addInclude("<string.h>");
    if (CodeGenState.needsCMSIS) addInclude("<cmsis_gcc.h>");
    if (CodeGenState.needsLimits) addInclude("<limits.h>");

    if (autoIncludes.length > 0) {
      output.push(...autoIncludes, "");
    }
  }

  /**
   * Extract the include target (`<header.h>` or `"header.h"`) from a line,
   * or null if the line is not a plain `#include` directive.
   */
  private static extractIncludeTarget(line: string): string | null {
    const match = /^#include\s+(<[^>]+>|"[^"]+")\s*$/.exec(line.trim());
    return match ? match[1] : null;
  }

  /**
   * Add generated helpers (static asserts, IRQ wrappers, typedefs, etc.).
   */
  private addGeneratedHelpers(output: string[]): void {
    if (CodeGenState.needsFloatStaticAssert) {
      // Use static_assert for C++ (standard), _Static_assert for C11.
      // Issue #1143: the requirement is recorded from this same ternary, so
      // the recorded key and the emitted keyword cannot disagree -- C11 for
      // _Static_assert, C++11 for static_assert.
      const cppMode = this.isCppMode();
      const assertKeyword = cppMode ? "static_assert" : "_Static_assert";
      CodeGenState.requireToolchain(
        cppMode ? "float-assert-cpp11" : "float-assert-c11",
        CodeGenState.takeDeferredSites("float_static_assert"),
      );
      output.push(
        `${assertKeyword}(sizeof(float) == 4, "Float bit indexing requires 32-bit float");`,
        `${assertKeyword}(sizeof(double) == 8, "Float bit indexing requires 64-bit double");`,
        "",
      );
    }

    if (CodeGenState.needsIrqWrappers) {
      // Issue #1143: the block emits all four platform arms in one
      // #if/#elif/#else chain, so the file carries all four requirements --
      // which one applies is decided by the *compiler*, not by us. Recording a
      // single "critical section" requirement here would force one answer to a
      // per-target question and is how a requirements table starts lying.
      const irqSites = CodeGenState.takeDeferredSites("irq_wrappers");
      for (const key of IRQ_WRAPPER_REQUIREMENTS) {
        CodeGenState.requireToolchain(key, irqSites);
      }
      output.push(...this.generateIrqWrappers());
    }

    // Issue #369/#1164: when the .c includes its own header, the header owns
    // this typedef. Emitting it here too is a redeclaration error.
    if (CodeGenState.needsISR && !CodeGenState.selfIncludeAdded) {
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
   * ADR-049: Resolve target capabilities with priority: CLI > pragma > default.
   *
   * Delegates to TargetResolver so this file and the whole-program Rule 5.1
   * check read the same pragma the same way (#1307 review).
   *
   * @param tree - The parsed program tree
   * @param cliTarget - Optional target from CLI --target flag
   */
  private resolveTargetCapabilities(
    tree: Parser.ProgramContext,
    cliTarget?: string,
  ): ITargetCapabilities {
    if (cliTarget) {
      const fromCli = TargetResolver.byName(cliTarget);
      if (fromCli) {
        return fromCli;
      }
      console.warn(
        `Warning: Unknown target '${cliTarget}', falling back to pragma or default`,
      );
    }

    return (
      TargetResolver.byName(TargetResolver.fromPragma(tree)) ?? DEFAULT_TARGET
    );
  }

  /**
   * ADR-010: Transform #include directives, converting .cnx to .h or .hpp
   * Delegates to IncludeGenerator
   * Issue #349: Now passes includeDirs and inputs for angle-bracket resolution
   * Issue #941: Now passes cppMode for .hpp extension in C++ mode
   */
  private transformIncludeDirective(includeText: string): string {
    return includeTransformIncludeDirective(includeText, {
      sourcePath: CodeGenState.sourcePath,
      includeDirs: CodeGenState.includeDirs,
      inputs: CodeGenState.inputs,
      headerExtension: CodeGenState.outputExtensions.header,
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
    CodeGenState.setCurrentScopeByPath(scopeName);

    // #1281/#1285: functions first, THEN everything that can reference one.
    // A struct field naming a scope-local function-as-type asks isScopeType
    // whether that name is a type, and the answer comes from callbackTypes --
    // which this loop is what fills. Walking members in source order made the
    // answer depend on whether the function happened to be declared above the
    // struct, so `Config` before `tickSource` resolved the field BARE and
    // emitted a header naming something that is not a type. Registering every
    // function before reading any reference makes the order irrelevant, which
    // is the same declaration-order invariant ADR-057 states for the symbols
    // layer's Pass 0b.
    for (const member of scopeDecl.scopeMember()) {
      const funcDecl = member.functionDeclaration();
      if (funcDecl) {
        // #1285: resolve the scope SYMBOL rather than reading back mutable
        // state, so the generated name does not depend on when it is asked.
        this._registerScopeFunction(
          SymbolRegistry.getOrCreateScope(scopeName),
          funcDecl,
        );
      }
    }

    for (const member of scopeDecl.scopeMember()) {
      // Issue #1200: a struct nested in a scope has callback fields just like a
      // top-level one, and a scope member variable can itself be callback-typed.
      // Neither was walked here, so neither ever registered its type.
      if (member.structDeclaration()) {
        this._collectStructCallbackFields(member.structDeclaration()!);
        continue;
      }
      if (member.variableDeclaration()) {
        const varType = this.getTypeName(member.variableDeclaration()!.type());
        CodeGenState.callbackTypeReferences.add(varType);
      }
    }

    // Restore previous scope context
    CodeGenState.currentScope = savedScope;
  }

  /**
   * Register one scope function: its qualified name, signature, and ADR-029
   * callback type. Extracted so the pre-pass above and nothing else owns the
   * registration -- it must complete for every function in the scope before any
   * reference to one is resolved.
   */
  private _registerScopeFunction(
    declaringScope: IScopeSymbol | null,
    funcDecl: Parser.FunctionDeclarationContext,
  ): void {
    const funcName = funcDecl.IDENTIFIER().getText();
    // Track fully qualified function name: Scope_function
    const fullName = QualifiedNameGenerator.forFunctionInScope(
      declaringScope,
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
      CodeGenState.callbackTypeReferences.add(fieldType);
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
        // Issue #1201: a parameter naming a callback type needs that type's
        // typedef emitted, exactly as a struct field does.
        CodeGenState.callbackTypeReferences.add(baseType);
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
      isStruct: boolean;
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
        // ADR-006: Check if parameter type is a struct (for pointer/reference semantics)
        const isStruct = this.isStructType(typeName);

        let paramType: string;
        let isPointer: boolean;

        if (isCallbackParam) {
          // Use the callback typedef name
          const cbInfo = CodeGenState.callbackTypes.get(typeName)!;
          paramType = cbInfo.typedefName;
          isPointer = false; // Function pointers are already pointers
        } else {
          paramType = this.generateType(param.type());
          // ADR-006: Non-array struct parameters become pointers in C mode
          isPointer = !isArray && isStruct;
        }

        let arrayDims: string;
        if (dims.length > 0) {
          arrayDims = dims.map((d) => this.generateArrayDimension(d)).join("");
        } else if (arrayTypeCtx) {
          // Generate all dimensions from arrayType (supports multi-dimensional)
          // Issue #1127: fold the same way ParameterInputAdapter does. Emitting
          // the identifier here made one const render two ways in a single .c
          // -- `void OnData(uint8_t buf[6])` beside
          // `typedef void (*OnData_fp)(uint8_t buf[SIZE])` -- and the typedef
          // form is a variably-modified type, which MISRA C:2012 Rule 18.8
          // forbids and which gcc warns about under its variable-length-array
          // diagnostic.
          arrayDims = arrayTypeCtx
            .arrayTypeDimension()
            .map((d) => {
              const expr = d.expression();
              if (!expr) {
                return "[]";
              }
              const folded = ArrayDimensionParser.parseSingleDimension(
                expr,
                dimensionEvalOptions(),
              );
              return `[${folded ?? this.generateExpression(expr)}]`;
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
          isStruct,
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
  private _getSubstringOperands(
    ctx: Parser.ExpressionContext,
  ): ISubstringOps | null {
    return StringOperationsHelper.getSubstringOperands(ctx, {
      generateExpression: (exprCtx) => this.generateExpression(exprCtx),
    });
  }

  // ========================================================================
  // ADR-024: Type Classification and Validation Helpers
  // ========================================================================

  // NOTE: Public isIntegerType and isFloatType moved to IOrchestrator interface
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
    // Issue #1164: the struct generator decides for itself what a self-include
    // suppresses. Returning early here also skipped its callback-field effects
    // and dropped the ADR-029 init function, which the header never carries.
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
    // #1285: no inline fallback. This used to carry a second, parallel
    // implementation guarded by `if (generator)`, but registration is
    // unconditional in the constructor, so the guard never failed and the twin
    // was unreachable -- while still having to be kept in step by hand. A
    // missing generator is an internal invariant violation, not a second path.
    const generator = this.registry.getDeclaration("scope");
    if (!generator) {
      throw new Error(
        "Internal: no 'scope' declaration generator is registered",
      );
    }
    const result = generator(ctx, this.getInput(), this.getState(), this);
    this.applyEffects(result.effects);
    return result.code;
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

  // ========================================================================
  // Register Bindings (ADR-004)
  // ========================================================================

  private generateRegister(ctx: Parser.RegisterDeclarationContext): string {
    // #1285: no inline fallback. This used to carry a second, parallel
    // implementation guarded by `if (generator)`, but registration is
    // unconditional in the constructor, so the guard never failed and the twin
    // was unreachable -- while still having to be kept in step by hand. A
    // missing generator is an internal invariant violation, not a second path.
    const generator = this.registry.getDeclaration("register");
    if (!generator) {
      throw new Error(
        "Internal: no 'register' declaration generator is registered",
      );
    }
    const result = generator(ctx, this.getInput(), this.getState(), this);
    this.applyEffects(result.effects);
    return result.code;
  }

  // ========================================================================
  // Struct
  // ========================================================================

  private generateStruct(ctx: Parser.StructDeclarationContext): string {
    // Delegates to extracted StructGenerator
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
   * Delegates to extracted EnumGenerator.
   */
  private generateEnum(ctx: Parser.EnumDeclarationContext): string {
    const generator = this.registry.getDeclaration("enum");
    if (!generator) {
      throw new Error("Error: enum generator not registered");
    }
    const result = generator(ctx, this.getInput(), this.getState(), this);
    this.applyEffects(result.effects);
    // Issues #369/#1164: the included header owns the definition. The generator
    // still runs so its effects are registered -- returning early here would
    // silently drop them, which is how the ADR-029 struct init function was lost.
    return CodeGenState.selfIncludeAdded ? "" : result.code;
  }

  /**
   * ADR-034: Generate bitmap declaration
   * bitmap8 MotorFlags { Running, Direction, Mode[3], Reserved[2] }
   * -> typedef uint8_t MotorFlags; (with field layout comment)
   *
   * Delegates to extracted generator if registered.
   */
  private generateBitmap(ctx: Parser.BitmapDeclarationContext): string {
    // #1285: no inline fallback. This used to carry a second, parallel
    // implementation guarded by `if (generator)`, but registration is
    // unconditional in the constructor, so the guard never failed and the twin
    // was unreachable -- while still having to be kept in step by hand. A
    // missing generator is an internal invariant violation, not a second path.
    const generator = this.registry.getDeclaration("bitmap");
    if (!generator) {
      throw new Error(
        "Internal: no 'bitmap' declaration generator is registered",
      );
    }
    const result = generator(ctx, this.getInput(), this.getState(), this);
    this.applyEffects(result.effects);
    // Issues #369/#1164: the included header owns the definition.
    return CodeGenState.selfIncludeAdded ? "" : result.code;
  }

  /**
   * The struct type for an initializer: explicit if written, else inferred
   * from the expected type at this position.
   *
   * Rejects a redundant explicit type, which is the case where both are
   * present: `const Point p <- Point { x: 0 };` should be written
   * `const Point p <- { x: 0 };`.
   */
  private _resolveStructInitializerTypeName(
    ctx: Parser.StructInitializerContext,
  ): string {
    const explicit = ctx.IDENTIFIER();
    if (explicit && CodeGenState.expectedType) {
      throw new Error(
        `Redundant type '${explicit.getText()}' in struct initializer. ` +
          `Use '{ field: value }' syntax when type is already declared.`,
      );
    }
    if (explicit) return explicit.getText();
    if (CodeGenState.expectedType) return CodeGenState.expectedType;
    // This should not happen in valid code
    throw new Error(
      "Cannot infer struct type - no explicit type and no context",
    );
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
    const typeName = this._resolveStructInitializerTypeName(ctx);
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
      // Empty initializer: Point {} -> { 0 } in declaration context, (Point){ 0 } elsewhere
      if (isCppClass) return "{}";
      return CodeGenState.inDeclarationInit ? "{ 0 }" : `(${castType}){ 0 }`;
    }

    // Get field type info for nested initializers
    // Issue #831: SymbolTable is the single source of truth for struct fields
    // (both C-Next and C/C++ header structs)
    const structFieldTypes =
      CodeGenState.symbolTable?.getStructFieldTypes(typeName);

    const fields = fieldList.fieldInitializer().map((field) => {
      const fieldName = field.IDENTIFIER().getText();
      const fieldType = this._resolveFieldType(fieldName, structFieldTypes);
      const value = CodeGenState.withExpectedType(fieldType, () =>
        this.generateExpression(field.expression()),
      );
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

    // For C-Next/C structs, generate designated initializer.
    // Issue #1143: `.field = value` is C99 in C mode (baseline, free) but
    // C++20 in C++ mode -- GCC and Clang accept it earlier as an extension,
    // which is how this repo's own -std=c++14 harness compiles the output.
    // The text is identical in both modes, so the mode has to be recorded
    // here; no probe over the output could recover it.
    if (CodeGenState.cppMode) {
      CodeGenState.requireToolchain("cpp-designated-initializer");
    }
    const fieldInits = fields.map((f) => `.${f.fieldName} = ${f.value}`);

    return this.formatStructInitializer(typeName, castType, fieldInits);
  }

  private formatStructInitializer(
    typeName: string,
    castType: string,
    fieldInits: string[],
  ): string {
    const initializer: string = `{ ${fieldInits.join(", ")} }`;

    // In a declaration initializer context, use plain designated initializer — no type cast
    // prefix needed, and compound literals are not C99 constant expressions so they fail
    // at file scope on GCC < 13.
    if (CodeGenState.inDeclarationInit) {
      return initializer;
    }

    // Issue #882: In C++ mode, anonymous structs/unions must use plain brace init.
    // Compound literals like (struct { ... }){ ... } create incompatible types in C++
    // because each struct { ... } definition creates a distinct nominal type.
    if (
      CodeGenState.cppMode &&
      (typeName.startsWith("struct {") || typeName.startsWith("union {"))
    ) {
      return initializer;
    }

    if (!CodeGenState.inFunctionBody) {
      return initializer;
    }

    // Issue #1143: a compound literal is C99, but is not ISO C++ at any
    // version -- GCC and Clang accept it as an extension.
    if (CodeGenState.cppMode) {
      CodeGenState.requireToolchain("cpp-compound-literal");
    }
    return `(${castType})${initializer}`;
  }

  /**
   * Resolve the C type string for a named struct field, converting C++ underscore-separated
   * names to :: notation. Returns undefined if the field is not in the type map.
   * Issue #502: C-Next stores C++ types with _ separator; codegen needs ::.
   */
  private _resolveFieldType(
    fieldName: string,
    structFieldTypes: Map<string, string> | undefined,
  ): string | undefined {
    if (!structFieldTypes?.has(fieldName)) return undefined;
    const fieldType = structFieldTypes.get(fieldName)!;
    if (!QualifiedCName.isQualified(fieldType)) return fieldType;
    const parts = QualifiedCName.split(fieldType);
    if (parts.length > 1 && this.isCppScopeSymbol(parts[0])) {
      return parts.join("::");
    }
    return fieldType;
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
    // #1285: no inline fallback. This used to carry a second, parallel
    // implementation guarded by `if (generator)`, but registration is
    // unconditional in the constructor, so the guard never failed and the twin
    // was unreachable -- while still having to be kept in step by hand. A
    // missing generator is an internal invariant violation, not a second path.
    const generator = this.registry.getDeclaration("function");
    if (!generator) {
      throw new Error(
        "Internal: no 'function' declaration generator is registered",
      );
    }
    const result = generator(ctx, this.getInput(), this.getState(), this);
    this.applyEffects(result.effects);
    return result.code;
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
      isTypedefStructType: (t: string) =>
        CodeGenState.symbolTable?.isTypedefStructType(t) ?? false,
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

    this.recordCallbackTypedef(name);
    return functionCode;
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
      isKnownStruct: (t) => {
        if (this.isKnownStruct(t)) return true;
        // ADR-057: check qualified name for scope-local struct types only
        const qualified = CodeGenState.currentScope
          ? ScopeUtils.qualifyInScope(t, CodeGenState.currentScope)
          : t;
        return CodeGenState.symbols?.knownStructs.has(qualified) ?? false;
      },
      typeMap: TYPE_MAP,
      isModified,
      isPassByValue,
      isCallbackCompatible,
      forcePassByReference,
      forceConst,
      isTypedefStructType: (t) =>
        CodeGenState.symbolTable?.isTypedefStructType(t) ?? false,
      // Issue #995: Opaque handles should not get auto-const
      isOpaqueType: (t) => CodeGenState.isOpaqueType(t),
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

    // Issue #958: C-header typedef struct types always need pointer semantics
    if (CodeGenState.symbolTable?.isTypedefStructType(type)) {
      return `${type}*`;
    }

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
    // The guard above established the last character is '*', so dropping it and
    // trimming is exactly what /\s*\*\s*$/ did -- without the super-linear
    // backtracking that pattern has on a long run of spaces (S8786).
    const returnBaseType = returnType.slice(0, -1).trim();
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
    CodeGenState.registerLocalVariable(name);

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
   * Brace initializer that zero-initializes an aggregate (struct or array).
   * Issue #379 / #1004: C++ uses value-initialization ({}), which is valid for
   * any aggregate element type (POD, struct, class) including enum-first
   * structs where {0} is an invalid int->enum narrowing; C uses {0}.
   */
  private _getAggregateZeroInitBrace(): string {
    return CodeGenState.cppMode ? "{}" : "{0}";
  }

  /**
   * Get zero initializer for an enum type.
   * Returns member with value 0, or first member, or casted 0.
   * ADR-017: Enums initialize to first member
   */
  private _getEnumZeroValue(
    enumName: string,
    separator: string = QualifiedCName.SEPARATOR,
  ): string {
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
   * Returns { name, separator } or null if not a named type.
   * ADR-016: Handles scoped, global, qualified, and user types
   */
  private _resolveTypeNameFromContext(
    typeCtx: Parser.TypeContext,
  ): { name: string; separator: string } | null {
    // #1285: ask for named types by name. Everything else -- string, array,
    // template, primitive, `void` -- returns null and is handled by the
    // caller's own chain, which is where it was always handled. An enumerated
    // list of alternatives to SKIP would have to be kept in step with the
    // grammar from ~3000 lines away, and getting it wrong fails open.
    const name = TypeBinding.resolveNamedType(
      typeCtx,
      CodeGenState.currentScope,
      {
        isScopeType: (qualifiedName) => CodeGenState.isScopeType(qualifiedName),
        resolveQualifiedType: (parts) => this.resolveQualifiedType(parts),
      },
    );
    if (name === null) {
      return null;
    }

    // Issue #388: a C++ namespace type comes back `::`-joined.
    const separator = name.includes("::") ? "::" : QualifiedCName.SEPARATOR;
    return { name, separator };
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

  // ADR-065: buildHandlerDeps removed - handlers now use CodeGenState.generator directly

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
    const savedAssignmentContext = { ...CodeGenState.assignmentContext };

    // Issue #644: AssignmentExpectedTypeResolver is now static
    const resolved = AssignmentExpectedTypeResolver.resolve(targetCtx);
    if (resolved.assignmentContext) {
      CodeGenState.assignmentContext = resolved.assignmentContext;
    }

    // Use withExpectedType for exception safety on expectedType,
    // manually save/restore assignmentContext
    let value: string;
    try {
      value = CodeGenState.withExpectedType(resolved.expectedType, () =>
        this.generateExpression(ctx.expression()),
      );
    } finally {
      CodeGenState.assignmentContext = savedAssignmentContext;
    }

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

    // ADR-065: Dispatch to assignment handlers
    // Build context, classify, and dispatch - all patterns handled by handlers
    const assignCtx = buildAssignmentContext(ctx, {
      typeRegistry: CodeGenState.getTypeRegistryView(),
      generateExpression: () => value,
      generateAssignmentTarget: (targetCtx) =>
        this.generateAssignmentTarget(targetCtx),
      isKnownRegister: (name) => CodeGenState.symbols!.knownRegisters.has(name),
      currentScope: CodeGenState.currentScope,
    });
    // ADR-065: Handlers access CodeGenState directly, no deps needed
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
      resolveBareIdentifier: (name: string, isLocal: boolean, line?: number) =>
        TypeValidator.resolveBareIdentifier(
          name,
          isLocal,
          (n: string) => this.isKnownStruct(n),
          line,
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

  private generateForever(ctx: Parser.ForeverStatementContext): string {
    return this.invokeStatement("forever", ctx);
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
  private _resolveIdentifierExpression(id: string, line?: number): string {
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
      line,
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
    // Issue #872: MISRA contexts set expectedType for U suffix but suppress enum resolution
    // Bare enum resolution in function args was never allowed and requires ADR approval to change
    if (CodeGenState.suppressBareEnumResolution) {
      // Fall through to error handling below - don't resolve bare enums
    } else if (
      // Type-aware resolution: check only the expected enum type
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
   * Uses extracted literal generator
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
    // MISRA 10.3: Cast limit macros to target type (they have type 'int')
    const finalCast = CppModeHelper.cast(targetType, `(${expr})`);
    const castMax = CppModeHelper.cast(targetType, maxValue);
    const castMin = CppModeHelper.cast(targetType, minValue);
    return `((${expr}) > ${maxComparison} ? ${castMax} : (${expr}) < ${minComparison} ? ${castMin} : ${finalCast})`;
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
   * True when the text contains an identifier followed by `(`, as
   * /[a-zA-Z_]\w*\s*\(/ did -- scanned rather than matched, because that
   * pattern retries \w* from every position when no `(` follows (S8786).
   *
   * The match may begin anywhere inside a word run, so the run before the
   * parenthesis needs only to contain one letter or underscore: "9a8(" matches
   * (starting at 'a') while "99(" does not.
   */
  private static _hasIdentifierBeforeParen(text: string): boolean {
    for (let index = 0; index < text.length; index += 1) {
      if (text[index] !== "(") {
        continue;
      }
      let cursor = index - 1;
      while (cursor >= 0 && /\s/.test(text[cursor])) {
        cursor -= 1;
      }
      let sawIdentifierStart = false;
      while (cursor >= 0 && /\w/.test(text[cursor])) {
        if (/[a-zA-Z_]/.test(text[cursor])) {
          sawIdentifierStart = true;
        }
        cursor -= 1;
      }
      if (sawIdentifierStart) {
        return true;
      }
    }
    return false;
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
    if (CodeGenerator._hasIdentifierBeforeParen(text)) {
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
   * Delegates to HelperGenerator
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
      // Internal helper-op key, not a scope-qualified C name
      CodeGenState.usedClampOps.add(`${operation}_${cnxType}`);
    }
  }

  // ========================================================================
  // Preprocessor Directive Handling (ADR-037)
  // ========================================================================

  /**
   * Process a preprocessor directive
   * Delegates to IncludeGenerator
   */
  private processPreprocessorDirective(
    ctx: Parser.PreprocessorDirectiveContext,
  ): string | null {
    return includeProcessPreprocessorDirective(ctx);
  }

  // ========================================================================
  // Comment Handling (ADR-043)
  // Delegates to CommentUtils
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
   * Delegates to HelperGenerator
   */
  private generateSafeDivHelpers(): string[] {
    return helperGenerateSafeDivHelpers(CodeGenState.usedSafeDivOps);
  }
}
