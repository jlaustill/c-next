import type IAnalysisContext from "./IAnalysisContext";
import type IIncludeContext from "./IIncludeContext";

/**
 * Options for running analyzers
 */
interface IAnalyzerOptions {
  /**
   * What 2.1 is allowed to know about the program -- see `IAnalysisContext`.
   *
   * REQUIRED, for the reason `includes` below gives at greater length: an
   * optional-with-a-fallback field is a guard that cannot fire. These facts
   * used to be read off `CodeGenState` at nineteen analyzer sites, for things
   * the caller is holding twenty lines above the call, and #1430 and #1432 are
   * what that costs once the shared answer is stale rather than redundant.
   */
  readonly context: IAnalysisContext;

  /**
   * #1672: 1.1 Discover's answers for this file's `#include` directives.
   * ADR-010's rules read them and ask the file system nothing, so the include
   * they accept and the file the run discovered cannot differ.
   *
   * #1322 passed the include facts in rather than reading them off shared
   * state, because the shared answer is WRONG at this moment:
   * `CodeGenState.sourcePath` was written inside `CodeGenerator.generate()`,
   * which runs after this -- the order-dependent-diagnostic shape #1399
   * shipped.
   *
   * REQUIRED, and that is the point. Optional-with-a-skip is a guard that
   * cannot fire: a caller who forgot it would lose all three ADR-010 rules
   * with nothing failing.
   */
  readonly includes: IIncludeContext;
}

export default IAnalyzerOptions;
