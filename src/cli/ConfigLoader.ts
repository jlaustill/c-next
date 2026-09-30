/**
 * ConfigLoader
 * Loads configuration from project config files, read through the port.
 */

import { dirname, isAbsolute, join, resolve } from "node:path";
import IFileConfig from "./types/IFileConfig";
import PathNormalizer from "./PathNormalizer";
import NodeFileSystem from "../transpiler/NodeFileSystem";

/**
 * Searched in this order in each directory. `cnext --help` documents these
 * three names and JSON as the only format.
 */
const SEARCH_PLACES = ["cnext.config.json", ".cnext.json", ".cnextrc"];

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
    const found = ConfigLoader.find(resolve(startDir));
    if (!found) {
      return {}; // No config found
    }

    let config: unknown;
    try {
      config = JSON.parse(found.content);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Warning: Failed to parse config: ${message}`);
      return {};
    }
    if (!config || typeof config !== "object") {
      return {};
    }

    const fileConfig = config as IFileConfig;
    fileConfig._path = found.path;
    return ConfigLoader.anchorPaths(fileConfig, dirname(found.path));
  }

  /**
   * #1653: the first non-empty config file, from `startDir` up to the root.
   *
   * This replaces cosmiconfig, for two reasons. First, cosmiconfig read the
   * disk itself, outside the injected port, where no gate could see it. Second,
   * it read more than `cnext --help` documents. With `stopDir` set, cosmiconfig
   * 9 switches to its "global" strategy, so after the upward walk it also
   * searched the OS config directory for `config`, `config.json`,
   * `config.yaml`, `config.js`, `config.ts` and more, and a JavaScript one
   * would be executed. Only the documented search remains: the three names,
   * JSON, and the upward walk.
   *
   * An empty file is skipped and the search continues, as cosmiconfig's
   * default `ignoreEmptySearchPlaces` did.
   */
  private static find(
    startDir: string,
  ): { path: string; content: string } | null {
    const fs = NodeFileSystem.instance;
    for (let dir = startDir; ; dir = dirname(dir)) {
      for (const place of SEARCH_PLACES) {
        const path = join(dir, place);
        if (!fs.isFile(path)) continue;
        const content = fs.readFile(path);
        if (content.trim() !== "") {
          return { path, content };
        }
      }
      if (dirname(dir) === dir) {
        return null;
      }
    }
  }

  /**
   * Issue #1547: anchor every path a config file declares to that config file's
   * own directory.
   *
   * The search goes UPWARD from the start directory, so the config that is
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
      // Empty entries are filtered rather than anchored: `resolve(configDir, "")`
      // is `configDir`, so anchoring one would silently put the whole project
      // root on the header search path. Same reason `output` and `headerOut`
      // above are guarded -- an empty `output` must keep meaning "(same dir as
      // input)" rather than becoming the project root.
      config.include = config.include
        .filter(Boolean)
        .map((path) => ConfigLoader.anchor(path, configDir));
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
