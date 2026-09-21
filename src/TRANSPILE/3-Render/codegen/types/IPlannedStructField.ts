/**
 * One field of a struct declaration, reduced to what the generator asks of it.
 *
 * #1445 box 3: `StructGenerator` read a `StructMemberContext` for a name, a
 * type name, and three renders -- the C type, the dimensions written on the
 * type (`u8[16] data`) and the dimensions written after the name
 * (`u8 data[16]`). Everything it DECIDES from those comes from
 * `input.callbackTypes`, `input.symbols` and the generator's own rules.
 *
 * ## Four of the seven are thunks, and that is not ceremony
 *
 * Each of the four renders is CONDITIONAL in the generator, and each can
 * register effects on `CodeGenState`:
 *
 * - `renderCType` runs only for a non-callback field. A callback field is
 *   spelled with its typedef name, so resolving its type eagerly would
 *   register an effect for a type the struct never names.
 * - `renderZeroInitializer` runs only for an enum field -- the one
 *   non-callback field whose zero is not the aggregate's zero.
 * - both dimension renders run only on the branches that use them, and the
 *   regular branch skips them entirely when the symbols carry tracked
 *   dimensions.
 *
 * Handing over four rendered strings would emit every one of those effects for
 * every field, which is a change to the output rather than to its shape.
 */
interface IPlannedStructField {
  readonly name: string;

  /**
   * The C-Next type name -- the key `callbackTypes` and `knownEnums` use.
   *
   * Always read, so it comes over as a value. This is `getTypeName`, NOT
   * `generateType`: the two answer different questions and the generator needs
   * both.
   */
  readonly typeName: string;

  /** `u8 data[16]` -- dimensions written after the NAME. */
  readonly hasNameDimensions: boolean;

  /** `u8[16] data` -- dimensions written on the TYPE. */
  readonly hasTypeDimensions: boolean;

  /** The rendered C type. */
  readonly renderCType: () => string;

  /** The rendered `[16]` from the type, or `""` when the type carries none. */
  readonly renderTypeDimensions: () => string;

  /** The rendered `[16]` from after the name, or `""` when there are none. */
  readonly renderNameDimensions: () => string;

  /** ADR-017's zero for this field's type, rendered. */
  readonly renderZeroInitializer: () => string;
}

export default IPlannedStructField;
