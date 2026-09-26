/**
 * TransitiveEnumCollector
 * Issue #588: Extracted from Transpiler to logic layer
 *
 * Collects symbol information from transitively included .cnx files.
 * This enables proper enum prefixing when enums are defined in deeply
 * nested includes (A includes B, B includes C with enum).
 */

import ICodeGenSymbols from "../../transpiler/types/ICodeGenSymbols";
import type ITransitiveIncludes from "../../transpiler/types/ITransitiveIncludes";

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
   * Collect symbol info from every file `filePath` transitively includes.
   *
   * #1435: the closure is taken over the include graph discovery resolved, and
   * over nothing else. There were two entry points here, and neither read that
   * graph: one re-read each file from disk and rebuilt a search path without
   * the PlatformIO and Arduino tiers or the injected filesystem, so an include
   * discovery had compiled was invisible to its includer (E0426); the other
   * started its walk without the root, so a cycle handed the root its own
   * symbols as an "external" source. One entry point over one graph cannot
   * disagree with discovery, or with itself.
   *
   * Depth-first, each file before its includes, each file once. The root is
   * visited first and is never a source of its own view.
   *
   * @param filePath - The root file to start collecting from
   * @param includesByFile - Each file's direct includes, as discovery resolved
   *   them. A file with no entry includes nothing.
   * @param symbolInfoByFile - Map of file paths to their symbol info
   * @returns the closure's `ICodeGenSymbols` and the paths they came from
   */
  static collect(
    filePath: string,
    includesByFile: ReadonlyMap<string, ReadonlyArray<{ path: string }>>,
    symbolInfoByFile: ReadonlyMap<string, ICodeGenSymbols>,
  ): ITransitiveIncludes {
    const sources: ICodeGenSymbols[] = [];
    const paths: string[] = [];
    const visited = new Set<string>([filePath]);

    const visit = (from: string): void => {
      for (const include of includesByFile.get(from) ?? []) {
        if (visited.has(include.path)) {
          continue;
        }
        visited.add(include.path);
        paths.push(include.path);
        const externalInfo = symbolInfoByFile.get(include.path);
        if (externalInfo) {
          sources.push(externalInfo);
        }
        visit(include.path);
      }
    };
    visit(filePath);

    return { sources, paths };
  }
}

export default TransitiveEnumCollector;
