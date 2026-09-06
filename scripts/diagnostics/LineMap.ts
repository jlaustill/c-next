/**
 * #1518: map line numbers from one revision of a file to the next.
 *
 * `output-throw-classification.md` cites 181 sites by `file:line`, and any edit
 * under `output/` -- adding a single import -- moves every later `throw new`.
 * Correcting the document by hand is how #1399 turned CI red, and this branch
 * did it four times before writing this.
 *
 * ## Anchored on lines that occur exactly once
 *
 * A line appearing once in the old revision and once in the new is the same
 * line: there is no other candidate it could be. Those pairs are the anchors,
 * kept only where they agree on order, and everything between two anchors moves
 * by the same offset.
 *
 * That is the "patience" strategy, and it is chosen over a full LCS for a
 * reason beyond speed: it never has to GUESS between equally good alignments.
 * A line that repeats -- `  }`, a blank, a `break;` -- anchors nothing, so it
 * cannot pull a mapping to the wrong place, and a region with no unique line
 * simply produces no mapping rather than a plausible-looking wrong one.
 * `ThrowCitations.remap` refuses on anything it cannot map.
 */
class LineMap {
  /**
   * Map 1-based old line numbers to 1-based new ones.
   *
   * A line with no confident mapping is absent from the result. Callers must
   * treat absence as "unknown", never as "unchanged".
   */
  static build(
    oldLines: readonly string[],
    newLines: readonly string[],
  ): ReadonlyMap<number, number> {
    const anchors = LineMap.anchorPairs(oldLines, newLines);
    const monotone = LineMap.longestIncreasing(anchors);

    const map = new Map<number, number>();
    for (const [oldLine, newLine] of monotone) {
      map.set(oldLine, newLine);
    }

    // Fill each gap between consecutive anchors, but only where the gap is the
    // same length on both sides -- equal length means nothing was inserted or
    // removed inside it, so the offset is the whole story. An unequal gap holds
    // a real edit whose interior cannot be aligned line for line, and guessing
    // there is what produces a citation that points at a closing brace.
    for (let i = 0; i + 1 < monotone.length; i += 1) {
      const [oldStart, newStart] = monotone[i];
      const [oldEnd, newEnd] = monotone[i + 1];
      if (oldEnd - oldStart !== newEnd - newStart) continue;
      for (let step = 1; step < oldEnd - oldStart; step += 1) {
        map.set(oldStart + step, newStart + step);
      }
    }
    return map;
  }

  /** Lines occurring exactly once on each side, paired. */
  private static anchorPairs(
    oldLines: readonly string[],
    newLines: readonly string[],
  ): [number, number][] {
    const oldOnce = LineMap.uniqueLines(oldLines);
    const newOnce = LineMap.uniqueLines(newLines);

    const pairs: [number, number][] = [];
    for (const [text, oldIndex] of oldOnce) {
      const newIndex = newOnce.get(text);
      if (newIndex !== undefined) {
        pairs.push([oldIndex + 1, newIndex + 1]);
      }
    }
    return pairs.sort((a, b) => a[0] - b[0]);
  }

  /** Text -> its only index, for lines that appear exactly once. */
  private static uniqueLines(lines: readonly string[]): Map<string, number> {
    const seen = new Map<string, number>();
    const repeated = new Set<string>();
    for (const [index, line] of lines.entries()) {
      if (seen.has(line)) {
        repeated.add(line);
        continue;
      }
      seen.set(line, index);
    }
    for (const line of repeated) {
      seen.delete(line);
    }
    return seen;
  }

  /**
   * The longest run of anchors whose new-side line numbers also increase.
   *
   * Anchors are already sorted by old line. One whose new line goes backwards
   * describes a move, and a moved line is not evidence about its neighbors --
   * keeping it would drag the whole gap around it to the wrong offset.
   */
  private static longestIncreasing(
    pairs: readonly [number, number][],
  ): [number, number][] {
    if (pairs.length === 0) return [];

    const best = new Array<number>(pairs.length).fill(1);
    const previous = new Array<number>(pairs.length).fill(-1);
    let bestEnd = 0;

    for (let i = 1; i < pairs.length; i += 1) {
      for (let j = 0; j < i; j += 1) {
        if (pairs[j][1] < pairs[i][1] && best[j] + 1 > best[i]) {
          best[i] = best[j] + 1;
          previous[i] = j;
        }
      }
      if (best[i] > best[bestEnd]) bestEnd = i;
    }

    const chain: [number, number][] = [];
    for (let at = bestEnd; at !== -1; at = previous[at]) {
      chain.push(pairs[at]);
    }
    return chain.reverse();
  }
}

export default LineMap;
