/**
 * StandaloneContextBuilder
 * Issue #591: Extracted from Transpiler.transpileSource() to reduce complexity
 *
 * Handles standalone-mode initialization:
 * - Parse C/C++ headers and collect symbols
 * - Recursively parse C-Next includes
 * - Store header include directives
 */

import IDiscoveredFile from "../data/types/IDiscoveredFile";
import IncludeTreeWalker from "../data/IncludeTreeWalker";
import IncludeResolver from "../data/IncludeResolver";

/** Inferred type from IncludeResolver.resolve() return type */
type TResolvedIncludes = ReturnType<
  InstanceType<typeof IncludeResolver>["resolve"]
>;

/**
 * Interface for the Transpiler methods needed by StandaloneContextBuilder.
 * This decouples the builder from the concrete Transpiler class.
 */
interface IStandaloneTranspiler {
  /** Parse and collect symbols from a C/C++ header file */
  collectHeaderSymbols(header: IDiscoveredFile): Promise<void>;

  /** Parse and collect symbols from a C-Next include file */
  collectCNextSymbols(cnxInclude: IDiscoveredFile): void;

  /** Get the configured include directories */
  getIncludeDirs(): readonly string[];

  /** Store header include directive for type headers */
  setHeaderIncludeDirective(headerPath: string, directive: string): void;

  /** Add a warning message */
  addWarning(message: string): void;
}

// Interface is not exported - Transpiler uses duck typing

/**
 * Builds standalone context by processing headers and C-Next includes.
 *
 * In standalone mode (when transpileSource() is called without a context),
 * this builder initializes the symbol table by:
 * 1. Parsing all C/C++ headers to collect type definitions
 * 2. Recursively parsing all C-Next includes for cross-file symbols
 * 3. Storing header include directives for generated header files
 */
class StandaloneContextBuilder {
  /**
   * Build the standalone context by processing all includes.
   *
   * @param transpiler - The transpiler instance (via interface)
   * @param resolved - The resolved includes from IncludeResolver
   */
  static async build(
    transpiler: IStandaloneTranspiler,
    resolved: TResolvedIncludes,
  ): Promise<void> {
    // Step 4a: Parse C/C++ headers to populate symbol table
    await StandaloneContextBuilder.processHeaders(transpiler, resolved);

    // Step 4b: Recursively parse C-Next includes for cross-file symbols
    StandaloneContextBuilder.processCNextIncludes(
      transpiler,
      resolved.cnextIncludes,
    );
  }

  /**
   * Process C/C++ headers to collect symbols.
   */
  private static async processHeaders(
    transpiler: IStandaloneTranspiler,
    resolved: TResolvedIncludes,
  ): Promise<void> {
    for (const header of resolved.headers) {
      try {
        await transpiler.collectHeaderSymbols(header);
        // Issue #497: Store the include directive for this header
        const directive = resolved.headerIncludeDirectives.get(header.path);
        if (directive) {
          transpiler.setHeaderIncludeDirective(header.path, directive);
        }
      } catch (err) {
        transpiler.addWarning(
          `Failed to process header ${header.path}: ${err}`,
        );
      }
    }
  }

  /**
   * Recursively process C-Next includes to collect symbols.
   * Issue #294: Enables cross-file scope references (e.g., decoder.getSpn() -> decoder_getSpn())
   * Issue #465: Recursively process transitive includes for enum info
   * Issue #591: Uses shared IncludeTreeWalker to eliminate duplicate traversal code
   */
  private static processCNextIncludes(
    transpiler: IStandaloneTranspiler,
    cnextIncludes: IDiscoveredFile[],
  ): void {
    const includeDirs = transpiler.getIncludeDirs();

    IncludeTreeWalker.walk(cnextIncludes, includeDirs, (file) => {
      try {
        transpiler.collectCNextSymbols(file);
      } catch (err) {
        transpiler.addWarning(
          `Failed to process C-Next include ${file.path}: ${err}`,
        );
        return false; // Stop traversing this branch on error
      }
    });
  }
}

export default StandaloneContextBuilder;
