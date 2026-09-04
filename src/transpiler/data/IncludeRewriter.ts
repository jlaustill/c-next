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

/**
 * The C-Next source extensions, as `FileDiscovery` maps them. `.cnext` is one
 * of them, and leaving it out is how the previous copies of this pattern
 * diverged: `IncludeResolver` swapped `/\.cnx$|\.cnext$/` while the `.c` and
 * `.h` matched `.cnx` alone, so a `.cnext` include reached no owner at all --
 * emitted verbatim into the `.c` and dropped from the `.h`.
 *
 * The #1399 review already named this shape once, as "a third spelling of
 * 'is this a C-Next include?' (it missed `.cnext`)". This file is where the
 * spelling now lives, so there is one to keep right.
 */
const CNX_EXTENSION = /\.cnx$|\.cnext$/;

/** `#include <path.cnx>` / `<path.cnext>` -- captures the path WITH its extension. */
const ANGLE_CNX = /#\s*include\s*<([^>]+\.(?:cnext|cnx))>/;

/** `#include "path.cnx"` / `"path.cnext"` -- captures the path WITH its extension. */
const QUOTE_CNX = /#\s*include\s*"([^"]+\.(?:cnext|cnx))"/;

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
    return match ? match[1] : null;
  }

  /**
   * The `.cnx` path a QUOTED include names, or null for any other directive.
   *
   * Quote-specific because only quoted includes are resolved relative to the
   * including file and so can be validated at transpile time. Kept here rather
   * than re-spelled at the call site: a second copy of this pattern is exactly
   * what let `.cnext` fall through three producers at once.
   */
  static quotedCnxSpecOf(includeText: string): string | null {
    const match = QUOTE_CNX.exec(includeText);
    return match ? match[1] : null;
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
      const spec = angleMatch[1];
      return includeText.replace(
        `<${spec}>`,
        `<${IncludeRewriter._headerFor(spec, rewrites, ext)}>`,
      );
    }

    const quoteMatch = QUOTE_CNX.exec(includeText);
    if (quoteMatch) {
      const spec = quoteMatch[1];
      return includeText.replace(
        `"${spec}"`,
        `"${IncludeRewriter._headerFor(spec, rewrites, ext)}"`,
      );
    }

    return includeText;
  }

  /**
   * The owner's answer for `spec`, or the extension swap when it has none.
   * The swap keeps the author's spelling, which is right only for a header
   * written beside its source -- it is the fallback, never a second answer.
   */
  private static _headerFor(
    spec: string,
    rewrites: ReadonlyMap<string, string>,
    ext: THeaderExtension,
  ): string {
    return rewrites.get(spec) ?? spec.replace(CNX_EXTENSION, ext);
  }
}

export default IncludeRewriter;
