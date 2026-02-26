/**
 * ArgParser
 * Parses command-line arguments using yargs
 */

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import ConfigPrinter from "./ConfigPrinter";
import IParsedArgs from "./types/IParsedArgs";

/**
 * Interface for yargs parsed result
 */
interface IYargsResult {
  _: (string | number)[];
  o?: string;
  output?: string;
  "header-out"?: string;
  "base-path"?: string;
  cpp: boolean;
  include: string[];
  target?: string;
  D: string[];
  parse: boolean;
  clean: boolean;
  config: boolean;
  verbose: boolean;
  debug: boolean;
  preprocess: boolean;
  cache: boolean;
  "pio-install": boolean;
  "pio-uninstall": boolean;
  serve: boolean;
}

/**
 * Configure yargs with all options
 */
function configureYargs(args: string[], argv: string[]) {
  return (
    yargs(args)
      .scriptName("cnext")
      .usage(
        `Usage:
  cnext <file.cnx>                          Entry point file (follows includes)
  cnext <file.cnx> -o <output.c>            Single file with explicit output

A safer C for embedded systems development.`,
      )

      // Output options
      .option("o", {
        alias: "output",
        type: "string",
        describe: "Output file or directory (default: same dir as input)",
        requiresArg: true,
      })
      .option("header-out", {
        type: "string",
        describe: "Output directory for header files",
        requiresArg: true,
      })
      .option("base-path", {
        type: "string",
        describe:
          "Strip path prefix from header output (use with --header-out)",
        requiresArg: true,
      })

      // Compilation options
      .option("cpp", {
        type: "boolean",
        describe: "Output .cpp instead of .c (for C++ features like Serial)",
        default: false,
      })
      .option("include", {
        type: "string",
        array: true,
        describe: "Additional include directory (can repeat)",
        requiresArg: true,
        default: [] as string[],
      })
      .option("target", {
        type: "string",
        describe: "Target platform for atomic code gen (ADR-049)",
        requiresArg: true,
      })
      .option("D", {
        type: "string",
        array: true,
        describe: "Define preprocessor macro",
        default: [] as string[],
      })

      // Mode flags
      .option("parse", {
        type: "boolean",
        describe: "Parse only, don't generate code",
        default: false,
      })
      .option("clean", {
        type: "boolean",
        describe: "Delete generated files for all .cnx sources",
        default: false,
      })
      .option("config", {
        type: "boolean",
        describe: "Show effective configuration and exit",
        default: false,
      })

      // Debug/development options
      .option("verbose", {
        type: "boolean",
        describe: "Show include path discovery",
        default: false,
      })
      .option("debug", {
        type: "boolean",
        describe: "Generate panic-on-overflow helpers (ADR-044)",
        default: false,
      })
      .option("preprocess", {
        type: "boolean",
        describe:
          "Run C preprocessor on headers (use --no-preprocess to disable)",
        default: true,
      })
      .option("cache", {
        type: "boolean",
        describe: "Enable symbol cache (use --no-cache to disable)",
        default: true,
      })

      // PlatformIO integration
      .option("pio-install", {
        type: "boolean",
        describe: "Setup PlatformIO integration",
        default: false,
      })
      .option("pio-uninstall", {
        type: "boolean",
        describe: "Remove PlatformIO integration",
        default: false,
      })

      // Server mode
      .option("serve", {
        type: "boolean",
        describe: "Start JSON-RPC server on stdin/stdout",
        default: false,
      })

      // Config file documentation (shown in help)
      .epilogue(
        `Examples:
  cnext src/main.cnx                        # Entry point (follows includes)
  cnext main.cnx -o build/main.c            # Explicit output path

Target platforms: teensy41, cortex-m7, cortex-m4, cortex-m3, cortex-m0+, cortex-m0, avr

Config files (searched in order, JSON format):
  cnext.config.json, .cnext.json, .cnextrc

Config options:
  cppRequired    Output .cpp instead of .c (boolean)
  noCache        Disable symbol caching (boolean)
  include        Additional include directories (string[])
  output         Output directory for generated files (string)
  headerOut      Separate directory for header files (string)
  target         Target platform for atomic code gen (string)
  debugMode      Generate panic-on-overflow helpers (boolean)`,
      )

      // Version from package.json
      .version(
        "version",
        "Show version",
        `cnext v${ConfigPrinter.getVersion()}`,
      )
      .alias("version", "v")

      // Help
      .help("help")
      .alias("help", "h")

      // Strict mode - reject unknown options (but allow positional args)
      .strictOptions()

      // Fail handler for unknown options
      .fail((msg, err, yargsInstance) => {
        if (err) throw err;
        // Check for -I flag (common GCC mistake)
        const hasIFlag = argv.some((arg) => arg.startsWith("-I"));
        if (hasIFlag) {
          console.error("Error: Unknown flag '-I...'");
          console.error("  Did you mean: --include <dir>");
          console.error("");
          console.error("Example:");
          console.error("  cnext src --include path/to/headers");
          process.exit(1);
        }
        console.error(msg);
        console.error("");
        yargsInstance.showHelp();
        process.exit(1);
      })
  );
}

/**
 * Parse command-line arguments using yargs
 */
class ArgParser {
  /**
   * Parse command-line arguments into a structured object
   * @param argv - Command-line arguments (typically process.argv)
   * @returns Parsed arguments object
   */
  static parse(argv: string[]): IParsedArgs {
    const args = hideBin(argv);

    // Show help and exit 0 when no arguments provided
    if (args.length === 0) {
      configureYargs([], argv).showHelp("log"); // Output to stdout, not stderr
      process.exit(0);
    }

    const parsed = configureYargs(args, argv).parseSync() as IYargsResult;

    // Parse -D defines into a record
    const defines: Record<string, string | boolean> = {};
    for (const define of parsed.D) {
      const eqIndex = define.indexOf("=");
      if (eqIndex > 0) {
        defines[define.slice(0, eqIndex)] = define.slice(eqIndex + 1);
      } else {
        defines[define] = true;
      }
    }

    // Get input files from positional args (everything that isn't an option)
    const inputFiles = parsed._.map(String);

    return {
      inputFiles,
      outputPath: parsed.o ?? "",
      includeDirs: parsed.include,
      defines,
      cppRequired: parsed.cpp,
      target: parsed.target,
      preprocess: parsed.preprocess,
      verbose: parsed.verbose,
      noCache: !parsed.cache,
      parseOnly: parsed.parse,
      headerOutDir: parsed["header-out"],
      basePath: parsed["base-path"],
      cleanMode: parsed.clean,
      showConfig: parsed.config,
      pioInstall: parsed["pio-install"],
      pioUninstall: parsed["pio-uninstall"],
      debugMode: parsed.debug,
      serveMode: parsed.serve,
    };
  }
}

export default ArgParser;
