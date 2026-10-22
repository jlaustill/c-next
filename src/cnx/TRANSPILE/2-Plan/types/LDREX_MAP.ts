/**
 * ADR-049: the ARM LDREX (Load-Exclusive) intrinsic for each cnx type an
 * exclusive access can hold. 2.2 decides an atomic takes the LDREX/STREX loop
 * only for these types; 2.3 writes the intrinsic.
 */
const LDREX_MAP: Readonly<Record<string, string>> = {
  u8: "__LDREXB",
  i8: "__LDREXB",
  u16: "__LDREXH",
  i16: "__LDREXH",
  u32: "__LDREXW",
  i32: "__LDREXW",
};

export default LDREX_MAP;
