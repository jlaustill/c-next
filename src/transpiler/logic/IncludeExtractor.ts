/**
 * IncludeExtractor
 * Extracts and transforms #include directives from parsed C-Next programs.
 *
 * Issue #589: Extracted from Transpiler.collectUserIncludes()
 */

import * as Parser from "./parser/grammar/CNextParser.js";
import type THeaderExtension from "../types/THeaderExtension";
import IncludeRewriter from "../data/IncludeRewriter";

/**
 * Extracts include directives from C-Next parse trees
 */
class IncludeExtractor {
  /**
   * Extract user includes from a parsed C-Next program.
   *
   * Extracts #include directives for .cnx files and transforms them to .h or .hpp includes.
   * Issue #941: Uses .hpp extension when the run emits C++.
   * This enables cross-file type definitions in generated headers.
   *
   * Issue #1319: takes the extension rather than the mode, and no longer
   * defaults it. The default was `false`, so omitting the argument silently
   * claimed a C run.
   *
   * Issue #1467: takes the resolved include paths rather than deriving them.
   * This used to swap the extension on whatever the author typed, which is
   * wrong whenever the generated header is not written beside its source --
   * and it was one of three places doing that independently.
   *
   * @param tree The parsed C-Next program
   * @param ext The run's header extension (".h" or ".hpp"), for includes the
   *   resolver could not place
   * @param rewrites Author spelling -> resolved header path (Issue #1467)
   * @returns Array of transformed include strings (e.g., '#include "types.h"' or '#include "types.hpp"')
   */
  static collectUserIncludes(
    tree: Parser.ProgramContext,
    ext: THeaderExtension,
    rewrites: ReadonlyMap<string, string>,
  ): string[] {
    const userIncludes: string[] = [];
    for (const includeDir of tree.includeDirective()) {
      const includeText = includeDir.getText();
      // Include both quoted ("...") and angle-bracket (<...>) .cnx includes
      // These define types used in function signatures that need to be in the header
      if (IncludeRewriter.cnxSpecOf(includeText) !== null) {
        userIncludes.push(IncludeRewriter.rewrite(includeText, rewrites, ext));
      }
    }
    return userIncludes;
  }

  /**
   * Collect plain C/C++ header includes (everything that is not a `.cnx`).
   *
   * Issue #424: a macro from one of these can appear inside a generated
   * declaration -- `u32[DEVICE_COUNT] devices` becomes
   * `extern uint32_t devices[DEVICE_COUNT]`. Such a header only compiles for a
   * translation unit that already included the macro's source, so when the
   * generated header names a macro it must carry the include itself.
   *
   * Collected separately from `.cnx` includes because it is added conditionally:
   * propagating every C include into every header would put implementation-only
   * dependencies into the public interface.
   */
  static collectCHeaderIncludes(tree: Parser.ProgramContext): string[] {
    const includes: string[] = [];
    for (const includeDir of tree.includeDirective()) {
      const includeText = includeDir.getText();
      // Issue #1467 review: one predicate for "is this a C-Next include?".
      // The substring test this replaced answered NO for `<utils.cnext>` --
      // ".cnext" does not contain ".cnx" -- so a `.cnext` include was
      // collected here as a foreign C header.
      if (IncludeRewriter.cnxSpecOf(includeText) === null) {
        includes.push(includeText);
      }
    }
    return includes;
  }
}

export default IncludeExtractor;
