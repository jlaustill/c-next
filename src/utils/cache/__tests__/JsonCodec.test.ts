/**
 * Unit tests for JsonCodec (issue #1225).
 *
 * The codec exists so the cache cannot drop a symbol field: it copies whatever
 * is there instead of naming fields. These tests hold it to that — including
 * the Map and Set paths, which no symbol field uses *today* and which would
 * therefore go unexercised by the integration suite right up until the day a
 * field needs them.
 */
import { describe, it, expect } from "vitest";
import JsonCodec from "../JsonCodec";
import TJsonValue from "../../types/TJsonValue";

/** Encode then decode, the way a cache write followed by a read does. */
function roundTrip(value: unknown): unknown {
  return JsonCodec.decode(JsonCodec.encode(value) as TJsonValue);
}

describe("JsonCodec", () => {
  describe("primitives", () => {
    it.each([
      ["string", "handle_t"],
      ["number", 42],
      ["zero", 0],
      ["true", true],
      ["false", false],
      ["null", null],
    ])("round-trips a %s unchanged", (_label, value) => {
      expect(roundTrip(value)).toStrictEqual(value);
    });
  });

  describe("collections", () => {
    it("round-trips a Map as a Map, not an object", () => {
      const value = new Map([
        ["widget_t", "widget.h"],
        ["handle_t", "handles.h"],
      ]);

      const restored = roundTrip(value);

      expect(restored).toBeInstanceOf(Map);
      expect(restored).toStrictEqual(value);
    });

    it("round-trips a Set as a Set, not an array", () => {
      const value = new Set(["opaque_t", "handle_t"]);

      const restored = roundTrip(value);

      expect(restored).toBeInstanceOf(Set);
      expect(restored).toStrictEqual(value);
    });

    it("round-trips an empty Map and Set", () => {
      expect(roundTrip(new Map())).toStrictEqual(new Map());
      expect(roundTrip(new Set())).toStrictEqual(new Set());
    });

    it("round-trips an array of objects", () => {
      const value = [{ name: "A", value: 0 }, { name: "B" }];
      expect(roundTrip(value)).toStrictEqual(value);
    });

    it("revives a Map nested inside an object, as a struct symbol carries one", () => {
      const value = {
        kind: "struct",
        name: "MyStruct",
        fields: new Map([["x", { name: "x", type: "int" }]]),
      };

      const restored = roundTrip(value) as { fields: unknown };

      expect(restored).toStrictEqual(value);
      expect(restored.fields).toBeInstanceOf(Map);
    });

    it("revives collections nested inside a Map's values", () => {
      const value = new Map([["outer", new Set(["inner"])]]);

      const restored = roundTrip(value) as Map<string, unknown>;

      expect(restored.get("outer")).toBeInstanceOf(Set);
      expect(restored).toStrictEqual(value);
    });
  });

  describe("field preservation", () => {
    it("copies every field without naming any — the whole point of the codec", () => {
      // A shape no serializer was written for. If the codec enumerated fields,
      // the ones it did not know about would vanish here.
      const value = {
        known: 1,
        aFieldAddedLater: "survives",
        nested: { alsoNew: [1, 2, 3] },
      };

      expect(roundTrip(value)).toStrictEqual(value);
    });

    it("drops undefined properties, matching JSON", () => {
      const encoded = JsonCodec.encode({ present: "yes", absent: undefined });

      expect(encoded).toStrictEqual({ present: "yes" });
      // An absent optional property and an explicitly-undefined one are the
      // same value on read, so nothing is lost.
      expect(roundTrip({ present: "yes", absent: undefined })).toStrictEqual({
        present: "yes",
      });
    });

    it("encodes a bare undefined as null rather than losing the slot", () => {
      expect(JsonCodec.encode(undefined)).toBeNull();
    });
  });

  describe("tag handling", () => {
    it("does not mistake a plain object for an encoded collection", () => {
      const value = { notATag: [["a", "b"]] };
      expect(roundTrip(value)).toStrictEqual(value);
    });
  });
});
