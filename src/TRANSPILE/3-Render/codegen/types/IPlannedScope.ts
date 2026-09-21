import type TPlannedScopeMember from "./TPlannedScopeMember";

/**
 * An ADR-016 scope declaration, reduced to the names it emits and the order it
 * emits them in.
 *
 * #1445 box 3: `ScopeGenerator` navigated a `ScopeDeclarationContext` to find
 * its members, asked each one which of four kinds it was, and read the type
 * declarations twice -- once to group them by kind for the header's ordering
 * and once again in the member loop. All of that is the planner's now.
 */
interface IPlannedScope {
  /** The scope's own identifier, as written. */
  readonly name: string;

  /**
   * The scope's full PATH, not its leaf name (#1298).
   *
   * Resolved by the planner through `SymbolRegistry`, the same resolver
   * `setCurrentScopeByPath` uses, rather than read back from
   * `CodeGenState.currentScopePath` -- reading it back would make the generated
   * names depend on `setCurrentScope` having reached global state, which is a
   * side effect through an interface. A mock orchestrator that did not forward
   * it produced bare names with nothing failing at the type level.
   */
  readonly declaringScopePath: string;

  /**
   * #1300: the types this scope contributes to the `.c`, in the order the
   * HEADER emits them -- grouped by kind, so a struct naming an enum declared
   * below it still comes second. The `.c` and the `.h` disagreeing on that
   * ordering was an exit-0 miscompile.
   *
   * The set is the complement of what the header defines, asked per symbol
   * rather than re-derived from visibility: those two answers agree only until
   * a public signature drags a private type into the header, and then the type
   * is defined twice and the C compiler rejects it.
   */
  readonly typeDefinitions: readonly IPlannedScopeTypeDefinition[];

  /** Every member, in source order. */
  readonly members: readonly TPlannedScopeMember[];
}

/** One type this scope defines in the `.c`, and which emitter renders it. */
interface IPlannedScopeTypeDefinition {
  readonly kind: "enum" | "bitmap" | "struct";
  /** The transpiled C name, already scope-qualified. */
  readonly cName: string;
}

export default IPlannedScope;
