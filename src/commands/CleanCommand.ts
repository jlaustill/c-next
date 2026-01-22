/**
 * CleanCommand
 * Deletes generated files (.c, .cpp, .h, .hpp) that have matching .cnx sources
 */

import { basename, join, relative, resolve } from "path";
import { existsSync, statSync, unlinkSync } from "fs";
import InputExpansion from "../lib/InputExpansion";

/**
 * Command to clean generated output files
 */
class CleanCommand {
  /**
   * Execute the clean command
   *
   * @param inputs - Input files or directories (source locations)
   * @param outDir - Output directory for code files
   * @param headerOutDir - Optional separate output directory for headers
   */
  static execute(
    inputs: string[],
    outDir: string,
    headerOutDir?: string,
  ): void {
    // If no outDir specified, we can't determine where to clean
    if (!outDir) {
      console.log("No output directory specified. Nothing to clean.");
      return;
    }

    // Discover all .cnx files
    let cnxFiles: string[];
    try {
      cnxFiles = InputExpansion.expandInputs(inputs);
    } catch (error) {
      console.error(`Error: ${error}`);
      return;
    }

    if (cnxFiles.length === 0) {
      console.log("No .cnx files found. Nothing to clean.");
      return;
    }

    const resolvedOutDir = resolve(outDir);
    const resolvedHeaderDir = headerOutDir
      ? resolve(headerOutDir)
      : resolvedOutDir;

    let deletedCount = 0;

    // For each .cnx file, calculate and delete generated files
    for (const cnxFile of cnxFiles) {
      const baseName = basename(cnxFile).replace(/\.cnx$|\.cnext$/, "");

      // Calculate relative path from input directories
      const relativePath = this.getRelativePath(cnxFile, inputs);

      // Code files (.c and .cpp) go to outDir
      const codeExtensions = [".c", ".cpp"];
      for (const ext of codeExtensions) {
        const outputPath = relativePath
          ? join(resolvedOutDir, relativePath.replace(/\.cnx$|\.cnext$/, ext))
          : join(resolvedOutDir, baseName + ext);

        if (this.deleteIfExists(outputPath)) {
          deletedCount++;
        }
      }

      // Header files (.h and .hpp) go to headerOutDir
      const headerExtensions = [".h", ".hpp"];
      for (const ext of headerExtensions) {
        const headerPath = relativePath
          ? join(
              resolvedHeaderDir,
              relativePath.replace(/\.cnx$|\.cnext$/, ext),
            )
          : join(resolvedHeaderDir, baseName + ext);

        if (this.deleteIfExists(headerPath)) {
          deletedCount++;
        }
      }
    }

    if (deletedCount === 0) {
      console.log("No generated files found to delete.");
    } else {
      console.log(`Deleted ${deletedCount} generated file(s).`);
    }
  }

  /**
   * Get relative path of a file from input directories.
   * Returns undefined if file is not under any input directory.
   *
   * When undefined is returned (e.g., for single file inputs), the caller
   * falls back to using just the basename, which is correct behavior since
   * there's no directory structure to preserve.
   */
  private static getRelativePath(
    filePath: string,
    inputs: string[],
  ): string | undefined {
    for (const input of inputs) {
      const resolvedInput = resolve(input);

      // Skip file inputs - only directories can establish relative structure.
      // For single file inputs like "cnext myfile.cnx -o build", we return
      // undefined and the caller uses baseName, which is the correct behavior.
      if (existsSync(resolvedInput) && statSync(resolvedInput).isFile()) {
        continue;
      }

      const rel = relative(resolvedInput, filePath);

      // Check if file is under this input directory
      if (rel && !rel.startsWith("..")) {
        return rel;
      }
    }

    return undefined;
  }

  /**
   * Delete a file if it exists
   * @returns true if file was deleted, false otherwise
   */
  private static deleteIfExists(filePath: string): boolean {
    try {
      unlinkSync(filePath);
      console.log(`  Deleted: ${filePath}`);
      return true;
    } catch (err: unknown) {
      // ENOENT means file doesn't exist - not an error for our purposes
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return false;
      }
      console.error(`  Failed to delete ${filePath}: ${err}`);
      return false;
    }
  }
}

export default CleanCommand;
