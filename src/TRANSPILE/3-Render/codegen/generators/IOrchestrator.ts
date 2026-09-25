/**
 * Interface that CodeGenerator implements to orchestrate generators.
 *
 * Provides:
 * - Access to read-only input and current state
 * - Effect processing to update mutable state
 * - Utility methods needed by generators
 * - Code generation delegation methods
 *
 * This abstraction enables:
 * - Testing generators with mock orchestrators
 * - Gradual migration via "strangler fig" pattern
 */
import type IPlannedFunctionParameter from "../types/IPlannedFunctionParameter";
import IGeneratorInput from "./IGeneratorInput";
import IGeneratorState from "./IGeneratorState";
import TGeneratorEffect from "./TGeneratorEffect";
import TTypeInfo from "../../../../transpiler/types/TTypeInfo";
import type RenderState from "../../../../transpiler/state/RenderState";

interface IOrchestrator {
  /**
   * 2.3 Render's per-file working state (#1452 box 4).
   *
   * A generator that already receives its orchestrator reads state from it
   * rather than from a static class -- which also keeps the generator
   * testable without installing a global, as `CastExprGenerator`'s unit tests
   * demonstrated when the ambient route was tried there first.
   */
  readonly state: RenderState;

  // === State Access ===

  /** Get the immutable input context */
  getInput(): IGeneratorInput;

  /** Get a snapshot of the current generation state */
  getState(): IGeneratorState;

  // === Effect Processing ===

  /** Process effects returned by a generator, updating internal state */
  applyEffects(effects: readonly TGeneratorEffect[]): void;

  // === Utilities ===

  /** Get the current indentation string */
  getIndent(): string;

  /** Resolve an identifier to its fully-scoped name */
  resolveIdentifier(name: string): string;

  // === Expression Generation ===
  // These methods allow extracted generators to call back into CodeGenerator
  // for parts not yet extracted, enabling incremental "strangler fig" migration.

  // === Type Utilities ===

  /** Check if a type name is a known struct */
  isKnownStruct(typeName: string): boolean;

  /** Check if a type is a float type (f32, f64, float, double) */
  isFloatType(typeName: string): boolean;

  /** Check if a type is an integer type */
  isIntegerType(typeName: string): boolean;

  /** Check if a function is defined in C-Next (vs C headers) */
  isCNextFunction(name: string): boolean;

  /** Issue #322: Check if a type is a struct type */
  isStructType(typeName: string): boolean;

  /**
   * Brace that zero-initializes a whole aggregate -- `{}` in C++, `{0}` in C.
   * #1568: the ADR-029 init function needs it for the struct as a whole, and
   * this is the one place that decision is made.
   */
  getAggregateZeroInitBrace(): string;

  // === Expression Analysis ===

  // === Function Call Helpers ===

  /** Get known enums set for pass-by-value detection */
  getKnownEnums(): ReadonlySet<string>;

  /** Issue #304: Check if we're generating C++ output */
  isCppMode(): boolean;

  /** Issue #304: Check if a type is a C++ enum class (needs :: syntax and explicit casts) */
  isCppEnumClass(typeName: string): boolean;

  /** Issue #269: Check if a parameter is pass-by-value (small unmodified primitive) */
  isParameterPassByValue(funcName: string, paramIndex: number): boolean;

  // === Statement Generation ===

  /**
   * Issue #250: Flush pending temp variable declarations.
   * Returns declarations as a single string and clears the pending list.
   * Used by control flow generators to capture temps from conditions
   * before generating loop/if bodies.
   */
  flushPendingTempDeclarations(): string;

  /** Get indentation string for current level */
  indent(text: string): string;

  // === Control Flow Helpers ===

  // === strlen Optimization ===

  // #1445 box 3: the two counting members that stood here --
  // `countStringLengthAccesses(ExpressionContext)` and
  // `countBlockLengthAccesses(BlockContext, ...)` -- were named by this
  // interface only so `ControlFlowGenerator` could ask a tree a question. It
  // plans now, and the planner calls `StringLengthCounter` directly, so two of
  // this interface's parse-typed members are gone with them.

  /** Setup length cache and return declarations */
  setupLengthCache(counts: Map<string, number>): string;

  /** Clear length cache */
  clearLengthCache(): void;

  /** Register a local variable */
  /**
   * Register a local and get back the C identifier it must be emitted under.
   *
   * ADR-057: a local that shadows a file-scope name is emitted under a distinct
   * name so `global.x` still reaches past it. Returning it keeps generators out
   * of CodeGenState -- the caller cannot forget to ask, because the name it
   * needs is the return value.
   */
  registerLocalVariable(name: string): string;

  // === Declaration Generation ===

  /** Get the length of a string literal (excluding quotes and null terminator) */
  getStringLiteralLength(literal: string): number;

  // === Parameter Management ===

  /** Set current function parameters for pointer semantics (ADR-006) */
  setParameters(parameters: readonly IPlannedFunctionParameter[] | null): void;

  /** Clear current function parameters */
  clearParameters(): void;

  /**
   * Issue #1200: the `_fp` typedef name for a callback type, or null if the
   * name is not one. Exposed so renderers do not re-derive the `${name}_fp`
   * convention that registerCallbackType owns.
   */
  getCallbackTypedefName(typeName: string): string | null;

  /**
   * ADR-029 / Issues #1201, #1212: record that this function needs a callback
   * `_fp` typedef, if it does. Callers state that a function was emitted; where
   * the typedef goes and whether it is needed belong to the implementation.
   */
  recordCallbackTypedef(funcName: string): void;

  // === Scope Management ===

  /** Set the current scope name for prefixing */
  setCurrentScope(name: string | null): void;

  /** Issue #269: Set the current function name for pass-by-value lookup */
  setCurrentFunctionName(name: string | null): void;

  /** Issue #477: Get the current function's return type for enum inference */
  getCurrentFunctionReturnType(): string | null;

  /** Issue #477: Set the current function's return type for enum inference */
  setCurrentFunctionReturnType(returnType: string | null): void;

  /**
   * #1277: enter/leave the context a function body is generated in -- its
   * name, its declared return type, and its parameters.
   *
   * One pair rather than four calls at each site. `FunctionGenerator` and
   * `ScopeGenerator` each open-coded the same four steps in the same order,
   * and the scope copy was missing `setCurrentFunctionReturnType`, so no
   * `return` inside a scope method knew what type it returned: a bare enum
   * member could not resolve there and a struct literal could not be typed.
   * A fifth fact is now one edit, not two that have to be remembered together.
   */
  enterFunctionContext(
    name: string,
    returnTypeText: string,
    parameters: readonly IPlannedFunctionParameter[] | null,
  ): void;

  exitFunctionContext(): void;

  // === Function Body Management ===

  /** Enter function body - clears local variables and sets inFunctionBody flag */
  enterFunctionBody(): void;

  /** Exit function body - clears local variables and inFunctionBody flag */
  exitFunctionBody(): void;

  /** Generate callback typedef for a function */

  /**
   * Issue #268: Update symbol parameters with auto-const info based on modification tracking.
   * Call this after generating function body but before clearing modifiedParameters.
   */
  updateFunctionParamsAutoConst(functionName: string): void;

  /**
   * Issue #268: Mark a parameter as modified for auto-const tracking.
   * Used when a parameter is passed to a function that modifies its corresponding parameter.
   */
  markParameterModified(paramName: string): void;

  /**
   * Issue #268: Check if a callee function's parameter at given index is modified.
   * Returns true if the callee modifies that parameter (should not have const).
   * Returns false if unmodified or unknown (callee not yet processed).
   */
  isCalleeParameterModified(funcName: string, paramIndex: number): boolean;

  /**
   * Issue #268: Check if a name is a parameter of the current function.
   */
  isCurrentParameter(name: string): boolean;

  // === Postfix Expression Helpers (Issue #644) ===

  /** Check if a name is a known scope */
  isKnownScope(name: string): boolean;

  /** Check if a symbol is a C++ scope symbol (namespace, class, enum) */
  isCppScopeSymbol(name: string): boolean;

  /** Get the separator for scope access (:: for C++, _ for C-Next) */
  getScopeSeparator(isCppAccess: boolean): string;

  /** Get struct field info for .length calculations */
  getStructFieldInfo(
    structType: string,
    fieldName: string,
  ): { type: string; dimensions?: (number | string)[] } | null;

  /** Get member type info for struct access chains */
  getMemberTypeInfo(structType: string, memberName: string): TTypeInfo | null;

  /** Generate a bit mask for bit range access */
  generateBitMask(width: string, is64Bit?: boolean): string;

  /** Add a pending temp variable declaration (for float bit indexing) */
  addPendingTempDeclaration(declaration: string): void;

  /** Register a float bit shadow variable */
  registerFloatBitShadow(shadowName: string): void;

  /** Mark a float shadow as having current value (skip redundant memcpy) */
  markFloatShadowCurrent(shadowName: string): void;

  /** Check if a float shadow has been declared */
  hasFloatBitShadow(shadowName: string): boolean;

  /** Check if a float shadow has current value */
  isFloatShadowCurrent(shadowName: string): boolean;

  // === Issue #948: Opaque Type Helpers ===

  /**
   * Check if a type is an opaque (forward-declared) struct type.
   * Opaque types can only be used as pointers (cannot be instantiated).
   */
  isOpaqueType(typeName: string): boolean;

  /**
   * Issue #958: Check if a type is an external typedef struct type.
   * Used for scope variables which should always be pointers for external struct types.
   */
  isTypedefStructType(typeName: string): boolean;

  /**
   * Mark a scope variable as having an opaque type.
   * These variables are generated as pointers with NULL initialization.
   */
  markOpaqueScopeVariable(qualifiedName: string): void;
}

export default IOrchestrator;
