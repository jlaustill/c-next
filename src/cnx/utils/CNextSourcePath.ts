import { extname } from "node:path";
import invariant from "./invariant";

/** The extensions that name C-Next source, exactly as spelled (#1833). */
const CNEXT_EXTENSIONS: readonly string[] = [".cnx", ".cnext"];

/**
 * Issue #1833: the one statement of "is this path C-Next source, and what is
 * its stem". Every site that names an output, rewrites an include or cleans a
 * build asks it.
 *
 * Owner ruling: the extension is case-sensitive -- only a lowercase `.cnx` or
 * `.cnext` is C-Next. Discovery used to lowercase it while each naming site
 * matched it exactly, so `Colors.CNX` was transpiled and its "header" was
 * named `Colors.CNX`: an in-place build wrote generated C over the source.
 * A path that is C-Next in any other case is `isMiscased`, and E0518.
 */
class CNextSourcePath {
  /** Whether `path` names C-Next source. */
  static isSource(path: string): boolean {
    return CNEXT_EXTENSIONS.includes(extname(path));
  }

  /** Whether `path` would name C-Next source if its extension were lowercase. */
  static isMiscased(path: string): boolean {
    const ext = extname(path);
    return (
      !CNEXT_EXTENSIONS.includes(ext) &&
      CNEXT_EXTENSIONS.includes(ext.toLowerCase())
    );
  }

  /**
   * `path` without its C-Next extension: `src/led.cnx` is `src/led`. A path
   * with none is its own stem: a source run's text may have no path, or an
   * editor's (`<string>`, `notes.txt`), and its header was always named so.
   * A miscased path never gets here; it was E0518 at discovery.
   */
  static stem(path: string): string {
    invariant(
      !CNextSourcePath.isMiscased(path),
      `a miscased C-Next path is E0518 before it is named (${path})`,
    );
    return CNextSourcePath.isSource(path)
      ? path.slice(0, -extname(path).length)
      : path;
  }

  /** `path` with its C-Next extension replaced: `led.cnx`, `.h` is `led.h`. */
  static withExtension(path: string, ext: string): string {
    return CNextSourcePath.stem(path) + ext;
  }
}

export default CNextSourcePath;
