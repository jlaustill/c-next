/**
 * One array dimension written on a TYPE -- the `[16]` of `u8[16] data`.
 *
 * #1445 box 3: `ArrayDimensionUtils` read an `ArrayTypeContext` for the list of
 * dimensions and, for each, whether it carries a size expression. That is two
 * facts per dimension, and both are here.
 *
 * `renderSize` is a thunk, not a string, because a dimension that does not
 * fold to a constant goes through expression generation, which registers
 * effects on `CodeGenState` -- and the caller that asks for the dimensions may
 * not emit them. Null is the unsized `[]`, which renders without asking.
 */
interface IPlannedDimension {
  /**
   * The size, rendered: a folded constant where one could be evaluated, and
   * the generated expression otherwise. Null for an unsized `[]`.
   */
  readonly renderSize: (() => string) | null;
}

export default IPlannedDimension;
