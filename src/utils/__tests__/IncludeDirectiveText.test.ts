import { describe, it, expect } from "vitest";
import IncludeDirectiveText from "../IncludeDirectiveText";

describe("IncludeDirectiveText", () => {
  describe("split (#1672)", () => {
    it.each([
      ['#include "a.cnx"', { path: "a.cnx", isLocal: true }],
      ["#include <a.h>", { path: "a.h", isLocal: false }],
      // The path is everything between the delimiters, as the grammar reads it
      // (#1830 review): the closing delimiter is the token's last character.
      ['#include <a"b.h>', { path: 'a"b.h', isLocal: false }],
      ["#include<stdint.h>", { path: "stdint.h", isLocal: false }],
      ["#  include  <utils.cnx>", { path: "utils.cnx", isLocal: false }],
      [
        '#include "../common/types.cnx"',
        { path: "../common/types.cnx", isLocal: true },
      ],
    ])("splits %s into its path and form", (text, spec) => {
      expect(IncludeDirectiveText.split(text)).toEqual(spec);
    });

    it.each([["#include <>"], ["#define FLAG"]])(
      "names nothing for %s",
      (text) => {
        expect(IncludeDirectiveText.split(text)).toBeNull();
      },
    );
  });

  describe("join", () => {
    it.each([
      [{ path: "a.cnx", isLocal: true }, '#include "a.cnx"'],
      [{ path: "a.h", isLocal: false }, "#include <a.h>"],
    ])("joins %o back into a directive", (spec, text) => {
      expect(IncludeDirectiveText.join(spec)).toBe(text);
      expect(IncludeDirectiveText.split(text)).toEqual(spec);
    });
  });
});
