/**
 * TranspilerState
 * Encapsulates accumulated state Maps/Sets for the Transpiler.
 *
 * Issue #587: Provides clear state lifecycle management with explicit reset()
 * and typed accessors for all accumulated data.
 */

import ICodeGenSymbols from "../types/ICodeGenSymbols";

/**
 * The accumulators the Transpiler carries across a run.
 *
 * The count this used to state was wrong in both directions -- it said "6"
 * while holding eight, and still said "6" after #1452 removed one. A number in
 * prose beside the thing it counts has nothing holding the two together, so it
 * is gone rather than corrected; the fields below are the list.
 *
 * `symbolInfoByFile` was removed as dead (#1452): declared, cleared in
 * `reset()`, and read or written nowhere. `getHeaderDirective` and
 * `isHeaderProcessed` went with it -- zero production callers each, alive only
 * on their own tests, which is the shape #1418 is open about. Their read-backs
 * route through `getAllHeaderDirectives` and `getProcessedHeadersSet`, both of
 * which production does call, so no assertion was lost.
 */
class TranspilerState {
  // === Group 1: Header Generation State ===

  /** Issue #220: Store ICodeGenSymbols per file for header generation (ADR-055) */
  private readonly symbolCollectors = new Map<string, ICodeGenSymbols>();

  /** Issue #280: Store pass-by-value params per file for header generation */
  private readonly passByValueParams = new Map<
    string,
    ReadonlyMap<string, ReadonlySet<string>>
  >();

  /** Issue #424: Store user includes per file for header generation */
  private readonly userIncludes = new Map<string, string[]>();

  // === Group 3: Cross-file Type Info ===

  /**
   * Issue #497: Map resolved header paths to their include directives.
   * Used to include C headers in generated .h files instead of forward-declaring types.
   */
  private readonly headerIncludeDirectives = new Map<string, string>();

  // === Group 4: Cycle Prevention ===

  /** Issue #321: Track processed headers to avoid cycles during recursive include resolution */
  private readonly processedHeaders = new Set<string>();

  // === Lifecycle ===

  /**
   * Reset all accumulated state.
   * Call at the start of run() to ensure clean state for each transpilation.
   */
  reset(): void {
    this.symbolCollectors.clear();
    this.passByValueParams.clear();
    this.userIncludes.clear();
    this.headerIncludeDirectives.clear();
    this.processedHeaders.clear();
  }

  // === Symbol Collectors (Group 1) ===

  /**
   * Store symbol info for a file (used in header generation).
   */
  setSymbolInfo(filePath: string, info: ICodeGenSymbols): void {
    this.symbolCollectors.set(filePath, info);
  }

  /**
   * Get symbol info for a file.
   */
  getSymbolInfo(filePath: string): ICodeGenSymbols | undefined {
    return this.symbolCollectors.get(filePath);
  }

  /**
   * Get all symbol info values (for aggregating across files).
   */
  getAllSymbolInfo(): Iterable<ICodeGenSymbols> {
    return this.symbolCollectors.values();
  }

  // === Pass-By-Value Params (Group 1) ===

  /**
   * Store pass-by-value params for a file.
   */
  setPassByValueParams(
    filePath: string,
    params: ReadonlyMap<string, ReadonlySet<string>>,
  ): void {
    this.passByValueParams.set(filePath, params);
  }

  /**
   * Get pass-by-value params for a file.
   */
  getPassByValueParams(
    filePath: string,
  ): ReadonlyMap<string, ReadonlySet<string>> | undefined {
    return this.passByValueParams.get(filePath);
  }

  // === User Includes (Group 1) ===

  /**
   * Store user includes for a file.
   */
  setUserIncludes(filePath: string, includes: string[]): void {
    this.userIncludes.set(filePath, includes);
  }

  /**
   * Get user includes for a file.
   */
  getUserIncludes(filePath: string): string[] {
    return this.userIncludes.get(filePath) ?? [];
  }

  // === Header Include Directives (Group 3) ===

  /**
   * Store an include directive for a header path.
   */
  setHeaderDirective(headerPath: string, directive: string): void {
    this.headerIncludeDirectives.set(headerPath, directive);
  }

  /**
   * Get all header include directives (for building external type headers).
   */
  getAllHeaderDirectives(): ReadonlyMap<string, string> {
    return this.headerIncludeDirectives;
  }

  // === Processed Headers (Group 4) ===

  /**
   * Mark a header as processed to prevent cycles.
   */
  markHeaderProcessed(absolutePath: string): void {
    this.processedHeaders.add(absolutePath);
  }

  /**
   * Get the processed headers Set (for external APIs that require Set access).
   * Issue #592: Used by IncludeResolver.resolveHeadersTransitively().
   */
  getProcessedHeadersSet(): Set<string> {
    return this.processedHeaders;
  }
}

export default TranspilerState;
