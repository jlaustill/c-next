/**
 * IncludeRewriter
 * Renders a `.cnx` `#include` directive as the C/C++ include it becomes.
 *
 * Issue #1467: this is the single place a `.cnx` include directive is turned
 * into include TEXT. It does not decide which header the include names --
 * `PathResolver.getHeaderIncludePath` owns that, and its answers arrive here
 * already resolved, keyed by the author's spelling.
 *
 * Before this existed the rendering lived in three places: IncludeGenerator
 * for the `.c`, IncludeExtractor for the `.h`, and IncludeResolver for
 * ExternalTypeHeaderBuilder. All three swapped the extension on whatever the
 * author typed, so they agreed on a bare `<utils.cnx>` while the header was
 * written to `Display/utils.h`, and the generated C did not compile with
 * `-I <header-out>`.
 */

import type THeaderExtension from "../types/THeaderExtension";

/** `#include <path.cnx>` -- captures the path without its extension. */
const ANGLE_CNX = /#\s*include\s*<([^>]+)\.cnx>/;

/** `#include "path.cnx"` -- captures the path without its extension. */
const QUOTE_CNX = /#\s*include\s*"([^"]+)\.cnx"/;

class IncludeRewriter {
  /**
   * Extract the `.cnx` path an include directive names, as the author spelled
   * it -- `<Display/utils.cnx>` gives `Display/utils.cnx`. Null when the
   * directive does not name a `.cnx` file.
   *
   * The spelling is the key `rewrites` is built with, so both must come from
   * the same reading of the directive.
   */
  static cnxSpecOf(includeText: string): string | null {
    const match = ANGLE_CNX.exec(includeText) ?? QUOTE_CNX.exec(includeText);
    return match ? `${match[1]}.cnx` : null;
  }

  /**
   * Rewrite one directive. A directive that does not name a `.cnx` file is
   * returned unchanged.
   *
   * `rewrites` maps the author's spelling to the path the generated header is
   * reachable at, relative to the header output root. When it has no answer --
   * an include that resolved to nothing, or a header written outside that root
   * -- the author's spelling is kept with its extension swapped, which is what
   * every caller did unconditionally before #1467.
   */
  static rewrite(
    includeText: string,
    rewrites: ReadonlyMap<string, string>,
    ext: THeaderExtension,
  ): string {
    const angleMatch = ANGLE_CNX.exec(includeText);
    if (angleMatch) {
      const spec = `${angleMatch[1]}.cnx`;
      const headerPath = rewrites.get(spec) ?? `${angleMatch[1]}${ext}`;
      return includeText.replace(`<${spec}>`, `<${headerPath}>`);
    }

    const quoteMatch = QUOTE_CNX.exec(includeText);
    if (quoteMatch) {
      const spec = `${quoteMatch[1]}.cnx`;
      const headerPath = rewrites.get(spec) ?? `${quoteMatch[1]}${ext}`;
      return includeText.replace(`"${spec}"`, `"${headerPath}"`);
    }

    return includeText;
  }
}

export default IncludeRewriter;
