/**
 * Issue #958: Immutable struct symbol state managed via immer produce().
 * All mutations are additive-only — no unmark/delete operations.
 * Resolution (e.g., "is this type truly opaque?") happens at query time.
 */
interface IStructSymbolState {
  /** Typedef names declared with forward-declared structs (additive only) */
  opaqueTypes: Set<string>;
  /** ALL typedef struct types from C headers: name → sourceFile (additive only) */
  typedefStructTypes: Map<string, string>;
  /** Struct tag → typedef name (e.g., "_widget_t" → "widget_t") */
  structTagAliases: Map<string, string>;
  /** Typedef name → struct tag (reverse of structTagAliases) */
  typedefToTag: Map<string, string>;
  /** Struct tags that have full definitions (bodies) */
  structTagsWithBodies: Set<string>;
  /**
   * Typedefs of a pointer to a struct, e.g. `typedef struct opaque_t* handle_t`.
   *
   * Issue #957 rightly keeps these out of opaqueTypes -- they are already
   * pointers, not incomplete structs. But the fact was then discarded, and a
   * generated header cannot tell one from a plain external struct: it emitted
   * `typedef struct handle_t handle_t;`, declaring a different type than the
   * real definition (#1164). Recorded here so both the forward-declaration
   * filter and the include-propagation check can ask.
   */
  pointerTypedefs: Set<string>;
}

export default IStructSymbolState;
