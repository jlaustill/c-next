/**
 * Cli
 * Main CLI orchestrator that handles argument parsing, config loading,
 * and dispatching to appropriate commands
 */

import { dirname, resolve } from "node:path";
import ArgParser from "./ArgParser";
import ConfigLoader from "./ConfigLoader";
import ConfigPrinter from "./ConfigPrinter";
import PlatformIOCommand from "./PlatformIOCommand";
import CleanCommand from "./CleanCommand";
import ICliResult from "./types/ICliResult";
import ICliConfig from "./types/ICliConfig";
import IParsedArgs from "./types/IParsedArgs";
import IFileConfig from "./types/IFileConfig";

/**
 * Main CLI orchestrator
 */
class Cli {
  /**
   * Run the CLI
   * @returns CLI result with configuration for Runner if transpilation should run
   */
  static run(): ICliResult {
    // Parse arguments (yargs handles --help and --version automatically)
    const args = ArgParser.parse(process.argv);

    // Early exits for PlatformIO commands
    if (args.pioInstall) {
      PlatformIOCommand.install();
      return { shouldRun: false, exitCode: 0 };
    }

    if (args.pioUninstall) {
      PlatformIOCommand.uninstall();
      return { shouldRun: false, exitCode: 0 };
    }

    // Early exit for serve mode (JSON-RPC server)
    if (args.serveMode) {
      return {
        shouldRun: false,
        exitCode: 0,
        serveMode: true,
        serveDebug: args.verbose,
      };
    }

    // Load config file (searches up from input file directory)
    const configDir =
      args.inputFiles.length > 0
        ? dirname(resolve(args.inputFiles[0]))
        : process.cwd();
    const fileConfig = ConfigLoader.load(configDir);

    // Merge CLI args with file config
    const config = this.mergeConfig(args, fileConfig);

    // Handle --config: show effective configuration
    if (args.showConfig) {
      ConfigPrinter.showConfig(config, fileConfig);
      return { shouldRun: false, exitCode: 0 };
    }

    // Validate inputs
    if (config.inputs.length === 0) {
      console.error("Error: No input files specified");
      console.error("Run 'cnext --help' for usage information");
      return { shouldRun: false, exitCode: 1 };
    }

    // Handle --clean: delete generated files
    if (args.cleanMode) {
      CleanCommand.execute(
        config.inputs,
        config.outputPath,
        config.headerOutDir,
      );
      return { shouldRun: false, exitCode: 0 };
    }

    return { shouldRun: true, exitCode: 0, config };
  }

  /**
   * Merge CLI arguments with file configuration
   * CLI flags take precedence over config file values
   */
  private static mergeConfig(
    args: IParsedArgs,
    fileConfig: IFileConfig,
  ): ICliConfig {
    return {
      inputs: args.inputFiles,
      outputPath: args.outputPath || fileConfig.output || "",
      // Merge include dirs: config includes come first, CLI includes override/append
      includeDirs: [...(fileConfig.include ?? []), ...args.includeDirs],
      defines: args.defines,
      preprocess: args.preprocess,
      verbose: args.verbose,
      cppRequired: args.cppRequired || fileConfig.cppRequired || false,
      noCache: args.noCache || fileConfig.noCache === true,
      parseOnly: args.parseOnly,
      headerOutDir: args.headerOutDir ?? fileConfig.headerOut,
      basePath: args.basePath ?? fileConfig.basePath,
      target: args.target ?? fileConfig.target,
      debugMode: args.debugMode || fileConfig.debugMode,
    };
  }
}

export default Cli;
