import { extname } from "node:path";
import invariant from "./invariant";

/** The extensions that name C-Next source, exactly as spelled (#1833). */
const CNEXT_EXTENSIONS: ReadonlySet<string> = new Set([".cnx", ".cnext"]);

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
    return CNEXT_EXTENSIONS.has(extname(path));
  }

  /** Whether `path` would name C-Next source if its extension were lowercase. */
  static isMiscased(path: string): boolean {
    const ext = extname(path);
    return (
      !CNEXT_EXTENSIONS.has(ext) && CNEXT_EXTENSIONS.has(ext.toLowerCase())
    );
  }

  /**
   * `path` without its C-Next extension: `src/led.cnx` is `src/led`. A path
   * with none is its own stem: a source run's text may have no path
   * (`<string>`) or an editor's (`notes.txt`). A miscased path never gets
   * here; it was E0518 at discovery.
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

  /**
   * `path` with its C-Next extension replaced: `led.cnx`, `.h` is `led.h`. A
   * path with none is returned as it is, as every naming site did before
   * #1833; what a source run's `<string>` self-include should be is #1204.
   */
  static withExtension(path: string, ext: string): string {
    return CNextSourcePath.isSource(path)
      ? CNextSourcePath.stem(path) + ext
      : CNextSourcePath.stem(path);
  }

  /** E0518's message, for every site that reports one. */
  static miscasedMessage(name: string): string {
    return `C-Next source extension must be lowercase: ${name}`;
  }

  /** E0518's help: the rule, then what to rename at this site. */
  static miscasedHelp(rename: string): string {
    return `Only \`.cnx\` and \`.cnext\`, spelled in lowercase, name C-Next source (ADR-010); ${rename}`;
  }
}

export default CNextSourcePath;
