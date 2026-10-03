import type IBaseSymbol from "./IBaseSymbol";

/**
 * Symbol representing one member of an enum.
 *
 * ## Why a symbol and not a number
 *
 * `IEnumSymbol.members` was `ReadonlyMap<string, number>`, so a member had a
 * value and nothing else -- no position, and no identity. Both were then
 * rebuilt by whoever needed them, and neither was rebuilt correctly:
 * `parseWithSymbols` reported the ENCLOSING ENUM's line for every member, which
 * is the "members carry their parent's position" defect #1318 exists to remove,
 * and it re-derived the qualified name by hand, which is the #1285 shape.
 *
 * ## Identity
 *
 * `scopePath` is the enum's `cnxScopedName` -- `EColor`, or `Motor.EMode` for a
 * scope-declared enum. `ScopeUtils.identityOf` then yields exactly the
 * identifier codegen already emits (`EColor__RED`, `Motor__EMode__HIGH`),
 * because `QualifiedCName.fromParts` expands the dotted component. Nothing here
 * invents an encoding; the member is spelled by the same encoder as everything
 * else, which is the whole point of ADR-063 being injective.
 *
 * ## Visibility
 *
 * A member is exactly as visible as the enum that declares it -- there is no
 * per-member access control in ADR-016 -- so it inherits, rather than
 * hardcoding "public" beside a parent that may be private. That hardcoded-flag
 * shape is what emitted every private struct, enum and bitmap into the public
 * header (#1300).
 */
interface IEnumMemberSymbol extends IBaseSymbol {
  /** Discriminator narrowed to "enum_member" */
  readonly kind: "enum_member";

  /**
   * The member's numeric value, after ADR auto-increment has been applied.
   *
   * Resolved at collection, so a consumer never re-runs the increment: the
   * value a member carries is the value C is emitted with.
   */
  readonly value: number;
}

export default IEnumMemberSymbol;
