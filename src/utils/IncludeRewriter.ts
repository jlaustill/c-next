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

import EFileType from "../PARSE/1-Discover/types/EFileType";
import type THeaderExtension from "../transpiler/types/THeaderExtension";
import IncludeDirectiveText from "./IncludeDirectiveText";
import invariant from "./invariant";

class IncludeRewriter {
  /**
   * Whether 1.1 Discover classified this directive as naming C-Next source.
   * A directive with no path names nothing.
   *
   * #1444, owner ruling 1: the kind is 1.1's answer, recorded per directive.
   * This is the one place a rewrite reads it, so the `.h`'s user includes
   * (1.1) and the `.c`'s directives (2.3) follow it the same way. The PR
   * review found the lookup written once in each caller, and the two copies
   * had already diverged: render asserted the answer was there, and the
   * resolver read a missing one as a C header.
   */
  static namesCNext(
    includeText: string,
    kinds: ReadonlyMap<string, EFileType>,
  ): boolean {
    return IncludeRewriter._cnextSpec(includeText, kinds) !== null;
  }

  /**
   * Rewrite one directive by 1.1's kind: an include of C-Next source names its
   * generated header, and any other directive is returned unchanged.
   *
   * It used to classify the spelling itself, as the third copy of a decision
   * 1.1 and 2.1 also made.
   *
   * `rewrites` maps the author's spelling to the path the generated header is
   * reachable at, relative to the header output root. When it has no answer --
   * an include that resolved to nothing, or a header written outside that root
   * -- the author's spelling is kept with its extension swapped, which is what
   * every caller did unconditionally before #1467.
   */
  static rewrite(
    includeText: string,
    kinds: ReadonlyMap<string, EFileType>,
    rewrites: ReadonlyMap<string, string>,
    ext: THeaderExtension,
  ): string {
    const spec = IncludeRewriter._cnextSpec(includeText, kinds);
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
   * What the directive names, when 1.1 classified it as C-Next source.
   * Asserts 1.1 classified it at all: it lexed the same tokens 1.2 parsed
   * (#1745), so every directive with a path has an answer.
   */
  private static _cnextSpec(
    includeText: string,
    kinds: ReadonlyMap<string, EFileType>,
  ): { path: string; isLocal: boolean } | null {
    const spec = IncludeDirectiveText.split(includeText);
    if (spec === null) return null;
    const directive = IncludeDirectiveText.join(spec);
    const kind = kinds.get(directive);
    invariant(
      kind !== undefined,
      `1.1 Discover classified every directive 1.2 parsed (missing ${directive})`,
    );
    return kind === EFileType.CNext ? spec : null;
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
