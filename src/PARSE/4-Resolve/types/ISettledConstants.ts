import type TEnumMemberValue from "../../../types/TEnumMemberValue";
import type TSettledConst from "../../../types/TSettledConst";

/**
 * The program's compile-time values, settled once by 1.4 Resolve (#1175,
 * #1669): every file-scope and scope const that has a value, and every C-Next
 * enum's member values, by C name.
 */
interface ISettledConstants {
  /** Each const that has settled, by C name: its value, or why it has none */
  readonly consts: ReadonlyMap<string, TSettledConst>;
  readonly enums: ReadonlyMap<string, ReadonlyArray<TEnumMemberValue>>;
  /**
   * While 1.4 settles: an enum some of whose members are still waiting, with
   * the values it has so far. A member that has one is final; a member that
   * does not is not yet known, so a reader waits on the enum (#1863 review:
   * settling a whole enum at a time made declaration order decide). Empty once
   * settling ends.
   */
  readonly partialEnums?: ReadonlyMap<string, ReadonlyArray<TEnumMemberValue>>;
}

export default ISettledConstants;
