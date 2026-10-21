import type IConstSpelling from "./IConstSpelling";
import type TPlannedNarrowing from "./TPlannedNarrowing";

/** #1735: how 2.3 writes one static-storage value as its folded value */
interface IPlannedStaticValue {
  readonly spelling: IConstSpelling;
  /** MISRA 10.3: a char literal's cast to the value's type, or null */
  readonly narrowing: TPlannedNarrowing | null;
}

export default IPlannedStaticValue;
