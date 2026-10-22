/**
 * ADR-049: the ARM STREX (Store-Exclusive) intrinsic for each cnx type an
 * exclusive access can hold, beside `LDREX_MAP`.
 */
const STREX_MAP: Readonly<Record<string, string>> = {
  u8: "__STREXB",
  i8: "__STREXB",
  u16: "__STREXH",
  i16: "__STREXH",
  u32: "__STREXW",
  i32: "__STREXW",
};

export default STREX_MAP;
