import { relative } from "node:path";

/**
 * DeclarationSite - the single source of truth for how C-Next renders and orders
 * "where a declaration is", `sourceFile:line`.
 *
 * #1334 gave IScopeSymbol a `declarationSites` set so a reopened scope records every
 * block that declares it (ADR-016). The set is keyed on the rendered `file:line`, so
 * that string is simultaneously the storage key, the diagnostic text, and the sort
 * key -- and it was being written out at three independent sites, with a fourth
 * (a parse, to order the sites) about to be added. Changing the separator would have
 * meant changing all four in lockstep, which is the duplicate-code-path anti-pattern
 * this project forbids. Route every producer and consumer through here.
 *
 * The ordering is the reason a comparator exists at all rather than a bare `.sort()`:
 * these keys end in a decimal line number, and lexicographic order puts `:10` ahead of
 * `:3`. Fixtures agreed with numeric order only by coincidence -- every scope in them
 * happens to be declared on a two-digit line -- so the first single-digit site would
 * have reordered a diagnostic with nothing failing in between (SonarCloud S2871).
 */
class DeclarationSite {
  /**
   * Separates the file from the line. A path may itself contain `:` (a Windows drive
   * letter), so parsing splits at the LAST occurrence, never the first.
   */
  private static readonly SEPARATOR = ":";

  /**
   * Encode a site for storage. Keeps the full path: `declarationSites` is a Set, and
   * two same-named files in different directories are different declarations.
   */
  static format(sourceFile: string, line: number): string {
    return `${sourceFile}${DeclarationSite.SEPARATOR}${line}`;
  }

  /**
   * Render a source path as a user should see it: relative to the directory the
   * transpiler was invoked from.
   *
   * NOT `basename`. An absolute path is machine-specific and these strings reach
   * `.expected.error` fixtures through the message, so something stable is required --
   * but a basename is not merely unstable, it is ambiguous. `can/config.cnx` and
   * `uart/config.cnx` are an explicitly supported layout (#1133 keys include guards on
   * the root-relative path precisely so that pair compiles), and rendering both as
   * `config.cnx` reproduces the `one.cnx:5 / one.cnx:5` output #1334 was filed about.
   *
   * A cwd-relative path is stable under the harness (every `transpileViaCli` spawn
   * uses `cwd: PROJECT_ROOT`) and keeps the two files distinguishable. The fallback
   * covers a path that IS the cwd, where `relative` returns "".
   */
  static displayPath(sourceFile: string): string {
    return relative(process.cwd(), sourceFile) || sourceFile;
  }

  /** Render a site for a diagnostic, from its components. */
  static display(sourceFile: string, line: number): string {
    return DeclarationSite.format(
      DeclarationSite.displayPath(sourceFile),
      line,
    );
  }

  /** Render a stored site for a diagnostic. */
  static displaySite(site: string): string {
    const parsed = DeclarationSite.parse(site);
    return DeclarationSite.display(parsed.sourceFile, parsed.line);
  }

  /**
   * Order sites by file, then by line NUMERICALLY.
   *
   * A default `.sort()` compares these keys as text, which orders `:10` before `:3`.
   */
  static compare(left: string, right: string): number {
    const leftSite = DeclarationSite.parse(left);
    const rightSite = DeclarationSite.parse(right);
    const byFile = leftSite.sourceFile.localeCompare(rightSite.sourceFile);
    if (byFile !== 0) {
      return byFile;
    }
    return leftSite.line - rightSite.line;
  }

  /**
   * Split a site back into its components.
   *
   * Total by construction: a string carrying no parsable line is treated as a bare
   * file at line 0, so a malformed key still sorts and renders rather than throwing
   * inside a diagnostic -- the one place an exception would replace the real error.
   */
  private static parse(site: string): { sourceFile: string; line: number } {
    const separatorAt = site.lastIndexOf(DeclarationSite.SEPARATOR);
    if (separatorAt === -1) {
      return { sourceFile: site, line: 0 };
    }
    const lineText = site.slice(separatorAt + 1);
    const line = Number.parseInt(lineText, 10);
    if (Number.isNaN(line) || !/^\d+$/.test(lineText)) {
      return { sourceFile: site, line: 0 };
    }
    return { sourceFile: site.slice(0, separatorAt), line };
  }
}

export default DeclarationSite;
