import { describe, expect, it } from "vitest";

import BlockedByField from "../backlog/BlockedByField";

/**
 * The two long fixtures are verbatim `Blocked by` values from the board on
 * 2026-09-12. They are the cases a bare `#\d+` scan gets wrong, so they are
 * quoted rather than simplified -- a tidied-up version would not exercise the
 * thing the module exists for.
 */
const ISSUE_1448 =
  "#1320, #1322, #1447; #1398 — box 3 requires #1430 AND #1398 fixed BY the hoist, " +
  "with fixtures that fail if it is reverted. #1398 closed 2026-09-05 via PR #1502, " +
  "a week BEFORE the hoist landed (#1320, 2026-09-12T03:29:14Z), and no fixture in " +
  "tests/ names it — so box 3 is unsatisfiable as written and cannot be ticked by " +
  "this card.; #1430 — same disqualification, missed above: closed by PR #1496.";

const ISSUE_1544 =
  "#1553 — the definition of done needs a multi-file fixture carrying a marker, " +
  "and that marker cannot be used on a multi-file fixture until #1553 lands. " +
  "(#1511, named in the body, is closed and is no longer a blocker.)";

describe("BlockedByField.parse", () => {
  it.each([
    ["a bare list", "#1323, #1447", [1323, 1447]],
    ["one blocker", "#1553", [1553]],
    ["an empty field", "", []],
    ["prose with no leading reference", "waiting on review", []],
    [
      "segments split on a semicolon",
      "#1317; #1449, #1450 — DoD needs codegen to render from a plan",
      [1317, 1449, 1450],
    ],
    [
      "a trailing parenthetical",
      "#1444, #1466 (§1 names no home for cli/ or lib/).",
      [1444, 1466],
    ],
    ["a dash after the run", "#1313, #1357 - only blockers", [1313, 1357]],
  ])("reads %s", (_label, text, expected) => {
    expect(BlockedByField.parse(text)).toEqual(expected);
  });

  it("takes only the leading run of each segment, not every reference", () => {
    expect(BlockedByField.parse(ISSUE_1448)).toEqual([
      1320, 1322, 1447, 1398, 1430,
    ]);
  });

  it("declines a citation the field itself calls a non-blocker", () => {
    expect(BlockedByField.parse(ISSUE_1544)).toEqual([1553]);
  });

  it("ignores a reference in a segment that begins with prose", () => {
    // The anchor IS the rule. Without it the first reference anywhere in a
    // segment reads as a blocker, so an appended note becomes an edge -- and
    // every other fixture here happens to start each segment with a reference,
    // where anchored and unanchored agree. This is the case that separates
    // them, added because a mutation dropping the `^` left the suite green.
    expect(
      BlockedByField.parse("#1320; paused before any commit — see PR #1502"),
    ).toEqual([1320]);
  });

  it("states a blocker once however often the field repeats it", () => {
    expect(BlockedByField.parse("#99; #99 — restated on append")).toEqual([99]);
  });
});

describe("BlockedByField.citations", () => {
  it("reports the references parse declined, so a wrong read is visible", () => {
    expect(BlockedByField.citations(ISSUE_1448)).toEqual([1502, 1496]);
  });

  it("reports a non-blocker named in a parenthetical", () => {
    expect(BlockedByField.citations(ISSUE_1544)).toEqual([1511]);
  });

  it("reports a reference from a segment that begins with prose", () => {
    expect(
      BlockedByField.citations(
        "#1320; paused before any commit — see PR #1502",
      ),
    ).toEqual([1502]);
  });

  it("reports nothing when every reference is a blocker", () => {
    expect(BlockedByField.citations("#1323, #1447")).toEqual([]);
  });
});
