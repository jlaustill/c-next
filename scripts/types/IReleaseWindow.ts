/**
 * One release and the commits that first appeared in it.
 *
 * `milestone` is the title to assign, not necessarily a tag: the window past
 * the last tag carries the name of the release being prepared, which only the
 * caller knows. Keeping it a plain string is what lets `ReleaseAttribution`
 * stay ignorant of version numbering.
 */
interface IReleaseWindow {
  readonly milestone: string;
  readonly commits: readonly string[];
}

export default IReleaseWindow;
