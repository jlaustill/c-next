import type TEssentialCategory from "../../types/TEssentialCategory";

/**
 * What ADR-058's length rule asks of a property's subject. Analysis and
 * render each read it off the typer's type for the value the property is
 * taken of, so both apply the one rule (`LengthProperty.rule`).
 */
interface ILengthSubject {
  /** The subject is a type's name (`u32`, `Point`), not a value */
  readonly namesType: boolean;
  readonly category: TEssentialCategory;
  /** A string value -- not an array of them */
  readonly isString: boolean;
  readonly isArray: boolean;
  /** A cnx struct, or a header's struct or class */
  readonly isStruct: boolean;
  /** A bitmap field or a header bit-field, which has no storage of its own */
  readonly isBitField: boolean;
  /** The subject as a message names it: `u32`, `u8[4]`, `string<8>` */
  readonly spelling: string;
}

export default ILengthSubject;
