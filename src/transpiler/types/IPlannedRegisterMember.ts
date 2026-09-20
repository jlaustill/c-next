/**
 * One register member's `#define`, decided (ADR-004).
 *
 * #1445 box 3: this is what `RegisterMacroGenerator` actually consumed out of
 * a `RegisterMemberContext` -- four strings per member and nothing else. It
 * named the grammar in order to call `.IDENTIFIER().getText()`,
 * `.accessModifier().getText()` and two orchestrator round-trips, then threw
 * the node away. Naming the four answers instead is what lets the formatter be
 * a pure function of them.
 *
 * `cType` and `offset` arrive ALREADY RENDERED, and that is deliberate rather
 * than a shortcut: `cType` is the output of `orchestrator.generateType`, which
 * is the single ADR-057 resolution point for the name -- it qualifies a bare
 * `Flags` to the enclosing scope's bitmap and leaves an explicit
 * `global.Flags` alone. Carrying the resolved string means nothing downstream
 * can re-qualify it, which is the defect ADR-057 forbids and which this pair
 * of generators has already had once.
 */
interface IPlannedRegisterMember {
  /** Member name as written, e.g. `DR`. Unqualified -- the prefix is applied by the formatter. */
  readonly name: string;

  /** The rendered C type, e.g. `uint32_t`. Already ADR-057 resolved. */
  readonly cType: string;

  /** ADR-004 access modifier as written: `ro`, `wo` or `rw`. */
  readonly access: string;

  /** The rendered offset expression, e.g. `0x00`. */
  readonly offset: string;
}

export default IPlannedRegisterMember;
