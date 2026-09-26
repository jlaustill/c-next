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
       * Where text with no `sourcePath` is resolved from (default: the
       * process's working directory). Unused when there is a `sourcePath`:
       * the text lives there (#1435).
       */
      readonly workingDir?: string;
      /** Searched ahead of the directories discovered from the text's own. */
      readonly includeDirs?: string[];
      /**
       * Where the text lives, resolved like any path, against the process's
       * working directory. Its directory is where quoted includes resolve
       * (ADR-010) and where the project's include tiers are discovered from
       * (#1435). An empty string is no path: `workingDir` decides, as when it
       * is omitted.
       */
      readonly sourcePath?: string;
    };

export default TTranspileInput;
