/**
 * CleanCommand
 * Deletes generated files (.c, .cpp, .h, .hpp) that have matching .cnx sources
 */

import { basename, dirname, join, resolve } from "node:path";
import { unlinkSync } from "node:fs";
import InputExpansion from "../transpiler/data/InputExpansion";
import PathResolver from "../transpiler/data/PathResolver";

/**
 * Command to clean generated output files
 */
class CleanCommand {
  /**
   * Discover CNX files from entry point.
   * Returns null if none found or on error.
   */
  private static discoverCnxFiles(input: string): string[] | null {
    try {
      const cnxFiles = InputExpansion.expandInputs([input]);
      if (cnxFiles.length === 0) {
        console.log("No .cnx files found. Nothing to clean.");
        return null;
      }
      return cnxFiles;
    } catch (error) {
      console.error(`Error: ${error}`);
      return null;
    }
  }

  /**
   * Delete generated files for a given set of extensions.
   */
  private static deleteGeneratedFiles(
    baseName: string,
    relativePath: string | null,
    targetDir: string,
    extensions: string[],
  ): number {
    let count = 0;
    for (const ext of extensions) {
      const outputPath = relativePath
        ? join(targetDir, relativePath.replace(/\.cnx$|\.cnext$/, ext))
        : join(targetDir, baseName + ext);
      if (this.deleteIfExists(outputPath)) {
        count++;
      }
    }
    return count;
  }

  /**
   * Execute the clean command
   *
   * @param input - Entry point .cnx file
   * @param outDir - Output directory for code files
   * @param headerOutDir - Optional separate output directory for headers
   */
  static execute(input: string, outDir: string, headerOutDir?: string): void {
    if (!outDir) {
      console.log("No output directory specified. Nothing to clean.");
      return;
    }

    const cnxFiles = this.discoverCnxFiles(input);
    if (!cnxFiles) return;

    const resolvedOutDir = resolve(outDir);
    const resolvedHeaderDir = headerOutDir
      ? resolve(headerOutDir)
      : resolvedOutDir;

    const pathResolver = new PathResolver({
      inputs: [dirname(resolve(input))],
      outDir,
      headerOutDir,
    });

    let deletedCount = 0;

    for (const cnxFile of cnxFiles) {
      const baseName = basename(cnxFile).replace(/\.cnx$|\.cnext$/, "");
      const relativePath = pathResolver.getRelativePathFromInputs(cnxFile);

      // Delete code files (.c and .cpp)
      deletedCount += this.deleteGeneratedFiles(
        baseName,
        relativePath,
        resolvedOutDir,
        [".c", ".cpp"],
      );

      // Delete header files (.h and .hpp)
      deletedCount += this.deleteGeneratedFiles(
        baseName,
        relativePath,
        resolvedHeaderDir,
        [".h", ".hpp"],
      );
    }

    if (deletedCount === 0) {
      console.log("No generated files found to delete.");
    } else {
      console.log(`Deleted ${deletedCount} generated file(s).`);
    }
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
