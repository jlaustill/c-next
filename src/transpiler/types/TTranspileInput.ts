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
       * The directory the text is resolved from: where its quoted includes
       * are found (ADR-010) and where the project's include tiers are
       * discovered from. Defaults to the directory of `sourcePath`, or to the
       * process's working directory when there is no `sourcePath` (#1435).
       */
      readonly workingDir?: string;
      /** Searched ahead of the directories discovered from `workingDir`. */
      readonly includeDirs?: string[];
      readonly sourcePath?: string;
    };

export default TTranspileInput;
