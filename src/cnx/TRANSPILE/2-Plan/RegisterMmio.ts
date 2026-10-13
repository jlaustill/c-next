import TypeCheckUtils from "../../utils/TypeCheckUtils";

/** ADR-004: whether a write-only register member's bit range is one memory access */
class RegisterMmio {
  /**
   * The `uintN_t` a byte-aligned, standard-width bit range is written
   * through, or null when the range is written as a masked word
   */
  static accessType(
    start: number | undefined,
    width: number | undefined,
  ): string | null {
    if (
      start === undefined ||
      width === undefined ||
      start % 8 !== 0 ||
      !TypeCheckUtils.isStandardWidth(width)
    ) {
      return null;
    }
    return `uint${width}_t`;
  }
}

export default RegisterMmio;
