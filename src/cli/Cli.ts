/**
 * Cli
 * Main CLI orchestrator that handles argument parsing, config loading,
 * and dispatching to appropriate commands
 */

import { dirname, resolve } from "node:path";
import { existsSync, statSync } from "node:fs";
import ArgParser from "./ArgParser";
import ConfigLoader from "./ConfigLoader";
import ConfigPrinter from "./ConfigPrinter";
import PlatformIOCommand from "./PlatformIOCommand";
import CleanCommand from "./CleanCommand";
import PathNormalizer from "./PathNormalizer";
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

    // Validate single entry point
    if (args.inputFiles.length > 1) {
      console.error("Error: Only one entry point file is supported");
      console.error(
        "Other files are discovered automatically via #include directives",
      );
      return { shouldRun: false, exitCode: 1 };
    }

    if (!config.input) {
      console.error("Error: No input file specified");
      console.error("Usage: cnext <file.cnx>");
      return { shouldRun: false, exitCode: 1 };
    }

    const resolvedInput = resolve(config.input);
    if (!existsSync(resolvedInput)) {
      console.error(`Error: Input not found: ${config.input}`);
      return { shouldRun: false, exitCode: 1 };
    }

    if (statSync(resolvedInput).isDirectory()) {
      console.error(
        "Error: Directory input not supported. Specify an entry point file.",
      );
      console.error(`Example: cnext ${config.input}/main.cnx`);
      return { shouldRun: false, exitCode: 1 };
    }

    // Handle --clean: delete generated files
    if (args.cleanMode) {
      CleanCommand.execute(
        config.input,
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
    const rawConfig: ICliConfig = {
      input: args.inputFiles[0] ?? "",
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

    return PathNormalizer.normalizeConfig(rawConfig);
  }
}

export default Cli;
