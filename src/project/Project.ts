/**
 * Project
 * Coordinates multi-file compilation with cross-language symbol resolution
 *
 * This class is now a thin wrapper around Pipeline for backwards compatibility.
 * For new code, consider using Pipeline directly.
 */

import SymbolTable from "../symbols/SymbolTable";
import Pipeline from "../pipeline/Pipeline";
import IProjectConfig from "./types/IProjectConfig";
import IProjectResult from "./types/IProjectResult";

/**
 * Manages multi-file C-Next projects
 *
 * @deprecated Consider using Pipeline directly for new code
 */
class Project {
  private config: IProjectConfig;
  private pipeline: Pipeline;

  constructor(config: IProjectConfig) {
    this.config = {
      extensions: [".cnx", ".cnext"],
      generateHeaders: true,
      preprocess: true,
      ...config,
    };

    // Build inputs list from config
    const inputs: string[] = [];

    // Add explicit files
    if (this.config.files && this.config.files.length > 0) {
      inputs.push(...this.config.files);
    }

    // Add source directories
    if (this.config.srcDirs.length > 0) {
      inputs.push(...this.config.srcDirs);
    }

    // Create pipeline with equivalent configuration
    this.pipeline = new Pipeline({
      inputs,
      includeDirs: this.config.includeDirs,
      outDir: this.config.outDir,
      defines: this.config.defines,
      preprocess: this.config.preprocess,
      generateHeaders: this.config.generateHeaders,
      outputExtension: this.config.outputExtension,
      noCache: this.config.noCache,
    });
  }

  /**
   * Compile the project
   */
  async compile(): Promise<IProjectResult> {
    const pipelineResult = await this.pipeline.run();

    // Convert IPipelineResult to IProjectResult for backwards compatibility
    return {
      success: pipelineResult.success,
      filesProcessed: pipelineResult.filesProcessed,
      symbolsCollected: pipelineResult.symbolsCollected,
      conflicts: pipelineResult.conflicts,
      errors: pipelineResult.errors.map(
        (e) => `${e.line}:${e.column} ${e.message}`,
      ),
      warnings: pipelineResult.warnings,
      outputFiles: pipelineResult.outputFiles,
    };
  }

  /**
   * Get the symbol table (for testing/inspection)
   */
  getSymbolTable(): SymbolTable {
    return this.pipeline.getSymbolTable();
  }
}

export default Project;
