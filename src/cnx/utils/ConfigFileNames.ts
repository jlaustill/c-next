import { basename, join } from "node:path";
import CodedErrorText from "./CodedErrorText";
import type IFileSystem from "../types/IFileSystem";
import type IRenamedConfigFile from "../types/IRenamedConfigFile";
import type ITranspileError from "../types/ITranspileError";

/** The config file names, searched in this order in each directory. */
const NAMES: readonly string[] = ["cnx.config.json", ".cnx.json", ".cnxrc"];

/** Each name read before the language was named cnx, and its successor. */
const RENAMED: ReadonlyMap<string, string> = new Map([
  ["cnext.config.json", "cnx.config.json"],
  [".cnext.json", ".cnx.json"],
  [".cnextrc", ".cnxrc"],
]);

/**
 * Issue #2165: the one statement of what a project's config file is called.
 *
 * The config walk (`ConfigLoader`), the project-root walk
 * (`IncludeDiscovery.findProjectRoot`), `--pio-install` and `--help` all read
 * the names here; they were written out at each, and the config walk and the
 * root walk each carried a copy. A file under an old name is E0918 wherever a
 * walk meets it, so a renamed project's settings are never dropped with no
 * diagnostic.
 */
class ConfigFileNames {
  static readonly names = NAMES;

  /** The names as prose: `cnx.config.json, .cnx.json and .cnxrc`. */
  static readonly listed = `${NAMES.slice(0, -1).join(", ")} and ${NAMES.at(-1)}`;

  /** The old-name config files in `dir`, in search order. */
  static renamedIn(dir: string, fs: IFileSystem): IRenamedConfigFile[] {
    const found: IRenamedConfigFile[] = [];
    for (const [oldName, successor] of RENAMED) {
      const path = join(dir, oldName);
      if (fs.isFile(path)) {
        found.push({
          path,
          successor,
          besideConfig: ConfigFileNames.configIn(dir, fs),
        });
      }
    }
    return found;
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

  /** The first new-name config file in `dir`, empty or not. */
  private static configIn(dir: string, fs: IFileSystem): string | null {
    for (const name of NAMES) {
      const path = join(dir, name);
      if (fs.isFile(path)) {
        return path;
      }
    }
    return null;
  }
}

export default ConfigFileNames;
