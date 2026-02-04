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

  /**
   * Issue #369: Whether self-include was added.
   * When true, type definitions (struct/enum/bitmap) should not be emitted
   * in the .c file as they'll come from the included header.
   */
  readonly selfIncludeAdded: boolean;

  // === Postfix Expression State (Issue #644) ===

  /** Scope members by scope name (for this.member lookups) */
  readonly scopeMembers: ReadonlyMap<string, ReadonlySet<string>>;

  /** Main function args parameter name (for args -> argv translation) */
  readonly mainArgsName: string | null;

  /** Float bit shadow variable declarations (tracks which shadows exist) */
  readonly floatBitShadows: ReadonlySet<string>;

  /** Float shadows that have current values (skip redundant memcpy) */
  readonly floatShadowCurrent: ReadonlySet<string>;

  /** Cached strlen values for optimization */
  readonly lengthCache: ReadonlyMap<string, string> | null;
}

export default IGeneratorState;
