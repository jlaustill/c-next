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
 *   CodeGenState holds the run's SymbolTable. It persists across reset()
 *   calls (which are per-file). The Transpiler REPLACES it at the start of
 *   each run -- #1452 box 5 deleted `clear()`, because a teardown listing
 *   eleven of twelve indexes is what let #1177 fire.
 */

import SymbolTable from "../../PARSE/3-Declare/SymbolTable";
import type IProgram from "../types/IProgram";
import TYPE_FORMING_KINDS from "../../PARSE/3-Declare/TYPE_FORMING_KINDS";
import ESourceLanguage from "../../utils/types/ESourceLanguage";
import type TSymbolKindCNext from "../types/symbol-kinds/TSymbolKindCNext";
import ReservedCnxName from "../../utils/ReservedCnxName";
import ICodeGenSymbols from "../types/ICodeGenSymbols";
import TTypeInfo from "../types/TTypeInfo";
import TParameterInfo from "../types/TParameterInfo";
import ICallbackTypeInfo from "../types/ICallbackTypeInfo";
import ToolchainRequirements from "../../instrumentation/ToolchainRequirements";
import ITargetCapabilities from "../types/ITargetCapabilities";
import TYPE_WIDTH from "../constants/TYPE_WIDTH";
import UNRESOLVED_DIMENSION from "../constants/UNRESOLVED_DIMENSION";
import type ICodeGenApi from "../types/ICodeGenApi";
import DeclaredTypeFacts from "../../utils/DeclaredTypeFacts";
import OutputExtensions from "../../utils/OutputExtensions";
import type IOutputExtensions from "../types/IOutputExtensions";
import QualifiedCName from "../../utils/QualifiedCName";
import ScopeUtils from "../../utils/ScopeUtils";
import invariant from "../../utils/invariant";
import type ITypeBindingDeps from "../types/ITypeBindingDeps";
import DEFAULT_TARGET from "../constants/DEFAULT_TARGET";
import StructFieldFacts from "../../utils/StructFieldFacts";
import DeclaredVariableFacts from "../../utils/DeclaredVariableFacts";

/**
 * Default target capabilities (safe fallback)
 * Uses C99 guarantees: 31 external, 63 internal significant characters.
 */
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
   * Reference to the CodeGenerator instance for handlers to call its methods,
   * typed to the method subset they use (ICodeGenApi).
   *
   * #1297: `ICodeGenApi` lives in `transpiler/types/`, a layer both sides may
   * depend on, rather than in `output/`. The previous note here argued the edge
   * was harmless because it was `import type` and CodeGenState already imported
   * siblings from `output/codegen/types` -- but that was the whole problem:
   * `logic/ -> state/ -> output/` was live through exactly those imports while
   * `logic-cannot-import-output` reported clean, because it matched only direct
   * edges. The rule is now transitive and `state/` has one of its own.
   *
   * The reference itself is still a `state/` object holding a codegen contract.
   * That coupling is by design today and is #1323's to move; what this removes
   * is the layer VIOLATION, not the dependency.
   */
  static generator: ICodeGenApi | null = null;

  /**
   * The CodeGenerator instance, asserted present. Handlers call this instead of
   * each casting `generator` themselves — one source of truth for the access and
   * null-check (the generator is always set before any handler runs).
   */
  static requireGenerator(): ICodeGenApi {
    if (CodeGenState.generator === null) {
      throw new Error(
        "CodeGenState.generator is not set; codegen accessed before initialization.",
      );
    }
    return CodeGenState.generator;
  }

  // ===========================================================================
  // SYMBOL DATA (read-only after initialization)
  // ===========================================================================

  /** ADR-055: Pre-collected symbol info from CNextResolver + TSymbolInfoAdapter */
  static symbols: ICodeGenSymbols | null = null;

  /** External symbol table for cross-language interop (C headers).
   * Held by CodeGenState; persists across per-file reset() calls.
   * REPLACED at the start of each Transpiler run (#1452 box 5).
   */
  /**
   * The artifact 1.4 Resolve emitted for this run (#1447).
   *
   * Run-wide, so it is NOT cleared by `reset()` -- that runs per file. The
   * Transpiler clears it at the start of each run. It used to share that
   * treatment with `callbackCompatibleFunctions`, which #1452 removed: an
   * artifact reference and an accumulator needed the same clearing for
   * different reasons, and only one of them still exists.
   */
  static program: IProgram | null = null;

  static symbolTable: SymbolTable = new SymbolTable();

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

  /**
   * #1399 review: whether the file being analyzed can see a C/C++ header,
   * directly or through any `.cnx` it includes. Set by `Transpiler` from the
   * resolver's categorization before `runAnalyzers`.
   *
   * Defaults to `true` so an unset value declines rather than diagnoses: a
   * false positive stops valid code compiling, a false negative is the status
   * quo.
   */
  static currentFileReachesForeignHeader = true;

  /** ADR-029: Callback types registry (function-as-type pattern) */
  static callbackTypes: Map<string, ICallbackTypeInfo> = new Map();

  /**
   * Issue #1205: structs whose ADR-029 init function this file's `.c` emitted.
   *
   * The generated `<Struct>_init(void)` is a definition with external linkage,
   * so MISRA C:2012 Rule 8.4 needs a visible declaration -- and the header is
   * the only place to put one. Recorded at the single site that decides to
   * emit the definition, and read by header generation, which must not work
   * the answer out again: its `structFields` view also holds scope-nested
   * structs, which get no init function at all (#1283), so a header-side
   * re-derivation would declare functions nobody defines.
   *
   * Same shape as `needsISR` (ADR-040) and `headerOwnsCallbackTypedef`
   * (#1164): one fact, recorded by the `.c`, consulted by the `.h`.
   */
  static generatedStructInits: Set<string> = new Set();

  /**
   * #1453 / ADR-004: the accessor `#define` blocks of every register this
   * file's header defines, rendered by the `.c` generator and printed by the
   * header verbatim.
   *
   * A `#define` cannot be exported from a `.c`, so a register reaches an
   * including file only through the header. The text is rendered once, where
   * the ADR-057 type qualification and the address expressions are available
   * (the register generators), and handed over rather than re-derived from the
   * symbol -- a header-side renderer would be a second copy of that
   * resolution. Same shape as `generatedStructInits`: one fact, recorded by the
   * `.c`, consulted by the `.h`. Cleared per file by `reset()`.
   */
  static exportedRegisterBlocks: string[] = [];

  /**
   * Functions that are assigned to C callback typedefs.
   * Maps function name -> typedef name (e.g., "my_flush" -> "flush_cb_t")
   * Issue #895: We need the typedef name to look up parameter types.
   */

  // ===========================================================================
  // PASS-BY-VALUE ANALYSIS (Issue #269)
  // ===========================================================================

  /** Parameters that should pass by value (small, unmodified primitives) */

  // ===========================================================================
  // OVERFLOW & DIVISION HELPERS (ADR-044, ADR-051)
  // ===========================================================================

  // ===========================================================================
  // CURRENT CONTEXT (changes during AST traversal)
  // ===========================================================================

  /**
   * ADR-016: path of the scope currently being generated, `""` at file scope.
   *
   * #1298: a PATH, not a scope object. Every consumer passed this straight into
   * the qualifier helpers, which used it for exactly one thing -- the chain of
   * names a path already spells out -- so holding the object meant ~45 sites
   * would each have had to re-derive the path from it.
   */
  static currentScopePath = "";

  /** Issue #269: Current function for modification tracking */
  static currentFunctionName: string | null = null;

  /** ADR-006: Current function parameters for pointer semantics */
  static currentParameters: Map<string, TParameterInfo> = new Map();

  /** ADR-016: Local variables in current function (allowed as bare identifiers) */
  static localVariables: Set<string> = new Set();

  /** ADR-006: Local array variables (no & needed when passing) */
  static localArrays: Set<string> = new Set();

  /**
   * ADR-057: bare source name -> the C identifier a shadowing local is emitted
   * under.
   *
   * A local that shadows a file-scope name must NOT be emitted under that bare
   * name: C has no `::` and no other syntax for reaching a shadowed outer
   * identifier, so `global.x` would silently bind to the local. C-Next promises
   * shadowing works and that `global.` still reaches past it, which means the
   * *local* moves rather than the global becoming unreachable.
   *
   * Populated only when a collision actually exists, so the generated C keeps
   * plain names in the common case -- the generated file is a certification
   * artifact and a reviewer should not have to decode every local. Empty for
   * the overwhelming majority of functions.
   */
  private static localRenames: Map<string, string> = new Map();

  /** Scope member names: scope -> Set of member names */
  private static scopeMembers: Map<string, Set<string>> = new Map();

  /** Float bit indexing: declared shadow variables */
  static floatBitShadows: Set<string> = new Set();

  /** Float bit indexing: shadows with current value (skip redundant reads) */
  static floatShadowCurrent: Set<string> = new Set();

  // ===========================================================================
  // GENERATION STATE
  // ===========================================================================

  /** Whether we're inside a function body */
  static inFunctionBody: boolean = false;

  /** Whether we're generating the RHS of a variable declaration initializer.
   *  When true, struct literals use { .field = value } instead of (Type){ .field = value }
   *  because plain designated initializers are valid C99 at any scope, while compound
   *  literals are not constant expressions and fail at file scope on GCC < 13. */
  static inDeclarationInit: boolean = false;

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

  /** ADR-035: Element count for array size inference */
  static lastArrayInitCount: number = 0;

  /** ADR-035: Fill-all value for array initialization */
  static lastArrayFillValue: string | undefined = undefined;

  /**
   * ADR-035: clear the array-initializer tracking before generating one.
   *
   * The two fields above are written by the expression generator as a side
   * effect and read back afterwards, so a caller that does not clear them
   * first can read the PREVIOUS declaration's answer. Both callers cleared
   * both fields by hand; naming the operation is what stops the next one
   * clearing only the count, which is the half that reads as "no array".
   */
  static resetArrayInitTracking(): void {
    this.lastArrayInitCount = 0;
    this.lastArrayFillValue = undefined;
  }

  /**
   * ADR-035: whether the initializer just generated was an array initializer.
   *
   * Derived from both fields, never one: `[0*]` sets only the fill value and
   * leaves the count at zero, so a predicate asking only about the count reads
   * the fill-all form as "not an array initializer". Two sites derived this
   * independently and agreed -- one of them `private`, so the other could not
   * have reused it even knowing it was there.
   */
  static wasArrayInit(): boolean {
    return this.lastArrayInitCount > 0 || this.lastArrayFillValue !== undefined;
  }

  /** ADR-049: Target platform capabilities */
  static targetCapabilities: ITargetCapabilities = DEFAULT_TARGET;

  // ===========================================================================
  // INCLUDE FLAGS (track required standard library includes)
  // ===========================================================================

  // ===========================================================================
  // OPAQUE TYPE SCOPE VARIABLES (Issue #948)
  // ===========================================================================

  // ===========================================================================
  // C++ MODE STATE (Issue #250)
  // ===========================================================================

  /** Use temp vars instead of compound literals */
  static cppMode: boolean = false;

  /**
   * Issue #1319: the extensions this run emits, derived from the mode rather
   * than stored beside it. A stored copy would be a second holder of the same
   * fact and could drift from `cppMode`; a getter cannot.
   *
   * Codegen sites that only need a filename ask for this. `cppMode` itself is
   * still read directly for genuine mode decisions -- pointer vs reference,
   * `.` vs `->`, `NULL` vs `nullptr` -- which are not filenames and are not
   * this decision.
   */
  static get outputExtensions(): IOutputExtensions {
    return OutputExtensions.forCppMode(this.cppMode);
  }

  /** Pending temp variable declarations for C++ mode */
  static pendingTempDeclarations: string[] = [];

  /** Counter for unique temp variable names */
  static tempVarCounter: number = 0;

  /** Issue #517: Pending field assignments for C++ class struct init */
  static pendingCppClassAssignments: string[] = [];

  // ===========================================================================
  // SOURCE PATHS (ADR-010, Issue #349)
  // ===========================================================================

  /** Source file path for validating includes */
  static sourcePath: string | null = null;

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
    // Back to the declining default: reset() runs at the start of
    // CodeGenerator.generate(), and a stale `false` here would let the next
    // file diagnose names a header it cannot see supplies.
    this.currentFileReachesForeignHeader = true;
    // Note: symbolTable is NOT reset here — it persists across per-file
    // generates. The Transpiler replaces it at the start of each run (#1452
    // box 5); there is no `clear()` to call.

    // Type tracking
    this.typeRegistry = new Map();
    this.constValues = new Map();

    // Function & callback tracking
    this.knownFunctions = new Set();
    this.callbackTypes = new Map();
    this.generatedStructInits = new Set();
    this.exportedRegisterBlocks = [];
    // persist into code generation. It is cleared at the start of each Transpiler run.

    // Pass-by-value analysis

    // Overflow & division helpers

    // Issue #1143, #1452: the per-file requirement maps moved to
    // src/instrumentation/ToolchainRequirements, which owns its own clearing.
    ToolchainRequirements.reset();

    // Current context
    this.currentScopePath = "";
    this.currentFunctionName = null;
    this.currentParameters = new Map();
    this.localVariables = new Set();
    this.localArrays = new Set();
    this.localRenames = new Map();
    this.scopeMembers = new Map();
    this.floatBitShadows = new Set();
    this.floatShadowCurrent = new Set();

    // Generation state
    this.inFunctionBody = false;
    this.inDeclarationInit = false;
    this.expectedType = null;
    this.suppressBareEnumResolution = false;
    this.mainArgsName = null;
    this.lastArrayInitCount = 0;
    this.lastArrayFillValue = undefined;
    this.targetCapabilities = targetCapabilities ?? DEFAULT_TARGET;

    // Include flags

    // C++ mode state
    this.cppMode = false;
    this.pendingTempDeclarations = [];
    this.tempVarCounter = 0;
    this.pendingCppClassAssignments = [];

    // Issue #948: Opaque scope variables (reset per-file)

    // Source paths
    this.sourcePath = null;
  }

  /**
   * Enter a function body context.
   * Clears local tracking and sets inFunctionBody flag.
   */
  static enterFunctionBody(): void {
    this.inFunctionBody = true;
    this.clearFunctionLocals();
  }

  /**
   * Clear every per-function local register.
   *
   * One owner for the whole family. Four copies of this block existed, and they
   * had already diverged: one of them cleared three of the four registers and
   * left `localArrays` to leak between functions. Adding `localRenames` to four
   * call sites would have made that five. (The copy that diverged lived on
   * `FunctionContextManager`, which #1450 deleted as production-dead; the point
   * survives it, so it is stated without the name.)
   */
  private static clearFunctionLocals(): void {
    this.localVariables.clear();
    this.localArrays.clear();
    this.localRenames.clear();
    this.floatBitShadows.clear();
    this.floatShadowCurrent.clear();
  }

  /**
   * Exit a function body context.
   * Clears local tracking and sets inFunctionBody to false.
   */
  static exitFunctionBody(): void {
    this.inFunctionBody = false;
    this.clearFunctionLocals();
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

  /**
   * Execute fn with the current scope set to `scopeName`'s path, restoring the
   * previous path on exit.
   *
   * The sibling these four helpers were missing. Two sites hand-rolled it --
   * `const savedScope = ...; setCurrentScopeByPath(...); ...; currentScopePath
   * = savedScope;` -- with the restore as a plain trailing statement rather
   * than a `finally`, which is the precise defect #872 extracted
   * `withExpectedType` to fix: its own doc says "eliminate duplicate
   * save/restore pattern and ADD EXCEPTION SAFETY". Scope path never got the
   * same treatment.
   *
   * Latent rather than live today: a throw inside either body is caught per
   * file by `Transpiler`, and `reset()` clears the path before the next file,
   * so the stale value has nothing left to reach. That is a property of two
   * unrelated mechanisms rather than of this code, which is why it is fixed
   * here instead of relied upon.
   */
  static withScopePath<T>(scopeName: string, fn: () => T): T {
    const saved = this.currentScopePath;
    this.setCurrentScopeByPath(scopeName);
    try {
      return fn();
    } finally {
      this.currentScopePath = saved;
    }
  }

  /** Execute fn with inDeclarationInit=true, restoring prior value on exit. */
  static withDeclarationInit<T>(fn: () => T): T {
    const saved = this.inDeclarationInit;
    this.inDeclarationInit = true;
    try {
      return fn();
    } finally {
      this.inDeclarationInit = saved;
    }
  }

  /** Execute fn with inDeclarationInit=false, restoring prior value on exit.
   *  Used in sub-expression contexts (function args, ternary arms) where
   *  plain designated initializers are not valid C. */
  static withoutDeclarationInit<T>(fn: () => T): T {
    const saved = this.inDeclarationInit;
    this.inDeclarationInit = false;
    try {
      return fn();
    } finally {
      this.inDeclarationInit = saved;
    }
  }

  /**
   * Execute fn with expectedType=null, restoring prior value on exit.
   * Issue #1032: Used in comparison contexts (relational/equality expressions)
   * where MISRA 7.2 U suffix should NOT be applied - comparing `i32 < 0`
   * should not generate `signedIdx < 0U` which changes comparison semantics.
   */
  static withoutExpectedType<T>(fn: () => T): T {
    const savedType = this.expectedType;
    const savedSuppress = this.suppressBareEnumResolution;
    this.expectedType = null;
    this.suppressBareEnumResolution = false;
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
    return DeclaredTypeFacts.isStruct(this.symbols, this.symbolTable, name);
  }

  /**
   * Check if a type name is a known scope.
   */
  static isKnownScope(name: string): boolean {
    return DeclaredTypeFacts.isScope(this.symbols, name);
  }

  /**
   * Check if a type name is a known enum.
   */
  static isKnownEnum(name: string): boolean {
    return DeclaredTypeFacts.isEnum(this.symbols, name);
  }

  /**
   * Check if a *qualified* name is a known type declared in a scope.
   * Used by QualifedCName.qualifyScopeType() to ensure only actual type
   * declarations (enum/struct/bitmap/function) capture the name at a type
   * position. ADR-029 makes a function definition create a callback type, so a
   * scope function is a type declaration for this purpose; a scope VARIABLE is
   * not, and deliberately does not capture (ADR-057).
   *
   * @param qualifiedName The already-joined C name (e.g. "A__B")
   * @returns true if the qualified name is a known enum, struct, bitmap, or
   *          function-as-type (ADR-029)
   */
  static isScopeType(qualifiedName: string): boolean {
    // #1285: ONE lookup that returns the symbol, then a question about its kind.
    //
    // This was four parallel string sets -- knownEnums | knownStructs |
    // knownBitmaps | callbackTypes -- and #1281 proposed adding a fifth. The sets
    // are standing in for a `kind` field the symbol already carries, and asking
    // them throws that kind away at the moment of lookup, which is why #1287's
    // member access on a function-as-type has nothing left to diagnose with.
    //
    // TYPE_FORMING_KINDS owns "does this kind introduce a type name", so a new
    // kind is answered in one place rather than by remembering to add a set.
    // ADR-029 makes a function definition create a callback type, which is why
    // `function` is a member.
    //
    // Measured equivalent to the four sets across the whole corpus before the
    // swap: 1119 integration and 124 bug fixtures, zero disagreements, with a
    // control confirming the probe fired (breaking the candidate produced 51).
    const found = this.symbolTable.getOverloadsByCName(qualifiedName);
    return found.some(
      (symbol) =>
        symbol.sourceLanguage === ESourceLanguage.CNext &&
        TYPE_FORMING_KINDS.has(symbol.kind as TSymbolKindCNext),
    );
  }

  /**
   * ADR-010: does this transpiled C name refer to a declaration that lives in
   * a DIFFERENT file from the one being generated?
   *
   * #1508: ADR-010 promises that a declaration reached through an `#include` is
   * usable wherever a local one would be. When that promise is KEPT nothing is
   * diagnosed -- the code simply compiles -- so the matrix had no source
   * position to derive occupancy from and every cross-file cell read as
   * unoccupied however many fixtures exercised it. That is the observability
   * gap #1241 describes, not a coverage gap.
   *
   * Asks the run-wide table, deliberately. The per-file `known*` sets carry
   * names only, so they cannot answer "which file did this come from"; the
   * run-wide table indexes symbols by their canonical C name and each symbol
   * carries its own `sourceFile`. This is the "which symbol IS this?" question,
   * which CLAUDE.md pairs with `getOverloadsByCName` rather than the bare-name
   * index.
   *
   * `every` rather than `some`: a name that resolves to declarations in several
   * files includes a local one, and a local declaration is what the caller
   * actually binds to. Reporting that as cross-file would credit an include for
   * a symbol the file defines itself.
   */
  static isCrossFileDeclaration(qualifiedCName: string): boolean {
    const current = this.sourcePath;
    if (!current) {
      return false;
    }
    const found = this.symbolTable.getOverloadsByCName(qualifiedCName);
    return (
      found.length > 0 && found.every((symbol) => symbol.sourceFile !== current)
    );
  }

  /**
   * `isScopeType` as a VALUE, bound to this class.
   *
   * `isScopeType` is a static that reads `this.symbolTable`, so a bare
   * reference to it loses its receiver and throws. Six sites each wrote the
   * same closure to work around that -- five feeding `ITypeBindingDeps`, one
   * feeding `ITypeGenerationDeps`, which CLAUDE.md keeps separate so
   * `TypeGenerationHelper` stays unit-testable. The two CONTRACTS are
   * different and stay different; the BINDING was the same six times.
   *
   * An arrow property rather than a method precisely because a method cannot
   * be passed unbound -- that is the whole problem it solves.
   */
  static readonly scopeTypePredicate = (qualifiedName: string): boolean =>
    CodeGenState.isScopeType(qualifiedName);

  /**
   * ADR-057: bind this state's type sets to `TypeBinding`'s injected deps.
   *
   * THE binding, for the sites that resolve a whole `TypeContext`.
   * `isScopeType` is a static that reads `this.symbolTable`, so it cannot be
   * passed unbound -- which is why five call sites each wrote the same closure,
   * paired with `currentScopePath`, and why the rule against re-pairing them
   * needed something to call instead of only saying not to.
   *
   * It had a bare-name sibling, `qualifyScopeType`, which CLAUDE.md told codegen
   * to call. Nothing did: the bare-name path resolves in the symbols layer
   * (`3-Declare/TypeBinding`), and codegen reaches the same decision through
   * this method. Deleted under #1452 with the rule that named it.
   *
   * `resolveQualifiedType` stays the caller's: it is the one half that really
   * does differ, routing to a generator's C++ namespace resolution or to a
   * callback's, and binding it here would invent a dependency from `state/` on
   * whichever one happened to be first.
   *
   * @param resolveQualifiedType the caller's `Scope.Type` resolver, if it has one
   */
  static typeBindingDeps(
    resolveQualifiedType?: (identifiers: string[]) => string,
  ): ITypeBindingDeps {
    return {
      isScopeType: CodeGenState.scopeTypePredicate,
      resolveQualifiedType,
    };
  }

  /**
   * Issue #948: Check if a type name is an opaque (forward-declared) struct type.
   * Opaque types are incomplete types that can only be used as pointers.
   * Example: `typedef struct _widget_t widget_t;` without a body makes `widget_t` opaque.
   */
  static isOpaqueType(typeName: string): boolean {
    // #1511: the artifact resolved this once for the whole program. It used to
    // read a per-file set that `mergeOpaqueTypes` patched the cross-file answer
    // into, which made this a second place the question was answered.
    return this.program?.isOpaqueType(typeName) ?? false;
  }

  /**
   * Issue #958: Check if a type name is an external typedef struct type.
   * External typedef struct types should use pointer semantics for scope variables.
   * Unlike isOpaqueType, this returns true for both forward-declared and complete structs.
   */
  static isTypedefStructType(typeName: string): boolean {
    return this.symbolTable?.isTypedefStructType(typeName) ?? false;
  }

  /**
   * Get type info for a variable, as CODEGEN sees it.
   *
   * Checks the local typeRegistry first, then the declared answer below, so a
   * generated file's own variables win over the cross-file ones.
   *
   * Issue #786: This unified lookup ensures cross-file variables
   * (defined in included files) are found even before code generation
   * registers them locally.
   *
   * **Not reachable from 2.1 Analyze.** `typeRegistry` is filled by
   * `CodeGenerator.generate()` and cleared by `reset()`, both after the
   * analyzers run, so an analyzer calling this reads a map that belongs to a
   * different file -- see `declaredVariableType` below, which is the question
   * an analyzer is actually asking.
   */
  static getVariableTypeInfo(name: string): TTypeInfo | undefined {
    // First check the local type registry (current file's variables)
    const localInfo = this.typeRegistry.get(name);
    if (localInfo) {
      return localInfo;
    }

    // ADR-057: callers reach here with a RESOLVED identifier -- for a scope
    // member that is already the registry key (`Scope__member`), but for a
    // shadowing local it is the emitted name while the registry is keyed on
    // the source spelling. Resolving both here rather than in each of the
    // ~65 call sites keeps one answer to "what type is this?"; without it a
    // bit-range write on a shadowing local silently lost its narrowing cast.
    const sourceName = this.sourceLocalName(name);
    if (sourceName !== name) {
      const renamedInfo = this.typeRegistry.get(sourceName);
      if (renamedInfo) {
        return renamedInfo;
      }
    }

    return this.declaredVariableType(name);
  }

  /**
   * What a variable's type is according to what the program DECLARES -- the
   * answer that does not depend on which file has been generated.
   *
   * #1432. `getVariableTypeInfo` above layers the per-file `typeRegistry` on
   * top of this; the registry probe is the entire difference, and it is
   * codegen's alone. An analyzer that probed it got the PREVIOUS RUN's answer,
   * and a signed array subscript reached generated C at exit 0.
   */
  static declaredVariableType(name: string): TTypeInfo | undefined {
    return DeclaredVariableFacts.typeInfoOf(
      this.symbols,
      this.symbolTable,
      name,
    );
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
    if (symbol?.kind === "variable" && symbol.type !== undefined) {
      return true;
    }
    // Issue #978: Check C symbols for external struct globals only
    const cSymbol = this.symbolTable.getCSymbol(name);
    if (cSymbol?.kind === "variable" && cSymbol.type) {
      const baseType = DeclaredVariableFacts.stripTrailingPointers(
        cSymbol.type,
      );
      return (
        this.symbolTable.isTypedefStructType(baseType) ||
        !!this.symbolTable.getStructFields(baseType)
      );
    }
    return false;
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

  /**
   * Check if a parameter in a function is modified.
   */
  static isParameterModified(funcName: string, paramName: string): boolean {
    // #1452: reads the artifact. This used to read a per-file accumulator on
    // this class -- the one `isParameterModifiedAnywhere` below documents as
    // the bug in #1529 and #1552, EMPTY while declarations are still walked and
    // absent entirely for a function reached through an include. The
    // accumulator is gone, so the two methods now answer from one place and the
    // sibling's fallback is no longer a second source.
    return (
      this.program?.modifiedParameters().get(funcName)?.has(paramName) ?? false
    );
  }

  /**
   * #1552/#1529: does this parameter get modified ANYWHERE in the program?
   *
   * The one modification fact behind every auto-const decision. `Program` owns
   * it -- 1.4 Resolve settles it for the whole run before any file is planned,
   * so the answer does not depend on which file is being rendered or on how
   * far through a file the walk has reached.
   *
   * Both properties are load-bearing, and each one was a bug:
   *
   * - The per-file accumulator below is EMPTY while declarations are still
   *   being walked, so a typedef built at that moment saw a modifying body as
   *   unmodified and emitted `const` where the prototype emitted none (#1529).
   * - A function reached through an include is never walked here at all, so the
   *   fact was absent rather than false, and an included function-as-type lost
   *   the const its declaring file computed (#1552). Two files then defined one
   *   typedef name incompatibly, which gcc rejects outright.
   *
   * Polarity matches the prototype's (`?? false`): an absent entry means NOT
   * modified, so auto-const applies. Reading the absent case the other way is
   * what made one expression wrong in both directions at once.
   *
   * The per-file fallback serves unit tests that drive codegen directly, which
   * are the only callers with no `Program`. NOT single-source transpilation:
   * `transpile({ kind: "source" })` and `{ kind: "files" }` share one
   * `_executePipeline`, so `Program.build` runs and this field is set for both.
   * Naming single-source here would be the kind of claim that survives by
   * never being checked -- a later reader would preserve the branch for a
   * production caller that does not exist.
   */
  static isParameterModifiedAnywhere(
    funcName: string,
    paramName: string,
  ): boolean {
    return this.isParameterModified(funcName, paramName);
  }

  /**
   * Issue #895: Get the typedef type string for a C typedef by name.
   * Used to look up function pointer typedef signatures for callback-compatible functions.
   *
   * @param typedefName - Name of the typedef (e.g., "flush_cb_t")
   * @returns The type string (e.g., "void (*)(widget_t *, const rect_t *, uint8_t *)") or undefined
   */
  /**
   * The C callback typedef TYPE a function is assigned to, or undefined.
   *
   * #1545 review: "is this function callback-compatible?" was answered in
   * three places with three spellings -- the header asked the two steps and
   * consumed them as truthiness, the body asked them and consumed `!==
   * undefined`, and the pass-by-value decision asked only `.has()` and never
   * resolved the typedef at all. The first two disagree on `""`, which
   * getTypedefType can return because it forwards `symbol.type` unchecked; the
   * third disagrees whenever the map holds a function whose typedef does not
   * resolve.
   *
   * One home, so the predicate cannot be spelled a fourth way. Whether an
   * unresolvable typedef should suppress auto-const at all is #1603, and this
   * is the single place that question now has to be answered.
   */
  static callbackTypedefTypeFor(functionName: string): string | undefined {
    const typedefName = this.program
      ?.callbackCompatibleFunctions()
      .get(functionName);
    if (!typedefName) return undefined;

    return this.getTypedefType(typedefName);
  }

  static getTypedefType(typedefName: string): string | undefined {
    const symbol = this.symbolTable.getCSymbol(typedefName);
    if (symbol?.kind === "type") {
      return symbol.type;
    }
    return undefined;
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
  static getScopeMembers(scopePath: string): Set<string> | undefined {
    return this.scopeMembers.get(scopePath);
  }

  /**
   * Set members of a scope.
   */
  static setScopeMembers(scopePath: string, members: Set<string>): void {
    this.scopeMembers.set(scopePath, members);
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
    if (this.currentScopePath === "") return false;
    // #1295: `scopeMembers` is keyed by the scope's IDENTITY -- its dotted
    // source path -- which is exactly what `currentScopePath` holds. No
    // conversion, and `Outer.Inner` no longer collides with `Other.Inner`.
    return (
      this.scopeMembers.get(this.currentScopePath)?.has(identifier) ?? false
    );
  }

  /**
   * Resolve an identifier to its fully-scoped name.
   * Inside a scope, checks if the identifier is a scope member first.
   */
  static resolveIdentifier(identifier: string): string {
    if (this.currentScopePath !== "") {
      const members = this.scopeMembers.get(this.currentScopePath);
      if (members?.has(identifier)) {
        // Built from the whole PATH, so a member of a nested scope gets every
        // component rather than just the innermost one.
        return ScopeUtils.getTranspiledCName({
          name: identifier,
          scopePath: this.currentScopePath,
        });
      }
    }
    return identifier;
  }

  /**
   * The key `ICodeGenSymbols.structFields` actually holds for a struct type,
   * or undefined when nothing does.
   *
   * #1322. Those maps are keyed by the TRANSPILED C name, so a scope-declared
   * struct is `S__Cfg` there while every declaration, parameter and field type
   * reads `S.Cfg`. Callers passed the source spelling, the lookup missed, and
   * the member chain became UNRESOLVABLE -- which no analyzer rejects, because
   * declining to guess is the correct behavior for a name it cannot resolve.
   *
   * So MISRA C:2012 Rule 10.1 fired on a global struct's `bool` field and was
   * silently absent on a scope-declared struct's, and the same held for the
   * divide-by-zero, array-index and essential-category rules that follow the
   * same chains. Four analyzers, one missing key derivation.
   *
   * It is resolved HERE, once, rather than at each call site: a fifth caller
   * arriving later inherits the fix instead of re-deriving it, and
   * `CompoundAssignmentAnalyzer` had already been forced to spell it out
   * privately -- which is the duplicate-path shape, and is now deleted.
   *
   * The source spelling is tried FIRST, so this can only ADD resolutions.
   * Nothing that resolved before resolves differently, which is what makes it
   * safe to put under a caller in `output/` as well as the analyzers.
   */
  private static resolvedStructKey(structName: string): string | undefined {
    return StructFieldFacts.keyFor(this.symbols, structName);
  }

  /**
   * Get struct field type (simple lookup).
   */
  static getStructFieldType(
    structName: string,
    fieldName: string,
  ): string | undefined {
    return StructFieldFacts.typeOf(this.symbols, structName, fieldName);
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

    // Fall back to local C-Next struct fields, under the resolved key (#1322 --
    // this had the same scope-declared-struct miss as getStructFieldType).
    const localKey = CodeGenState.resolvedStructKey(structType);
    if (localKey !== undefined) {
      const fieldType = this.symbols?.structFields
        .get(localKey)
        ?.get(fieldName);
      if (fieldType) {
        const fieldDimensions =
          this.symbols?.structFieldDimensions.get(localKey);
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
    // Issue #1127: map a non-numeric dimension to UNRESOLVED_DIMENSION rather
    // than filtering it out. TTypeInfo.arrayDimensions is number[], so an
    // enum-qualified count cannot be carried here -- but dropping it shifts
    // every dimension after it, so `u8[EColor.COUNT][3] cells` came back as
    // [3] and put dimension 2's bound in dimension 1's slot.
    //
    // UNRESOLVED_DIMENSION holds the slot and reads as "size unknown";
    // TypeValidator.checkArrayBounds skips it because it is not > 0.
    const dims = fieldInfo.dimensions?.map((d) =>
      typeof d === "number" ? d : UNRESOLVED_DIMENSION,
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
   * Get external struct fields for initialization analysis.
   */
  static getExternalStructFields(): ReadonlyMap<string, ReadonlySet<string>> {
    // #1447: derived by 1.4 Resolve, not accumulated here. Which fields a
    // header's struct has is a cross-file fact, and the pass that owns it is
    // the one that can see every file.
    return this.program?.externalStructFields() ?? new Map();
  }

  /**
   * Get function return type.
   */
  static getFunctionReturnType(funcName: string): string | undefined {
    return this.symbols?.functionReturnTypes.get(funcName);
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
   * Enter a scope by its DOTTED PATH.
   *
   * The parameter is a path (`Outer.Inner`), not a leaf, because that is what
   * `SymbolRegistry.getOrCreateScope` takes. Pass a leaf for a nested scope and
   * it does not fail -- it CREATES a fresh scope parented to global and
   * registers it under the leaf, after which every qualification through
   * `currentScopePath` silently returns a one-level name.
   *
   * Every codegen caller passes a leaf, and that is correct for every program
   * C-Next can express: `scopeMember` admits no `scopeDeclaration`
   * (grammar/CNext.g4:81-89), so a scope's leaf IS its whole path. ADR-016 makes
   * that permanent, so no future grammar change retires the gap.
   *
   * #1304: what remains is that a leaf passed where a path is expected used to
   * be UNDETECTABLE. `getOrCreateScope` minted a fresh scope parented to global
   * and registered it under the leaf, after which `currentScopePath` was that
   * orphan's one-level name -- so #1295's producer key (`scope.cnxScopedName`,
   * the whole path) missed, and the member generated as a bare C identifier at
   * exit 0. The two halves of the same decision disagreed silently.
   *
   * The registry is the authority. A path it does not know is a broken promise
   * about the symbols pass, not something to create here, so this looks up and
   * asserts instead of creating. Measured before changing it: the whole fixture
   * corpus (1247/1247) enters only scopes that are already registered, so
   * nothing reachable relied on the creating behavior.
   *
   * Reading the path back off the registered scope is what makes producer and
   * reader agree BY CONSTRUCTION rather than by coincidence -- both are that
   * scope's `cnxScopedName`, not two strings that happen to match.
   */
  static setCurrentScopeByPath(name: string | null): void {
    if (name === null) {
      this.currentScopePath = "";
      return;
    }
    const scope = this.program?.scope(name) ?? null;
    invariant(
      scope !== null,
      `a scope entered during generation was registered by the symbols pass (got "${name}")`,
    );
    this.currentScopePath = ScopeUtils.pathOf(scope);
  }

  /**
   * ADR-057: whether a bare name is already taken by a FILE-SCOPE C identifier.
   *
   * Asks the canonical-identity index, not the bare-name one: a symbol whose
   * transpiled C name IS the bare spelling is by definition at file scope,
   * because anything inside a scope carries its scope in that name
   * (`Counter__count`). So a scope member never counts as a collision -- it is
   * still reachable as `this.count` regardless of what the local is called.
   *
   * An outer *local* is excluded deliberately. C block scoping already gives
   * the language's shadowing semantics there, and neither `global.` nor `this.`
   * can name an outer local, so nothing becomes unreachable.
   */
  static shadowsFileScopeSymbol(name: string): boolean {
    if (this.localVariables.has(name)) {
      return false;
    }
    if (this.knownFunctions.has(name)) {
      return true;
    }
    return this.symbolTable.getOverloadsByCName(name).length > 0;
  }

  /**
   * Record that a shadowing local is emitted under a different C identifier.
   *
   * Keyed on the BARE name because that is what every reference in the source
   * says and what every registry (`typeRegistry`, `localVariables`,
   * `constValues`) is keyed by. Only the emitted text moves.
   */
  static registerLocalRename(name: string, emittedName: string): void {
    this.localRenames.set(name, emittedName);
  }

  /**
   * The C identifier a local is emitted under -- its own name unless it shadows
   * a file-scope symbol. Call at every point a local's name is WRITTEN into C;
   * never when looking one up.
   */
  static emittedLocalName(name: string): string {
    return this.localRenames.get(name) ?? name;
  }

  /**
   * The source name behind an emitted local identifier -- the inverse of
   * `emittedLocalName`.
   *
   * Derived by scanning the one rename map rather than kept as a second map,
   * so the two directions cannot drift apart. The map holds only shadowing
   * locals, so it is empty in almost every function.
   *
   * Needed where a helper is handed the emitted name for code generation but
   * must still register under the name the source used: every registry
   * (`localVariables`, `localArrays`, `typeRegistry`) is keyed by the source
   * spelling, because that is what references in the source say.
   */
  static sourceLocalName(emittedName: string): string {
    for (const [source, emitted] of this.localRenames) {
      if (emitted === emittedName) {
        return source;
      }
    }
    return emittedName;
  }

  /**
   * Register a local variable, deciding its emitted C name first.
   *
   * The single registration point for every kind of local -- declarations,
   * `for` init variables, and generator effects all arrive here. The shadow
   * decision has to sit in front of the registration and cannot be duplicated
   * into the callers: `shadowsFileScopeSymbol` consults `localVariables`, so a
   * caller that registered first would ask about a name that is already local
   * and always be told "no collision".
   */
  static registerLocalVariable(name: string, isArray: boolean = false): void {
    this.planShadowingLocalName(name);
    this.localVariables.add(name);
    if (isArray) {
      this.localArrays.add(name);
    }
  }

  /**
   * ADR-057: give a local that shadows a file-scope name a distinct C
   * identifier, so `global.x` still reaches past it.
   *
   * C has no `::`. Emitting the local as plain `count` makes an outer `count`
   * unreachable for the rest of the function, so `global.count` would silently
   * bind to the local -- wrong code, no diagnostic, clean compile. C-Next
   * guarantees shadowing works AND that `global.` sees through it, so the local
   * is what moves.
   *
   * `currentFunctionName` is already the qualified function name
   * (`Counter__test`), so this adds one component to the existing encoder
   * rather than inventing a second naming scheme.
   */
  private static planShadowingLocalName(name: string): void {
    const functionName = this.currentFunctionName;
    if (!functionName || !this.shadowsFileScopeSymbol(name)) {
      return;
    }
    this.registerLocalRename(
      name,
      QualifiedCName.fromParts([functionName, name]),
    );
  }

  /**
   * Register a callback type.
   */
  static registerCallbackType(name: string, info: ICallbackTypeInfo): void {
    this.callbackTypes.set(name, info);
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
  // OPAQUE SCOPE VARIABLE HELPERS (Issue #948)
  // ===========================================================================

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
    return ReservedCnxName.temporary(this.tempVarCounter++);
  }
}
