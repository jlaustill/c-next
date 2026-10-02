import type EFileType from "./EFileType";

/**
 * What 1.1 Discover learned about one `.cnx` file's includes, while it
 * resolved them (#1444).
 *
 * Every fact here is decided at the one point where a directive's spelling and
 * the file it resolved to are both in hand, and none can be re-derived later:
 * a quoted spelling is relative to the file that wrote it, and whether it
 * resolved depends on the file system at the moment discovery asked. These
 * rode on 1.4's `Program` until 1.1 had an artifact of its own (#1452), and on
 * `Transpiler` fields before that.
 */
interface IFileIncludes {
  /**
   * The author's `.cnx` include spelling mapped to the path its generated
   * header is reachable at (#1467).
   *
   * Read by both the `.c` and the `.h` path, so neither re-derives it.
   */
  readonly cnxIncludeRewrites: ReadonlyMap<string, string>;

  /**
   * The file each `#include` directive resolved to, or null, keyed by
   * `IncludeDirectiveText.join` (#1672).
   *
   * 2.1's ADR-010 rules report the answer discovery gave, not one of their own.
   * #1322 handed them the search path instead, after codegen re-derived a
   * narrower one; with the inputs in hand 2.1 still made its own decision, and
   * missed an absolute angle include that discovery resolves.
   */
  readonly resolutions: ReadonlyMap<string, string | null>;

  /**
   * ADR-010's E0504 question answered by the same rule: for each include of a
   * header whose C-Next source the same form of include would find, that
   * source's spelling, keyed like `resolutions` (#1672). An include with no
   * entry has no such source.
   */
  readonly cnextAlternatives: ReadonlyMap<string, string>;

  /**
   * The kind of file each directive's spelling names, keyed like
   * `resolutions` (#1444, owner ruling 1). The one classification of an
   * include: 2.1's ADR-010 rules (E0503, E0506) and render read it, and no
   * pass after 1.1 classifies a spelling itself.
   */
  readonly kinds: ReadonlyMap<string, EFileType>;

  /**
   * The directory this file's quoted includes resolve from (#1435): its own
   * directory, or for a source run's in-memory root the directory of its
   * `sourcePath`, or the caller's `workingDir` when the text has no path.
   *
   * 2.1 once re-derived it as `dirname(sourcePath)` while discovery resolved
   * from `workingDir`, so a missing include read as a foreign header, E0426
   * declined, and C-Next member syntax reached the C output at exit 0. A
   * generated header spells a quoted include relative to it (#1725).
   */
  readonly quotedIncludeDirectory: string;

  /**
   * How this file spells each header and `.cnx` it includes: resolved header
   * path to directive, in discovery order (#497, #854). A quoted spelling is
   * relative to the file that wrote it, so it is a fact of the file, not of
   * the run (#1435).
   */
  readonly headerIncludeDirectives: ReadonlyMap<string, string>;

  /**
   * For each of those spellings that is relative to this file, the file it
   * names, so a file that reaches the header only through another can spell
   * it relative to itself (#1725). Keyed like `headerIncludeDirectives`.
   */
  readonly writerRelativeIncludes: ReadonlyMap<string, string>;

  /**
   * This file's `.cnx` includes, each rendered as the include its generated
   * header carries (#589, #941, #1467), in source order.
   */
  readonly userIncludes: readonly string[];

  /**
   * This file's other includes, exactly as written, in source order. A
   * generated header carries them only when it names a macro one of them
   * supplies (#424), and #985's translation-unit recovery is built from them.
   */
  readonly cHeaderIncludes: readonly string[];
}

export default IFileIncludes;
