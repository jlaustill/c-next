import type TLengthKind from "./TLengthKind";
import type TLengthUnit from "./TLengthUnit";

/** A length property's name, split into its kind and its unit */
interface ILengthName {
  readonly kind: TLengthKind;
  readonly unit: TLengthUnit;
}

export default ILengthName;
