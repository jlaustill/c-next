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

import { extname } from "node:path";

import type THeaderExtension from "../types/THeaderExtension";
import IncludeDirectiveText from "../../utils/IncludeDirectiveText";

class IncludeRewriter {
  /**
   * Rewrite one directive that names C-Next source. A directive with no path
   * is returned unchanged.
   *
   * #1444, owner ruling 1: whether a directive names C-Next source is 1.1
   * Discover's answer, recorded per directive, and the caller asks it before
   * calling this. This used to classify the spelling itself, as the third
   * copy of a decision 1.1 and 2.1 also made.
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
    const spec = IncludeDirectiveText.split(includeText);
    if (spec === null) return includeText;
    // The path is everything between the delimiters, and the closing one is
    // the token's last character, so only the path is replaced: the author's
    // spacing and form survive.
    const pathStart = includeText.length - 1 - spec.path.length;
    return (
      includeText.slice(0, pathStart) +
      IncludeRewriter._headerFor(spec.path, rewrites, ext) +
      includeText.slice(-1)
    );
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
    return rewrites.get(spec) ?? IncludeRewriter.besideSource(spec, ext);
  }

  /**
   * The header generated beside a `.cnx`: the same path with its C-Next
   * extension swapped for `ext`. Right only for a header written beside its
   * source -- the fallback when the output root does not reach it.
   */
  static besideSource(cnxPath: string, ext: THeaderExtension): string {
    return cnxPath.slice(0, cnxPath.length - extname(cnxPath).length) + ext;
  }
}

export default IncludeRewriter;
