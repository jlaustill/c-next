/**
 * Which `.cnx` a file under `tests/` came from, and which mode it belongs to.
 *
 * #1449: which files `headers:standalone:check` is entitled to compile, and
 * #1149: which files exist for a mode their fixture excludes.
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
class FixtureFiles {
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
    path: string,
    exists: (candidate: string) => boolean,
  ): string | null {
    const isSnapshot = /\.expected\.(c|h|cpp|hpp)$/.test(path);
    const base = path.replace(/(?:\.expected)?\.(c|h|cpp|hpp)$/, "");
    if (base === path) return null;

    // A snapshot is written for whichever shape produced it, and does not carry
    // `.test` either way: `foo.expected.c` belongs to `foo.test.cnx` when that
    // fixture exists, and to the helper `foo.cnx` otherwise.
    if (isSnapshot) {
      for (const candidate of [`${base}.test.cnx`, `${base}.cnx`]) {
        if (exists(candidate)) return candidate;
      }
      return null;
    }

    // Generated output, where the two shapes do NOT share a stem and trying
    // both picks up hand-written INPUT: `comprehensive-cpp.hpp` is a
    // hand-authored interop fixture the transpiler READS, beside
    // `comprehensive-cpp.test.cnx` whose output is `comprehensive-cpp.test.hpp`.
    if (base.endsWith(".test")) {
      const candidate = `${base.slice(0, -".test".length)}.test.cnx`;
      return exists(candidate) ? candidate : null;
    }
    const candidate = `${base}.cnx`;
    return exists(candidate) ? candidate : null;
  }

  /** The mode a file belongs to, from its extension. */
  static modeOf(path: string): "c" | "cpp" {
    return path.endsWith(".cpp") || path.endsWith(".hpp") ? "cpp" : "c";
  }

  /**
   * Whether this header is an orphan of the OTHER mode (#1149).
   *
   * A `.h` beside a `// test-cpp-only` fixture is never regenerated and never
   * compared; it preserves a dead codegen shape. Compiling one reports a defect
   * in output nothing produces any more, which is worse than not checking it.
   */
  static isModeOrphan(path: string, sourceText: string): boolean {
    return FixtureFiles.modeOf(path) === "cpp"
      ? sourceText.includes("test-c-only")
      : sourceText.includes("test-cpp-only");
  }
}

export default FixtureFiles;
