import { resolve, extname, basename } from "node:path";
import IFileSystem from "../../types/IFileSystem";
import CNextSourcePath from "../../utils/CNextSourcePath";
import CodedErrorText from "../../utils/CodedErrorText";

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
  /**
   * Expand inputs (files) to list of .cnx files
   *
   * @param inputs - Array of file paths
   * @returns Array of .cnx file paths
   */
  static expandInputs(inputs: string[], fs: IFileSystem): string[] {
    const files: string[] = [];

    for (const input of inputs) {
      const resolvedPath = resolve(input);

      if (!fs.exists(resolvedPath)) {
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
   * Accepts: .cnx, .c, .cpp, .cc, .cxx, .c++
   *
   * @param path - File path to validate
   * @throws Error if extension is invalid
   */
  static validateFileExtension(path: string): void {
    const ext = extname(path);
    const fileName = basename(path);

    // Accept cnx source files
    if (CNextSourcePath.isSource(path)) {
      return;
    }

    const rejection = CNextSourcePath.rejection(fileName, "rename the file.");
    if (rejection !== null) {
      throw new Error(CodedErrorText.of(rejection.code, rejection.message));
    }

    // Accept C/C++ entry point files
    if (InputExpansion.CPP_EXTENSIONS.includes(ext)) {
      return;
    }

    throw new Error(
      `Invalid file extension '${ext}' for file '${fileName}'. ` +
        `cnx only accepts .cnx, .c, .cpp, .cc, .cxx, or .c++ files.`,
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
