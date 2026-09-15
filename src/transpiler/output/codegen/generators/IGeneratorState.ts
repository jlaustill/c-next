/**
 * Transient state snapshot during generation.
 * Represents the current position in the AST traversal.
 * Generators read this but return effects to modify it.
 */
import TParameterInfo from "../../../types/TParameterInfo";

interface IGeneratorState {
  /** Path of the scope currently being generated; `""` at file scope */
  readonly currentScopePath: string;

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
   * Issue #369 / #1450: whether the included header owns this file's type
   * definitions, so a generator must not also emit them.
   *
   * The DECISION, decided once by 2.2 Plan before any declaration renders --
   * not the `selfIncludeAdded` fact it comes from, which this field used to
   * carry. The prose above the old field stated the consequence and then left
   * every reader to derive it, which is the shape CLAUDE.md names: sharing the
   * flag is not enough if each path re-derives what it means.
   */
  readonly headerOwnsTypeDefinitions: boolean;

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
