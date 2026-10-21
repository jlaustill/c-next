import { extname } from "node:path";
import invariant from "./invariant";

/** The one extension that names cnx source, exactly as spelled (#1833). */
const CNX_EXTENSION = ".cnx";
/** The extension cnx source had before the rename; E0519 in any case (#2167). */
const RETIRED_EXTENSION = ".cnext";

/** The rule both rejections state, before what to rename at their site. */
const RULE = "Only `.cnx`, spelled in lowercase, names cnx source (ADR-010)";

/** Why a path that looks like cnx source is not, as its site reports it. */
interface ISourceRejection {
  readonly code: "E0518" | "E0519";
  readonly message: string;
  readonly helpText: string;
}

/**
 * Issue #1833: the one statement of "is this path cnx source, and what is
 * its stem". Every site that names an output, rewrites an include or cleans a
 * build asks it.
 *
 * Owner ruling: the extension is case-sensitive -- only a lowercase `.cnx` is
 * cnx source. Discovery used to lowercase it while each naming site matched
 * it exactly, so `Colors.CNX` was transpiled and its "header" was named
 * `Colors.CNX`: an in-place build wrote generated C over the source. A path
 * that is `.cnx` in any other case is E0518; `.cnext`, in any case, is E0519
 * (#2167). Each is `isRejected`, and every site reports `rejection`.
 */
class CNextSourcePath {
  /** Whether `path` names cnx source. */
  static isSource(path: string): boolean {
    return extname(path) === CNX_EXTENSION;
  }

  /** Whether `path` looks like cnx source but is E0518 or E0519. */
  static isRejected(path: string): boolean {
    return CNextSourcePath.rejectedCode(path) !== null;
  }

  /**
   * The diagnostic for `name` if it is rejected, else null. `rename` says
   * what to change at the reporting site: the file, an include, a header.
   */
  static rejection(name: string, rename: string): ISourceRejection | null {
    const code = CNextSourcePath.rejectedCode(name);
    if (code === null) return null;
    const message =
      code === "E0519"
        ? `\`.cnext\` no longer names cnx source; rename it to \`.cnx\`: ${name}`
        : `cnx source extension must be lowercase: ${name}`;
    return { code, message, helpText: `${RULE}; ${rename}` };
  }

  /**
   * `path` without its cnx extension: `src/led.cnx` is `src/led`. A path
   * with none is its own stem: a source run's text may have no path
   * (`<string>`) or an editor's (`notes.txt`). A rejected path never gets
   * here; it was E0518 or E0519 at discovery.
   */
  static stem(path: string): string {
    invariant(
      !CNextSourcePath.isRejected(path),
      `a rejected cnx path is E0518 or E0519 before it is named (${path})`,
    );
    return CNextSourcePath.isSource(path)
      ? path.slice(0, -extname(path).length)
      : path;
  }

  /**
   * `path` with its cnx extension replaced: `led.cnx`, `.h` is `led.h`. A
   * path with none is returned as it is, as every naming site did before
   * #1833; what a source run's `<string>` self-include should be is #1204.
   */
  static withExtension(path: string, ext: string): string {
    return CNextSourcePath.isSource(path)
      ? CNextSourcePath.stem(path) + ext
      : CNextSourcePath.stem(path);
  }

  private static rejectedCode(path: string): "E0518" | "E0519" | null {
    const ext = extname(path);
    const lowered = ext.toLowerCase();
    if (lowered === RETIRED_EXTENSION) return "E0519";
    if (lowered === CNX_EXTENSION && ext !== CNX_EXTENSION) return "E0518";
    return null;
  }
}

export default CNextSourcePath;
