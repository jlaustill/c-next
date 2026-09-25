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

  /** Cleared per file, at the top of `generate()`. */
  reset(): void {
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
