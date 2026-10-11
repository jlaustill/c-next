/**
 * The bit region one bitmap field occupies (ADR-034).
 *
 * The projected, name-free view of `IBitmapFieldSymbol` that codegen and the
 * header writer consume -- #1318 chose projection over handing those layers a
 * symbol, deliberately, so this is the shape that projection produces.
 *
 * It exists because the same two fields were written out inline at every site
 * that touched a bitmap field -- the consumers (`ICodeGenSymbols`,
 * `IHeaderTypeInput`, `BitmapAccessHelper`, `BitmapHandlers`), the PRODUCER that
 * builds the map (`TSymbolInfoAdapter`), and two file-local duplicates named
 * `IBitmapFieldInfo` and `BitmapFieldInfo` in `BitmapCommentUtils` and
 * `AccessExprGenerator`. Adding a third property meant editing all of them in
 * lockstep -- the duplicate-path shape this project forbids outright (#1486).
 *
 * The producer matters most: converting only the consumers would have left the
 * lockstep intact and made the converted maps flow into unconverted signatures,
 * type-checking by structural typing alone -- agreement by coincidence, which is
 * what this type exists to stop.
 */
interface IBitmapFieldLayout {
  /** Bit offset from LSB */
  readonly offset: number;

  /** Width in bits */
  readonly width: number;
}

export default IBitmapFieldLayout;
