/**
 * Transient state snapshot during generation.
 * Represents the current position in the AST traversal.
 * Generators read this but return effects to modify it.
 */
import TParameterInfo from "../types/TParameterInfo";

interface IGeneratorState {
  /** Current scope name (null if at file level) */
  readonly currentScope: string | null;

  /** Current indentation level */
  readonly indentLevel: number;

  /** Whether we're inside a function body */
  readonly inFunctionBody: boolean;

  /** Parameters of the current function */
  readonly currentParameters: ReadonlyMap<string, TParameterInfo>;

  /** Local variables in the current function */
  readonly localVariables: ReadonlySet<string>;

  /** Local arrays in the current function (no & needed for pass-by-ref) */
  readonly localArrays: ReadonlySet<string>;

  /** Expected type for inferred struct initializers */
  readonly expectedType: string | null;
}

export default IGeneratorState;
