/**
 * The one marker vocabulary (#1555).
 *
 * A fixture declares what the harness should do with it by writing a marker in
 * a comment. Until this module there was no vocabulary: each site re-derived
 * both the marker's spelling and what a match meant, so a marker could be
 * written in a form no site read and nothing said anything.
 *
 * That silence is the shape behind five separate issues -- #1143 (the marker
 * compiled with no optimiser, so it could not emit the diagnostic it guarded),
 * #1379 (`test-error` is read in no spelling at all), #1553 (wrong include
 * path, then entry-only), #1555 (block form only), #1557 (C mode only). Each
 * was fixed where it was found; each site kept its own copy of the question.
 *
 * The decision this module owns is "what is a correctly spelled marker" -- one
 * answer, asked by the harness, by the snapshot generator, and by the corpus
 * guard that asserts no fixture writes anything else.
 *
 * Every marker is a line comment holding the marker and nothing else. The one
 * exception used to be the no-warnings marker, which was read in block form
 * only: introduced that way in `7bd86291` with the gloss "marker in block
 * comment" -- a description, never a rationale -- and pinned afterwards by a
 * characterization test written during an extraction. The corpus had settled
 * the question anyway, 954 line-form markers to 17.
 */

import IMarkerSpelling from "./types/IMarkerSpelling";

/**
 * A comment line naming a marker and nothing else.
 *
 * Marker-ness is decided by ANCHORING, the convention the `test-adr:` /
 * `test-link:` family already documents: a marker occupies its own comment
 * line. Prose that merely mentions one -- "This fixture is test-no-warnings
 * rather than test-execution because ..." -- has words around the name and is
 * not a claim about the harness, so it must not be read as one.
 */
const MARKER_SHAPED =
  /^[ \t]*(?:\/\/|\/\*)[ \t]*(test-[a-z0-9-]+)(?::[^\n]*?)?[ \t]*(?:\*\/)?[ \t]*$/i;

class TestMarkers {
  /**
   * Marker name to the single spelling the harness reads.
   *
   * NOT global: a `/g` regex carries `lastIndex` between calls, so a shared
   * one would alternate true and false across `.test()`. Callers needing a
   * global copy build one from `.source` and `.flags`.
   *
   * Arg-bearing markers capture their argument list in group 1.
   */
  private static readonly SPELLINGS: ReadonlyMap<string, RegExp> = new Map([
    ["test-execution", /^[ \t]*\/\/[ \t]*test-execution[ \t]*$/m],
    ["test-error", /^[ \t]*\/\/[ \t]*test-error[ \t]*$/im],
    ["test-c-only", /^[ \t]*\/\/[ \t]*test-c-only[ \t]*$/im],
    ["test-cpp-only", /^[ \t]*\/\/[ \t]*test-cpp-only[ \t]*$/im],
    ["test-transpile-only", /^[ \t]*\/\/[ \t]*test-transpile-only[ \t]*$/im],
    ["test-no-warnings", /^[ \t]*\/\/[ \t]*test-no-warnings[ \t]*$/im],
    ["test-adr", /^[ \t]*\/\/[ \t]*test-adr:[ \t]*(.+)$/im],
    ["test-link", /^[ \t]*\/\/[ \t]*test-link:[ \t]*(.+)$/im],
  ]);

  /**
   * The spelling of one marker.
   *
   * Throws on an unknown name rather than returning a regex that matches
   * nothing: a typo must fail loudly, since "no fixture has this marker" and
   * "this marker does not exist" are indistinguishable to every caller and
   * silence is the defect this module exists to remove.
   */
  static spellingOf(marker: string): RegExp {
    const spelling = TestMarkers.SPELLINGS.get(marker);
    if (spelling === undefined) {
      throw new Error(
        `Unknown test marker "${marker}". Known markers: ${[...TestMarkers.SPELLINGS.keys()].join(", ")}`,
      );
    }
    return spelling;
  }

  /**
   * A fresh global copy of one marker's spelling, for callers that iterate
   * every occurrence to parse its arguments.
   *
   * Fresh per call on purpose: a `/g` regex carries `lastIndex`, so a shared
   * one resumes mid-source on its next caller and skips matches.
   */
  static globalSpellingOf(marker: string): RegExp {
    const spelling = TestMarkers.spellingOf(marker);
    return new RegExp(spelling.source, `${spelling.flags}g`);
  }

  /** Whether `source` carries `marker`, spelled the way the harness reads it. */
  static has(marker: string, source: string): boolean {
    return TestMarkers.spellingOf(marker).test(source);
  }

  /** Every known marker name, in declaration order. */
  static names(): string[] {
    return [...TestMarkers.SPELLINGS.keys()];
  }

  /**
   * Lines that are trying to be a marker but are not spelled like one.
   *
   * Per line rather than per file: a fixture spelling a marker correctly on
   * one line and incorrectly on another must not have the good line mask the
   * bad one.
   */
  static findUnrecognisedSpellings(source: string): IMarkerSpelling[] {
    const offences: IMarkerSpelling[] = [];

    source.split("\n").forEach((line, index) => {
      const shaped = MARKER_SHAPED.exec(line);
      if (shaped === null) return;

      const marker = shaped[1].toLowerCase();
      if (!TestMarkers.SPELLINGS.has(marker)) return; // not a marker we know
      if (TestMarkers.spellingOf(marker).test(line)) return;

      offences.push({ marker, line: index + 1, text: line.trim() });
    });

    return offences;
  }
}

export default TestMarkers;
