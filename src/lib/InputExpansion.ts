import { resolve, extname, basename } from "path";
import { existsSync, statSync, readdirSync } from "fs";

/**
 * Input expansion for C-Next CLI
 *
 * Expands file paths and directories into a list of .cnx files to compile.
 * Handles recursive directory scanning and file validation.
 */
class InputExpansion {
  /**
   * Expand inputs (files or directories) to list of .cnx files
   *
   * @param inputs - Array of file paths or directories
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

      if (stats.isDirectory()) {
        // Recursively find .cnx files
        const cnextFiles = this.findCNextFiles(resolvedPath);
        files.push(...cnextFiles);
      } else if (stats.isFile()) {
        // Validate and add file
        this.validateFileExtension(resolvedPath);
        files.push(resolvedPath);
      }
    }

    // Remove duplicates
    return Array.from(new Set(files));
  }

  /**
   * Recursively find .cnx files in directory
   *
   * @param dir - Directory to scan
   * @returns Array of .cnx file paths
   */
  static findCNextFiles(dir: string): string[] {
    const files: string[] = [];

    try {
      const entries = readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = resolve(dir, entry.name);

        // Skip hidden directories and common build/dependency directories
        if (entry.isDirectory()) {
          const dirName = entry.name;
          if (
            dirName.startsWith(".") ||
            dirName === "node_modules" ||
            dirName === "build" ||
            dirName === ".pio" ||
            dirName === "dist"
          ) {
            continue;
          }

          // Recursively scan subdirectory
          const subFiles = this.findCNextFiles(fullPath);
          files.push(...subFiles);
        } else if (entry.isFile()) {
          const ext = extname(entry.name);
          if (ext === ".cnx" || ext === ".cnext") {
            files.push(fullPath);
          }
        }
      }
    } catch (error) {
      throw new Error(`Failed to scan directory ${dir}: ${error}`, {
        cause: error,
      });
    }

    return files;
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
