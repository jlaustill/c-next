/**
 * What a manifest command decided, separated from printing it.
 *
 * `check`'s ordering bug lived in the CLI's `main()`, which nothing could reach
 * from a test -- so the decision is returned as data and `main()` only prints it.
 */
interface IManifestOutcome {
  readonly ok: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  readonly info: readonly string[];
}

export default IManifestOutcome;
