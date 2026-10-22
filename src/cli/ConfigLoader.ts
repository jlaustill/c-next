/**
 * ConfigLoader
 * Loads configuration from project config files, read through the port.
 */

import { dirname, isAbsolute, resolve } from "node:path";
import IFileConfig from "./types/IFileConfig";
import TConfigInDirectory from "./types/TConfigInDirectory";
import TConfigObject from "./types/TConfigObject";
import PathNormalizer from "./PathNormalizer";
import NodeFileSystem from "../cnx/PARSE/1-Discover/NodeFileSystem";
import IFileSystem from "../cnx/types/IFileSystem";
import CaughtError from "../cnx/utils/CaughtError";
import ConfigFileNames from "../cnx/PARSE/1-Discover/ConfigFileNames";
import IncludeDiscovery from "../cnx/PARSE/1-Discover/IncludeDiscovery";

/**
 * Load configuration from project directory
 */
class ConfigLoader {
  /**
   * Load the config of the project `startDir` is in: the one its project root
   * holds, and none above it.
   *
   * #2261: the root is `IncludeDiscovery.findProjectRoot`'s, the walk that
   * also decides the include tiers, the `.cnx/` cache and the compile
   * database. The config had a walk of its own, which went on past the `.git`
   * or `package.json` that walk stops at, so a run could take its settings
   * from one directory and its root from another, and a `~/.cnxrc` applied to
   * every project on the machine with no config of its own. Every config
   * name is a marker, so a config of any content ends the walk: an empty one
   * is the default settings, and an unreadable one warns.
   *
   * #1653 replaced cosmiconfig, which read the disk outside the injected port
   * and, with `stopDir` set, also searched the OS config directory for
   * `config.js` and more, executing a JavaScript one. Only the documented
   * search remains: the three names, JSON, and this walk.
   *
   * @param startDir - Directory to start searching from
   * @returns The loaded configuration (empty if none was found)
   */
  static load(
    startDir: string,
    fs: IFileSystem = NodeFileSystem.instance,
  ): IFileConfig {
    const root = IncludeDiscovery.findProjectRoot(startDir, fs);
    if (root === null) {
      return {};
    }
    const found = ConfigLoader.inDirectory(root, fs);
    for (const file of found.unreadable) {
      console.error(`Warning: ${file.reason}`);
    }
    return ConfigLoader.parse(found);
  }

  /**
   * What `dir` alone holds (#2165): `ConfigFileNames.readIn`'s config, the
   * one decision of which file that is. `load` asks it about the project root.
   * `--pio-install` asks it about the directory it configures, which holds
   * `platformio.ini` and so is its own root (#2261): that directory's config
   * is the one a run there reads, and no ancestor's applies.
   */
  static inDirectory(dir: string, fs: IFileSystem): TConfigInDirectory {
    const read = ConfigFileNames.readIn(dir, fs);
    return read.config === null
      ? { kind: "none", unreadable: read.unreadable }
      : { kind: "found", ...read.config, unreadable: read.unreadable };
  }

  /**
   * A config file's text as a config object, its paths left as written: the
   * one decision of whether the file holds one (#2221 review). A run warns and
   * ignores a file that does not; `--pio-install` stops before writing, where
   * it used to replace the file and drop its settings.
   */
  static objectOf(found: {
    readonly path: string;
    readonly content: string;
  }): TConfigObject {
    let parsed: unknown;
    try {
      parsed = JSON.parse(found.content);
    } catch (err) {
      return {
        kind: "invalid",
        reason: `Failed to parse config ${found.path}: ${CaughtError.messageOf(err)}`,
      };
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {
        kind: "invalid",
        reason: `Config ${found.path} is not a JSON object`,
      };
    }
    return { kind: "object", config: parsed as IFileConfig };
  }

  /** The config a walk found, parsed and anchored; empty when there is none. */
  private static parse(found: TConfigInDirectory): IFileConfig {
    if (found.kind === "none") {
      return {};
    }
    const read = ConfigLoader.objectOf(found);
    if (read.kind === "invalid") {
      console.error(`Warning: ${read.reason}; ignored`);
      return {};
    }
    read.config._path = found.path;
    return ConfigLoader.anchorPaths(read.config, dirname(found.path));
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
