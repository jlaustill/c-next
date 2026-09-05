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
 * Four invariants, all mechanical:
 *
 *   1. every cited `file:line` is exactly a line containing `throw new`
 *   2. every `throw new` under `output/` is cited exactly once
 *   3. every row's anchor is a substring of what the throw at its line says
 *   4. no two rows in one file could trade line numbers and keep 3 holding
 *
 * The second is the one that earns its keep beyond drift: it fails when a new
 * throw is added and nobody classifies it, which is how `output/` grows a
 * rejection the Plan/Render boundary has not accounted for.
 *
 * The third is #1374. Two rows can trade line numbers within a file and the
 * first two invariants still hold -- each cited line is a throw, each throw
 * is cited once -- while both rows now describe the other's site, which is
 * exactly what #1322's delete-and-relocate work produces. So each row also
 * carries an anchor: a verbatim substring of the throw's argument, at least
 * `MIN_ANCHOR_LENGTH` characters, which the gate holds to the statement at
 * the cited line. The line stays the key and the anchor corroborates it:
 * identically-messaged sites keep identical anchors and stay interchangeable,
 * because the source makes no distinction between them either.
 *
 * The fourth is what makes the third a gate rather than an audit. An anchor
 * that clears the floor can still stop just short of the text that tells two
 * different throws apart, and then both rows corroborate both sites. Whether
 * a pair could trade is directly computable from the rows of a file, so it
 * is computed -- the #1374 review found three such pairs by hand; this finds
 * them mechanically, and the next ones #1322 adds.
 */

/**
 * Below this an anchor stops telling sites apart -- `Error` or `'` would
 * corroborate every row in the document, the #1143 shape.
 */
const MIN_ANCHOR_LENGTH = 8;

interface IThrowCitation {
  readonly path: string;
  readonly line: number;
  /** The second cell, when it is a lone code span; null when it is not. */
  readonly anchor: string | null;
}

/** A row whose line holds a throw and whose anchor cleared the floor. */
interface IAnchoredRow {
  readonly line: number;
  readonly anchor: string;
  readonly argument: string;
}

interface IThrowCitationOutcome {
  readonly ok: boolean;
  readonly errors: readonly string[];
  readonly info: readonly string[];
}

class ThrowCitations {
  /**
   * A citation is the first cell of a table row, `| \`Path.ts:123\` |`, and
   * its anchor is the second cell when that cell is nothing but a code span,
   * `| \`what the throw says\` |`.
   *
   * Anchored to the row start so prose mentioning a `file:line` elsewhere in
   * the document is not treated as a claim this gate has to defend. The
   * anchor cell must be the whole cell: prose that merely opens with a code
   * span is not an anchor, so the pre-#1374 row shape reads as anchor-less
   * rather than as a wrong anchor.
   */
  static parse(markdown: string): IThrowCitation[] {
    const pattern =
      /^\| `([A-Za-z0-9_/….]+\.ts):(\d+)`\s*\|(?:\s*`([^`|]+)`\s*\|)?/gm;
    const found: IThrowCitation[] = [];
    let match = pattern.exec(markdown);
    while (match !== null) {
      found.push({
        path: match[1],
        line: Number.parseInt(match[2], 10),
        anchor: match[3] === undefined ? null : match[3].replace(/\s+/g, " "),
      });
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
   * What the throw statement starting at `line` (1-based) says: its text from
   * that line to the first line ending in `;`, comment lines dropped,
   * whitespace collapsed, with the `throw new Ctor(` opener removed.
   *
   * The opener is scaffolding every site shares, so an anchor drawn from it
   * would corroborate every row; removing it is what makes `Error(` an
   * invalid anchor rather than a universally true one. 155 of the 181 sites
   * span several lines, so the anchor is held to the statement, not the line.
   *
   * Returns null when the statement opens no argument list at all. A strip
   * that silently did nothing would hand the opener back as text, and
   * `new Ctor(` would become the universally-true anchor the strip exists to
   * prevent -- so the miss is reported, not absorbed.
   */
  static throwArgument(source: string, line: number): string | null {
    const lines = source.split("\n");
    const collected: string[] = [];
    for (let index = line - 1; index < lines.length; index += 1) {
      const text = lines[index].trim();
      // A comment is not what the throw says, and one ending in `;` must
      // not end the scan early -- the hazard throwLines guards against.
      if (text.startsWith("//")) {
        continue;
      }
      collected.push(text);
      if (text.endsWith(";")) {
        break;
      }
    }
    const statement = collected.join(" ").replace(/\s+/g, " ");
    // `[^(]*` admits any constructor expression -- dotted, generic -- up to
    // its argument list: the same breadth throwLines counts.
    const opener = /^throw new\b[^(]*\(\s*/.exec(statement);
    return opener === null ? null : statement.slice(opener[0].length);
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
    const rowsByFile = new Map<string, IThrowCitation[]>();

    for (const citation of cited) {
      const file = ThrowCitations.resolve(citation.path, files);
      if (file === null) {
        errors.push(
          `${citation.path}:${citation.line} -- no single file matches this path`,
        );
        continue;
      }
      errors.push(
        ...ThrowCitations.checkCitation(citation, sources.get(file)!),
      );
      rowsByFile.set(file, [...(rowsByFile.get(file) ?? []), citation]);
    }

    let total = 0;
    for (const [file, source] of sources) {
      const actual = ThrowCitations.throwLines(source);
      total += actual.length;
      const rows = rowsByFile.get(file) ?? [];
      const claimed = rows.map((row) => row.line);
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
      errors.push(...ThrowCitations.checkTradeable(file, rows, source));
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
   * Invariants 1 and 3 for one citation whose file resolved: the cited line
   * holds a `throw new`, and the row's anchor is what that throw says.
   *
   * A line holding no throw has nothing to anchor against, so the anchor is
   * checked only where invariant 1 holds -- drift is reported once, naming
   * the nearest throw, not once per invariant.
   */
  static checkCitation(citation: IThrowCitation, source: string): string[] {
    const lines = ThrowCitations.throwLines(source);
    if (lines.includes(citation.line)) {
      return ThrowCitations.checkAnchor(citation, source);
    }
    const nearest = lines.reduce<number | null>(
      (best, line) =>
        best === null ||
        Math.abs(line - citation.line) < Math.abs(best - citation.line)
          ? line
          : best,
      null,
    );
    return [
      `${citation.path}:${citation.line} -- no \`throw new\` on that line` +
        (nearest === null ? "" : ` (nearest is :${nearest})`),
    ];
  }

  /**
   * Invariant 3: the row's anchor is a substring of what the throw at its
   * line says. Returns the errors for one citation whose line is known to
   * hold a throw.
   *
   * An anchor is required. Optional would leave every row #1322 adds without
   * one outside the swap check -- a gate that can be skipped silently is the
   * #1143 shape.
   */
  static checkAnchor(citation: IThrowCitation, source: string): string[] {
    const where = `${citation.path}:${citation.line}`;
    if (citation.anchor === null) {
      return [
        `${where} -- no anchor (the second cell must be a \`code span\` quoting the throw's argument)`,
      ];
    }
    if (citation.anchor.length < MIN_ANCHOR_LENGTH) {
      return [
        `${where} -- anchor \`${citation.anchor}\` is shorter than ${MIN_ANCHOR_LENGTH} characters`,
      ];
    }
    const argument = ThrowCitations.throwArgument(source, citation.line);
    if (argument === null) {
      return [
        `${where} -- unrecognized throw opener: no argument list to hold the anchor to`,
      ];
    }
    if (!argument.includes(citation.anchor)) {
      return [
        `${where} -- anchor \`${citation.anchor}\` not found in the throw at that line (it says: ${argument.slice(0, 80)})`,
      ];
    }
    return [];
  }

  /**
   * Invariant 4: no two rows in one file may be able to trade line numbers
   * undetected. A trade goes undetected exactly when each row's anchor is
   * also a substring of the other row's throw, so that is what is tested --
   * a mutual-substring check over a file's rows -- rather than a length
   * floor standing in for it with a hand audit behind that. The #1374 review
   * found three pairs the audit had missed; this check finds them.
   *
   * Throws with identical text are exempt: the source makes no distinction
   * between them, so a row cannot either, and their rows are interchangeable
   * by design. Rows already carrying an error -- no anchor, below the floor,
   * a line holding no throw, an anchor its own line does not contain -- are
   * left out: a trade invariant 3 caught is detected, not undetected.
   */
  static checkTradeable(
    file: string,
    rows: readonly IThrowCitation[],
    source: string,
  ): string[] {
    const throwsAt = new Set(ThrowCitations.throwLines(source));
    const anchored: IAnchoredRow[] = [];
    for (const row of rows) {
      if (
        row.anchor === null ||
        row.anchor.length < MIN_ANCHOR_LENGTH ||
        !throwsAt.has(row.line)
      ) {
        continue;
      }
      const argument = ThrowCitations.throwArgument(source, row.line);
      // A row whose anchor already fails on its own line was detected by
      // invariant 3; only rows that pass it can trade undetected.
      if (argument !== null && argument.includes(row.anchor)) {
        anchored.push({ line: row.line, anchor: row.anchor, argument });
      }
    }
    const errors: string[] = [];
    for (const [index, a] of anchored.entries()) {
      for (const b of anchored.slice(index + 1)) {
        if (ThrowCitations.canTrade(a, b)) {
          errors.push(
            `${file}:${a.line} and :${b.line} -- these rows could trade lines undetected; lengthen one anchor past the text both throws share`,
          );
        }
      }
    }
    return errors;
  }

  /** Both anchors match both throws, and the throws are not the same text. */
  private static canTrade(a: IAnchoredRow, b: IAnchoredRow): boolean {
    return (
      a.argument !== b.argument &&
      b.argument.includes(a.anchor) &&
      a.argument.includes(b.anchor)
    );
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
