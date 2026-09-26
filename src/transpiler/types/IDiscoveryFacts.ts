/**
 * What 1.1 Discover learned about a file's includes, frozen into `Program`.
 *
 * ## Why these travel on the program artifact (#1452)
 *
 * Both are written during discovery and read two stages later, and neither can
 * be re-derived at the point of use -- which is what put them on a mutable
 * accumulator in the first place. A state container held them, and box 4 of
 * #1452 forbids a module reachable from the pipeline holding state written in
 * one pass and read in another.
 *
 * The ordering is what makes the program a legal home, measured by enclosing
 * method rather than by line number:
 *
 * | when                  | where                                    |
 * | --------------------- | ---------------------------------------- |
 * | written, Stage 1      | `_resolveCnxIncludes`                    |
 * | **frozen, Stage 3**   | **`Program.build`**                      |
 * | read, Stage 4d        | `_analyzeFile`                           |
 * | read, Stage 5         | `_transpileFile`                         |
 *
 * Every write precedes the freeze and every read follows it, so nothing reads a
 * half-filled map and nothing writes one after it is published. The accumulation
 * that fills this lives inside discovery and is handed over once; it is not
 * cross-pass state, because no later pass can reach it.
 *
 * An honest caveat, recorded rather than argued away: 1.1 Discover authors
 * these facts and `Program` is 1.4 Resolve's artifact, so this is not strictly
 * "the artifact of the pass that authored it". `src/PARSE/1-Discover/` does not
 * exist yet -- that is #1444 -- and `Program` already carries facts it did not
 * author for the same reason (`headerStructFields` comes from the symbol table,
 * `IForeignSymbols` from the C and C++ collectors). When #1444 stands 1.1 up
 * with a `SourceGraph`, these two move there.
 */
interface IDiscoveryFacts {
  /**
   * Per source file, the author's `.cnx` include spelling mapped to the path
   * its generated header is reachable at (#1467).
   *
   * Resolved once during discovery, because that is the only point where a
   * spelling and its resolved file are both in hand, and read by both the `.c`
   * and the `.h` path so neither re-derives it.
   */
  readonly cnxIncludeRewrites: ReadonlyMap<string, ReadonlyMap<string, string>>;

  /**
   * Per source file, the directories an angle include is searched along, in
   * priority order, exactly as discovery built them (#1322).
   *
   * Recorded because it cannot be re-derived: discovery builds the list from
   * the file's own directory PLUS `--include` directories PLUS the config's,
   * and codegen once re-derived a narrower one from the file's directory alone.
   * ADR-010's `.cnx`-alternative rule was then blind to any header reachable
   * only through `--include` -- with `ext.h` and `ext.cnx` side by side in an
   * `--include` directory, `#include <ext.h>` transpiled at exit 0 with no
   * diagnostic, while the same two files in the source's own directory
   * reported E0504.
   */
  readonly includeSearchPaths: ReadonlyMap<string, readonly string[]>;

  /**
   * Per source file, the directory its quoted includes resolve from (#1435).
   *
   * The file's own directory. For a source run's in-memory root that is the
   * directory of its `sourcePath` resolved against the caller's `workingDir`,
   * or the `workingDir` itself when the text has no path. Recorded for the
   * same reason as the search path: 2.1 re-derived it as `dirname(sourcePath)`
   * while discovery resolved from `workingDir`, so the two disagreed about
   * which quoted includes exist -- and a missing one read as a foreign header,
   * E0426 declined, and C-Next member syntax reached the C output at exit 0.
   */
  readonly quotedIncludeDirectories: ReadonlyMap<string, string>;
}

export default IDiscoveryFacts;
