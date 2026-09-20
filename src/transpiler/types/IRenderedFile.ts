/**
 * 2.3 Render's artifact: the text emitted for ONE file. Formatting only.
 *
 * `docs/architecture/README.md` §1 gives 2.3 Render "text. Formatting only --
 * **no decisions**", emitted as `RenderedFile`. This is that record.
 *
 * ## What it holds, and what it deliberately does not
 *
 * Text, and the path it was rendered from. Not `success`, not `errors`, not
 * `declarationCount`, not `outputPath` -- those are the RUN's facts about a
 * file, and they belong to the passes that author them (2.1 Analyze for
 * diagnostics, 3.1 Write for where a file lands). `IFileResult` is the public
 * projection that composes all of it; this is only the half 2.3 produced.
 *
 * ## Why the two texts arrive at different times
 *
 * The implementation is rendered per file in Stage 5. The header is rendered
 * whole-program in Stage 5.5, once every file's facts are captured (#1323) --
 * a header cannot be rendered while the file that owns it is still warm,
 * which is the whole reason that stage exists. So a file's record is complete
 * only after 5.5, and that is where it is assembled.
 *
 * `header` is null for a file with no public interface. That is not an error
 * and not a missing value: `PublicInterface.forFile` was empty, so there is no
 * header to emit and none was rendered.
 */
interface IRenderedFile {
  /** The `.cnx` this text was rendered from. */
  readonly sourcePath: string;

  /** The `.c`/`.cpp` text. */
  readonly implementation: string;

  /** The `.h`/`.hpp` text, or null when the file has no public interface. */
  readonly header: string | null;
}

export default IRenderedFile;
