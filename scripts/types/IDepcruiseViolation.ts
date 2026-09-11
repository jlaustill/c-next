/**
 * One violation edge as dependency-cruiser reports it in `--output-type json`.
 *
 * Shared because it is a fact about ANOTHER TOOL'S output shape, and #1317 wrote
 * it three times before anyone counted: an unexported interface in
 * `ParseTreeSites`, and twice inline in `parse-tree-sites.ts` as a return
 * annotation and a cast. If dependency-cruiser renames a field, three edits --
 * which is the duplicate-path anti-pattern the very PR that introduced it spends
 * two paragraphs arguing against.
 *
 * Deliberately structural and partial: only the fields this repo reads. Mirroring
 * the whole schema would be a second, staler copy of dependency-cruiser's own
 * types with nothing keeping it honest.
 */
interface IDepcruiseViolation {
  /** Module the edge starts at, repo-relative (`src/...`). */
  readonly from: string;
  /** What it depends on -- a repo path, or `node_modules/<pkg>/...` for an npm dep. */
  readonly to: string;
  /** Absent when the reporter omits it, so every read must narrow first. */
  readonly rule?: { readonly name?: string };
}

export default IDepcruiseViolation;
