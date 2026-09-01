import type TSourceExtension from "./TSourceExtension";
import type THeaderExtension from "./THeaderExtension";

/**
 * The generated-file extensions for one transpiler run.
 *
 * Issue #1319: "is this run C++?" is declared in config, and every site that
 * consumed it needed only the extension it implies -- not the mode itself. The
 * mode was therefore mapped to an extension at nine separate sites across all
 * four layers, eight of them deriving the identical `.h` / `.hpp` answer. That
 * is a re-derived decision, not shared data: changing how a mode selects an
 * extension meant editing nine places.
 *
 * This carries the decision once. Sites receive the extension they need and no
 * longer see the mode, which is also what lets `data/` stop naming output files.
 *
 * The owner is the Transpiler, which reads the declared mode once. Because the
 * mode is known before any file is opened, there is no window in which a
 * consumer can read this too early -- which is what made the previous,
 * discovered version of the fact hazardous.
 */
interface IOutputExtensions {
  /** Extension for a generated translation unit. */
  readonly source: TSourceExtension;
  /** Extension for a generated header. */
  readonly header: THeaderExtension;
}

export default IOutputExtensions;
