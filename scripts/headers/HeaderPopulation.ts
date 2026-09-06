/**
 * #1449: which files `headers:standalone:check` is entitled to compile.
 *
 * Separated from the check itself, and injected rather than reading the disk,
 * because this is the half with a bug history and it fails SILENTLY. A wrong
 * answer here does not make the gate red -- it makes it compile the wrong set,
 * which looks exactly like compiling the right one.
 *
 * The first version conflated the two output shapes and picked up hand-written
 * INPUT as though the transpiler had produced it: `comprehensive-cpp.hpp` is a
 * hand-authored C++ interop fixture that the transpiler READS, sitting beside
 * `comprehensive-cpp.test.cnx` whose output is `comprehensive-cpp.test.hpp`.
 * Nine such files were being compiled and reported as generated headers. They
 * happened to compile, so nothing said otherwise.
 */
class HeaderPopulation {
  /**
   * The `.cnx` a generated header came from, or null when it came from none.
   *
   * The two shapes do not share a stem, and each accepts only its own source:
   *
   *   `X.test.h` / `X.test.hpp`  <- `X.test.cnx`   (a fixture's own output)
   *   `Y.h` / `Y.hpp`            <- `Y.cnx`        (a helper's output)
   *
   * @param header path of the header, relative or absolute
   * @param exists whether a given path is present -- injected so the rule can
   *   be tested without a filesystem, the way `ThrowCitations.check` takes its
   *   sources
   */
  static sourceOf(
    header: string,
    exists: (path: string) => boolean,
  ): string | null {
    const base = header.replace(/\.(h|hpp)$/, "");
    if (base === header) return null;

    if (base.endsWith(".test")) {
      const candidate = `${base.slice(0, -".test".length)}.test.cnx`;
      return exists(candidate) ? candidate : null;
    }
    const candidate = `${base}.cnx`;
    return exists(candidate) ? candidate : null;
  }

  /**
   * Whether this header is an orphan of the OTHER mode (#1149).
   *
   * A `.h` beside a `// test-cpp-only` fixture is never regenerated and never
   * compared; it preserves a dead codegen shape. Compiling one reports a defect
   * in output nothing produces any more, which is worse than not checking it.
   */
  static isModeOrphan(header: string, sourceText: string): boolean {
    return header.endsWith(".hpp")
      ? sourceText.includes("test-c-only")
      : sourceText.includes("test-cpp-only");
  }
}

export default HeaderPopulation;
