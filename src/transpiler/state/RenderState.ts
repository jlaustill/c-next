import type IProgram from "../types/IProgram";
import type IDeclarationPlan from "../types/IDeclarationPlan";
import type IFunctionSignature from "../types/IFunctionSignature";
import invariant from "../../utils/invariant";
import ToolchainRequirements from "../../instrumentation/ToolchainRequirements";
import type TIncludeHeader from "../types/TIncludeHeader";
import type IAssignmentOverflowContext from "../types/IAssignmentOverflowContext";

/**
 * 2.3 Render's per-file working state, as an INSTANCE.
 *
 * ## Why (#1452 boxes 1 and 4)
 *
 * Box 1 forbids `src/transpiler/state/`; box 4 forbids a module reachable from
 * the pipeline holding mutable state. Those pull against each other, because
 * the obvious way to satisfy box 1 -- relocate `CodeGenState.ts` into a pass
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
class RenderState {
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
  requireInclude(
    header: TIncludeHeader,
    line: number | null = null,
    sourcePath = "",
  ): void {
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
    if (header === "irq_wrappers" || header === "float_static_assert") {
      ToolchainRequirements.noteDeferredSite(header, sourcePath, line);
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
   * #1452: the artifact is handed in rather than reached for. 1.4 Resolve owns
   * it, and this is render state -- the two travel together at the call site
   * instead of one holding a reference to the other.
   */
  getUnmodifiedParameters(program: IProgram | null): Map<string, Set<string>> {
    const result = new Map<string, Set<string>>();
    for (const [funcName, signature] of this.functionSignatures) {
      const modifiedSet = program?.modifiedParameters().get(funcName);
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
  /** Cleared per file, at the top of `generate()`. */
  reset(): void {
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

export default RenderState;
