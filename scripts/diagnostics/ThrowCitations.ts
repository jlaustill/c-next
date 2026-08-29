/**
 * Issue #1365: the throw classification cites every site by `file:line`, and a
 * line number decays silently.
 *
 * `docs/architecture/output-throw-classification.md` (#1321) is the input that
 * splits #1322. It names every `throw new` site in `output/` by file and
 * line. #1362 committed it with correct citations; #1363 then added 62 lines to
 * `TypeValidator.ts`, and 64 of the 180 citations silently began pointing at a
 * docstring or a closing brace. Each pull request was green on its own -- one
 * never looked at the doc, the other ran before the code change existed -- and
 * `main` is unprotected (#1344), so nothing evaluated the pair.
 *
 * A line number cannot be replaced by the message text: `Error: 'this' can only
 * be used inside a scope` is thrown from nine distinct sites, so message text
 * does not identify one. `file:line` is the only unique key, which is why this
 * gate verifies it rather than the doc trading it for something softer.
 *
 * Two invariants, both mechanical:
 *
 *   1. every cited `file:line` is exactly a line containing `throw new`
 *   2. every `throw new` under `output/` is cited exactly once
 *
 * The second is the one that earns its keep beyond drift: it fails when a new
 * throw is added and nobody classifies it, which is how `output/` grows a
 * rejection the Plan/Render boundary has not accounted for.
 */

interface IThrowCitation {
  readonly path: string;
  readonly line: number;
}

interface IThrowCitationOutcome {
  readonly ok: boolean;
  readonly errors: readonly string[];
  readonly info: readonly string[];
}

class ThrowCitations {
  /**
   * A citation is the first cell of a table row: `| \`Path.ts:123\` |`.
   *
   * Anchored to the row start so prose mentioning a `file:line` elsewhere in
   * the document is not treated as a claim this gate has to defend.
   */
  static parse(markdown: string): IThrowCitation[] {
    const pattern = /^\| `([A-Za-z0-9_/….]+\.ts):(\d+)`/gm;
    const found: IThrowCitation[] = [];
    let match = pattern.exec(markdown);
    while (match !== null) {
      found.push({ path: match[1], line: Number.parseInt(match[2], 10) });
      match = pattern.exec(markdown);
    }
    return found;
  }

  /**
   * 1-based line numbers of every `throw new` STATEMENT in a source file.
   *
   * A raw substring test would count a comment or a string literal that merely
   * mentions `throw new`, and invariant 2 would then demand a classification
   * row for it -- pushing an author into corrupting the document this gate
   * exists to protect. That is not hypothetical here: five bucket-2 sites carry
   * an in-file comment whose subject is throwing.
   *
   * So the match is structural: a comment marker is stripped, and `throw new`
   * must OPEN the statement rather than merely appear on the line. Every site
   * in `output/` is a bare `throw new` statement, verified, so nothing is lost
   * by requiring it.
   */
  static throwLines(source: string): number[] {
    return source
      .split("\n")
      .map((text, index) => ({ text: text.trim(), line: index + 1 }))
      .filter((entry) => entry.text.startsWith("throw new"))
      .map((entry) => entry.line);
  }

  /**
   * The count each `## Bucket N — … (C)` heading declares, paired with the
   * citation rows beneath it.
   *
   * #1365 is a number in this document going stale with nothing noticing. The
   * bucket headings, the total, and the by-area table are the same kind of
   * claim as a citation, so they are held to the corpus the same way -- adding
   * a throw and its row must not leave a heading reading the old count.
   */
  static bucketCounts(
    markdown: string,
  ): Array<{ heading: string; declared: number; rows: number }> {
    // Headings nest: `## Bucket 1 — … (144)` contains `### <area> — 39`
    // subsections whose rows belong to both. A section therefore accumulates
    // rows until the next heading of the SAME OR HIGHER level, not until the
    // next heading of any level.
    const open: Array<{
      level: number;
      heading: string;
      declared: number;
      rows: number;
    }> = [];
    const closed: Array<{ heading: string; declared: number; rows: number }> =
      [];

    const close = (level: number): void => {
      while (open.length > 0 && open.at(-1)!.level >= level) {
        closed.push(open.pop()!);
      }
    };

    for (const line of markdown.split("\n")) {
      const heading = /^(#{2,6}) (.*)$/.exec(line);
      if (heading !== null) {
        const level = heading[1].length;
        close(level);
        // A count is declared either as `(144)` or as a trailing `— 39`.
        const declared = /\((\d+)\)\s*$|[—-]\s*(\d+)\s*$/.exec(heading[2]);
        if (declared !== null) {
          open.push({
            level,
            heading: line.trim(),
            declared: Number.parseInt(declared[1] ?? declared[2], 10),
            rows: 0,
          });
        }
        continue;
      }
      if (/^\| `[A-Za-z0-9_/….]+\.ts:\d+`/.test(line)) {
        for (const section of open) {
          section.rows += 1;
        }
      }
    }
    close(0);
    return closed;
  }

  /**
   * Resolve a cited path against the real files.
   *
   * The document abbreviates: a row may read `codegen/CodeGenerator.ts` or
   * `…/PostfixExpressionGenerator.ts`. Suffix match first, then basename. An
   * ambiguous basename returns null rather than picking one, because guessing
   * would let the gate pass while checking the wrong file.
   */
  static resolve(citedPath: string, files: readonly string[]): string | null {
    const normalized = citedPath.replace(/…\//g, "").replace(/^\/+/, "");
    const bySuffix = files.filter((file) => file.endsWith(`/${normalized}`));
    if (bySuffix.length === 1) {
      return bySuffix[0];
    }
    const base = normalized.split("/").at(-1);
    const byBase = files.filter((file) => file.split("/").at(-1) === base);
    return byBase.length === 1 ? byBase[0] : null;
  }

  /**
   * @param cited citation list from the document
   * @param sources every non-test `.ts` under `output/`, mapped to its contents
   */
  static check(
    markdown: string,
    sources: ReadonlyMap<string, string>,
  ): IThrowCitationOutcome {
    // Citations are parsed here rather than passed in: they are derived from
    // this same markdown, and two parameters that must agree is one more thing
    // a caller can get wrong.
    const cited = ThrowCitations.parse(markdown);
    const files = [...sources.keys()];
    const errors: string[] = [];
    const citedByFile = new Map<string, number[]>();

    for (const citation of cited) {
      const file = ThrowCitations.resolve(citation.path, files);
      if (file === null) {
        errors.push(
          `${citation.path}:${citation.line} -- no single file matches this path`,
        );
        continue;
      }
      const lines = ThrowCitations.throwLines(sources.get(file)!);
      if (!lines.includes(citation.line)) {
        const nearest = lines.reduce<number | null>(
          (best, line) =>
            best === null ||
            Math.abs(line - citation.line) < Math.abs(best - citation.line)
              ? line
              : best,
          null,
        );
        errors.push(
          `${citation.path}:${citation.line} -- no \`throw new\` on that line` +
            (nearest === null ? "" : ` (nearest is :${nearest})`),
        );
      }
      const seen = citedByFile.get(file) ?? [];
      seen.push(citation.line);
      citedByFile.set(file, seen);
    }

    let total = 0;
    for (const [file, source] of sources) {
      const actual = ThrowCitations.throwLines(source);
      total += actual.length;
      const claimed = citedByFile.get(file) ?? [];
      for (const line of actual) {
        if (!claimed.includes(line)) {
          errors.push(`${file}:${line} -- \`throw new\` is not classified`);
        }
      }
      const duplicates = claimed.filter(
        (line, index) => claimed.indexOf(line) !== index,
      );
      for (const line of new Set(duplicates)) {
        errors.push(`${file}:${line} -- cited more than once`);
      }
    }

    errors.push(...ThrowCitations.checkDeclaredCounts(markdown, cited.length));

    return {
      ok: errors.length === 0,
      errors,
      info: [
        `${cited.length} citation(s) checked against ${total} \`throw new\` site(s) in output/.`,
      ],
    };
  }

  /**
   * Hold the document's self-describing numbers to its own rows.
   *
   * #1365 is a number here going stale with nothing noticing. A bucket heading,
   * the total, and the by-area table make the same kind of claim a citation
   * does, so adding a throw and its classification row must not be able to
   * leave any of them reading the old figure.
   */
  static checkDeclaredCounts(markdown: string, cited: number): string[] {
    const errors: string[] = [];

    // Sections nest, so their row counts deliberately overlap and are NOT
    // summed -- the total is held by the counts table and the by-area table
    // below, each against the citation count directly.
    for (const section of ThrowCitations.bucketCounts(markdown)) {
      if (section.declared !== section.rows) {
        errors.push(
          `${section.heading} -- declares ${section.declared}, has ${section.rows} row(s)`,
        );
      }
    }

    const total = /^\|\s*\|\s*\*\*total\*\*\s*\|\s*\*\*(\d+)\*\*\s*\|/m.exec(
      markdown,
    );
    if (total === null) {
      errors.push("counts table has no **total** row");
    } else if (Number.parseInt(total[1], 10) !== cited) {
      errors.push(
        `counts table total says ${total[1]}, document cites ${cited}`,
      );
    }

    const areas = [...markdown.matchAll(/^\| `[^`]+`[^|]*\|\s*(\d+)\s*\|/gm)];
    if (areas.length > 0) {
      const summed = areas.reduce(
        (sum, row) => sum + Number.parseInt(row[1], 10),
        0,
      );
      if (summed !== cited) {
        errors.push(`by-area table sums to ${summed}, document cites ${cited}`);
      }
    }

    return errors;
  }
}

export default ThrowCitations;
