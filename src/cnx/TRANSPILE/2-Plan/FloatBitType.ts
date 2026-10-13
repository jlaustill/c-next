/** ADR-007: the unsigned integer a float's bits are held in, at its width */
class FloatBitType {
  static of(floatType: string): string {
    return floatType === "f64" ? "uint64_t" : "uint32_t";
  }
}

export default FloatBitType;
