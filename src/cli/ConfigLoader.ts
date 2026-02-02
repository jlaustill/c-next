/**
 * ConfigLoader
 * Loads configuration from project config files using cosmiconfig
 */

import { cosmiconfigSync } from "cosmiconfig";
import IFileConfig from "./types/IFileConfig";

/**
 * Load configuration from project directory
 */
class ConfigLoader {
  /**
   * Load config from project directory, searching up the directory tree
   * @param startDir - Directory to start searching from
   * @returns Loaded configuration (empty object if no config found)
   */
  static load(startDir: string): IFileConfig {
    const explorer = cosmiconfigSync("cnext", {
      searchPlaces: ["cnext.config.json", ".cnext.json", ".cnextrc"],
      loaders: {
        ".cnextrc": (_filepath: string, content: string) => JSON.parse(content),
      },
      // Search up to filesystem root
      stopDir: "/",
    });

    try {
      const result = explorer.search(startDir);
      if (result?.config) {
        const config = result.config as IFileConfig;
        config._path = result.filepath;
        return config;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Warning: Failed to parse config: ${message}`);
      return {};
    }

    return {}; // No config found
  }
}

export default ConfigLoader;
