/**
 * ConfigPrinter
 * Displays effective configuration and provides version info
 */

import ICliConfig from "./types/ICliConfig";
import IFileConfig from "./types/IFileConfig";
import packageJson from "../../package.json" with { type: "json" };

/**
 * Version string from package.json
 */
const VERSION = packageJson.version as string;

/**
 * Print effective configuration and version info
 */
class ConfigPrinter {
  /**
   * Get the current version string
   */
  static getVersion(): string {
    return VERSION;
  }

  /**
   * Display effective configuration
   * @param config - Merged effective configuration
   * @param fileConfig - Configuration loaded from file (for displaying path)
   */
  static showConfig(config: ICliConfig, fileConfig: IFileConfig): void {
    console.log("Effective configuration:");
    console.log("");
    console.log("  Config file:    " + (fileConfig._path ?? "(none)"));
    console.log("  cppRequired:    " + config.cppRequired);
    console.log("  debugMode:      " + (config.debugMode ?? false));
    console.log("  target:         " + (config.target ?? "(none)"));
    console.log("  noCache:        " + config.noCache);
    console.log("  preprocess:     " + config.preprocess);
    console.log(
      "  output:         " + (config.outputPath || "(same dir as input)"),
    );
    console.log(
      "  headerOut:      " + (config.headerOutDir ?? "(same as output)"),
    );
    console.log("  basePath:       " + (config.basePath ?? "(none)"));
    console.log(
      "  include:        " + (config.includeDirs.length > 0 ? "" : "(none)"),
    );
    for (const dir of config.includeDirs) {
      console.log("    - " + dir);
    }
    console.log(
      "  defines:        " +
        (Object.keys(config.defines).length > 0 ? "" : "(none)"),
    );
    for (const [key, value] of Object.entries(config.defines)) {
      console.log("    - " + key + (value === true ? "" : "=" + value));
    }
    console.log("");
    console.log("Source:");
    console.log("  CLI flags take precedence over config file values");
  }
}

export default ConfigPrinter;
