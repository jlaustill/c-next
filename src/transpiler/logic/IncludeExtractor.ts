/**
 * IncludeExtractor
 * Extracts and transforms #include directives from parsed C-Next programs.
 *
 * Issue #589: Extracted from Transpiler.collectUserIncludes()
 */

import * as Parser from "./parser/grammar/CNextParser.js";

/**
 * Extracts include directives from C-Next parse trees
 */
class IncludeExtractor {
  /**
   * Extract user includes from a parsed C-Next program.
   *
   * Extracts #include directives for .cnx files and transforms them to .h or .hpp includes.
   * Issue #941: Uses .hpp extension when cppMode is true.
   * This enables cross-file type definitions in generated headers.
   *
   * @param tree The parsed C-Next program
   * @param cppMode Whether to use .hpp extension (C++ mode)
   * @returns Array of transformed include strings (e.g., '#include "types.h"' or '#include "types.hpp"')
   */
  static collectUserIncludes(
    tree: Parser.ProgramContext,
    cppMode: boolean = false,
  ): string[] {
    const userIncludes: string[] = [];
    const ext = cppMode ? ".hpp" : ".h";
    for (const includeDir of tree.includeDirective()) {
      const includeText = includeDir.getText();
      // Include both quoted ("...") and angle-bracket (<...>) .cnx includes
      // These define types used in function signatures that need to be in the header
      if (includeText.includes(".cnx")) {
        // Transform .cnx includes to .h or .hpp (the generated header for the included .cnx file)
        const transformedInclude = includeText
          .replace(/\.cnx"/, `${ext}"`)
          .replace(/\.cnx>/, `${ext}>`);
        userIncludes.push(transformedInclude);
      }
    }
    return userIncludes;
  }
}

export default IncludeExtractor;
