import SymbolTable from "../PARSE/3-Declare/SymbolTable";
import TYPE_FORMING_KINDS from "../PARSE/3-Declare/TYPE_FORMING_KINDS";
import ESourceLanguage from "../utils/types/ESourceLanguage";
import type TSymbolKindCNext from "../transpiler/types/symbol-kinds/TSymbolKindCNext";
import ReservedCnxName from "../utils/ReservedCnxName";
import ICodeGenSymbols from "../transpiler/types/ICodeGenSymbols";
import TTypeInfo from "../transpiler/types/TTypeInfo";
import TParameterInfo from "../transpiler/types/TParameterInfo";
import ICallbackTypeInfo from "../transpiler/types/ICallbackTypeInfo";
import ITargetCapabilities from "../transpiler/types/ITargetCapabilities";
import TYPE_WIDTH from "../transpiler/constants/TYPE_WIDTH";
import UNRESOLVED_DIMENSION from "../transpiler/constants/UNRESOLVED_DIMENSION";
import type ICodeGenApi from "../transpiler/types/ICodeGenApi";
import DeclaredTypeFacts from "../utils/DeclaredTypeFacts";
import OutputExtensions from "../utils/OutputExtensions";
import type IOutputExtensions from "../transpiler/types/IOutputExtensions";
import QualifiedCName from "../utils/QualifiedCName";
import ScopeUtils from "../utils/ScopeUtils";
import type ITypeBindingDeps from "../transpiler/types/ITypeBindingDeps";
import DEFAULT_TARGET from "../transpiler/constants/DEFAULT_TARGET";
import StructFieldFacts from "../utils/StructFieldFacts";
import DeclaredVariableFacts from "../utils/DeclaredVariableFacts";
import type IProgram from "../transpiler/types/IProgram";
import type IDeclarationPlan from "../transpiler/types/IDeclarationPlan";
import type IFunctionSignature from "../transpiler/types/IFunctionSignature";
import invariant from "../utils/invariant";
import ToolchainRequirements from "../instrumentation/ToolchainRequirements";
import type TIncludeHeader from "../transpiler/types/TIncludeHeader";
import type IAssignmentOverflowContext from "../transpiler/types/IAssignmentOverflowContext";

/**
 * 2.3 Render's per-file working state, as an INSTANCE.
 *
 * ## Why (#1452 boxes 1 and 4)
 *
 * Box 1 forbids `src/transpiler/state/`; box 4 forbids a module reachable from
 * the pipeline holding mutable state. Those pull against each other, because
 * the obvious way to satisfy box 1 -- relocate `this.ts` into a pass
 * root -- moves 58 mutable statics INSIDE one.
 * `passes-hold-no-mutable-state.test.ts` was written first precisely to catch
 * that. So the statics dissolve BEFORE the file moves, and this is where they
 * go.
 *
 * ## Why only nine, for now
 *
 * These are the members with no friction: measured, every reference outside
 * `CodeGenState` itself lives in `CodeGenWalker` or `CodeGenerator` -- two
 * modules that already hold each other -- AND `CodeGenState`'s own methods
 * never touch them. Eighteen more are walker/generator-only but are read or
 * written by methods on `CodeGenState`, so they move with those methods rather
 * than alone. The rest reach further still.
 *
 * Owned by `CodeGenerator`, which the walker reaches as `this.host`, so both
 * read one object instead of one global.
 */
class TranspileState {
  /** ADR-044: Current assignment context for overflow behavior */
  assignmentContext: IAssignmentOverflowContext = {
    targetName: null,
    targetType: null,
    overflowBehavior: "clamp",
  };
  /**
   * Issue #1467: author spelling -> resolved header path for this file's `.cnx`
   * includes. Decided by PathResolver during discovery and handed here; codegen
   * reads it and derives nothing. Replaces `inputs`/`includeDirs`, which
   * described a resolution codegen was never given the data to perform.
   */
  cnxIncludeRewrites: ReadonlyMap<string, string> = new Map<string, string>();
  /** Issue #477: Current function return type for enum inference */
  currentFunctionReturnType: string | null = null;
  /** Debug mode generates panic-on-overflow helpers (ADR-044) */
  debugMode: boolean = false;
  /**
   * Callback typedefs this file has already emitted, so the sweep for types it
   * does NOT declare cannot emit one twice.
   */
  emittedCallbackTypedefs: Set<string> = new Set();
  /** Current indentation level */
  indentLevel: number = 0;
  /** strlen optimization: variable name -> temp variable name */
  lengthCache: Map<string, string> | null = null;
  /**
   * Issue #1212: callback `_fp` typedefs awaiting placement.
   *
   * They used to be appended after the function each was derived from, which
   * only works when every use appears later in the file. A parameter naming a
   * callback declared further down got a typedef after its first use, and the
   * generated C did not compile.
   *
   * They cannot simply be hoisted into the prelude either: a callback typedef
   * inherits its parameters' dependencies, so `typedef void (*onReceive_fp)(const
   * Message*)` must follow `Message`'s definition. Collecting them here lets
   * generateAllDeclarations place the whole block after the type declarations
   * and before the first function.
   */
  pendingCallbackTypedefs: string[] = [];
  /** Issue #369: Whether self-include was added */
  selfIncludeAdded: boolean = false;

  /** For u8, u16, u32, u64, i8, i16, i32, i64 */
  needsStdint: boolean = false;
  /** For bool type */
  needsStdbool: boolean = false;
  /** ADR-045: For strlen, strncpy, etc. */
  needsString: boolean = false;
  /** ADR-049/050: For atomic intrinsics and critical sections */
  needsCMSIS: boolean = false;
  /** Issue #632: For float-to-int clamp casts */
  needsLimits: boolean = false;
  /** ADR-040: For ISR function pointer type */
  needsISR: boolean = false;
  /** For float bit indexing size verification */
  needsFloatStaticAssert: boolean = false;
  /** Issue #473: IRQ wrappers for critical sections */
  needsIrqWrappers: boolean = false;
  /** Track which overflow helper types/operations are needed: "add_u8", etc. */
  usedClampOps: Set<string> = new Set();
  /** Track which safe division helpers are needed: "div_u32", "mod_i16" */
  usedSafeDivOps: Set<string> = new Set();

  /**
   * THE sink for include and deferred-emission requests.
   *
   * Every transport lands here -- generator effects via
   * `CodeGenerator.applyEffects`, the `requireInclude` callbacks injected into
   * the static helpers, and direct calls from assignment handlers. One sink for
   * the same reason `ToolchainRequirements.record` is one: the question "does
   * this file need <string.h>?" gets exactly one recorded answer, so changing
   * how that answer is REPRESENTED is one edit rather than one per writer.
   *
   * #1452 moved the requirement half to `src/instrumentation/`, so the two no
   * longer sit beside each other. They are still one decision made once -- this
   * method is the only caller of `noteDeferredSite`, and the deferral keys below
   * are the only ones it can produce.
   * It was a private method on `CodeGenerator` until #1449, which is why five
   * sites in `StringHandlers` set `needsString` raw instead -- a handler could
   * not reach the funnel, so it wrote the flag. That made the include decision
   * six edits wide, and #1449 turns these flags into an `EmissionPlan` entry.
   * Every line of the body writes this class and reads nothing from the
   * generator, so `state/` is where it already lived in all but name.
   *
   * @param header - The header to require (stdint, stdbool, string, ...)
   * @param line - The `.cnx` line that asked, for deferred attribution
   */
  requireInclude(header: TIncludeHeader, line: number | null = null): void {
    // Issue #1143: three of these "headers" are really deferred code-emission
    // requests. Record where they were asked for, so the emitter that finally
    // produces the block can attribute its requirement to a .cnx line. No
    // requirement is recorded here -- the code does not exist yet, and
    // recording a requirement for text that may never be emitted is exactly
    // the mistake that made #1141's guard fire on files without the construct.
    // Only the two headers that have a claiming emitter. "isr" was noted here
    // and never read: ToolchainRequirements.takeDeferredSites is called for
    // float_static_assert and irq_wrappers alone, and the ISR typedef carries
    // no requirement. Keeping
    // the deferred keys equal to the set that gets claimed is the property the
    // rest of this design leans on.
    // #1452: the path comes off THIS object, the way it did when the two halves
    // shared a class. It was briefly a defaulted third parameter, which no
    // caller ever supplied -- so every site recorded `sourcePath: ""`, and
    // `ResultPrinter.printSites` filters those out and falls back to the
    // generic `from <incurredBy>` line. A defaulted parameter for a fact the
    // receiver already holds is a channel nobody uses, and the default is the
    // wrong answer rather than a missing one.
    if (header === "irq_wrappers" || header === "float_static_assert") {
      ToolchainRequirements.noteDeferredSite(
        header,
        this.sourcePath ?? "",
        line,
      );
    }

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
   * Mark a clamp operation as used.
   */
  markClampOpUsed(operation: string, cnxType: string): void {
    // Internal helper-op key (e.g. "add_u32"), not a scope-qualified C name.
    // HelperGenerator splits this on a single underscore.
    this.usedClampOps.add(`${operation}_${cnxType}`);
  }
  /**
   * Mark a safe div operation as used.
   */
  markSafeDivOpUsed(operation: string, cnxType: string): void {
    // Internal helper-op key (e.g. "div_u32"), not a scope-qualified C name.
    // HelperGenerator matches these with a single underscore.
    this.usedSafeDivOps.add(`${operation}_${cnxType}`);
  }

  /**
   * 2.2 Plan's declaration decisions for the file being generated.
   *
   * Frozen, and set once before any declaration renders. Held here rather than
   * on `CodeGenerator` because CLAUDE.md gives this class sole ownership of
   * per-file state; it sits beside `symbols` for the same reason -- a decided
   * artifact the whole file's generation reads and nothing re-derives.
   *
   * Null before `assembleGeneratedOutput` reaches the declarations, which is
   * also every unit test that drives a generator directly. `declarationPlan()`
   * is the accessor that refuses the null rather than letting a site read a
   * silently-wrong default.
   */
  declarationPlanOrNull: IDeclarationPlan | null = null;
  /** ADR-013: Track function parameter const-ness for call-site validation */
  functionSignatures: Map<string, IFunctionSignature> = new Map();
  /** Callback field types: "Struct.field" -> callbackTypeName */
  callbackFieldTypes: Map<string, string> = new Map();
  /**
   * ADR-029 / Issues #1200, #1201: every type name referenced by a field or a
   * parameter, wherever it appears -- top-level struct, scope-nested struct,
   * scope member, or function parameter.
   *
   * Emitting a callback's `_fp` typedef is one decision, and it used to be
   * derived from callbackFieldTypes alone. That map is populated only while
   * walking TOP-LEVEL struct declarations, so a callback used anywhere else was
   * registered as known, referenced in the output, and never given a typedef --
   * generated C that does not compile.
   *
   * Names go in unfiltered: a parameter may name a callback declared later in
   * the file, so membership is intersected with callbackTypes at query time
   * rather than at collection time.
   */
  callbackTypeReferences: Set<string> = new Set();
  /**
   * #1491: the subset of `callbackTypeReferences` named by a declaration that
   * APPEARS IN THE HEADER -- a struct field, a scope member variable, or a
   * parameter.
   *
   * A local variable inside a function body names a callback type too (#1484),
   * and that reference must still produce a typedef -- but in the `.c`, not the
   * header. Treating the two alike put a type in the public interface because
   * one function body happened to use it, which is neither what C does nor
   * safe: two files that both named an INCLUDED function-as-type locally each
   * exported the same typedef, and anything including both headers saw it
   * twice, which C99 rejects.
   *
   * The C practice this follows: a library header typedefs the callback types
   * ITS OWN API uses -- POSIX's signal-handler typedef, `curl_write_callback`, `sqlite3_callback`
   * -- and nothing else. `stdlib.h` does not typedef `qsort`'s comparator; it
   * writes the pointer inline, because no caller needs to name it.
   */
  publicCallbackTypeReferences: Set<string> = new Set();
  /**
   * Tracks scope variables with opaque (forward-declared) struct types.
   * These are generated as pointers with NULL initialization and should
   * be passed directly (not with &) since they're already pointers.
   * Maps qualified name (e.g., "MyScope_widget") to true.
   */
  opaqueScopeVariables: Set<string> = new Set();

  /**
   * 2.2 Plan's declaration decisions, asserted present.
   *
   * A decision read before it was made is a defect, not a default: answering
   * `false` for "does the header own the type?" emits a duplicate definition
   * rather than failing, and the C compiler is the first thing that notices.
   */
  declarationPlan(): IDeclarationPlan {
    const plan = this.declarationPlanOrNull;
    invariant(
      plan !== null,
      "2.2 Plan decides declarations before 2.3 Render reads them",
    );
    return plan;
  }
  /**
   * Compute unmodified parameters for all functions on-demand.
   * Returns a map of function name -> Set of parameter names NOT modified.
   * Computed from `functionSignatures` and the program's modification facts.
   *
   * Reads `this.program`, like the siblings that answer the same question
   * (`isParameterModified`, `isParameterModifiedAnywhere`). It took the artifact
   * as a parameter for one revision, and the only caller passed
   * `this.state.program` -- the receiver's own field -- so the separation it
   * claimed did not exist while the `| null` left a second caller free to supply
   * a program that disagrees with every other reader. Worse, the `?.` answered
   * "every parameter is unmodified" for a missing artifact, which is the vacuous
   * const comparison `TypeValidator`'s own comment records as the reason ADR-029
   * callback checking could not stay in 2.3.
   */
  getUnmodifiedParameters(): Map<string, Set<string>> {
    const result = new Map<string, Set<string>>();
    for (const [funcName, signature] of this.functionSignatures) {
      const modifiedSet = this.program?.modifiedParameters().get(funcName);
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
   * Register a callback field type.
   */
  registerCallbackFieldType(key: string, typeName: string): void {
    this.callbackFieldTypes.set(key, typeName);
  }
  /**
   * Record a callback type named by a declaration that APPEARS IN THE HEADER.
   *
   * The single writer for that decision, so "does the public interface name
   * this type" is decided in one place rather than by remembering to update a
   * second set at each of the three declaration sites.
   */
  notePublicCallbackTypeReference(functionName: string): void {
    this.callbackTypeReferences.add(functionName);
    this.publicCallbackTypeReferences.add(functionName);
  }
  /**
   * Issue #1164: does the generated header own this callback's typedef?
   *
   * When the `.c` includes its own header, whichever typedefs the header emits
   * must not be emitted a second time -- C99 rejects even an identical typedef
   * redefinition. Both sides ask this one question so they cannot disagree
   * about who owns a given typedef.
   *
   * Keyed on callbackTypeReferences (#1200/#1201) rather than a set of its own:
   * that already records every site naming a callback type, so ownership and
   * emission cannot drift apart.
   */
  headerOwnsCallbackTypedef(functionName: string): boolean {
    return this.publicCallbackTypeReferences.has(functionName);
  }
  /**
   * Check if generated code accesses an opaque scope variable (and is thus
   * already a pointer). Used during argument generation to decide whether an
   * address-of (&) prefix is needed.
   *
   * Handles two forms:
   * - Direct access:        "MyScope_widget"     → the handle itself (pointer)
   * - Array-element access: "MyScope_widgets[i]" → an element of an opaque
   *   handle array, which is itself a pointer (Issue #996)
   *
   * @param generatedCode - The generated access expression (e.g. "UI_widgets[i]")
   * @returns true if this resolves to an opaque scope variable (already a pointer)
   */
  isOpaqueScopeVariableAccess(generatedCode: string): boolean {
    if (this.opaqueScopeVariables.has(generatedCode)) {
      return true;
    }
    // Issue #996: An element of an opaque-handle array is already a pointer.
    // Match on the base array name that precedes the subscript.
    const bracketIndex = generatedCode.indexOf("[");
    if (bracketIndex === -1) {
      return false;
    }
    return this.opaqueScopeVariables.has(generatedCode.slice(0, bracketIndex));
  }
  /**
   * Mark a scope variable as having an opaque (forward-declared) struct type.
   * These are generated as pointers with NULL initialization.
   *
   * @param qualifiedName - The fully qualified variable name (e.g., "MyScope_widget")
   */
  markOpaqueScopeVariable(qualifiedName: string): void {
    this.opaqueScopeVariables.add(qualifiedName);
  }

  /** Expected type for struct initializers and enum inference */
  expectedType: string | null = null;
  /** Whether we're generating the RHS of a variable declaration initializer.
   *  When true, struct literals use { .field = value } instead of (Type){ .field = value }
   *  because plain designated initializers are valid C99 at any scope, while compound
   *  literals are not constant expressions and fail at file scope on GCC < 13. */
  inDeclarationInit: boolean = false;
  /**
   * Suppress bare enum resolution even when expectedType is set.
   * Issue #872: MISRA 7.2 requires expectedType for U suffix on function args,
   * but bare enum resolution in function args was never allowed and changing
   * that would require ADR approval.
   */
  suppressBareEnumResolution: boolean = false;

  /**
   * Execute a function with a temporary expectedType, restoring on completion.
   * Issue #872: Extracted to eliminate duplicate save/restore pattern and add exception safety.
   *
   * @param type - The expected type to set (if falsy, no change is made)
   * @param fn - The function to execute
   * @param suppressEnumResolution - If true, suppress bare enum resolution (for MISRA-only contexts)
   * @returns The result of the function
   */
  withExpectedType<T>(
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
   * Execute fn with expectedType=null, restoring prior value on exit.
   * Issue #1032: Used in comparison contexts (relational/equality expressions)
   * where MISRA 7.2 U suffix should NOT be applied - comparing `i32 < 0`
   * should not generate `signedIdx < 0U` which changes comparison semantics.
   */
  withoutExpectedType<T>(fn: () => T): T {
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
  /** Execute fn with inDeclarationInit=true, restoring prior value on exit. */
  withDeclarationInit<T>(fn: () => T): T {
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
  withoutDeclarationInit<T>(fn: () => T): T {
    const saved = this.inDeclarationInit;
    this.inDeclarationInit = false;
    try {
      return fn();
    } finally {
      this.inDeclarationInit = saved;
    }
  }
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
  generator: ICodeGenApi | null = null;

  /**
   * The CodeGenerator instance, asserted present. Handlers call this instead of
   * each casting `generator` themselves — one source of truth for the access and
   * null-check (the generator is always set before any handler runs).
   */
  requireGenerator(): ICodeGenApi {
    if (this.generator === null) {
      throw new Error(
        "TranspileState.generator is not set; codegen accessed before initialization.",
      );
    }
    return this.generator;
  }

  // ===========================================================================
  // SYMBOL DATA (read-only after initialization)
  // ===========================================================================

  /** ADR-055: Pre-collected symbol info from CNextResolver + TSymbolInfoAdapter */
  symbols: ICodeGenSymbols | null = null;

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
  program: IProgram | null = null;

  symbolTable: SymbolTable = new SymbolTable();

  // ===========================================================================
  // TYPE TRACKING
  // ===========================================================================

  /**
   * Track variable types for bit access, .length, and type inference.
   * PRIVATE: Use getVariableTypeInfo()/setVariableTypeInfo() instead.
   * This ensures cross-file variables from SymbolTable are also found.
   */
  typeRegistry: Map<string, TTypeInfo> = new Map();

  /** Bug #8: Compile-time const values for array size resolution */
  constValues: Map<string, number> = new Map();

  // ===========================================================================
  // FUNCTION & CALLBACK TRACKING
  // ===========================================================================

  /** Track C-Next defined functions */
  knownFunctions: Set<string> = new Set();

  /** ADR-029: Callback types registry (function-as-type pattern) */
  callbackTypes: Map<string, ICallbackTypeInfo> = new Map();

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
  generatedStructInits: Set<string> = new Set();

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
  exportedRegisterBlocks: string[] = [];

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
  currentScopePath = "";

  /** Issue #269: Current function for modification tracking */
  currentFunctionName: string | null = null;

  /** ADR-006: Current function parameters for pointer semantics */
  currentParameters: Map<string, TParameterInfo> = new Map();

  /** ADR-016: Local variables in current function (allowed as bare identifiers) */
  localVariables: Set<string> = new Set();

  /** ADR-006: Local array variables (no & needed when passing) */
  localArrays: Set<string> = new Set();

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
  localRenames: Map<string, string> = new Map();

  /** Scope member names: scope -> Set of member names */
  scopeMembers: Map<string, Set<string>> = new Map();

  /** Float bit indexing: declared shadow variables */
  floatBitShadows: Set<string> = new Set();

  /** Float bit indexing: shadows with current value (skip redundant reads) */
  floatShadowCurrent: Set<string> = new Set();

  // ===========================================================================
  // GENERATION STATE
  // ===========================================================================

  /** Whether we're inside a function body */
  inFunctionBody: boolean = false;

  /** Track args parameter name for main() translation */
  mainArgsName: string | null = null;

  /** ADR-035: Element count for array size inference */
  lastArrayInitCount: number = 0;

  /** ADR-035: Fill-all value for array initialization */
  lastArrayFillValue: string | undefined = undefined;

  /**
   * ADR-035: clear the array-initializer tracking before generating one.
   *
   * The two fields above are written by the expression generator as a side
   * effect and read back afterwards, so a caller that does not clear them
   * first can read the PREVIOUS declaration's answer. Both callers cleared
   * both fields by hand; naming the operation is what stops the next one
   * clearing only the count, which is the half that reads as "no array".
   */
  resetArrayInitTracking(): void {
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
  wasArrayInit(): boolean {
    return this.lastArrayInitCount > 0 || this.lastArrayFillValue !== undefined;
  }

  /** ADR-049: Target platform capabilities */
  targetCapabilities: ITargetCapabilities = DEFAULT_TARGET;

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
  cppMode: boolean = false;

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
  get outputExtensions(): IOutputExtensions {
    return OutputExtensions.forCppMode(this.cppMode);
  }

  /** Pending temp variable declarations for C++ mode */
  pendingTempDeclarations: string[] = [];

  /** Counter for unique temp variable names */
  tempVarCounter: number = 0;

  /** Issue #517: Pending field assignments for C++ class struct init */
  pendingCppClassAssignments: string[] = [];

  // ===========================================================================
  // SOURCE PATHS (ADR-010, Issue #349)
  // ===========================================================================

  /** Source file path for validating includes */
  sourcePath: string | null = null;

  // ===========================================================================
  // LIFECYCLE METHODS
  // ===========================================================================

  /**
   * Exit a function body context.
   * Clears local tracking and sets inFunctionBody to false.
   */
  exitFunctionBody(): void {
    this.inFunctionBody = false;
    this.clearFunctionLocals();
  }

  /**
   * Enter a function body context.
   * Clears local tracking and sets inFunctionBody flag.
   */
  enterFunctionBody(): void {
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
  clearFunctionLocals(): void {
    this.localVariables.clear();
    this.localArrays.clear();
    this.localRenames.clear();
    this.floatBitShadows.clear();
    this.floatShadowCurrent.clear();
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
  withScopePath<T>(scopeName: string, fn: () => T): T {
    const saved = this.currentScopePath;
    this.setCurrentScopeByPath(scopeName);
    try {
      return fn();
    } finally {
      this.currentScopePath = saved;
    }
  }

  // ===========================================================================
  // CONVENIENCE LOOKUP METHODS
  // ===========================================================================

  /**
   * Check if a type name is a known struct.
   * Also includes bitmaps since they're struct-like (Issue #551).
   */
  isKnownStruct(name: string): boolean {
    return DeclaredTypeFacts.isStruct(this.symbols, this.symbolTable, name);
  }

  /**
   * Check if a type name is a known scope.
   */
  isKnownScope(name: string): boolean {
    return DeclaredTypeFacts.isScope(this.symbols, name);
  }

  /**
   * Check if a type name is a known enum.
   */
  isKnownEnum(name: string): boolean {
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
  isScopeType(qualifiedName: string): boolean {
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
  isCrossFileDeclaration(qualifiedCName: string): boolean {
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
   * `isScopeType` is an instance method reading `this.symbolTable`, so a bare
   * reference to it loses its receiver and throws. Six sites each wrote the
   * same closure to work around that -- five feeding `ITypeBindingDeps`, one
   * feeding `ITypeGenerationDeps`, which CLAUDE.md keeps separate so
   * `TypeGenerationHelper` stays unit-testable. The two CONTRACTS are
   * different and stay different; the BINDING was the same six times.
   *
   * An arrow property rather than a method precisely because a method cannot
   * be passed unbound -- that is the whole problem it solves.
   */
  readonly scopeTypePredicate = (qualifiedName: string): boolean =>
    this.isScopeType(qualifiedName);

  /**
   * ADR-057: bind this state's type sets to `TypeBinding`'s injected deps.
   *
   * THE binding, for the sites that resolve a whole `TypeContext`.
   * `isScopeType` is an instance method reading `this.symbolTable`, so it cannot be
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
  typeBindingDeps(
    resolveQualifiedType?: (identifiers: string[]) => string,
  ): ITypeBindingDeps {
    return {
      isScopeType: this.scopeTypePredicate,
      resolveQualifiedType,
    };
  }

  /**
   * Issue #948: Check if a type name is an opaque (forward-declared) struct type.
   * Opaque types are incomplete types that can only be used as pointers.
   * Example: `typedef struct _widget_t widget_t;` without a body makes `widget_t` opaque.
   */
  isOpaqueType(typeName: string): boolean {
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
  isTypedefStructType(typeName: string): boolean {
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
  getVariableTypeInfo(name: string): TTypeInfo | undefined {
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
  declaredVariableType(name: string): TTypeInfo | undefined {
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
  getTypeInfo(name: string): TTypeInfo | undefined {
    return this.getVariableTypeInfo(name);
  }

  /**
   * Check if a variable type is registered (locally or in SymbolTable).
   * ADR-055 Phase 7: Uses getTSymbol for typed symbol lookup.
   */
  hasVariableTypeInfo(name: string): boolean {
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
  setVariableTypeInfo(name: string, info: TTypeInfo): void {
    this.typeRegistry.set(name, info);
  }

  /**
   * Delete variable type info from the local registry.
   */
  deleteVariableTypeInfo(name: string): void {
    this.typeRegistry.delete(name);
  }

  /**
   * Get a read-only view of the local type registry.
   * Used for passing to helper functions that need to iterate over types.
   * Note: This only returns locally registered types, not cross-file symbols.
   */
  getTypeRegistryView(): ReadonlyMap<string, TTypeInfo> {
    return this.typeRegistry;
  }

  /**
   * Convert a TSymbol IVariableSymbol to TTypeInfo for unified type lookups.
   * ADR-055 Phase 7: Works with typed TSymbol instead of ISymbol.
   */

  /**
   * Check if a parameter in a function is modified.
   */
  isParameterModified(funcName: string, paramName: string): boolean {
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
  isParameterModifiedAnywhere(funcName: string, paramName: string): boolean {
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
  callbackTypedefTypeFor(functionName: string): string | undefined {
    const typedefName = this.program
      ?.callbackCompatibleFunctions()
      .get(functionName);
    if (!typedefName) return undefined;

    return this.getTypedefType(typedefName);
  }

  getTypedefType(typedefName: string): string | undefined {
    const symbol = this.symbolTable.getCSymbol(typedefName);
    if (symbol?.kind === "type") {
      return symbol.type;
    }
    return undefined;
  }

  /**
   * Check if a name is a local variable.
   */
  isLocalVariable(name: string): boolean {
    return this.localVariables.has(name);
  }

  /**
   * Check if a name is a local array.
   */
  isLocalArray(name: string): boolean {
    return this.localArrays.has(name);
  }

  /**
   * Get members of a scope.
   */
  getScopeMembers(scopePath: string): Set<string> | undefined {
    return this.scopeMembers.get(scopePath);
  }

  /**
   * Set members of a scope.
   */
  setScopeMembers(scopePath: string, members: Set<string>): void {
    this.scopeMembers.set(scopePath, members);
  }

  /**
   * Get all scope members (for IGeneratorState).
   */
  getAllScopeMembers(): ReadonlyMap<string, ReadonlySet<string>> {
    return this.scopeMembers;
  }

  /**
   * Check if an identifier is a member of the current scope.
   */
  isCurrentScopeMember(identifier: string): boolean {
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
  resolveIdentifier(identifier: string): string {
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
  resolvedStructKey(structName: string): string | undefined {
    return StructFieldFacts.keyFor(this.symbols, structName);
  }

  /**
   * Get struct field type (simple lookup).
   */
  getStructFieldType(
    structName: string,
    fieldName: string,
  ): string | undefined {
    return StructFieldFacts.typeOf(this.symbols, structName, fieldName);
  }

  /**
   * Get struct field info including dimensions (checks SymbolTable then local symbols).
   */
  getStructFieldInfo(
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
    const localKey = this.resolvedStructKey(structType);
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
  getMemberTypeInfo(structType: string, memberName: string): TTypeInfo | null {
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
  isStructFieldArray(structName: string, fieldName: string): boolean {
    return (
      this.symbols?.structFieldArrays.get(structName)?.has(fieldName) ?? false
    );
  }

  /**
   * Get enum members for an enum.
   */
  getEnumMembers(enumName: string): ReadonlyMap<string, number> | undefined {
    return this.symbols?.enumMembers.get(enumName);
  }

  /**
   * Get external struct fields for initialization analysis.
   */
  getExternalStructFields(): ReadonlyMap<string, ReadonlySet<string>> {
    // #1447: derived by 1.4 Resolve, not accumulated here. Which fields a
    // header's struct has is a cross-file fact, and the pass that owns it is
    // the one that can see every file.
    return this.program?.externalStructFields() ?? new Map();
  }

  /**
   * Get function return type.
   */
  getFunctionReturnType(funcName: string): string | undefined {
    return this.symbols?.functionReturnTypes.get(funcName);
  }

  // ===========================================================================
  // TYPE REGISTRATION HELPERS
  // ===========================================================================

  /**
   * Register a variable type.
   */
  registerType(name: string, info: TTypeInfo): void {
    this.setVariableTypeInfo(name, info);
  }

  /**
   * Register a const value.
   */
  registerConstValue(name: string, value: number): void {
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
  setCurrentScopeByPath(name: string | null): void {
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
  shadowsFileScopeSymbol(name: string): boolean {
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
  registerLocalRename(name: string, emittedName: string): void {
    this.localRenames.set(name, emittedName);
  }

  /**
   * The C identifier a local is emitted under -- its own name unless it shadows
   * a file-scope symbol. Call at every point a local's name is WRITTEN into C;
   * never when looking one up.
   */
  emittedLocalName(name: string): string {
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
  sourceLocalName(emittedName: string): string {
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
  registerLocalVariable(name: string, isArray: boolean = false): void {
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
  planShadowingLocalName(name: string): void {
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
  registerCallbackType(name: string, info: ICallbackTypeInfo): void {
    this.callbackTypes.set(name, info);
  }

  // ===========================================================================
  // FLOAT BIT SHADOW HELPERS
  // ===========================================================================

  /**
   * Register a float bit shadow variable.
   */
  registerFloatBitShadow(name: string): void {
    this.floatBitShadows.add(name);
  }

  /**
   * Check if a float bit shadow exists.
   */
  hasFloatBitShadow(name: string): boolean {
    return this.floatBitShadows.has(name);
  }

  /**
   * Mark a float shadow as having current value.
   */
  markFloatShadowCurrent(name: string): void {
    this.floatShadowCurrent.add(name);
  }

  /**
   * Check if a float shadow has current value.
   */
  isFloatShadowCurrent(name: string): boolean {
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
  addPendingTempDeclaration(decl: string): void {
    this.pendingTempDeclarations.push(decl);
  }

  /**
   * Flush and return pending temp declarations.
   */
  flushPendingTempDeclarations(): string[] {
    const decls = this.pendingTempDeclarations;
    this.pendingTempDeclarations = [];
    return decls;
  }

  /**
   * Get a unique temp variable name.
   */
  getNextTempVarName(): string {
    return ReservedCnxName.temporary(this.tempVarCounter++);
  }

  /** Cleared per file, at the top of `generate()`. */
  reset(targetCapabilities?: ITargetCapabilities): void {
    // Generator reference
    this.generator = null;

    // Symbol data
    this.symbols = null;
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
    this.inDeclarationInit = false;
    this.expectedType = null;
    this.suppressBareEnumResolution = false;
    this.functionSignatures = new Map();
    this.callbackFieldTypes = new Map();
    this.callbackTypeReferences = new Set();
    this.publicCallbackTypeReferences = new Set();
    this.declarationPlanOrNull = null;
    this.opaqueScopeVariables = new Set();
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
    this.emittedCallbackTypedefs = new Set();
    this.pendingCallbackTypedefs = [];
    this.currentFunctionReturnType = null;
    this.indentLevel = 0;
    this.assignmentContext = {
      targetName: null,
      targetType: null,
      overflowBehavior: "clamp",
    };
    this.lengthCache = null;
    this.debugMode = false;
    this.selfIncludeAdded = false;
    this.cnxIncludeRewrites = new Map<string, string>();
  }
}

export default TranspileState;
