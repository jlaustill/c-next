/**
 * Any value that survives a JSON round trip unchanged.
 *
 * Used to type data read back from the on-disk cache: until it has been
 * validated it is genuinely of unknown shape, and saying so is more honest
 * than asserting a type the file is not obliged to hold.
 */
type TJsonValue =
  | string
  | number
  | boolean
  | null
  | TJsonValue[]
  | { [key: string]: TJsonValue };

export default TJsonValue;
