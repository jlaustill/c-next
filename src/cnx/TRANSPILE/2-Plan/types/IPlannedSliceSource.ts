/**
 * 2.2's decision for a slice write's source (#1081, #1991): the C type it is
 * read as, its width, the unsigned type it is shifted as, and whether it is a
 * composite expression rather than a single value
 */
interface IPlannedSliceSource {
  readonly cType: string | null;
  readonly bytes: number;
  readonly unsignedCType: string | null;
  readonly isComposite: boolean;
}

export default IPlannedSliceSource;
