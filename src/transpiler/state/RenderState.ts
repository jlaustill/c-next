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

  /** Cleared per file, at the top of `generate()`. */
  reset(): void {
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
