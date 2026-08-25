/**
 * ADR-029: CallbackTypedefFormatter is the single source of truth for a
 * callback typedef's shape.
 *
 * The `.c` and the `.h` each used to format this themselves and disagreed --
 * the header dropped `const` and array dimensions, so
 * `void (*onReceive_fp)(const Message*)` in the implementation met
 * `void (*onReceive_fp)(Message*)` in the header (#1164). These cover each
 * parameter shape the two paths have to agree on.
 */

import { describe, it, expect } from "vitest";
import CallbackTypedefFormatter from "../CallbackTypedefFormatter";

describe("CallbackTypedefFormatter", () => {
  describe("formatParameterList", () => {
    it("writes void for a callback taking no parameters", () => {
      expect(CallbackTypedefFormatter.formatParameterList([], false)).toBe(
        "void",
      );
    });

    it("passes a primitive through unchanged", () => {
      const params = [{ type: "uint8_t", isStruct: false }];
      expect(CallbackTypedefFormatter.formatParameterList(params, false)).toBe(
        "uint8_t",
      );
    });

    it("gives a struct pointer semantics in C (ADR-006)", () => {
      const params = [{ type: "Message", isStruct: true }];
      expect(CallbackTypedefFormatter.formatParameterList(params, false)).toBe(
        "Message*",
      );
    });

    it("gives a struct reference semantics in C++ (ADR-006)", () => {
      const params = [{ type: "Message", isStruct: true }];
      expect(CallbackTypedefFormatter.formatParameterList(params, true)).toBe(
        "Message&",
      );
    });

    it("keeps const on a struct parameter", () => {
      const params = [{ type: "Message", isStruct: true, isConst: true }];
      expect(CallbackTypedefFormatter.formatParameterList(params, false)).toBe(
        "const Message*",
      );
    });

    it("keeps an array parameter's name and dimensions", () => {
      const params = [
        {
          type: "uint8_t",
          isStruct: false,
          isArray: true,
          name: "data",
          arrayDims: "[4]",
        },
      ];
      expect(CallbackTypedefFormatter.formatParameterList(params, false)).toBe(
        "uint8_t data[4]",
      );
    });

    it("keeps const on an array parameter", () => {
      const params = [
        {
          type: "uint8_t",
          isStruct: false,
          isArray: true,
          isConst: true,
          name: "data",
          arrayDims: "[4]",
        },
      ];
      expect(CallbackTypedefFormatter.formatParameterList(params, false)).toBe(
        "const uint8_t data[4]",
      );
    });

    it("separates multiple parameters with a comma", () => {
      const params = [
        { type: "Message", isStruct: true, isConst: true },
        { type: "uint32_t", isStruct: false },
      ];
      expect(CallbackTypedefFormatter.formatParameterList(params, false)).toBe(
        "const Message*, uint32_t",
      );
    });
  });

  describe("format", () => {
    it("builds a complete typedef declaration", () => {
      const params = [{ type: "Message", isStruct: true, isConst: true }];
      expect(
        CallbackTypedefFormatter.format("void", "onReceive_fp", params, false),
      ).toBe("typedef void (*onReceive_fp)(const Message*);");
    });

    it("builds a void parameter list for a no-argument callback", () => {
      expect(
        CallbackTypedefFormatter.format("uint8_t", "tick_fp", [], false),
      ).toBe("typedef uint8_t (*tick_fp)(void);");
    });
  });
});
