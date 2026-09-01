/**
 * SPIKE #1431 — THROWAWAY. Deleted before this branch merges.
 *
 * One row of the `member` table: an enum member, bitmap field, struct field or
 * register member.
 *
 * #1313's audit lists "members as symbols" as **missing** -- they are in the kind
 * vocabulary with no `TSymbol` variant. `TSymbolKindCNext` has 10 members while the
 * `TSymbol` union has 7 variants, and the three without one are exactly
 * `enum_member`, `bitmap_field` and `register_member`. So the discriminant's declared
 * type is wider than the union it discriminates, and members live instead in three
 * incompatible struct-field records plus a scattering of sibling maps
 * (`structFields` + `structFieldArrays` + `structFieldDimensions` are one fact split
 * across three collections keyed the same way).
 *
 * Normalizing them into one table is what lets `structFields` be derived rather than
 * merged -- and `structFields` is one of the 13 collections that never crosses an
 * include boundary today.
 */
interface IMemberRow {
  /** FOREIGN KEY -> symbol.fullyQualifiedCName: the enum, struct, bitmap or register. */
  readonly ownerCName: string;

  /** The member's own name, as written. */
  readonly name: string;

  /** Declaration order. Struct layout and MISRA both care; neither survives a Set. */
  readonly ordinal: number;

  /** "enum_member" | "bitmap_field" | "struct_field" | "register_member". */
  readonly kind: string;

  /** Declared type, as a string. Flattening this is itself one of the losses #1313 names. */
  readonly declaredType: string;

  /**
   * As written. A number when it folds at compile time, a string when it does not --
   * an enum-qualified count already resolved to its generated C name. #1127: this was
   * `number[]` and non-numeric dimensions were filtered out, so `u8[EColor.COUNT] slots`
   * reached the header as a scalar. `CodeGenerator.getMemberTypeInfo` still filters them.
   */
  readonly arrayDimensions: readonly (number | string)[];

  /** Enum member value, bitmap field offset. `null` where the kind has none. */
  readonly value: number | null;

  /** Bitmap field width in bits. `null` where the kind has none. */
  readonly width: number | null;
}

export default IMemberRow;
