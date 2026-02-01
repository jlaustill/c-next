import ICodeGenSymbols from "./ICodeGenSymbols";
import SymbolTable from "../logic/symbols/SymbolTable";

/**
 * Cross-file context passed to transpileSource() when called from run().
 *
 * This interface encapsulates the shared state built during Stages 1-4 of
 * the Pipeline, allowing transpileSource() to skip redundant parsing when
 * operating in multi-file mode.
 *
 * When context is provided:
 * - Uses shared symbolTable (already populated with all symbols)
 * - Skips header parsing (Step 4a) and C-Next include parsing (Step 4b)
 * - Uses pre-collected symbolInfoByFile for transitive enum resolution
 * - Uses accumulatedModifications for cross-file C++ const inference
 *
 * When context is undefined (standalone mode):
 * - transpileSource() behaves as before (backwards compatible)
 */
interface ITranspileContext {
  /** Shared symbol table populated with all symbols from Stages 2-3 */
  readonly symbolTable: SymbolTable;

  /** Per-file symbol info collected during Stage 3 for external enum resolution */
  readonly symbolInfoByFile: ReadonlyMap<string, ICodeGenSymbols>;

  /** Cross-file parameter modifications for C++ const inference (Issue #558) */
  readonly accumulatedModifications: ReadonlyMap<string, ReadonlySet<string>>;

  /** Cross-file function parameter lists for transitive propagation (Issue #558) */
  readonly accumulatedParamLists: ReadonlyMap<string, readonly string[]>;

  /** C header include directives for type headers (Issue #497) */
  readonly headerIncludeDirectives: ReadonlyMap<string, string>;

  /** Whether C++ output mode is active (Issue #211) */
  readonly cppMode: boolean;

  /** Include directories from config */
  readonly includeDirs: readonly string[];

  /** Target platform from config */
  readonly target: string;

  /** Debug mode flag from config */
  readonly debugMode: boolean;
}

export default ITranspileContext;
