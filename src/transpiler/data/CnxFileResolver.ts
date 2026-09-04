/**
 * CnxFileResolver
 * Static utilities for resolving C-Next file paths.
 *
 * Extracted from IncludeGenerator.ts as part of layer architecture cleanup.
 * File discovery and path resolution belong in the data layer, not output layer.
 *
 * Issue #1467: `findCnxFile` and `getRelativePathFromInputs` were removed with
 * the #349 angle-include resolution they served. That resolution was a second
 * answer to a question PathResolver already owns, and no production caller ever
 * fed it -- only the quote-include existence check remains.
 */

import { existsSync } from "node:fs";

/**
 * Check if a .cnx file exists at the given path.
 * Used by IncludeGenerator for quote-style include validation.
 */
const cnxFileExists = (cnxPath: string): boolean => {
  return existsSync(cnxPath);
};

class CnxFileResolver {
  static readonly cnxFileExists = cnxFileExists;
}

export default CnxFileResolver;
