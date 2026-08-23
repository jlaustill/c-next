/**
 * Issue #1159: placeholder for an array dimension whose size is not known at
 * compile time (a non-constant expression, or a const from a file not yet
 * collected).
 *
 * The slot is kept rather than omitted so that dimension `i` always
 * corresponds to subscript `i`. Dropping an unresolvable dimension shifts
 * every dimension after it, which would make `TypeValidator.checkArrayBounds`
 * validate an index against the wrong bound — e.g. `u8[N][4] grid` would check
 * `grid[i]` against 4.
 *
 * `0` is the value because `checkArrayBounds` already skips non-positive
 * dimensions, and `ArrayDimensionParser.parseForParameters` established the
 * same convention. It means "size unknown, cannot validate" — never "size
 * zero". A dimension that IS statically known must never be recorded as this;
 * conflating the two is what silently disabled bounds checking for hex-sized
 * arrays before #1159.
 */
const UNRESOLVED_DIMENSION = 0;

export default UNRESOLVED_DIMENSION;
