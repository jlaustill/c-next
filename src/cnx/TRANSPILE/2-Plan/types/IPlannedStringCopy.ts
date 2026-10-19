/**
 * 2.2's decision for a write of one whole `string<N>` (#1731): its capacity,
 * and whether it copies through `cnx_string_copy` because its source is a
 * string that can be the target itself (#2207). A string literal never is.
 */
interface IPlannedStringCopy {
  readonly capacity: number;
  readonly throughHelper: boolean;
}

export default IPlannedStringCopy;
