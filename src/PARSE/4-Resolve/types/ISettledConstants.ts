import type TEnumMemberValue from "../../../types/TEnumMemberValue";

/**
 * The program's compile-time values, settled once by 1.4 Resolve (#1175,
 * #1669): every file-scope and scope const that has a value, and every C-Next
 * enum's member values, by C name.
 */
interface ISettledConstants {
  readonly consts: ReadonlyMap<string, number>;
  readonly enums: ReadonlyMap<string, ReadonlyArray<TEnumMemberValue>>;
}

export default ISettledConstants;
