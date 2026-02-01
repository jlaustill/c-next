/**
 * ConfigLoader
 * Loads configuration from project config files
 */

import { dirname, resolve } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import IFileConfig from "./types/IFileConfig";

/**
 * Config file names in priority order (highest first)
 */
const CONFIG_FILES = ["cnext.config.json", ".cnext.json", ".cnextrc"];

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
    let dir = resolve(startDir);

    while (dir !== dirname(dir)) {
      // Stop at filesystem root
      for (const configFile of CONFIG_FILES) {
        const configPath = resolve(dir, configFile);
        if (existsSync(configPath)) {
          try {
            const content = readFileSync(configPath, "utf-8");
            const config = JSON.parse(content) as IFileConfig;
            config._path = configPath;
            return config;
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error(`Warning: Failed to parse ${configPath}: ${message}`);
            return {};
          }
        }
      }
      dir = dirname(dir);
    }

    return {}; // No config found
  }
}

export default ConfigLoader;
