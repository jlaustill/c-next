/**
 * ConfigLoader
 * Loads configuration from project config files using cosmiconfig
 */

import { cosmiconfigSync } from "cosmiconfig";
import { dirname, isAbsolute, resolve } from "node:path";
import IFileConfig from "./types/IFileConfig";
import PathNormalizer from "./PathNormalizer";

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
        return ConfigLoader.anchorPaths(config, dirname(result.filepath));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Warning: Failed to parse config: ${message}`);
      return {};
    }

    return {}; // No config found
  }

  /**
   * Issue #1547: anchor every path a config file declares to that config file's
   * own directory.
   *
   * cosmiconfig searches UPWARD from the start directory, so the config that is
   * found is routinely not in the directory the user is standing in. A relative
   * path read out of it and left relative is therefore resolved against the CWD
   * by whoever consumes it, which makes the destination slide with the shell:
   * the same project, config and entry file wrote the header to `proj/include`,
   * `proj/src/include` or `proj/include/include` depending only on where the
   * run started. `include` entries failed more quietly still -- an unresolvable
   * directory is dropped by PathNormalizer.expandRecursive, so the path simply
   * vanished from the effective config with nothing reported.
   *
   * The config file's directory is the project root by definition: it is the
   * thing the upward search was looking for. Anchoring here rather than at each
   * consumer also keeps CLI flags correct by construction -- everything this
   * class returns came from the file, so there is no path by which a flag
   * (typed at the shell, where CWD *is* the right anchor) can reach this code.
   */
  private static anchorPaths(
    config: IFileConfig,
    configDir: string,
  ): IFileConfig {
    if (config.output) {
      config.output = ConfigLoader.anchor(config.output, configDir);
    }
    if (config.headerOut) {
      config.headerOut = ConfigLoader.anchor(config.headerOut, configDir);
    }
    if (config.include) {
      config.include = config.include.map((path) =>
        ConfigLoader.anchor(path, configDir),
      );
    }
    return config;
  }

  /**
   * Resolve one config-declared path against `configDir`. A `~` path is the
   * user's own absolute spelling and an already-absolute path is already
   * anchored, so neither is relative to anything and both are left alone.
   */
  private static anchor(path: string, configDir: string): string {
    const expanded = PathNormalizer.expandTilde(path);
    return isAbsolute(expanded) ? expanded : resolve(configDir, expanded);
  }
}

export default ConfigLoader;
