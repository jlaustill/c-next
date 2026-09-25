/**
 * C-Next Code Generator
 * Transforms C-Next AST to clean, readable C code
 */

import ReservedCnxName from "../../../utils/ReservedCnxName";

import TYPE_WIDTH from "../../../transpiler/constants/TYPE_WIDTH";
// Issue #60: BITMAP_SIZE and BITMAP_BACKING_TYPE moved to SymbolCollector
import TTypeInfo from "../../../transpiler/types/TTypeInfo";
import ExpressionTypeResolver from "../../2-Plan/ExpressionTypeResolver";
import IOrchestrator from "./generators/IOrchestrator";
import IGeneratorInput from "./generators/IGeneratorInput";
import IGeneratorState from "./generators/IGeneratorState";
import TGeneratorEffect from "./generators/TGeneratorEffect";
// Expression generators
// Statement generators
import atomicGenerators from "./generators/statements/AtomicGenerator";
// Declaration generators
// ADR-065: Extracted utilities
import BitUtils from "../../../utils/BitUtils";
import CppNamespaceUtils from "../../../utils/CppNamespaceUtils";
import FormatUtils from "../../../utils/FormatUtils";
import StringUtils from "../../../utils/StringUtils";
// Support generators
// ADR-046: which nullable C functions return a struct pointer (#1322: a
// constant lookup, not an analyzer -- see the module header)
// ADR-006: Helper for building member access chains with proper separators
// ADR-065: Assignment decomposition (Phase 2)
// IHandlerDeps removed - handlers now use CodeGenState.generator directly
// Issue #644: Extracted string length counter for strlen caching optimization
// Issue #644: C/C++ mode helper for consolidated mode-specific patterns
// Issue #644: Array dimension parsing helper for consolidation
// Issue #644: Member chain analyzer for bit access pattern detection
// Issue #644: Float bit write helper for shadow variable pattern
import FloatBitHelper from "./helpers/FloatBitHelper";
// Issue #644: String declaration helper for bounded/array/concat strings
// Note: StringDeclHelper is now used via VariableDeclHelper
// Issue #794: Argument generation helper for ADR-006 semantics
// Issue #644: Enum assignment validator for type-safe enum assignments
// Issue #644: Array initialization helper for size inference and fill-all
// Note: ArrayInitHelper is now used via VariableDeclHelper
// Issue #644: Assignment expected type resolution helper
// PR #715: C++ member conversion helper for improved testability
// PR #715: Boolean conversion helper for improved testability
import BooleanHelper from "./helpers/BooleanHelper";
// PR #715: C++ constructor detection helper for improved testability
// PR #715: Set/Map utilities for improved testability
// PR #715: Symbol lookup utilities for improved testability
import SymbolLookupHelper from "./helpers/SymbolLookupHelper";
// Issue #644: Assignment validation coordinator helper
// Issue #696: Variable modifier extraction helper
// Note: VariableModifierBuilder is now used via VariableDeclHelper
// Issue #792: Variable declaration helper
// String operation detection and extraction
// PR #681: Extracted separator and dereference resolution utilities
// SonarCloud S3776: Extracted helpers for assignment target generation
// Issue #707: Expression unwrapping utility for reducing duplication
// Stateless parser utilities extracted from CodeGenerator
// Phase 3: Type generation helper for improved testability
import type IPlannedFunctionParameter from "./types/IPlannedFunctionParameter";
// Phase 5: Cast validation helper for improved testability
// Issue #793: Function context lifecycle and parameter processing helper
import FunctionContextManager from "./helpers/FunctionContextManager";
import IFunctionContextCallbacks from "./types/IFunctionContextCallbacks";
// Global state for code generation (simplifies debugging, eliminates DI complexity)
import CodeGenState from "../../../transpiler/state/CodeGenState";
import DeclaredTypeFacts from "../../../utils/DeclaredTypeFacts";
import CallbackTypedefFormatter from "./helpers/CallbackTypedefFormatter";
// Issue #269: Pass-by-value analysis extracted from CodeGenerator
import PassByValueAnalyzer from "../../2-Plan/PassByValueAnalyzer";
// Unified parameter generation (Phase 1)
// Issue #895: Parse typedef signatures to determine pointer vs value params
// Extracted resolvers that use CodeGenState
// Issue #797: Centralized C-style name generation
import type IRecordedRequirement from "../../../transpiler/types/IRecordedRequirement";
import ToolchainRequirements from "../../../instrumentation/ToolchainRequirements";
import RenderState from "../../../transpiler/state/RenderState";

/**
 * Code Generator - Transpiles C-Next to C
 *
 * Implements IOrchestrator to support modular generator extraction.
 */
export default class CodeGenerator implements IOrchestrator {
  /**
   * 2.3 Render's per-file working state (#1452 box 4). Owned here because the
   * walker reaches this object as `this.host`, so one instance serves both
   * without a global between them.
   */
  readonly state = new RenderState();

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
      debugMode: this.state.debugMode,
    };
  }

  /**
   * Get a snapshot of the current generation state.
   * Represents where we are in the AST traversal.
   */
  getState(): IGeneratorState {
    return {
      currentScopePath: CodeGenState.currentScopePath,
      indentLevel: this.state.indentLevel,
      inFunctionBody: CodeGenState.inFunctionBody,
      currentParameters: CodeGenState.currentParameters,
      localVariables: CodeGenState.localVariables,
      localArrays: CodeGenState.localArrays,
      expectedType: CodeGenState.expectedType,
      headerOwnsTypeDefinitions:
        CodeGenState.declarationPlan().headerOwnsTypeDefinitions, // #369/#1450
      // Issue #644: Postfix expression state
      scopeMembers: CodeGenState.getAllScopeMembers(),
      mainArgsName: CodeGenState.mainArgsName,
      floatBitShadows: CodeGenState.floatBitShadows,
      floatShadowCurrent: CodeGenState.floatShadowCurrent,
      lengthCache: this.state.lengthCache,
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
          CodeGenState.requireInclude(effect.header, effect.line ?? null);
          break;
        case "isr":
          CodeGenState.requireInclude("isr");
          break;

        // Toolchain requirement effects (Issue #1143)
        case "requires":
          ToolchainRequirements.record(effect.key, [
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
          CodeGenState.requireInclude("stdbool");
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
        case "register-struct-init":
          CodeGenState.generatedStructInits.add(effect.structName);
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
    return ToolchainRequirements.collect();
  }

  /**
   * Get the current indentation string.
   */
  getIndent(): string {
    return FormatUtils.indent(this.state.indentLevel);
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

  // === Type Utilities ===

  /**
   * Check if a type name is a known struct.
   * Part of IOrchestrator interface.
   */
  isKnownStruct(typeName: string): boolean {
    return DeclaredTypeFacts.isStruct(
      CodeGenState.symbols,
      CodeGenState.symbolTable,
      typeName,
    );
  }

  /**
   * Check if a type is a float type.
   * Part of IOrchestrator interface - delegates to ExpressionTypeResolver.
   */
  isFloatType(typeName: string): boolean {
    return ExpressionTypeResolver.isFloatType(typeName);
  }

  /**
   * Check if a type is an integer type.
   * Part of IOrchestrator interface - delegates to ExpressionTypeResolver.
   */
  isIntegerType(typeName: string): boolean {
    return ExpressionTypeResolver.isIntegerType(typeName);
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

  // === Validation ===

  // === Function Call Helpers ===

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
    return FormatUtils.indentAllLines(text, this.state.indentLevel);
  }

  // === strlen Optimization ===

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
      this.state.lengthCache = cache;
      return declarations.join("\n") + "\n";
    }

    return "";
  }

  /**
   * Clear length cache.
   * Part of IOrchestrator interface.
   */
  clearLengthCache(): void {
    this.state.lengthCache = null;
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

  // #1322: the `Validation (IOrchestrator A4)` section that stood here held
  // ADR-024's `validateLiteralFitsType` and `validateTypeConversion`. Both are
  // E0868/E0869 in pass 2.1, and no generator asks the orchestrator for them.

  // === String Helpers (IOrchestrator A4) ===

  /** Get the length of a string literal */
  getStringLiteralLength(literal: string): number {
    return StringUtils.literalLength(literal);
  }

  // #1445 box 3: `getStringConcatOperands` and `getSubstringOperands` stood
  // here as public delegates to the `_`-prefixed pair below. Their only
  // reachable caller was `IOrchestrator`, and no generator ever called either
  // -- so removing the declarations left them dead, which `knip` reported
  // (#1556's `classMembers`, doing exactly what it was added for). The private
  // originals keep their in-file callers.

  // === Parameter Management (IOrchestrator A4) ===

  /** Set current function parameters */
  setParameters(parameters: readonly IPlannedFunctionParameter[] | null): void {
    FunctionContextManager.processParameterList(
      parameters,
      this._getFunctionContextCallbacks(),
    );
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
      this.state.pendingCallbackTypedefs.push(typedef);
      this.state.emittedCallbackTypedefs.add(funcName);
    }
  }

  private isCallbackTypeReferenced(funcName: string): boolean {
    return CodeGenState.callbackTypeReferences.has(funcName);
  }

  // #1322: `isCallbackTypeUsedAsFieldType` stood here, answering ADR-029's
  // nominal-typing question by scanning `CodeGenState.callbackFieldTypes`.
  // That map holds the structs emitted SO FAR in the current file, so a struct
  // declared below the assignment, in an enclosing scope, or in an include did
  // not count -- the identity of a type depending on emission order. Pass 2.1
  // asks `CodeGenState.symbols.structFields`, the per-file view, which holds
  // every struct the file can see before any code is generated.

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
  }

  /**
   * Issue #477: Get the current function's return type for enum inference.
   * Used by return statement generation to set expectedType.
   */
  getCurrentFunctionReturnType(): string | null {
    return this.state.currentFunctionReturnType;
  }

  /**
   * Issue #477: Set the current function's return type for enum inference.
   */
  setCurrentFunctionReturnType(returnType: string | null): void {
    this.state.currentFunctionReturnType = returnType;
  }

  /**
   * #1277: the four facts a function body is generated against, set and
   * cleared as one. See `IOrchestrator` for why this is a pair rather than
   * four calls repeated at each site.
   */
  enterFunctionContext(
    name: string,
    returnTypeText: string,
    parameters: readonly IPlannedFunctionParameter[] | null,
  ): void {
    this.setCurrentFunctionName(name);
    this.setCurrentFunctionReturnType(returnTypeText);
    this.setParameters(parameters);
    this.enterFunctionBody();
  }

  exitFunctionContext(): void {
    this.exitFunctionBody();
    this.setCurrentFunctionName(null);
    this.setCurrentFunctionReturnType(null);
    this.clearParameters();
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
      CodeGenState.declarationPlan().headerOwnsTypeDefinitions &&
      CodeGenState.headerOwnsCallbackTypedef(funcName)
    ) {
      return null;
    }

    // Bare, with no padding of its own: the splice in generateAllDeclarations
    // decides the blank lines around the whole block, so one place owns the
    // layout instead of each typedef guessing at it.
    return CallbackTypedefFormatter.format(
      callbackInfo.returnType,
      callbackInfo.typedefName,
      callbackInfo.parameters,
      this.isCppMode(),
    );
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

  private foldBooleanToInt(expr: string): string {
    return BooleanHelper.foldBooleanToInt(expr);
  }

  // Issue #63: validateIncludeNotImplementationFile moved to TypeValidator

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
    // #1511: the artifact's answer, so the `.h` this feeds and the `.c` this
    // class emits cannot disagree -- they now read one derivation.
    return CodeGenState.program?.passByValueParams() ?? new Map();
  }

  /**
   * Issue #322: Check if a type name is a user-defined struct
   * Part of IOrchestrator interface.
   */
  isStructType(typeName: string): boolean {
    return ExpressionTypeResolver.isStructType(typeName);
  }

  /**
   * Clear parameter tracking when leaving a function.
   * Issue #793: Delegates to FunctionContextManager.
   */
  private _clearParameters(): void {
    FunctionContextManager.clearParameters();
  }

  // ========================================================================
  // ADR-024: Type Classification and Validation Helpers
  // ========================================================================

  // NOTE: Public isIntegerType and isFloatType moved to IOrchestrator interface
  // Private versions kept for internal use

  // ========================================================================
  // Declarations
  // ========================================================================

  // ========================================================================
  // Scope (ADR-016: Organization with visibility control)
  // ========================================================================

  // ========================================================================
  // Register Bindings (ADR-004)
  // ========================================================================

  // ========================================================================
  // Struct
  // ========================================================================

  // ========================================================================
  // Enum (ADR-017: Type-safe enums)
  // ========================================================================

  // ========================================================================
  // Functions
  // ========================================================================

  /**
   * Issue #793: Create callbacks for FunctionContextManager.
   */
  private _getFunctionContextCallbacks(): IFunctionContextCallbacks {
    return {
      isStructType: (typeName: string) => this.isStructType(typeName),
      isTypedefStructType: (t: string) =>
        CodeGenState.symbolTable?.isTypedefStructType(t) ?? false,
    };
  }

  // ========================================================================
  // Variables
  // ========================================================================

  // ========================================================================
  // Variable declaration planning (#1445 box 3)
  // ========================================================================

  // Issue #792 extracted a batch of variable-declaration methods to
  // `VariableDeclHelper`. #1445 box 3 split that batch again, by what each one
  // does: the tree-reading half came back as the `plan*` methods above and the
  // rendering half stayed there.
  //
  // The list this comment used to enumerate named nine methods, one of which
  // (`_validateArrayDeclarationSyntax`) had not existed since its rejection
  // moved to 2.1 as E0874. A list of names is wrong the moment anything moves,
  // and nothing checks it -- which is why it is a sentence now.

  /**
   * Brace initializer that zero-initializes an aggregate (struct or array).
   * Issue #379 / #1004: C++ uses value-initialization ({}), which is valid for
   * any aggregate element type (POD, struct, class) including enum-first
   * structs where {0} is an invalid int->enum narrowing; C uses {0}.
   */
  getAggregateZeroInitBrace(): string {
    return CodeGenState.cppMode ? "{}" : "{0}";
  }

  /**
   * Generate float bit write using shadow variable + memcpy.
   * Issue #644: Delegates to FloatBitHelper.
   */
  /** Public for handler access via CodeGenState.generator */
  /**
   * Dispatched through `ICodeGenApi` via `CodeGenState.requireGenerator()`, so
   * no call site ever names this class. knip cannot follow that indirection.
   *
   * @public
   */
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
        requireInclude: (header) => CodeGenState.requireInclude(header),
      },
    );
  }

  // ADR-001: <- becomes = in C, with compound assignment operators
  /**
   * ADR-049: Generate atomic Read-Modify-Write operation
   * Uses LDREX/STREX on platforms that support it, otherwise PRIMASK
   */
  /** Public for handler access via CodeGenState.generator */
  /**
   * Dispatched through `ICodeGenApi` via `CodeGenState.requireGenerator()`, so
   * no call site ever names this class. knip cannot follow that indirection.
   *
   * @public
   */
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

  // #1322: ADR-016's access rules are E0435-E0437 in pass 2.1; `ScopeResolver`
  // is gone with them.

  // Issue #387: Dead methods removed (generateGlobalMemberAccess, generateGlobalArrayAccess,
  // generateThisMemberAccess, generateThisArrayAccess) - now handled by unified doGenerateAssignmentTarget

  // ========================================================================
  // ADR-025/027/036/068 control-flow planning (#1445 box 3)
  // ========================================================================

  // ========================================================================
  // Critical Statements (ADR-050)
  // ========================================================================

  // Issue #63: validateNoEarlyExits moved to TypeValidator

  // ========================================================================
  // Switch Statements (ADR-025)
  // ========================================================================

  // ========================================================================
  // Expressions
  // ========================================================================

  // #1322: the shift-amount check (MISRA 12.2, E0873) that Issue #63 moved
  // to TypeValidator is in pass 2.1, with the additive-type helpers that
  // existed only to feed it.

  // NOTE: generateMemberAccess and generateArrayAccess removed in grammar consolidation
  // These methods referenced MemberAccessContext and ArrayAccessContext which no longer
  // exist after unifying to assignmentTarget: IDENTIFIER postfixTargetOp*

  // ========================================================================
  // strlen Optimization - Cache repeated .length accesses
  // Issue #644: Walker methods extracted to StringLengthCounter class
  // ========================================================================

  // ========================================================================
  // Preprocessor Directive Handling (ADR-037)
  // ========================================================================

  // ========================================================================
  // Comment Handling (ADR-043)
  // Delegates to CommentUtils
  // ========================================================================
}
