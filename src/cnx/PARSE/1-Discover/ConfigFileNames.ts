import { basename, join } from "node:path";
import CaughtError from "../../utils/CaughtError";
import CodedErrorText from "../../utils/CodedErrorText";
import CONFIG_FILE_NAMES from "../../types/CONFIG_FILE_NAMES";
import type IFileSystem from "../../types/IFileSystem";
import type IRenamedConfigFile from "../../types/IRenamedConfigFile";
import type IConfigRead from "./types/IConfigRead";
import type ITranspileError from "../../types/ITranspileError";

/**
 * The names read before the language was named cnx, in `CONFIG_FILE_NAMES`
 * order: each one's successor is the name at its position, so the new names
 * are written once.
 */
const OLD_NAMES = [
  "cnext.config.json",
  ".cnext.json",
  ".cnextrc",
] as const satisfies { length: (typeof CONFIG_FILE_NAMES)["length"] };

/** Each old name, and its successor. */
const RENAMED: ReadonlyMap<string, string> = new Map(
  OLD_NAMES.map((oldName, index) => [oldName, CONFIG_FILE_NAMES[index]]),
);

/**
 * Issue #2165: what a directory's config files mean. The names are
 * `CONFIG_FILE_NAMES`; the project-root walk
 * (`IncludeDiscovery.findProjectRoot`), whose root `ConfigLoader` reads the
 * config from (#2261), and `--pio-install` ask this about the old names. A
 * file under one is E0918 wherever a walk meets it, so a renamed project's
 * settings are never dropped with no diagnostic. Which new-name file a
 * directory's config is, `readIn`, is decided here once, for the config read
 * and for E0918's help alike (#2221 review).
 *
 * It reads the filesystem, which only 1.1 Discover and 3.1 Write may
 * (`filesystem-only-in-discover-and-write`), so it is 1.1's.
 */
class ConfigFileNames {
  /** The names as prose: `cnx.config.json, .cnx.json and .cnxrc`. */
  static readonly listed = `${CONFIG_FILE_NAMES.slice(0, -1).join(", ")} and ${CONFIG_FILE_NAMES.at(-1)}`;

  /** The old-name config files in `dir`, in search order. */
  static renamedIn(dir: string, fs: IFileSystem): IRenamedConfigFile[] {
    const found = [...RENAMED]
      .map(([oldName, successor]) => ({ path: join(dir, oldName), successor }))
      .filter((file) => fs.isFile(file.path));
    if (found.length === 0) {
      return [];
    }
    const besideConfig = ConfigFileNames.besideConfigIn(dir, fs);
    return found.map((file) => ({ ...file, besideConfig }));
  }

  /**
   * The config a run reads in `dir`: the first new-name file, in
   * `CONFIG_FILE_NAMES` order, that can be read and is not empty. An empty one
   * is skipped, as is one that cannot be read, which is returned for the
   * caller to warn about (#1826 review: letting the error escape aborted every
   * run under an unreadable ancestor config).
   */
  static readIn(dir: string, fs: IFileSystem): IConfigRead {
    const unreadable: { path: string; reason: string }[] = [];
    for (const name of CONFIG_FILE_NAMES) {
      const path = join(dir, name);
      if (!fs.isFile(path)) {
        continue;
      }
      let content: string;
      try {
        content = fs.readFile(path);
      } catch (err) {
        unreadable.push({
          path,
          reason: `Failed to read config ${path}: ${CaughtError.messageOf(err)}`,
        });
        continue;
      }
      if (content.trim() !== "") {
        return { config: { path, content }, unreadable };
      }
    }
    return { config: null, unreadable };
  }

  /**
   * E0918, at the old file. Placed at `1:0`, as a diagnostic about a whole
   * file is; the file is the config, not a C-Next source.
   */
  static errorFor(renamed: IRenamedConfigFile): ITranspileError {
    const oldName = basename(renamed.path);
    const beside =
      renamed.besideConfig === null ? null : basename(renamed.besideConfig);
    return {
      sourcePath: renamed.path,
      line: 1,
      column: 0,
      severity: "error",
      message: CodedErrorText.of(
        "E0918",
        beside === null
          ? `a config file has its old name: ${oldName} is now ${renamed.successor}`
          : `a config file has its old name: ${oldName}, beside ${beside}`,
      ),
      helpText:
        beside === null
          ? `cnx reads ${ConfigFileNames.listed}. Rename this file to ${renamed.successor}; a library's config is renamed in the library.`
          : `cnx reads ${ConfigFileNames.listed}, never this file. Move any setting ${beside} lacks into it, then delete this file.`,
    };
  }

  /**
   * The new-name config beside an old file: the one a run reads (`readIn`),
   * or, when every one is empty, the first that exists, which a run reads once
   * the old file's settings are moved into it.
   */
  private static besideConfigIn(dir: string, fs: IFileSystem): string | null {
    const read = ConfigFileNames.readIn(dir, fs).config;
    if (read !== null) {
      return read.path;
    }
    return (
      CONFIG_FILE_NAMES.map((name) => join(dir, name)).find((path) =>
        fs.isFile(path),
      ) ?? null
    );
  }
}

export default ConfigFileNames;
