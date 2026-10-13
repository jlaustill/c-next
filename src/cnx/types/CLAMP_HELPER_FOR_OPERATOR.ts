/**
 * ADR-044 (#1152): the saturating helper each overflowing binary operator
 * lowers to on a `clamp` integer. `x op<- y` applies `op`, so a compound
 * assignment uses its binary operator's entry.
 *
 * Only `+ - *` can overflow into a helper. Unsigned division and modulo cannot
 * overflow at all, and the sole signed case (`INT_MIN / -1`) is left to the
 * existing safe-division path rather than folded in here.
 */
// Partial: an operator outside this map yields undefined, which callers rely
// on. Typing it as a total Record made that lookup appear to always produce a
// string, so the guard read as dead code (S7765).
const CLAMP_HELPER_FOR_OPERATOR: Readonly<Partial<Record<string, string>>> = {
  "+": "add",
  "-": "sub",
  "*": "mul",
};

export default CLAMP_HELPER_FOR_OPERATOR;
