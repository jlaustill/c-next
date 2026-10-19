/**
 * ConfigLoader
 * Loads configuration from project config files, read through the port.
 */

import { dirname, isAbsolute, resolve } from "node:path";
import IFileConfig from "./types/IFileConfig";
import TConfigInDirectory from "./types/TConfigInDirectory";
import TConfigLoad from "./types/TConfigLoad";
import TConfigObject from "./types/TConfigObject";
import PathNormalizer from "./PathNormalizer";
import NodeFileSystem from "../cnx/PARSE/1-Discover/NodeFileSystem";
import IFileSystem from "../cnx/types/IFileSystem";
import CaughtError from "../cnx/utils/CaughtError";
import ConfigFileNames from "../cnx/PARSE/1-Discover/ConfigFileNames";

/**
 * Load configuration from project directory
 */
class ConfigLoader {
  /**
   * Load config from project directory, searching up the directory tree
   * @param startDir - Directory to start searching from
   * @returns The loaded configuration (empty if none was found), or E0918
   *   for each file under an old name the walk met first (#2165)
   */
  static load(
    startDir: string,
    fs: IFileSystem = NodeFileSystem.instance,
  ): TConfigLoad {
    const found = ConfigLoader.find(resolve(startDir), fs);
    if (found.kind === "renamed") {
      return found;
    }
    return { kind: "loaded", config: ConfigLoader.parse(found) };
  }

  /**
   * What `dir` alone holds for the walk (#2165): an old-name file is E0918,
   * whatever else is there; otherwise `ConfigFileNames.readIn`'s config, the
   * one decision of which new-name file that is. `--pio-install` asks it about
   * the directory it configures and updates that directory's config (#2235:
   * with none there, the one it writes shadows an ancestor's).
   */
  static inDirectory(dir: string, fs: IFileSystem): TConfigInDirectory {
    const renamed = ConfigFileNames.renamedIn(dir, fs);
    if (renamed.length > 0) {
      return {
        kind: "renamed",
        errors: renamed.map((file) => ConfigFileNames.errorFor(file)),
      };
    }
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
  private static parse(
    found: Exclude<TConfigInDirectory, { kind: "renamed" }>,
  ): IFileConfig {
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
   * #1653: the first non-empty config file, from `startDir` up to the root.
   *
   * This replaces cosmiconfig, for two reasons. First, cosmiconfig read the
   * disk itself, outside the injected port, where no gate could see it. Second,
   * it read more than `cnx --help` documents. With `stopDir` set, cosmiconfig
   * 9 switches to its "global" strategy, so after the upward walk it also
   * searched the OS config directory for `config`, `config.json`,
   * `config.yaml`, `config.js`, `config.ts` and more, and a JavaScript one
   * would be executed. Only the documented search remains: the three names,
   * JSON, and the upward walk. #2165: the first directory holding an
   * old-name file ends it, as E0918.
   *
   * An empty file is skipped and the search continues, as cosmiconfig's
   * default `ignoreEmptySearchPlaces` did. So is a file that cannot be read,
   * as cosmiconfig skipped EACCES, now with a warning (#1826 review: letting
   * the error escape aborted every run under an unreadable ancestor config).
   */
  private static find(startDir: string, fs: IFileSystem): TConfigInDirectory {
    for (let dir = startDir; ; dir = dirname(dir)) {
      const found = ConfigLoader.inDirectory(dir, fs);
      if (found.kind !== "renamed") {
        for (const file of found.unreadable) {
          console.error(`Warning: ${file.reason}`);
        }
      }
      if (found.kind !== "none" || dirname(dir) === dir) {
        return found;
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
