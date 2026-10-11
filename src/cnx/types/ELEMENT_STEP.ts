/**
 * A step into an array's element in a constant name's path (#1175):
 * `m[0].element_count` is `["m", ELEMENT_STEP, "element_count"]`.
 *
 * ADR-058's length properties are the same for every element of an array, so
 * the index does not matter and is not recorded. It appears only before a
 * length property; any other subscript has no value. It cannot be confused
 * with an identifier, which never contains a bracket.
 */
const ELEMENT_STEP = "[]";

export default ELEMENT_STEP;
