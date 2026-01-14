/**
 * ADR-034: Bitmap backing types for C output
 */
const BITMAP_BACKING_TYPE: Record<string, string> = {
  bitmap8: "uint8_t",
  bitmap16: "uint16_t",
  bitmap24: "uint32_t", // 24-bit uses 32-bit backing for simplicity
  bitmap32: "uint32_t",
};

export default BITMAP_BACKING_TYPE;
