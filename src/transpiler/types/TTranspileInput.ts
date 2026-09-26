/**
 * Input to the unified transpile() method.
 *
 * Discriminated union:
 * - { kind: 'files' } — CLI mode, discovers from config.inputs, writes to disk
 * - { kind: 'source', ... } — API mode, in-memory source, returns results as strings
 */
type TTranspileInput =
  | { readonly kind: "files" }
  | {
      readonly kind: "source";
      readonly source: string;
      /**
       * The working directory (default: the process's). A relative
       * `sourcePath` resolves against it, and text with no `sourcePath` is
       * resolved from it.
       */
      readonly workingDir?: string;
      /** Searched ahead of the directories discovered from the text's own. */
      readonly includeDirs?: string[];
      /**
       * Where the text lives. Its directory is where quoted includes resolve
       * (ADR-010) and where the project's include tiers are discovered from
       * (#1435).
       */
      readonly sourcePath?: string;
    };

export default TTranspileInput;
