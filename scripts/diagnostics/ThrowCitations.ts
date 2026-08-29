/**
 * Issue #1365: the throw classification cites every site by `file:line`, and a
 * line number decays silently.
 *
 * `docs/architecture/output-throw-classification.md` (#1321) is the input that
 * splits #1322. It names all 181 `throw new` sites in `output/` by file and
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

  /** 1-based line numbers of every `throw new` in a source file. */
  static throwLines(source: string): number[] {
    return source
      .split("\n")
      .map((text, index) => ({ text, line: index + 1 }))
      .filter((entry) => entry.text.includes("throw new"))
      .map((entry) => entry.line);
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
    cited: readonly IThrowCitation[],
    sources: ReadonlyMap<string, string>,
  ): IThrowCitationOutcome {
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

    return {
      ok: errors.length === 0,
      errors,
      info: [
        `${cited.length} citation(s) checked against ${total} \`throw new\` site(s) in output/.`,
      ],
    };
  }
}

export default ThrowCitations;
