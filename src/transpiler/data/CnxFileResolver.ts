/**
 * CnxFileResolver
 * Static utilities for resolving C-Next file paths.
 *
 * Extracted from IncludeGenerator.ts as part of layer architecture cleanup.
 * File discovery and path resolution belong in the data layer, not output layer.
 */

import { existsSync, statSync } from "node:fs";
import { resolve, relative } from "node:path";

/**
 * Find a .cnx file in the given search paths.
 * Returns the absolute path if found, null otherwise.
 *
 * Issue #349: Used by IncludeGenerator for angle-bracket include resolution.
 */
const findCnxFile = (
  filename: string,
  searchPaths: string[],
): string | null => {
  for (const searchPath of searchPaths) {
    const cnxPath = resolve(searchPath, `${filename}.cnx`);
    if (existsSync(cnxPath)) {
      return cnxPath;
    }
  }
  return null;
};

/**
 * Calculate the relative path from input directories.
 * Returns the relative path (e.g., "Display/utils.cnx") or null if not found.
 *
 * Issue #349: Used by IncludeGenerator for correct header path calculation.
 *
 * Note: PathResolver has an instance method version that uses config.inputs.
 * This static version is for cases where inputs are passed as a parameter.
 */
const getRelativePathFromInputs = (
  filePath: string,
  inputs: string[],
): string | null => {
  for (const input of inputs) {
    const resolvedInput = resolve(input);

    // Skip if input is a file (not a directory)
    if (existsSync(resolvedInput) && statSync(resolvedInput).isFile()) {
      continue;
    }

    const relativePath = relative(resolvedInput, filePath);

    // If relative path doesn't start with '..' it's under this input
    if (!relativePath.startsWith("..") && !relativePath.startsWith("/")) {
      return relativePath;
    }
  }
  return null;
};

/**
 * Check if a .cnx file exists at the given path.
 * Used by IncludeGenerator for quote-style include validation.
 */
const cnxFileExists = (cnxPath: string): boolean => {
  return existsSync(cnxPath);
};

class CnxFileResolver {
  static readonly findCnxFile = findCnxFile;
  static readonly getRelativePathFromInputs = getRelativePathFromInputs;
  static readonly cnxFileExists = cnxFileExists;
}

export default CnxFileResolver;
