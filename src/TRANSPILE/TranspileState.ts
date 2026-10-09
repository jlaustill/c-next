import type EFileType from "../PARSE/1-Discover/types/EFileType";
import type ITargetDescription from "../types/ITargetDescription";
import SymbolTable from "../PARSE/3-Declare/SymbolTable";
import ReservedCnxName from "../utils/ReservedCnxName";
import ICodeGenSymbols from "../types/ICodeGenSymbols";
import TTypeInfo from "../types/TTypeInfo";
import type TChainRoot from "../types/TChainRoot";
import type TValueBinding from "../types/TValueBinding";
import type ISourcePosition from "../utils/types/ISourcePosition";
import DeclaredTypeInfo from "../PARSE/3-Declare/DeclaredTypeInfo";
import TParameterInfo from "../types/TParameterInfo";
import ICallbackTypeInfo from "../types/ICallbackTypeInfo";
import type ICodeGenApi from "./types/ICodeGenApi";
import DeclaredTypeFacts from "../utils/DeclaredTypeFacts";
import DeclaredPointer from "../utils/DeclaredPointer";
import OutputExtensions from "../utils/OutputExtensions";
import type IOutputExtensions from "../types/IOutputExtensions";
import QualifiedCName from "../utils/QualifiedCName";
import ScopeUtils from "../utils/ScopeUtils";
import type ITypeBindingDeps from "../types/ITypeBindingDeps";
import type IProgram from "../types/IProgram";
import type ITypingContext from "../types/ITypingContext";
import type IDeclarationPlan from "../types/IDeclarationPlan";
import type IFunctionSignature from "../types/IFunctionSignature";
import invariant from "../utils/invariant";
import ToolchainRequirements from "../instrumentation/ToolchainRequirements";
import type TIncludeHeader from "../types/TIncludeHeader";

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
 * Owned by `CodeGenerator`, which the walker reaches as `this.host`, so both
 * read one object instead of one global.
 */
class TranspileState {
  /**
   * Issue #1467: author spelling -> resolved header path for this file's `.cnx`
   * includes. Decided by PathResolver during discovery and handed here; codegen
   * reads it and derives nothing. Replaces `inputs`/`includeDirs`, which
   * described a resolution codegen was never given the data to perform.
   */
  cnxIncludeRewrites: ReadonlyMap<string, string> = new Map<string, string>();
  /**
   * #1444, owner ruling 1: the kind of file each `#include` directive of this
   * file names, as 1.1 Discover classified it. Codegen rewrites a directive by
   * this answer and classifies nothing itself.
   */
  includeKinds: ReadonlyMap<string, EFileType> = new Map<string, EFileType>();
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
  /** strlen optimization: the measured C operand -> temp variable name */
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

  /**
   * The C types render recorded spelling into this file (`uint8_t`, `bool`),
   * from which the plan decides `<stdint.h>` / `<stdbool.h>` (#1927). Holds
   * only what the recording sites add: every render site that spells a
   * `<stdint.h>` / `<stdbool.h>` name records it, or says in a comment which
   * record necessarily comes with it.
   */
  emittedCTypes: Set<string> = new Set();
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
  /** #1668: single-evaluation saturating casts, as `"f32_u8"` keys */
  usedCastHelpers: Set<string> = new Set();

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
   * @param header - The header to require (string, cmsis, limits, ...)
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
   * #1668: mark a single-evaluation saturating cast as used -- the helper a
   * clamped cast calls when its operand has a side effect. The helper uses
   * the limit macros, so it needs `<limits.h>` exactly as the inline form does.
   */
  markCastHelperUsed(sourceType: string, targetType: string): void {
    this.usedCastHelpers.add(`${sourceType}_${targetType}`);
    this.requireInclude("limits");
  }

  /**
   * #1668: the operand typer's context for this file, over the facts 1.4
   * settled -- the same artifact 2.1's analyzers read, so 2.2 types an operand
   * exactly as 2.1 did. Null for a render with no program behind it (a unit
   * test that builds codegen state alone).
   */
  /**
   * #1668 (C7): a name's declared type where it is used -- `bindValue` at
   * `at`, then `DeclaredTypeInfo.of`. This replaces the per-file registry,
   * whose one flat key space per function could not tell an inner block's
   * `x` from its sibling's, nor `global.x` from a local `x`. `root` is the
   * chain's `this`/`global`, as the source spelled it; `name` may be a
   * shadowing local's emitted name, which is mapped back to its source name.
   */
  declarationTypeInfo(
    root: TChainRoot,
    name: string,
    at: ISourcePosition,
  ): TTypeInfo | undefined {
    return this.sourceDeclarationTypeInfo(root, this.sourceLocalName(name), at);
  }

  /**
   * #1934: declarationTypeInfo() for a name as the source spelled it, so it
   * reads no rename 2.3 Render registered. 2.2 Plan's entry: it walks the
   * parse tree, whose names are never emitted ones (E0201 keeps `__`, the
   * rename separator, out of source identifiers).
   */
  sourceDeclarationTypeInfo(
    root: TChainRoot,
    sourceName: string,
    at: ISourcePosition,
  ): TTypeInfo | undefined {
    return DeclaredTypeInfo.of(
      this.sourceBindingAt(root, sourceName, at),
      this.typingContext().symbols,
      this.symbolTable,
      this.targetDescription,
    );
  }

  /**
   * #1668 (C7): which declaration a name means where it is used -- the
   * binder's local -> scope -> global order (ADR-057). `name` may be a
   * shadowing local's emitted name, mapped back to its source name.
   */
  bindingAt(
    root: TChainRoot,
    name: string,
    at: ISourcePosition,
  ): TValueBinding | null {
    return this.sourceBindingAt(root, this.sourceLocalName(name), at);
  }

  /** bindingAt() for a name as the source spelled it (#1934). */
  private sourceBindingAt(
    root: TChainRoot,
    sourceName: string,
    at: ISourcePosition,
  ): TValueBinding | null {
    const typing = this.typingContext();
    return typing.program.bindValue(typing.sourceFile, root, sourceName, at);
  }

  /**
   * What the one operand typer reads for the file being rendered. Render
   * always runs against a program (#1668 review: fifteen sites carried a
   * default for a missing one, guards that could not fire in production and
   * would have answered wrongly if they had).
   */
  typingContext(): ITypingContext {
    invariant(
      this.program !== null &&
        this.symbols !== null &&
        this.sourcePath !== null,
      "render runs against a program: set program, symbols and sourcePath first",
    );
    return {
      sourceFile: this.sourcePath,
      symbols: this.symbols,
      program: this.program,
      symbolTable: this.symbolTable,
    };
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
      const unmodified = new Set<string>();
      for (const param of signature.parameters) {
        // Through the predicate, not a fourth inline `program?.…` lookup. The
        // absent-artifact polarity (`?? false` -> "not modified", so auto-const
        // applies) is one decision (#1529/#1552); spelling it here as well is
        // how the four copies came to need four edits.
        if (!this.isParameterModified(funcName, param.name)) {
          unmodified.add(param.name);
        }
      }
      result.set(funcName, unmodified);
    }
    return result;
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
   * #1297 moved `ICodeGenApi` out of `output/` into the shared types root, which
   * both sides may depend on, and #1653 moved it on to `src/TRANSPILE/types/`,
   * since only TRANSPILE names it. The previous note here argued the edge
   * was harmless because it was `import type` and CodeGenState already imported
   * siblings from `output/codegen/types` -- but that was the whole problem:
   * `logic/ -> state/ -> output/` was live through exactly those imports while
   * `logic-cannot-import-output` reported clean, because it matched only direct
   * edges. The rule was made transitive and `state/` got one of its own; #1444
   * retired the `logic-` rule with the layer, when `logic/` joined 1.1 Discover
   * and `parse-cannot-import-transpile` covered it -- since #1443,
   * `1-1-discover-reads-no-later-pass`.
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
    invariant(this.generator, "the generator is set before any handler runs");
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
  private localRenames: Map<string, string> = new Map();

  /** Scope member names: scope -> Set of member names */
  private scopeMembers: Map<string, Set<string>> = new Map();

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

  /**
   * ADR-049: the target this file is generated for. Set by `reset()` from the
   * description the orchestrator decided; null only before the first file.
   */
  targetDescription: ITargetDescription | null = null;

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
  private tempVarCounter: number = 0;

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
   * left a local-array set (since deleted, #1668) to leak between functions. Adding `localRenames` to four
   * call sites would have made that five. (The copy that diverged lived on
   * `FunctionContextManager`, which #1450 deleted as production-dead; the point
   * survives it, so it is stated without the name.)
   */
  private clearFunctionLocals(): void {
    this.localVariables.clear();
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
   * Check if a *qualified* name is a type declared in a scope that the file
   * being generated can see.
   * Used by `ScopeUtils.qualifyScopeType()`, through `typeBindingDeps`, to
   * ensure only actual type declarations (enum/struct/bitmap/function) capture
   * the name at a type position. ADR-029 makes a function definition create a
   * callback type, so a scope function is a type declaration for this purpose;
   * a scope VARIABLE is not, and deliberately does not capture (ADR-057).
   *
   * @param qualifiedName The already-joined C name (e.g. "A__B")
   * @returns true if the qualified name is an enum, struct, bitmap, or
   *          function-as-type (ADR-029) declared in a scope, by this file or a
   *          file it includes
   */
  isScopeType(qualifiedName: string): boolean {
    // #1724: the answer 1.4 settled this file's symbols with, asked about the
    // same file, so the `.c` and the `.h` cannot disagree. This read the
    // run-wide symbol table, which also holds the scope types of files this
    // one never includes: a bare `Config` in a reopened scope became a
    // sibling's `Motor__Config` here while 1.4, reading a run-wide union, made
    // the same mistake in the header -- two lookups agreeing by coincidence.
    //
    // Which kinds form a type is still TYPE_FORMING_KINDS' answer (#1285): 1.3
    // Declare's pass 0b asks it when it collects each file's scope types.
    const sourcePath = this.sourcePath;
    if (this.program === null || sourcePath === null) {
      return false;
    }
    return this.program.isScopeTypeVisibleFrom(sourcePath, qualifiedName);
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
   * `isScopeType` is an instance method reading `this.program`, so a bare
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
   * `isScopeType` is an instance method reading `this.program`, so it cannot be
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
   * ADR-030: is a C-Next declaration of this type held through a pointer?
   *
   * An incomplete type can only be held through a pointer, so a declaration of
   * one is `T*` wherever C-Next declares it -- a scope member, a file-scope or
   * local variable, a parameter, a callback typedef's parameter -- and an array
   * of them is an array of pointers (#996). This is the ONE answer each of
   * those sites reads. A declaration's own pointer-ness (`DeclaredPointer.of`,
   * which the `.c` definition and the header's `extern` both follow) asks the
   * same predicate, `DeclaredPointer.isHandleType`, so the two cannot differ.
   */
  isHeldThroughPointer(typeName: string): boolean {
    return DeclaredPointer.isHandleType(typeName, this.symbolTable);
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
   * The name auto-const reads this fact under, kept because it says WHY the
   * answer is program-wide at the call site that cares. It is an alias, and the
   * aliasing is the point: `Program` owns the fact, 1.4 Resolve settles it for
   * the whole run before any file is planned, so there is nothing for a
   * per-scope variant to differ about.
   *
   * Both of the bugs behind it were a SECOND source disagreeing with this one:
   *
   * - A per-file accumulator was EMPTY while declarations were still being
   *   walked, so a typedef built at that moment saw a modifying body as
   *   unmodified and emitted `const` where the prototype emitted none (#1529).
   * - A function reached through an include was never walked, so the fact was
   *   absent rather than false, and an included function-as-type lost the const
   *   its declaring file computed (#1552). Two files then defined one typedef
   *   name incompatibly, which gcc rejects outright.
   *
   * That accumulator is gone. This docblock described its fallback as still
   * present for one revision after it was deleted, which is the comment half of
   * the same duplication.
   *
   * Polarity is `isParameterModified`'s: an absent entry means NOT modified, so
   * auto-const applies.
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

  // ===========================================================================
  // TYPE REGISTRATION HELPERS
  // ===========================================================================

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
   * says and what `localVariables` is keyed by. Only the emitted text moves.
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
   * (`localVariables`) is keyed by the source
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
  registerLocalVariable(name: string): void {
    this.planShadowingLocalName(name);
    this.localVariables.add(name);
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
  private planShadowingLocalName(name: string): void {
    const functionName = this.currentFunctionName;
    if (!functionName || !this.shadowsFileScopeSymbol(name)) {
      return;
    }
    this.registerLocalRename(
      name,
      QualifiedCName.fromParts([functionName, name]),
    );
  }

  // ===========================================================================
  // OPAQUE SCOPE VARIABLE HELPERS (Issue #948)
  // ===========================================================================

  // ===========================================================================
  // C++ MODE HELPERS
  // ===========================================================================

  /**
   * Get a unique temp variable name.
   */
  getNextTempVarName(): string {
    return ReservedCnxName.temporary(this.tempVarCounter++);
  }

  /** Cleared per file, at the top of `generate()`. */
  reset(targetDescription: ITargetDescription | null = null): void {
    // Generator reference
    this.generator = null;

    // Symbol data
    this.symbols = null;
    // Note: symbolTable is NOT reset here — it persists across per-file
    // generates. The Transpiler replaces it at the start of each run (#1452
    // box 5); there is no `clear()` to call.

    // Type tracking

    // Function & callback tracking
    this.knownFunctions = new Set();
    this.callbackTypes = new Map();
    this.generatedStructInits = new Set();
    this.exportedRegisterBlocks = [];

    // Issue #1143, #1452: the per-file requirement maps moved to
    // src/instrumentation/ToolchainRequirements, which owns its own clearing.
    ToolchainRequirements.reset();

    // Current context
    this.currentScopePath = "";
    this.currentFunctionName = null;
    this.currentParameters = new Map();
    this.localVariables = new Set();
    this.localRenames = new Map();
    this.scopeMembers = new Map();
    this.floatBitShadows = new Set();
    this.floatShadowCurrent = new Set();

    // Generation state
    this.inFunctionBody = false;
    this.mainArgsName = null;
    this.lastArrayInitCount = 0;
    this.lastArrayFillValue = undefined;
    this.targetDescription = targetDescription;

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
    this.usedClampOps = new Set();
    this.usedSafeDivOps = new Set();
    this.usedCastHelpers = new Set();
    this.emittedCTypes = new Set();
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
    this.lengthCache = null;
    this.debugMode = false;
    this.selfIncludeAdded = false;
    this.cnxIncludeRewrites = new Map<string, string>();
    this.includeKinds = new Map<string, EFileType>();
  }
}

export default TranspileState;
