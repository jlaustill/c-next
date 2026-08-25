import TJsonValue from "../types/TJsonValue";

/**
 * Tag marking an encoded `Map`. Chosen to be something no symbol field is
 * named, so a plain object can never be mistaken for one.
 */
const MAP_TAG = "__cnxMap";

/** Tag marking an encoded `Set`. */
const SET_TAG = "__cnxSet";

/**
 * JsonCodec
 *
 * Lossless JSON encoding for values stored in the symbol cache.
 *
 * The cache used to convert each symbol field-by-field into a flat
 * `ISerializedSymbol` — the legacy model ADR-055 Phase 7 removed everywhere
 * else. Every fact the symbol model gained had to be re-taught to that list by
 * hand, and four bugs (#985, #1104, #1214, #1225) were fields nobody added.
 *
 * This encoder never enumerates fields, so it cannot drop one. `Map` and `Set`
 * are the only non-JSON constructs the symbol model uses; both are tagged on
 * the way out and revived on the way back, which keeps the round trip total for
 * any shape a symbol takes now or later.
 *
 * `undefined` properties are omitted rather than encoded, matching JSON: an
 * absent property and an explicitly-undefined optional property are the same
 * value on read.
 */
class JsonCodec {
  /** Convert a value into its JSON-representable form. */
  static encode(value: unknown): TJsonValue {
    if (value instanceof Map) {
      return {
        [MAP_TAG]: Array.from(value, ([key, entryValue]) => [
          JsonCodec.encode(key),
          JsonCodec.encode(entryValue),
        ]),
      };
    }

    if (value instanceof Set) {
      return {
        [SET_TAG]: Array.from(value, (member) => JsonCodec.encode(member)),
      };
    }

    if (Array.isArray(value)) {
      return value.map((element) => JsonCodec.encode(element));
    }

    if (typeof value === "object" && value !== null) {
      return JsonCodec.encodeObject(value as Record<string, unknown>);
    }

    // undefined has no JSON form; callers drop the property instead.
    return value === undefined ? null : (value as TJsonValue);
  }

  /** Rebuild the original value from its JSON-representable form. */
  static decode(value: TJsonValue): unknown {
    if (Array.isArray(value)) {
      return value.map((element) => JsonCodec.decode(element));
    }

    if (typeof value !== "object" || value === null) {
      return value;
    }

    const tagged = JsonCodec.decodeTagged(value);
    if (tagged !== null) {
      return tagged.value;
    }

    const decoded: Record<string, unknown> = {};
    for (const key of Object.keys(value)) {
      decoded[key] = JsonCodec.decode(value[key]);
    }
    return decoded;
  }

  /**
   * Revive a tagged `Map`/`Set`, or report that this object carries no tag.
   *
   * Returns a wrapper rather than the value itself so that a legitimately
   * encoded `null` is not confused with "no tag here".
   */
  private static decodeTagged(
    value: Record<string, TJsonValue>,
  ): { value: unknown } | null {
    const mapEntries = value[MAP_TAG];
    if (Array.isArray(mapEntries)) {
      return {
        value: new Map(
          mapEntries.map((entry) => {
            const pair = entry as TJsonValue[];
            return [JsonCodec.decode(pair[0]), JsonCodec.decode(pair[1])] as [
              unknown,
              unknown,
            ];
          }),
        ),
      };
    }

    const setMembers = value[SET_TAG];
    if (Array.isArray(setMembers)) {
      return {
        value: new Set(setMembers.map((member) => JsonCodec.decode(member))),
      };
    }

    return null;
  }

  /** Copy every defined own property, encoding each value. */
  private static encodeObject(
    value: Record<string, unknown>,
  ): Record<string, TJsonValue> {
    const encoded: Record<string, TJsonValue> = {};
    for (const key of Object.keys(value)) {
      const property = value[key];
      if (property !== undefined) {
        encoded[key] = JsonCodec.encode(property);
      }
    }
    return encoded;
  }
}

export default JsonCodec;
