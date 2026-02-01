/**
 * ResultPrinter
 * Prints transpiler compilation results
 */

import ITranspilerResult from "../transpiler/types/ITranspilerResult";

/**
 * Print transpiler compilation results
 */
class ResultPrinter {
  /**
   * Print pipeline compilation result
   * @param result - Transpiler result to print
   */
  static print(result: ITranspilerResult): void {
    // Print warnings
    for (const warning of result.warnings) {
      console.warn(`Warning: ${warning}`);
    }

    // Print conflicts
    for (const conflict of result.conflicts) {
      console.error(`Conflict: ${conflict}`);
    }

    // Print errors
    for (const error of result.errors) {
      // Format error with source path if available
      const location = error.sourcePath
        ? `${error.sourcePath}:${error.line}:${error.column}`
        : `${error.line}:${error.column}`;
      console.error(`Error: ${location} ${error.message}`);
    }

    // Summary
    if (result.success) {
      console.log("");
      console.log(`Compiled ${result.filesProcessed} files`);
      console.log(`Collected ${result.symbolsCollected} symbols`);
      console.log(`Generated ${result.outputFiles.length} output files:`);
      for (const file of result.outputFiles) {
        console.log(`  ${file}`);
      }
    } else {
      console.error("");
      console.error("Compilation failed");
    }
  }
}

export default ResultPrinter;
