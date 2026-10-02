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
import FileDiscovery from "./FileDiscovery";
import IncludeDiscovery from "./IncludeDiscovery";
import EFileType from "./types/EFileType";

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
    return IncludeRewriter._cnextSpecOf(includeText)?.path ?? null;
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
    const spec = IncludeRewriter._cnextSpecOf(includeText);
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
   * The C-Next source a directive names, with its form, or null.
   *
   * #1672: split by the one split of a directive's text and classified by
   * `FileDiscovery`, the classification 1.1 resolves with. This held its own
   * regexes and its own copy of the C-Next extensions, matched
   * case-sensitively where discovery is not (#1833).
   */
  private static _cnextSpecOf(
    includeText: string,
  ): { path: string; isLocal: boolean } | null {
    const spec = IncludeDiscovery.specOfDirective(includeText);
    if (spec === null) return null;
    return FileDiscovery.classifyFile(spec.path).type === EFileType.CNext
      ? spec
      : null;
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
