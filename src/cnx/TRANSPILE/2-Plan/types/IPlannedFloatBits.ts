/** ADR-007: 2.2's decision for one read or write of a float's bits */
interface IPlannedFloatBits {
  /** The float's cnx type, which picks the union's integer member */
  readonly floatType: string;
  /**
   * Whether the bits go through the variable's own shadow union, which every
   * read and write of that variable shares and a whole-variable write
   * invalidates. Otherwise the value is copied into a union of its own.
   */
  readonly shared: boolean;
}

export default IPlannedFloatBits;
