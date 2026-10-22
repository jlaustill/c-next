/**
 * #1833 box 3: whether a path is cnx source, whether its extension is
 * rejected (E0518), and what its stem is, is answered by
 * `src/cnx/utils/CnxSourcePath.ts` alone. A module that matches the extension
 * itself -- a `/\.cnx$/` regex, `endsWith(".cnx")`, a list holding `".cnx"` --
 * can disagree with it, which is how `Colors.CNX` was transpiled by discovery
 * and then named as if it were not cnx.
 *
 * A stem cut with `extname` is the same decision without a literal
 * (`IncludeRewriter.besideSource` was one), so `extname` is scanned too.
 *
 * What it cannot see: a match built at runtime from pieces (`"." + "cnx"`).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import SourceScan from "./SourceScan";

// A regex literal's `\.cnx` in any case, or a quoted string that is exactly
// the extension. Prose in backticks in a message (`.cnx`) is not a match.
const EXTENSION_MATCH = /\\\.cnx\b|["']\.cnx["']/gi;
const OWNER = "src/cnx/utils/CnxSourcePath.ts";

/**
 * Lines that spell the extension without asking whether a path has it, each
 * with the reason it is not a match.
 */
const NOT_A_MATCH: ReadonlyArray<readonly [string, string]> = [
  // A directory name: the project's cache.
  [
    "src/cnx/PARSE/2-Parse/preprocessor/PreprocessCache.ts",
    'projectRoot, ".cnx"',
  ],
  ["src/cli/cache/CacheManager.ts", 'projectRoot, ".cnx"'],
  // Builds E0504's candidate spelling from a header's; the candidate is then
  // resolved, not classified.
  ["src/cnx/PARSE/1-Discover/IncludeResolver.ts", 'ADMITTED_HEADER, ".cnx"'],
];

/** `extname` outside the owner, each with what it reads instead. */
const EXTNAME_NOT_A_STEM: ReadonlyArray<readonly [string, string]> = [
  // A C/C++ entry point's extension (#2050), and the rejection's text.
  ["src/cnx/PARSE/1-Discover/InputExpansion.ts", "const ext = extname(path);"],
  // An included header's string keeps the header's extension (#1991)...
  ["src/cnx/PARSE/2-Parse/preprocessor/Preprocessor.ts", "cnx-include"],
  // ...because standard input has no name, so cpp is told its language with
  // `-x` from that extension (#1991 replaced the temporary file).
  [
    "src/cnx/PARSE/2-Parse/preprocessor/Preprocessor.ts",
    "extname(text.filename)",
  ],
  // Every other kind's table key (#2043); cnx is asked of the owner.
  ["src/cnx/utils/FileKinds.ts", "extname(filePath)"],
];

function lineAt(file: string, offset: number): string {
  const source = readFileSync(file, "utf-8");
  const start = source.lastIndexOf("\n", offset) + 1;
  const end = source.indexOf("\n", offset);
  return source.slice(start, end === -1 ? undefined : end);
}

describe("one rule says what cnx source is (#1833)", () => {
  const hits = SourceScan.scan(EXTENSION_MATCH);

  it("no module but CnxSourcePath matches a cnx extension", () => {
    const outside = hits
      .filter((hit) => hit.file !== OWNER)
      .filter(
        (hit) =>
          !NOT_A_MATCH.some(
            ([file, snippet]) =>
              hit.file === file &&
              lineAt(hit.file, hit.offset).includes(snippet),
          ),
      )
      .map((hit) => `${hit.file}: ${lineAt(hit.file, hit.offset).trim()}`);
    expect(outside).toEqual([]);
  });

  // Controls: the pattern sees the owner's source extension, and every
  // exemption is still live, so a stale one cannot hide a new match on its
  // line.
  it("sees the owner's extension", () => {
    expect(hits.filter((hit) => hit.file === OWNER).map((h) => h.text)).toEqual(
      ['".cnx"'],
    );
  });

  it.each(NOT_A_MATCH)("exemption %s (%s) is still there", (file, snippet) => {
    expect(
      hits.some(
        (hit) =>
          hit.file === file && lineAt(hit.file, hit.offset).includes(snippet),
      ),
    ).toBe(true);
  });

  it("no module but CnxSourcePath cuts a stem with extname", () => {
    const outside = SourceScan.scan(/\bextname\(/g)
      .filter((hit) => hit.file !== OWNER)
      .filter(
        (hit) =>
          !EXTNAME_NOT_A_STEM.some(
            ([file, snippet]) =>
              hit.file === file &&
              lineAt(hit.file, hit.offset).includes(snippet),
          ),
      )
      .map((hit) => `${hit.file}: ${lineAt(hit.file, hit.offset).trim()}`);
    expect(outside).toEqual([]);
  });

  it.each(EXTNAME_NOT_A_STEM)(
    "extname exemption %s (%s) is still there",
    (file, snippet) => {
      expect(
        SourceScan.scan(/\bextname\(/g).some(
          (hit) =>
            hit.file === file && lineAt(hit.file, hit.offset).includes(snippet),
        ),
      ).toBe(true);
    },
  );

  it.each([
    String.raw`p.replace(/\.cnx$/, ext)`,
    String.raw`/\.CNX$/i.test(p)`,
    `p.endsWith(".cnx")`,
    `[".cnx", ".h"].includes(ext)`,
  ])("the pattern matches %s", (spelling) => {
    expect(spelling.match(EXTENSION_MATCH)).not.toBeNull();
  });
});
