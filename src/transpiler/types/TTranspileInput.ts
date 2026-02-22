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
      readonly workingDir?: string;
      readonly includeDirs?: string[];
      readonly sourcePath?: string;
    };

export default TTranspileInput;
