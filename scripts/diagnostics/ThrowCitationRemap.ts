/**
 * Issue #1322: recompute the line numbers in
 * `docs/architecture/output-throw-classification.md` from each row's anchor.
 *
 * ## Why this is separate from the gate, and must stay separate
 *
 * `scripts/throw-citations.ts` is check-only on purpose, and the reason it
 * gives is sound: a fixer "would have to guess which throw a stale citation
 * meant, and nine sites share a message, so the guess is not safe."
 *
 * What changed since is that #1374 gave every row an ANCHOR -- a verbatim
 * substring of the throw's argument. Where an anchor identifies exactly one
 * throw in the file, there is no guess to make; where it identifies zero or
 * several, this refuses and says so. The unsafe case is declined rather than
 * defined away.
 *
 * It stays a separate module, and out of `gate.sh`, because a fixer that also
 * validated could only ever agree with itself -- the `/* test-no-warnings *\/`
 * shape (#1143). The gate re-derives the answer independently afterwards, so
 * the remapper's output is checked by something that did not produce it.
 *
 * ## Why it is needed at all
 *
 * #1322 deletes 23 throws and relocates 145 more. Deleting one throw shifts
 * every citation below it IN THAT FILE -- `TypeValidator.ts` alone carries 30
 * -- and CLAUDE.md records the same arithmetic biting #1399, where a single
 * added import moved 20 citations by exactly one. Hand-editing that at this
 * volume is how a row silently comes to describe its neighbor's site, which
 * is the failure invariant 4 exists to catch and would then be catching us.
 *
 * Every primitive here comes from `ThrowCitations`: one definition of what a
 * throw is, what a row is, and which file a path resolves to. A second copy
 * would be free to disagree with the gate, which is the only way this could
 * produce a document that passes the remap and fails the check.
 */

import ThrowCitations from "./ThrowCitations";

interface IRemapChange {
  readonly path: string;
  readonly from: number;
  readonly to: number;
  readonly anchor: string;
}

interface IRemapResult {
  readonly markdown: string;
  readonly changes: readonly IRemapChange[];
  /** Rows and prose this could not move, each saying why. */
  readonly refusals: readonly string[];
}

class ThrowCitationRemap {
  /**
   * Lines in `source` whose throw statement contains `anchor`.
   *
   * Deliberately the same containment test `checkAnchor` applies, read from
   * the same `throwArgument`: a candidate this accepts is one the gate would
   * accept, so a remap cannot produce a row the check then rejects.
   */
  private static candidates(source: string, anchor: string): number[] {
    return ThrowCitations.throwLines(source).filter((line) => {
      const argument = ThrowCitations.throwArgument(source, line);
      return argument !== null && argument.includes(anchor);
    });
  }

  /**
   * Rewrite every citation row whose anchor identifies exactly one throw.
   *
   * Rows are matched by their own text rather than by index, so a row that is
   * refused is left byte-identical -- a refusal must not perturb the document
   * it declined to fix.
   */
  /**
   * For a shared anchor, the ascending pairing of stale rows to candidates --
   * but only when their counts are equal.
   *
   * Nine sites share `Error: 'this' can only be used inside a scope` and four
   * share the enum-assignment message, so refusing every shared anchor left
   * the largest groups to be re-numbered by hand, which is the arithmetic this
   * tool exists to take over.
   *
   * Equal counts make the pairing a derivation rather than a guess: an edit
   * elsewhere in the file shifts every survivor and cannot reorder them, so
   * the k-th remaining row is the k-th remaining throw. Unequal counts mean one
   * of the group was DELETED and nothing says which, so pairing in order would
   * silently reattribute the rest -- that case is still refused.
   */
  /**
   * One definition of what makes two rows the same group.
   *
   * It was written twice, and the two copies differed by one invisible byte --
   * a NUL where a space was intended -- so every lookup missed and the ordered
   * pairing silently never fired. The test caught it, but only because it
   * asserted the pairing HAPPENED rather than that nothing crashed. Two
   * expressions that must agree are one expression.
   */
  private static groupKey(file: string, anchor: string): string {
    return `${file}\u0000${anchor}`;
  }

  private static orderedPairing(
    rows: readonly { line: number; anchor: string }[],
    candidates: readonly number[],
  ): Map<number, number> | null {
    if (rows.length !== candidates.length) return null;
    const stale = rows.map((row) => row.line).sort((a, b) => a - b);
    const targets = [...candidates].sort((a, b) => a - b);
    const pairing = new Map<number, number>();
    stale.forEach((line, index) => pairing.set(line, targets[index]));
    return pairing;
  }

  static remap(
    markdown: string,
    sources: ReadonlyMap<string, string>,
  ): IRemapResult {
    const files = [...sources.keys()];
    const changes: IRemapChange[] = [];
    const refusals: string[] = [];

    // Rows keyed by file+anchor, so a shared-anchor group can be paired as a
    // group rather than each row deciding alone with no view of its siblings.
    const groups = new Map<string, { line: number; anchor: string }[]>();
    for (const line of markdown.split("\n")) {
      for (const citation of ThrowCitations.parse(line)) {
        if (citation.anchor === null) continue;
        const file = ThrowCitations.resolve(citation.path, files);
        if (file === null) continue;
        const key = ThrowCitationRemap.groupKey(file, citation.anchor);
        groups.set(key, [
          ...(groups.get(key) ?? []),
          { line: citation.line, anchor: citation.anchor },
        ]);
      }
    }

    const rewritten = markdown
      .split("\n")
      .map((text) => {
        const rows = ThrowCitations.parse(text);
        if (rows.length === 0) {
          return text;
        }
        const [citation] = rows;
        const where = `${citation.path}:${citation.line}`;
        if (citation.anchor === null) {
          refusals.push(`${where} -- row carries no anchor to remap by`);
          return text;
        }
        const file = ThrowCitations.resolve(citation.path, files);
        if (file === null) {
          refusals.push(`${where} -- no single file matches this path`);
          return text;
        }
        const found = ThrowCitationRemap.candidates(
          sources.get(file)!,
          citation.anchor,
        );
        if (found.length === 0) {
          refusals.push(
            `${where} -- anchor \`${citation.anchor}\` matches no throw in ${file}`,
          );
          return text;
        }
        if (found.includes(citation.line)) {
          // Already valid: invariants 1 and 3 hold at this line, so the gate
          // accepts the row as written. That is true even when the anchor is
          // shared, because the gate treats identically-messaged sites as
          // interchangeable -- the source draws no distinction between them
          // either. Refusing here would report every one of the nine `'this'`
          // rows on a run that had nothing to fix, and a fixer whose normal
          // output is a wall of warnings is one nobody reads.
          //
          // This is deliberately no more opinionated than the gate: the job is
          // to make the check pass, not to hold rows to a stricter rule the
          // check would not enforce.
          return text;
        }
        let line: number;
        if (found.length > 1) {
          const pairing = ThrowCitationRemap.orderedPairing(
            groups.get(ThrowCitationRemap.groupKey(file, citation.anchor)) ??
              [],
            found,
          );
          const paired = pairing?.get(citation.line);
          if (paired === undefined) {
            // The row is stale, the anchor is shared, and the group's size does
            // not match the candidates' -- so one of them was deleted and
            // nothing says which. Assigning in order would silently reattribute
            // the rest, and the gate would then certify the guess.
            refusals.push(
              `${where} -- anchor \`${citation.anchor}\` matches ${found.length} throws (${found.join(", ")}) and the group does not pair; remap by hand`,
            );
            return text;
          }
          line = paired;
        } else {
          [line] = found;
        }
        if (line === citation.line) {
          return text;
        }
        changes.push({
          path: citation.path,
          from: citation.line,
          to: line,
          anchor: citation.anchor,
        });
        return text.replace(
          `\`${citation.path}:${citation.line}\``,
          `\`${citation.path}:${line}\``,
        );
      })
      .join("\n");

    // Prose is checked against the REWRITTEN document, in one pass over the
    // whole text rather than line by line: `checkProse` reports the document
    // line it found a citation on, and feeding it one line at a time makes
    // every report say line 1. Checking the rewritten text also means a prose
    // citation is only reported if it is still wrong after the rows moved.
    //
    // Prose carries no anchor, so nothing says which throw it meant and there
    // is nothing to move it to. Naming it is what keeps invariant 5 fixable:
    // otherwise a remap run reports success while leaving the document red,
    // and the author has to rediscover what the gate objected to.
    refusals.push(
      ...ThrowCitations.checkProse(rewritten, sources).map(
        (error) => `${error} -- prose has no anchor; correct it by hand`,
      ),
    );

    return { markdown: rewritten, changes, refusals };
  }
}

export default ThrowCitationRemap;
