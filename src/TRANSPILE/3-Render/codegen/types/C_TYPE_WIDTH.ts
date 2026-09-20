/**
 * Maps C standard types to their bit widths
 * Used for type resolution from C headers
 */
const C_TYPE_WIDTH: Record<string, number> = {
  uint8_t: 8,
  int8_t: 8,
  uint16_t: 16,
  int16_t: 16,
  uint32_t: 32,
  int32_t: 32,
  uint64_t: 64,
  int64_t: 64,
  float: 32,
  double: 64,
  _Bool: 8, // Storage size is 1 byte (8 bits), not 1 bit
  bool: 8, // Storage size is 1 byte (8 bits), not 1 bit
  char: 8,
  "unsigned char": 8,
  "signed char": 8,
  short: 16,
  "unsigned short": 16,
  int: 32,
  "unsigned int": 32,
  long: 32, // Platform dependent, but commonly 32-bit
  "unsigned long": 32,
  "long long": 64,
  "unsigned long long": 64,
};

export default C_TYPE_WIDTH;
