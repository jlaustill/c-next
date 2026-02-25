import { resolve, extname, basename } from "node:path";
import { existsSync } from "node:fs";

/**
 * Input expansion for C-Next CLI
 *
 * Validates and resolves file paths for compilation.
 */
class InputExpansion {
  /**
   * Expand inputs (files) to list of .cnx files
   *
   * @param inputs - Array of file paths
   * @returns Array of .cnx file paths
   */
  static expandInputs(inputs: string[]): string[] {
    const files: string[] = [];

    for (const input of inputs) {
      const resolvedPath = resolve(input);

      if (!existsSync(resolvedPath)) {
        throw new Error(`Input not found: ${input}`);
      }

      this.validateFileExtension(resolvedPath);
      files.push(resolvedPath);
    }

    return Array.from(new Set(files));
  }

  /**
   * Validate file extension
   *
   * Accepts: .cnx, .cnext
   * Rejects: .c, .cpp, .cc, .cxx, .c++ (implementation files)
   *
   * @param path - File path to validate
   * @throws Error if extension is invalid
   */
  static validateFileExtension(path: string): void {
    const ext = extname(path);
    const fileName = basename(path);

    // Reject implementation files
    const rejectedExtensions = [".c", ".cpp", ".cc", ".cxx", ".c++"];
    if (rejectedExtensions.includes(ext)) {
      throw new Error(
        `Cannot process implementation file '${fileName}'. ` +
          `C-Next only compiles .cnx files. ` +
          `If you need to include this file, create a header (.h) instead.`,
      );
    }

    // Accept C-Next source files
    const acceptedExtensions = [".cnx", ".cnext"];
    if (!acceptedExtensions.includes(ext)) {
      throw new Error(
        `Invalid file extension '${ext}' for file '${fileName}'. ` +
          `C-Next only accepts .cnx or .cnext files.`,
      );
    }
  }
}

export default InputExpansion;
