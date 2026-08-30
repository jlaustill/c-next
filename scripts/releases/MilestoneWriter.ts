/**
 * Issue #1388: the argv of every milestone write, and when a failed one is
 * retried.
 *
 * Extracted from the entry point because the writes are the only part of this
 * tool that can destroy an answer, and none of them had a test. The sharpest
 * case was the clear: by the time the script existed, the not-planned
 * corrections had already been applied by hand, so `check` reported nothing to
 * do and the milestone-clearing path had never once run in production either.
 *
 * `run` and `sleep` are injected for the same reason `ReleaseWindows.build`
 * takes `commitsIn` -- so the decision is checkable without a network.
 */

/** GitHub asks for roughly a second between writes; a backfill is ~1000. */
const WRITE_INTERVAL_MS = 1100;

/** First backoff after a rejected write; doubled on each further attempt. */
const RETRY_BASE_MS = 15_000;

/** Attempts before a failed write is allowed to stop the run. */
const MAX_ATTEMPTS = 3;

class MilestoneWriter {
  static get intervalMs(): number {
    return WRITE_INTERVAL_MS;
  }

  static get maxAttempts(): number {
    return MAX_ATTEMPTS;
  }

  /**
   * The `gh` argv that sets or clears one item's milestone.
   *
   * `null` is sent as the literal `null` through `-F`, which `gh` converts to a
   * JSON null -- the documented sentinel for "remove the milestone". The
   * previous form sent an empty string through `-f` and worked, but rested on
   * the API accepting a value its documentation does not name, and forced the
   * flag itself to depend on the value.
   *
   * An issue and a pull request are both patched through `/issues/`; that is
   * the REST API's own shape, not a shortcut.
   */
  static patchArgs(
    slug: string,
    itemNumber: number,
    milestone: number | null,
  ): string[] {
    if (milestone !== null && !Number.isInteger(milestone)) {
      // Unreachable while the plan's milestones come from the same windows the
      // index does. Worth stating anyway: the alternative is `String(undefined)`
      // reaching GitHub as the word "undefined" and coming back a 422 halfway
      // through a backfill, which says nothing about what went wrong.
      throw new Error(
        `No milestone number for #${itemNumber}; refusing to write "${String(milestone)}".`,
      );
    }
    return [
      "api",
      `repos/${slug}/issues/${itemNumber}`,
      "-X",
      "PATCH",
      "-F",
      `milestone=${milestone === null ? "null" : String(milestone)}`,
      "--jq",
      ".number",
    ];
  }

  /** The `gh` argv that creates a release milestone, dated when it shipped. */
  static createArgs(slug: string, title: string, dueOn?: string): string[] {
    const args = [
      "api",
      `repos/${slug}/milestones`,
      "-X",
      "POST",
      "-f",
      `title=${title}`,
      "-f",
      "description=Release milestone. Assigned by scripts/release-milestones.ts: the closing merge commit is contained in this release.",
    ];
    // A milestone with no due date sorts as undated in GitHub's own list, so
    // the tag's date is what makes the milestone list read as a release
    // timeline. It is absent only for a milestone that is not a tag yet.
    if (dueOn !== undefined) {
      args.push("-f", `due_on=${dueOn}`);
    }
    return args;
  }

  /** Backoff before attempt `attempt` (0-based), doubling each time. */
  static retryDelayMs(attempt: number): number {
    return RETRY_BASE_MS * 2 ** attempt;
  }

  /**
   * Runs one write, retrying a rejection up to `MAX_ATTEMPTS` times.
   *
   * A backfill is a thousand writes, so a secondary rate limit is a normal
   * event rather than a failure. When the attempts run out the error is
   * rethrown: the run is idempotent, so stopping loses nothing but the
   * remainder, and re-running resumes.
   */
  static async write(
    args: readonly string[],
    run: (args: readonly string[]) => void,
    sleep: (ms: number) => Promise<void>,
    onRetry: (attempt: number, waitMs: number) => void,
  ): Promise<void> {
    for (let attempt = 0; ; attempt += 1) {
      try {
        run(args);
        return;
      } catch (error) {
        if (attempt >= MAX_ATTEMPTS - 1) {
          throw error;
        }
        const wait = MilestoneWriter.retryDelayMs(attempt);
        onRetry(attempt, wait);
        await sleep(wait);
      }
    }
  }
}

export default MilestoneWriter;
