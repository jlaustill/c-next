import { join } from "node:path";
import CaughtError from "../../utils/CaughtError";
import CONFIG_FILE_NAMES from "../../types/CONFIG_FILE_NAMES";
import type IFileSystem from "../../types/IFileSystem";
import type IConfigRead from "./types/IConfigRead";

/**
 * Issue #2165: what a directory's config files mean. The names are
 * `CONFIG_FILE_NAMES`; the project-root walk
 * (`IncludeDiscovery.findProjectRoot`) finds the root `ConfigLoader` reads the
 * config from (#2261), and `--pio-install` asks about the directory it
 * configures. Which file a directory's config is, `readIn`, is decided here
 * once (#2221 review).
 *
 * It reads the filesystem, which only 1.1 Discover and 3.1 Write may
 * (`filesystem-only-in-discover-and-write`), so it is 1.1's.
 */
class ConfigFileNames {
  /**
   * The config a run reads in `dir`: the first file, in
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
}

export default ConfigFileNames;
