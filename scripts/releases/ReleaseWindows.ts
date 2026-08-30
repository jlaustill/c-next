/**
 * Issue #1388: the commit ranges that make up each release.
 *
 * `commitsIn` is injected rather than called directly so the window arithmetic
 * -- which range belongs to which release, and where the unreleased work goes
 * -- is reachable from a unit test without a repository.
 */

import type IReleaseWindow from "../types/IReleaseWindow";

/** `vMAJOR.MINOR.PATCH`, the only tag shape `publish.yml` reacts to. */
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
   * The release being prepared: the open milestone that is not yet a tag.
   *
   * `docs/WORKFLOW.md` already requires the release issue to set that
   * milestone, so reading it beats a flag -- the board and this script cannot
   * disagree about which version is next.
   *
   * Two candidates is refused rather than resolved. Picking one would attribute
   * every in-flight merge to a release chosen by sort order, and the run writes
   * milestones, so a wrong guess here is a wrong guess written across the
   * backlog.
   */
  static preparing(
    openMilestoneTitles: readonly string[],
    tags: readonly string[],
  ): string | null {
    const tagged = new Set(tags);
    const candidates = ReleaseWindows.releaseTags(openMilestoneTitles).filter(
      (title) => !tagged.has(title),
    );

    if (candidates.length > 1) {
      throw new Error(
        `Ambiguous release in preparation: ${candidates.join(", ")}. ` +
          "Exactly one open milestone may name an untagged release.",
      );
    }
    return candidates[0] ?? null;
  }
}

export default ReleaseWindows;
