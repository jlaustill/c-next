/**
 * ExternalTypeHeaderBuilder
 * Builds mapping from external type names to their C header include directives.
 *
 * Issue #589: Extracted from Transpiler.buildExternalTypeHeaders()
 * Issue #497: Enables header generation to include original C headers instead of
 * generating conflicting forward declarations for types like anonymous struct typedefs.
 */

import ESymbolKind from "../../../utils/types/ESymbolKind";
import ISymbol from "../../../utils/types/ISymbol";

/**
 * Interface for accessing symbols by file path
 */
interface ISymbolSource {
  getSymbolsByFile(filePath: string): ISymbol[];
}

/**
 * Builds mapping from external type names to their C header include directives
 */
class ExternalTypeHeaderBuilder {
  /**
   * Build a map from external type names to their C header include directives.
   *
   * This enables header generation to include the original C headers instead of
   * generating conflicting forward declarations for types like anonymous struct typedefs.
   *
   * @param headerIncludeDirectives Map from header file paths to their include directives
   * @param symbolSource Source for retrieving symbols by file path (typically SymbolTable)
   * @returns Map from type names to include directives (e.g., "MyStruct" -> '#include "mystruct.h"')
   */
  static build(
    headerIncludeDirectives: ReadonlyMap<string, string>,
    symbolSource: ISymbolSource,
  ): Map<string, string> {
    const typeHeaders = new Map<string, string>();

    // Check each header we have an include directive for
    for (const [headerPath, directive] of headerIncludeDirectives) {
      // Get all symbols defined in this header
      const symbols = symbolSource.getSymbolsByFile(headerPath);

      // Map each struct/type/enum name to the include directive
      for (const sym of symbols) {
        if (
          sym.kind === ESymbolKind.Struct ||
          sym.kind === ESymbolKind.Type ||
          sym.kind === ESymbolKind.Enum ||
          sym.kind === ESymbolKind.Class
        ) {
          // Only add if we don't already have a mapping (first include wins)
          if (!typeHeaders.has(sym.name)) {
            typeHeaders.set(sym.name, directive);
          }
        }
      }
    }

    return typeHeaders;
  }
}

export default ExternalTypeHeaderBuilder;
