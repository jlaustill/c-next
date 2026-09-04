/**
 * The bit region one bitmap field occupies (ADR-034).
 *
 * The projected, name-free view of `IBitmapFieldSymbol` that codegen and the
 * header writer consume -- #1318 chose projection over handing those layers a
 * symbol, deliberately, so this is the shape that projection produces.
 *
 * It exists because the same two fields were written out inline at four
 * independent sites (`ICodeGenSymbols`, `IHeaderTypeInput`,
 * `BitmapAccessHelper`, and a local `IBitmapFieldInfo` in `BitmapCommentUtils`),
 * so adding a third property meant editing four places in lockstep -- the
 * duplicate-path shape this project forbids outright (#1486).
 */
interface IBitmapFieldLayout {
  /** Bit offset from LSB */
  readonly offset: number;

  /** Width in bits */
  readonly width: number;
}

export default IBitmapFieldLayout;
