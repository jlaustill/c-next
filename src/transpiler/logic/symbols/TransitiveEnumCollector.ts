/**
 * TransitiveEnumCollector
 * Issue #588: Extracted from Transpiler to logic layer
 *
 * Collects symbol information from transitively included .cnx files.
 * This enables proper enum prefixing when enums are defined in deeply
 * nested includes (A includes B, B includes C with enum).
 */

import ICodeGenSymbols from "../../types/ICodeGenSymbols";
import type ITransitiveIncludes from "../../types/ITransitiveIncludes";
import IncludeTreeWalker from "../../data/IncludeTreeWalker";

/**
 * Collects symbol information by traversing the include graph.
 *
 * When generating code, we need to know about enums defined in included files
 * so we can properly prefix enum member references. This collector walks the
 * include graph starting from a root file and gathers symbol info from all
 * transitively included .cnx files.
 */
class TransitiveEnumCollector {
  /**
   * Collect symbol info from all transitively included .cnx files.
   *
   * Performs depth-first traversal of the include graph, collecting
   * ICodeGenSymbols from each visited file. Files are only visited once
   * to handle circular includes.
   *
   * @param filePath - The root file to start collecting from
   * @param symbolInfoByFile - Map of file paths to their symbol info
   * @param includeDirs - Additional directories to search for includes
   * @returns the closure's `ICodeGenSymbols` and the paths they came from
   */
  static collect(
    filePath: string,
    symbolInfoByFile: ReadonlyMap<string, ICodeGenSymbols>,
    includeDirs: readonly string[],
  ): ITransitiveIncludes {
    return TransitiveEnumCollector._gather(
      (visit) => IncludeTreeWalker.walkFromFile(filePath, includeDirs, visit),
      symbolInfoByFile,
    );
  }

  /**
   * The body both entry points share.
   *
   * #1472: these two methods differed only in which `IncludeTreeWalker` entry
   * they called -- the per-file work was written out twice, so adding `paths`
   * to the walk would have been two edits that had to agree. They are one edit
   * now, which is the point: "if two code paths must produce identical output,
   * they MUST share the same logic" (CLAUDE.md).
   *
   * @param walk - invokes the appropriate walker with the visitor given to it
   * @param symbolInfoByFile - Map of file paths to their symbol info
   */
  private static _gather(
    walk: (visit: (file: { path: string }) => void) => void,
    symbolInfoByFile: ReadonlyMap<string, ICodeGenSymbols>,
  ): ITransitiveIncludes {
    const sources: ICodeGenSymbols[] = [];
    const paths: string[] = [];

    walk((file) => {
      paths.push(file.path);
      const externalInfo = symbolInfoByFile.get(file.path);
      if (externalInfo) {
        sources.push(externalInfo);
      }
    });

    return { sources, paths };
  }

  /**
   * Collect symbol info for standalone mode from resolved includes.
   *
   * Issue #591: Extracted to unify enum collection across transpilation modes.
   * Unlike collect() which starts from a file path and parses it, this method
   * starts from already-resolved includes (from IncludeResolver.resolve()).
   *
   * @param cnextIncludes - Array of resolved C-Next include files
   * @param symbolInfoByFile - Map of file paths to their symbol info
   * @param includeDirs - Additional directories to search for nested includes
   * @returns the closure's `ICodeGenSymbols` and the paths they came from
   */
  static collectForStandalone(
    cnextIncludes: ReadonlyArray<{ path: string }>,
    symbolInfoByFile: ReadonlyMap<string, ICodeGenSymbols>,
    includeDirs: readonly string[],
  ): ITransitiveIncludes {
    return TransitiveEnumCollector._gather(
      (visit) => IncludeTreeWalker.walk(cnextIncludes, includeDirs, visit),
      symbolInfoByFile,
    );
  }
}

export default TransitiveEnumCollector;
