/**
 * The generated-file extensions for one transpiler run.
 *
 * Issue #1319: "is this run C++?" is a monotone latch, and every site that
 * consumed it needed only the extension it implies -- not the mode itself. The
 * mode was therefore mapped to an extension at nine separate sites across all
 * four layers, eight of them deriving the identical `.h` / `.hpp` answer. That
 * is a re-derived decision, not shared data: changing how a mode selects an
 * extension meant editing nine places.
 *
 * This carries the decision once. Sites receive the extension they need and no
 * longer see the mode, which is also what lets `data/` stop naming output files.
 *
 * The interim owner is the Transpiler. In the target architecture this is a
 * Tier 2 fact settled in 1.4 Resolve and consumed from 2.2 Plan.
 */
interface IOutputExtensions {
  /** Extension for a generated translation unit: ".c" or ".cpp" */
  readonly source: string;
  /** Extension for a generated header: ".h" or ".hpp" */
  readonly header: string;
}

export default IOutputExtensions;
