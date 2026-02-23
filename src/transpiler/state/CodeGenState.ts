/**
 * CodeGenState - Global state for code generation
 *
 * Centralizes all code generation state in a single static class.
 * Eliminates dependency injection complexity and makes debugging easier.
 *
 * Usage:
 *   import CodeGenState from "../state/CodeGenState";
 *   const type = CodeGenState.typeRegistry.get(name);
 *   if (CodeGenState.isKnownStruct(name)) { ... }
 *
 * Lifecycle:
 *   1. CodeGenerator.generate() calls CodeGenState.reset()
 *   2. CodeGenerator sets CodeGenState.generator = this
 *   3. All generators/helpers read from CodeGenState directly
 *   4. State persists for the duration of one generate() call
 *
 * SymbolTable ownership:
 *   CodeGenState owns the single SymbolTable instance. It persists across
 *   reset() calls (which are per-file). The Transpiler clears it via
 *   CodeGenState.symbolTable.clear() at the start of each run().
 */

import SymbolTable from "../logic/symbols/SymbolTable";
import ICodeGenSymbols from "../types/ICodeGenSymbols";
import TTypeInfo from "../output/codegen/types/TTypeInfo";
import TParameterInfo from "../output/codegen/types/TParameterInfo";
import IFunctionSignature from "../output/codegen/types/IFunctionSignature";
import ICallbackTypeInfo from "../output/codegen/types/ICallbackTypeInfo";
import ITargetCapabilities from "../output/codegen/types/ITargetCapabilities";
import TOverflowBehavior from "../output/codegen/types/TOverflowBehavior";
import TYPE_WIDTH from "../output/codegen/types/TYPE_WIDTH";
import TypeResolver from "../../utils/TypeResolver";

/**
 * Default target capabilities (safe fallback)
 */
const DEFAULT_TARGET: ITargetCapabilities = {
  wordSize: 32,
  hasLdrexStrex: false,
  hasBasepri: false,
};

/**
 * Assignment context for overflow behavior tracking (ADR-044)
 */
interface IAssignmentContext {
  targetName: string | null;
  targetType: string | null;
  overflowBehavior: TOverflowBehavior;
}

/**
 * Function call graph entry for transitive modification analysis
 */
interface ICallGraphEntry {
  callee: string;
  paramIndex: number;
  argParamName: string;
}

/**
 * Global state for code generation.
 * All fields are static - import and use directly from any module.
 *
 * NOTE: All static properties are intentionally mutable (not readonly).
 * This class holds session state that is reset via reset() and modified
 * during code generation.
 */
export default class CodeGenState {
  // ===========================================================================
  // GENERATOR REFERENCE (for handler access)
  // ===========================================================================

  /**
   * Reference to the CodeGenerator instance for handlers to call methods.
   * Typed as unknown to avoid circular dependencies - handlers cast as needed.
   */
  static generator: unknown = null;

  // ===========================================================================
  // SYMBOL DATA (read-only after initialization)
  // ===========================================================================

  /** ADR-055: Pre-collected symbol info from CNextResolver + TSymbolInfoAdapter */
  static symbols: ICodeGenSymbols | null = null;

  /** External symbol table for cross-language interop (C headers).
   * Owned by CodeGenState; persists across per-file reset() calls.
   * Cleared via symbolTable.clear() at the start of each Transpiler run.
   */
  static symbolTable: SymbolTable = new SymbolTable();

  /**
   * External struct fields from C/C++ headers for initialization analysis.
   * Maps struct name -> Set of non-array field names.
   * Persists across per-file reset() calls, cleared at start of run.
   */
  static externalStructFields: Map<string, Set<string>> = new Map();

  // ===========================================================================
  // TYPE TRACKING
  // ===========================================================================

  /**
   * Track variable types for bit access, .length, and type inference.
   * PRIVATE: Use getVariableTypeInfo()/setVariableTypeInfo() instead.
   * This ensures cross-file variables from SymbolTable are also found.
   */
  private static typeRegistry: Map<string, TTypeInfo> = new Map();

  /** Bug #8: Compile-time const values for array size resolution */
  static constValues: Map<string, number> = new Map();

  // ===========================================================================
  // FUNCTION & CALLBACK TRACKING
  // ===========================================================================

  /** Track C-Next defined functions */
  static knownFunctions: Set<string> = new Set();

  /** ADR-013: Track function parameter const-ness for call-site validation */
  static functionSignatures: Map<string, IFunctionSignature> = new Map();

  /** ADR-029: Callback types registry (function-as-type pattern) */
  static callbackTypes: Map<string, ICallbackTypeInfo> = new Map();

  /** Callback field types: "Struct.field" -> callbackTypeName */
  static callbackFieldTypes: Map<string, string> = new Map();

  /**
   * Functions that are assigned to C callback typedefs.
   * Maps function name -> typedef name (e.g., "my_flush" -> "flush_cb_t")
   * Issue #895: We need the typedef name to look up parameter types.
   */
  static callbackCompatibleFunctions: Map<string, string> = new Map();

  // ===========================================================================
  // PASS-BY-VALUE ANALYSIS (Issue #269)
  // ===========================================================================

  /** Tracks which parameters are modified (directly or transitively) */
  static modifiedParameters: Map<string, Set<string>> = new Map();

  /** Issue #579: Parameters with subscript access (must become pointers) */
  static subscriptAccessedParameters: Map<string, Set<string>> = new Map();

  /** Parameters that should pass by value (small, unmodified primitives) */
  static passByValueParams: Map<string, Set<string>> = new Map();

  /** Function call relationships for transitive modification analysis */
  static functionCallGraph: Map<string, ICallGraphEntry[]> = new Map();

  /** Function parameter lists for call graph analysis */
  static functionParamLists: Map<string, string[]> = new Map();

  /** Issue #558: Cross-file modifications to inject */
  static pendingCrossFileModifications: ReadonlyMap<
    string,
    ReadonlySet<string>
  > | null = null;

  /** Issue #558: Cross-file parameter lists to inject */
  static pendingCrossFileParamLists: ReadonlyMap<
    string,
    readonly string[]
  > | null = null;

  // ===========================================================================
  // OVERFLOW & DIVISION HELPERS (ADR-044, ADR-051)
  // ===========================================================================

  /** Track which overflow helper types/operations are needed: "add_u8", etc. */
  static usedClampOps: Set<string> = new Set();

  /** Track which safe division helpers are needed: "div_u32", "mod_i16" */
  static usedSafeDivOps: Set<string> = new Set();

  // ===========================================================================
  // CURRENT CONTEXT (changes during AST traversal)
  // ===========================================================================

  /** ADR-016: Current scope for name resolution */
  static currentScope: string | null = null;

  /** Issue #269: Current function for modification tracking */
  static currentFunctionName: string | null = null;

  /** Issue #477: Current function return type for enum inference */
  static currentFunctionReturnType: string | null = null;

  /** ADR-006: Current function parameters for pointer semantics */
  static currentParameters: Map<string, TParameterInfo> = new Map();

  /** ADR-016: Local variables in current function (allowed as bare identifiers) */
  static localVariables: Set<string> = new Set();

  /** ADR-006: Local array variables (no & needed when passing) */
  static localArrays: Set<string> = new Set();

  /** Scope member names: scope -> Set of member names */
  private static scopeMembers: Map<string, Set<string>> = new Map();

  /** Float bit indexing: declared shadow variables */
  static floatBitShadows: Set<string> = new Set();

  /** Float bit indexing: shadows with current value (skip redundant reads) */
  static floatShadowCurrent: Set<string> = new Set();

  // ===========================================================================
  // GENERATION STATE
  // ===========================================================================

  /** Current indentation level */
  static indentLevel: number = 0;

  /** Whether we're inside a function body */
  static inFunctionBody: boolean = false;

  /** Expected type for struct initializers and enum inference */
  static expectedType: string | null = null;

  /**
   * Suppress bare enum resolution even when expectedType is set.
   * Issue #872: MISRA 7.2 requires expectedType for U suffix on function args,
   * but bare enum resolution in function args was never allowed and changing
   * that would require ADR approval.
   */
  static suppressBareEnumResolution: boolean = false;

  /** Track args parameter name for main() translation */
  static mainArgsName: string | null = null;

  /** ADR-044: Current assignment context for overflow behavior */
  static assignmentContext: IAssignmentContext = {
    targetName: null,
    targetType: null,
    overflowBehavior: "clamp",
  };

  /** ADR-035: Element count for array size inference */
  static lastArrayInitCount: number = 0;

  /** ADR-035: Fill-all value for array initialization */
  static lastArrayFillValue: string | undefined = undefined;

  /** strlen optimization: variable name -> temp variable name */
  static lengthCache: Map<string, string> | null = null;

  /** ADR-049: Target platform capabilities */
  static targetCapabilities: ITargetCapabilities = DEFAULT_TARGET;

  // ===========================================================================
  // INCLUDE FLAGS (track required standard library includes)
  // ===========================================================================

  /** For u8, u16, u32, u64, i8, i16, i32, i64 */
  static needsStdint: boolean = false;

  /** For bool type */
  static needsStdbool: boolean = false;

  /** ADR-045: For strlen, strncpy, etc. */
  static needsString: boolean = false;

  /** For float bit indexing size verification */
  static needsFloatStaticAssert: boolean = false;

  /** ADR-040: For ISR function pointer type */
  static needsISR: boolean = false;

  /** ADR-049/050: For atomic intrinsics and critical sections */
  static needsCMSIS: boolean = false;

  /** Issue #632: For float-to-int clamp casts */
  static needsLimits: boolean = false;

  /** Issue #473: IRQ wrappers for critical sections */
  static needsIrqWrappers: boolean = false;

  // ===========================================================================
  // C++ MODE STATE (Issue #250)
  // ===========================================================================

  /** Use temp vars instead of compound literals */
  static cppMode: boolean = false;

  /** Debug mode generates panic-on-overflow helpers (ADR-044) */
  static debugMode: boolean = false;

  /** Pending temp variable declarations for C++ mode */
  static pendingTempDeclarations: string[] = [];

  /** Counter for unique temp variable names */
  static tempVarCounter: number = 0;

  /** Issue #517: Pending field assignments for C++ class struct init */
  static pendingCppClassAssignments: string[] = [];

  /** Issue #369: Whether self-include was added */
  static selfIncludeAdded: boolean = false;

  // ===========================================================================
  // SOURCE PATHS (ADR-010, Issue #349)
  // ===========================================================================

  /** Source file path for validating includes */
  static sourcePath: string | null = null;

  /** Include directories for resolving angle-bracket .cnx includes */
  static includeDirs: string[] = [];

  /** Input directories for calculating relative paths */
  static inputs: string[] = [];

  // ===========================================================================
  // LIFECYCLE METHODS
  // ===========================================================================

  /**
   * Reset all state for a fresh generation pass.
   * Called at the start of CodeGenerator.generate()
   */
  static reset(targetCapabilities?: ITargetCapabilities): void {
    // Generator reference
    this.generator = null;

    // Symbol data
    this.symbols = null;
    // Note: symbolTable is NOT reset here — it persists across per-file generates.
    // It is cleared via symbolTable.clear() at the start of each Transpiler run.

    // Type tracking
    this.typeRegistry = new Map();
    this.constValues = new Map();

    // Function & callback tracking
    this.knownFunctions = new Set();
    this.functionSignatures = new Map();
    this.callbackTypes = new Map();
    this.callbackFieldTypes = new Map();
    // Note: callbackCompatibleFunctions is NOT reset here — it's populated by
    // FunctionCallAnalyzer (which runs before CodeGenerator.generate()) and must
    // persist into code generation. It is cleared at the start of each Transpiler run.

    // Pass-by-value analysis
    this.modifiedParameters = new Map();
    this.subscriptAccessedParameters = new Map();
    this.passByValueParams = new Map();
    this.functionCallGraph = new Map();
    this.functionParamLists = new Map();
    // Note: pendingCrossFileModifications/ParamLists are set externally, not reset

    // Overflow & division helpers
    this.usedClampOps = new Set();
    this.usedSafeDivOps = new Set();

    // Current context
    this.currentScope = null;
    this.currentFunctionName = null;
    this.currentFunctionReturnType = null;
    this.currentParameters = new Map();
    this.localVariables = new Set();
    this.localArrays = new Set();
    this.scopeMembers = new Map();
    this.floatBitShadows = new Set();
    this.floatShadowCurrent = new Set();

    // Generation state
    this.indentLevel = 0;
    this.inFunctionBody = false;
    this.expectedType = null;
    this.suppressBareEnumResolution = false;
    this.mainArgsName = null;
    this.assignmentContext = {
      targetName: null,
      targetType: null,
      overflowBehavior: "clamp",
    };
    this.lastArrayInitCount = 0;
    this.lastArrayFillValue = undefined;
    this.lengthCache = null;
    this.targetCapabilities = targetCapabilities ?? DEFAULT_TARGET;

    // Include flags
    this.needsStdint = false;
    this.needsStdbool = false;
    this.needsString = false;
    this.needsFloatStaticAssert = false;
    this.needsISR = false;
    this.needsCMSIS = false;
    this.needsLimits = false;
    this.needsIrqWrappers = false;

    // C++ mode state
    this.cppMode = false;
    this.debugMode = false;
    this.pendingTempDeclarations = [];
    this.tempVarCounter = 0;
    this.pendingCppClassAssignments = [];
    this.selfIncludeAdded = false;

    // Source paths
    this.sourcePath = null;
    this.includeDirs = [];
    this.inputs = [];
  }

  /**
   * Enter a function body context.
   * Clears local tracking and sets inFunctionBody flag.
   */
  static enterFunctionBody(): void {
    this.inFunctionBody = true;
    this.localVariables.clear();
    this.localArrays.clear();
    this.floatBitShadows.clear();
    this.floatShadowCurrent.clear();
  }

  /**
   * Exit a function body context.
   * Clears local tracking and sets inFunctionBody to false.
   */
  static exitFunctionBody(): void {
    this.inFunctionBody = false;
    this.localVariables.clear();
    this.localArrays.clear();
    this.floatBitShadows.clear();
    this.floatShadowCurrent.clear();
  }

  /**
   * Execute a function with a temporary expectedType, restoring on completion.
   * Issue #872: Extracted to eliminate duplicate save/restore pattern and add exception safety.
   *
   * @param type - The expected type to set (if falsy, no change is made)
   * @param fn - The function to execute
   * @param suppressEnumResolution - If true, suppress bare enum resolution (for MISRA-only contexts)
   * @returns The result of the function
   */
  static withExpectedType<T>(
    type: string | undefined | null,
    fn: () => T,
    suppressEnumResolution: boolean = false,
  ): T {
    if (!type) {
      return fn();
    }
    const savedType = this.expectedType;
    const savedSuppress = this.suppressBareEnumResolution;
    this.expectedType = type;
    if (suppressEnumResolution) {
      this.suppressBareEnumResolution = true;
    }
    try {
      return fn();
    } finally {
      this.expectedType = savedType;
      this.suppressBareEnumResolution = savedSuppress;
    }
  }

  // ===========================================================================
  // CONVENIENCE LOOKUP METHODS
  // ===========================================================================

  /**
   * Check if a type name is a known struct.
   * Also includes bitmaps since they're struct-like (Issue #551).
   */
  static isKnownStruct(name: string): boolean {
    if (this.symbols?.knownStructs.has(name)) return true;
    if (this.symbols?.knownBitmaps.has(name)) return true;
    if (this.symbolTable.getStructFields(name)) return true;
    return false;
  }

  /**
   * Check if a type name is a known scope.
   */
  static isKnownScope(name: string): boolean {
    return this.symbols?.knownScopes.has(name) ?? false;
  }

  /**
   * Check if a type name is a known enum.
   */
  static isKnownEnum(name: string): boolean {
    return this.symbols?.knownEnums.has(name) ?? false;
  }

  /**
   * Check if a type name is a known bitmap.
   */
  static isKnownBitmap(name: string): boolean {
    return this.symbols?.knownBitmaps.has(name) ?? false;
  }

  /**
   * Check if a type name is a known register.
   */
  static isKnownRegister(name: string): boolean {
    return this.symbols?.knownRegisters.has(name) ?? false;
  }

  /**
   * Get type info for a variable.
   * Checks local typeRegistry first, then falls back to SymbolTable
   * for cross-file variables from included .cnx files.
   *
   * Issue #786: This unified lookup ensures cross-file variables
   * (defined in included files) are found even before code generation
   * registers them locally.
   */
  static getVariableTypeInfo(name: string): TTypeInfo | undefined {
    // First check the local type registry (current file's variables)
    const localInfo = this.typeRegistry.get(name);
    if (localInfo) {
      return localInfo;
    }

    // ADR-055 Phase 7: Fall back to SymbolTable for cross-file C-Next variables only.
    // C/C++ header symbols don't have complete type info (e.g., isArray),
    // so we only use C-Next TSymbols from SymbolTable.
    const symbol = this.symbolTable.getTSymbol(name);
    if (symbol?.kind === "variable" && symbol.type) {
      return this.convertTSymbolToTypeInfo(symbol);
    }

    return undefined;
  }

  /**
   * Legacy alias for getVariableTypeInfo.
   * @deprecated Use getVariableTypeInfo() instead
   */
  static getTypeInfo(name: string): TTypeInfo | undefined {
    return this.getVariableTypeInfo(name);
  }

  /**
   * Check if a variable type is registered (locally or in SymbolTable).
   * ADR-055 Phase 7: Uses getTSymbol for typed symbol lookup.
   */
  static hasVariableTypeInfo(name: string): boolean {
    if (this.typeRegistry.has(name)) {
      return true;
    }
    const symbol = this.symbolTable.getTSymbol(name);
    return symbol?.kind === "variable" && symbol.type !== undefined;
  }

  /**
   * Set variable type info in the local registry.
   */
  static setVariableTypeInfo(name: string, info: TTypeInfo): void {
    this.typeRegistry.set(name, info);
  }

  /**
   * Delete variable type info from the local registry.
   */
  static deleteVariableTypeInfo(name: string): void {
    this.typeRegistry.delete(name);
  }

  /**
   * Get a read-only view of the local type registry.
   * Used for passing to helper functions that need to iterate over types.
   * Note: This only returns locally registered types, not cross-file symbols.
   */
  static getTypeRegistryView(): ReadonlyMap<string, TTypeInfo> {
    return this.typeRegistry;
  }

  /**
   * Convert a TSymbol IVariableSymbol to TTypeInfo for unified type lookups.
   * ADR-055 Phase 7: Works with typed TSymbol instead of ISymbol.
   */
  private static convertTSymbolToTypeInfo(
    symbol: import("../types/symbols/IVariableSymbol").default,
  ): TTypeInfo {
    const typeName = TypeResolver.getTypeName(symbol.type);

    // Parse string capacity using regex
    const stringPattern = /^string<(\d+)>$/;
    const stringMatch = stringPattern.exec(typeName);
    const isString = stringMatch !== null;
    const stringCapacity = stringMatch
      ? Number.parseInt(stringMatch[1], 10)
      : undefined;
    // Use char for string types to match local convention
    const baseType = isString ? "char" : typeName;

    const isEnum = this.isKnownEnum(baseType);

    return {
      baseType,
      bitWidth: isString ? 8 : TYPE_WIDTH[baseType] || 0,
      isArray: symbol.isArray || false,
      arrayDimensions: symbol.arrayDimensions
        ?.map((d) => (typeof d === "number" ? d : Number.parseInt(d, 10)))
        .filter((n) => !Number.isNaN(n)),
      isConst: symbol.isConst || false,
      isAtomic: symbol.isAtomic || false,
      isEnum,
      enumTypeName: isEnum ? baseType : undefined,
      isString,
      stringCapacity,
    };
  }

  /**
   * Check if a parameter in a function is modified.
   */
  static isParameterModified(funcName: string, paramName: string): boolean {
    return this.modifiedParameters.get(funcName)?.has(paramName) ?? false;
  }

  /**
   * Compute unmodified parameters for all functions on-demand.
   * Returns a map of function name -> Set of parameter names NOT modified.
   * Computed from functionSignatures and modifiedParameters (no cached state).
   */
  static getUnmodifiedParameters(): Map<string, Set<string>> {
    const result = new Map<string, Set<string>>();
    for (const [funcName, signature] of this.functionSignatures) {
      const modifiedSet = this.modifiedParameters.get(funcName);
      const unmodified = new Set<string>();
      for (const param of signature.parameters) {
        if (!modifiedSet?.has(param.name)) {
          unmodified.add(param.name);
        }
      }
      result.set(funcName, unmodified);
    }
    return result;
  }

  /**
   * Check if a parameter should pass by value.
   */
  static isPassByValue(funcName: string, paramName: string): boolean {
    return this.passByValueParams.get(funcName)?.has(paramName) ?? false;
  }

  /**
   * Check if a parameter has subscript access.
   */
  static hasSubscriptAccess(funcName: string, paramName: string): boolean {
    return (
      this.subscriptAccessedParameters.get(funcName)?.has(paramName) ?? false
    );
  }

  /**
   * Get the function signature for a function.
   */
  static getFunctionSignature(name: string): IFunctionSignature | undefined {
    return this.functionSignatures.get(name);
  }

  /**
   * Get callback type info for a function name.
   */
  static getCallbackType(name: string): ICallbackTypeInfo | undefined {
    return this.callbackTypes.get(name);
  }

  /**
   * Issue #895: Get the typedef type string for a C typedef by name.
   * Used to look up function pointer typedef signatures for callback-compatible functions.
   *
   * @param typedefName - Name of the typedef (e.g., "flush_cb_t")
   * @returns The type string (e.g., "void (*)(widget_t *, const rect_t *, uint8_t *)") or undefined
   */
  static getTypedefType(typedefName: string): string | undefined {
    const symbol = this.symbolTable.getCSymbol(typedefName);
    if (symbol?.kind === "type") {
      return symbol.type;
    }
    return undefined;
  }

  /**
   * Check if a type name is a known C-Next function.
   */
  static isCNextFunction(name: string): boolean {
    return this.knownFunctions.has(name);
  }

  /**
   * Check if a name is a compile-time const value.
   */
  static isConstValue(name: string): boolean {
    return this.constValues.has(name);
  }

  /**
   * Get the compile-time value of a const.
   */
  static getConstValue(name: string): number | undefined {
    return this.constValues.get(name);
  }

  /**
   * Get parameter info from current function context.
   */
  static getParameterInfo(name: string): TParameterInfo | undefined {
    return this.currentParameters.get(name);
  }

  /**
   * Check if a name is a local variable.
   */
  static isLocalVariable(name: string): boolean {
    return this.localVariables.has(name);
  }

  /**
   * Check if a name is a local array.
   */
  static isLocalArray(name: string): boolean {
    return this.localArrays.has(name);
  }

  /**
   * Get members of a scope.
   */
  static getScopeMembers(scopeName: string): Set<string> | undefined {
    return this.scopeMembers.get(scopeName);
  }

  /**
   * Set members of a scope.
   */
  static setScopeMembers(scopeName: string, members: Set<string>): void {
    this.scopeMembers.set(scopeName, members);
  }

  /**
   * Get all scope members (for IGeneratorState).
   */
  static getAllScopeMembers(): ReadonlyMap<string, ReadonlySet<string>> {
    return this.scopeMembers;
  }

  /**
   * Check if an identifier is a member of the current scope.
   */
  static isCurrentScopeMember(identifier: string): boolean {
    if (!this.currentScope) return false;
    return this.scopeMembers.get(this.currentScope)?.has(identifier) ?? false;
  }

  /**
   * Resolve an identifier to its fully-scoped name.
   * Inside a scope, checks if the identifier is a scope member first.
   */
  static resolveIdentifier(identifier: string): string {
    if (this.currentScope) {
      const members = this.scopeMembers.get(this.currentScope);
      if (members?.has(identifier)) {
        return `${this.currentScope}_${identifier}`;
      }
    }
    return identifier;
  }

  /**
   * Get struct field type (simple lookup).
   */
  static getStructFieldType(
    structName: string,
    fieldName: string,
  ): string | undefined {
    return this.symbols?.structFields.get(structName)?.get(fieldName);
  }

  /**
   * Get struct field info including dimensions (checks SymbolTable then local symbols).
   */
  static getStructFieldInfo(
    structType: string,
    fieldName: string,
  ): { type: string; dimensions?: (number | string)[] } | null {
    // First check SymbolTable (C header structs)
    const fieldInfo = this.symbolTable.getStructFieldInfo(
      structType,
      fieldName,
    );
    if (fieldInfo) {
      return {
        type: fieldInfo.type,
        dimensions: fieldInfo.arrayDimensions,
      };
    }

    // Fall back to local C-Next struct fields
    const localFields = this.symbols?.structFields.get(structType);
    if (localFields) {
      const fieldType = localFields.get(fieldName);
      if (fieldType) {
        const fieldDimensions =
          this.symbols?.structFieldDimensions.get(structType);
        const dimensions = fieldDimensions?.get(fieldName);
        return {
          type: fieldType,
          dimensions: dimensions ? [...dimensions] : undefined,
        };
      }
    }

    return null;
  }

  /**
   * Get member type info for a struct field.
   * Returns full TTypeInfo for the field, or null if not found.
   */
  static getMemberTypeInfo(
    structType: string,
    memberName: string,
  ): TTypeInfo | null {
    const fieldInfo = this.getStructFieldInfo(structType, memberName);
    if (!fieldInfo) return null;

    const isArray =
      (fieldInfo.dimensions !== undefined && fieldInfo.dimensions.length > 0) ||
      (this.symbols?.structFieldArrays.get(structType)?.has(memberName) ??
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
   * Check if a struct field is an array.
   */
  static isStructFieldArray(structName: string, fieldName: string): boolean {
    return (
      this.symbols?.structFieldArrays.get(structName)?.has(fieldName) ?? false
    );
  }

  /**
   * Get enum members for an enum.
   */
  static getEnumMembers(
    enumName: string,
  ): ReadonlyMap<string, number> | undefined {
    return this.symbols?.enumMembers.get(enumName);
  }

  /**
   * Build external struct fields from the symbol table.
   * Called once per run after all headers are processed.
   * Issue #355: Excludes array fields from init checking.
   */
  static buildExternalStructFields(): void {
    this.externalStructFields.clear();
    const allStructFields = this.symbolTable.getAllStructFields();

    for (const [structName, fieldMap] of allStructFields) {
      const nonArrayFields = new Set<string>();
      for (const [fieldName, fieldInfo] of fieldMap) {
        // Only include non-array fields in init checking
        if (
          !fieldInfo.arrayDimensions ||
          fieldInfo.arrayDimensions.length === 0
        ) {
          nonArrayFields.add(fieldName);
        }
      }
      if (nonArrayFields.size > 0) {
        this.externalStructFields.set(structName, nonArrayFields);
      }
    }
  }

  /**
   * Get external struct fields for initialization analysis.
   */
  static getExternalStructFields(): Map<string, Set<string>> {
    return this.externalStructFields;
  }

  /**
   * Get function return type.
   */
  static getFunctionReturnType(funcName: string): string | undefined {
    return this.symbols?.functionReturnTypes.get(funcName);
  }

  // ===========================================================================
  // INCLUDE FLAG HELPERS
  // ===========================================================================

  /**
   * Mark that stdint.h is needed.
   */
  static requireStdint(): void {
    this.needsStdint = true;
  }

  /**
   * Mark that stdbool.h is needed.
   */
  static requireStdbool(): void {
    this.needsStdbool = true;
  }

  /**
   * Mark that string.h is needed.
   */
  static requireString(): void {
    this.needsString = true;
  }

  /**
   * Mark that CMSIS headers are needed.
   */
  static requireCMSIS(): void {
    this.needsCMSIS = true;
  }

  /**
   * Mark that limits.h is needed.
   */
  static requireLimits(): void {
    this.needsLimits = true;
  }

  /**
   * Mark that ISR type is needed.
   */
  static requireISR(): void {
    this.needsISR = true;
  }

  // ===========================================================================
  // TYPE REGISTRATION HELPERS
  // ===========================================================================

  /**
   * Register a variable type.
   */
  static registerType(name: string, info: TTypeInfo): void {
    this.setVariableTypeInfo(name, info);
  }

  /**
   * Register a const value.
   */
  static registerConstValue(name: string, value: number): void {
    this.constValues.set(name, value);
  }

  /**
   * Register a local variable.
   */
  static registerLocalVariable(name: string, isArray: boolean = false): void {
    this.localVariables.add(name);
    if (isArray) {
      this.localArrays.add(name);
    }
  }

  /**
   * Register a function signature.
   */
  static registerFunctionSignature(
    name: string,
    sig: IFunctionSignature,
  ): void {
    this.functionSignatures.set(name, sig);
    this.knownFunctions.add(name);
  }

  /**
   * Register a callback type.
   */
  static registerCallbackType(name: string, info: ICallbackTypeInfo): void {
    this.callbackTypes.set(name, info);
  }

  /**
   * Register a callback field type.
   */
  static registerCallbackFieldType(key: string, typeName: string): void {
    this.callbackFieldTypes.set(key, typeName);
  }

  /**
   * Mark a clamp operation as used.
   */
  static markClampOpUsed(operation: string, cnxType: string): void {
    this.usedClampOps.add(`${operation}_${cnxType}`);
  }

  /**
   * Mark a safe div operation as used.
   */
  static markSafeDivOpUsed(operation: string, cnxType: string): void {
    this.usedSafeDivOps.add(`${operation}_${cnxType}`);
  }

  // ===========================================================================
  // FLOAT BIT SHADOW HELPERS
  // ===========================================================================

  /**
   * Register a float bit shadow variable.
   */
  static registerFloatBitShadow(name: string): void {
    this.floatBitShadows.add(name);
  }

  /**
   * Check if a float bit shadow exists.
   */
  static hasFloatBitShadow(name: string): boolean {
    return this.floatBitShadows.has(name);
  }

  /**
   * Mark a float shadow as having current value.
   */
  static markFloatShadowCurrent(name: string): void {
    this.floatShadowCurrent.add(name);
  }

  /**
   * Check if a float shadow has current value.
   */
  static isFloatShadowCurrent(name: string): boolean {
    return this.floatShadowCurrent.has(name);
  }

  // ===========================================================================
  // C++ MODE HELPERS
  // ===========================================================================

  /**
   * Add a pending temp declaration for C++ mode.
   */
  static addPendingTempDeclaration(decl: string): void {
    this.pendingTempDeclarations.push(decl);
  }

  /**
   * Flush and return pending temp declarations.
   */
  static flushPendingTempDeclarations(): string[] {
    const decls = this.pendingTempDeclarations;
    this.pendingTempDeclarations = [];
    return decls;
  }

  /**
   * Get a unique temp variable name.
   */
  static getNextTempVarName(): string {
    return `_tmp${this.tempVarCounter++}`;
  }
}
