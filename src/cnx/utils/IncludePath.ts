/**
 * IncludePath
 * The text a `#include` uses to name a file from a directory.
 */

import { relative, resolve, sep } from "node:path";

class IncludePath {
  /**
   * #2272/#1473: the path from `fromDirectory` to `to`, as `#include` text
   * spells it, with POSIX separators. A quoted include resolves from the
   * directory of the file that holds it, so a generated file spells one
   * relative to where it is written. The one implementation: 1.1 spells a
   * file's own includes with it and 2.3 re-spells a dependency's (#1725).
   */
  static relative(fromDirectory: string, to: string): string {
    return relative(resolve(fromDirectory), resolve(to)).split(sep).join("/");
  }
}

export default IncludePath;
