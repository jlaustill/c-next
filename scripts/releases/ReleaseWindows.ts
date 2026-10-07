/**
 * Issue #1388: the commit ranges that make up each release.
 *
 * `commitsIn` is injected rather than called directly so the window arithmetic
 * -- which range belongs to which release, and where the unreleased work goes
 * -- is reachable from a unit test without a repository.
 */

import type IReleaseWindow from "../types/IReleaseWindow";

/**
 * `vMAJOR.MINOR.PATCH` -- deliberately stricter than what starts a publish.
 *
 * `publish.yml` triggers on the glob `v*.*.*`, and an Actions glob lets `*`
 * match any run of characters, so `v0.4.0-rc.1` and `v1.2.3.4` both fire it.
 * They are not releases for attribution: a prerelease ships nothing that a
 * milestone should name, so it contributes no window and the work it contains
 * stays attributed to the release being prepared -- which is where it will
 * actually ship.
 *
 * An earlier version of this comment claimed the regex was the only shape the
 * workflow reacts to. That was checkable and false.
 */
const RELEASE_TAG = /^v\d+\.\d+\.\d+$/;

class ReleaseWindows {
  /**
   * Keeps only release tags, in the order given.
   *
   * The caller sorts by creation date, not by version name: the question is
   * which release first *contained* a commit, and that is a fact about when
   * releases happened. Sorting by name would place a late hotfix on an old
   * minor before releases that shipped years earlier.
   */
  static releaseTags(tags: readonly string[]): string[] {
    return tags.filter((tag) => RELEASE_TAG.test(tag));
  }

  /**
   * One window per release, plus the unreleased work if a name is given.
   *
   * The unreleased window carries the milestone of the release being prepared,
   * so in-flight work is attributed the moment it merges rather than at tag
   * time. That is the same derivation, not a second one.
   */
  static build(
    tags: readonly string[],
    unreleased: { readonly milestone: string; readonly head: string } | null,
    commitsIn: (range: string) => readonly string[],
  ): IReleaseWindow[] {
    const releases = ReleaseWindows.releaseTags(tags);
    const windows = releases.map((tag, position) => ({
      milestone: tag,
      // The first release has no predecessor, so its window is every commit
      // reachable from it rather than a range.
      commits: commitsIn(
        position === 0 ? tag : `${releases[position - 1]}..${tag}`,
      ),
    }));

    if (unreleased === null) {
      return windows;
    }

    const last = releases.at(-1);
    windows.push({
      milestone: unreleased.milestone,
      commits: commitsIn(
        last === undefined ? unreleased.head : `${last}..${unreleased.head}`,
      ),
    });
    return windows;
  }

  /**
   * The ref the unreleased window is measured to.
   *
   * NOT `HEAD`. "Unreleased" means merged and awaiting a release, and what
   * ships is the default branch -- so measuring from whatever is checked out
   * under-reports on every feature branch, which is precisely where someone
   * runs the check. It reads as `not-shipped`, indistinguishable from a pull
   * request merged into a stack that never landed.
   *
   * Falls back through the candidates so a detached checkout at a tag, which
   * is what `publish.yml` produces, still has a ref to measure to.
   */
  static headRef(
    candidates: readonly string[],
    exists: (ref: string) => boolean,
  ): string {
    return candidates.find((ref) => exists(ref)) ?? "HEAD";
  }

  /**
   * The release being prepared: the lowest-versioned open milestone that is
   * not yet a tag.
   *
   * `docs/WORKFLOW.md` already requires the release issue to set that
   * milestone, so reading it beats a flag -- the board and this script cannot
   * disagree about which version is next. `/issue-check` reads this answer
   * (`npm run -s release:preparing`) rather than deriving its own (#1912).
   *
   * A second untagged milestone is not an ambiguity. Only the lowest is being
   * prepared; every higher one is pre-planning for a future release, and
   * nothing is attributed to or picked from it (owner ruling on #1918).
   * Versions compare numerically: `v0.1.10` is later than `v0.1.9`.
   */
  static preparing(
    openMilestoneTitles: readonly string[],
    tags: readonly string[],
  ): string | null {
    const tagged = new Set(tags);
    const candidates = ReleaseWindows.releaseTags(openMilestoneTitles).filter(
      (title) => !tagged.has(title),
    );
    return [...candidates].sort(ReleaseWindows.byVersion)[0] ?? null;
  }

  /** Orders `vMAJOR.MINOR.PATCH` titles by number, lowest first. */
  private static byVersion(a: string, b: string): number {
    const parts = (title: string): number[] =>
      title.slice(1).split(".").map(Number);
    const [left, right] = [parts(a), parts(b)];
    const differing = left.findIndex((part, i) => part !== right[i]);
    return differing === -1 ? 0 : left[differing] - right[differing];
  }
}

export default ReleaseWindows;
