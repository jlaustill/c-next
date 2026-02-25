import { resolve, extname, basename } from "node:path";
import { existsSync, statSync } from "node:fs";

/**
 * Input expansion for C-Next CLI
 *
 * Validates and resolves file paths for compilation.
 */
class InputExpansion {
  private static readonly CPP_EXTENSIONS = [
    ".c",
    ".cpp",
    ".cc",
    ".cxx",
    ".c++",
  ];
  private static readonly CNEXT_EXTENSIONS = [".cnx", ".cnext"];
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

      const stats = statSync(resolvedPath);

      if (stats.isFile()) {
        this.validateFileExtension(resolvedPath);
        files.push(resolvedPath);
      }
    }

    return Array.from(new Set(files));
  }

  /**
   * Validate file extension
   *
   * Accepts: .cnx, .cnext, .c, .cpp, .cc, .cxx, .c++
   *
   * @param path - File path to validate
   * @throws Error if extension is invalid
   */
  static validateFileExtension(path: string): void {
    const ext = extname(path);
    const fileName = basename(path);

    // Accept C-Next source files
    if (InputExpansion.CNEXT_EXTENSIONS.includes(ext)) {
      return;
    }

    // Accept C/C++ entry point files
    if (InputExpansion.CPP_EXTENSIONS.includes(ext)) {
      return;
    }

    throw new Error(
      `Invalid file extension '${ext}' for file '${fileName}'. ` +
        `C-Next only accepts .cnx, .cnext, .c, .cpp, .cc, .cxx, or .c++ files.`,
    );
  }

  /**
   * Check if a file is a C/C++ entry point
   *
   * @param path - File path to check
   * @returns true if the file has a C/C++ extension
   */
  static isCppEntryPoint(path: string): boolean {
    const ext = extname(path);
    return InputExpansion.CPP_EXTENSIONS.includes(ext);
  }
}

export default InputExpansion;
