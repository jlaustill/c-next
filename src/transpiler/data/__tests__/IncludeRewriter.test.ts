/**
 * Unit tests for IncludeRewriter
 *
 * Issue #1467: this module is the single owner of "is this a C-Next include,
 * and what does it name?". It decides no paths -- `PathResolver` does -- so
 * these tests cover the two things it IS responsible for: matching every
 * C-Next source extension, and using the owner's answer in preference to the
 * extension-swap fallback.
 */

import { describe, it, expect } from "vitest";
import IncludeRewriter from "../IncludeRewriter";

describe("IncludeRewriter", () => {
  const none = new Map<string, string>();

  describe("cnxSpecOf", () => {
    it.each([
      ["#include <utils.cnx>", "utils.cnx"],
      ["#include <utils.cnext>", "utils.cnext"],
      ["#include <Display/utils.cnx>", "Display/utils.cnx"],
      ['#include "utils.cnx"', "utils.cnx"],
      ['#include "utils.cnext"', "utils.cnext"],
      ['#include "../common/types.cnx"', "../common/types.cnx"],
      ["#include<utils.cnx>", "utils.cnx"],
      ["#  include  <utils.cnx>", "utils.cnx"],
    ])("reads the spec from %s", (directive, expected) => {
      expect(IncludeRewriter.cnxSpecOf(directive)).toBe(expected);
    });

    it.each([
      ["#include <stdint.h>"],
      ['#include "local.h"'],
      ["#include <FlexCAN_T4.hpp>"],
      ["#define FLAG"],
    ])("returns null for %s", (directive) => {
      expect(IncludeRewriter.cnxSpecOf(directive)).toBeNull();
    });
  });

  describe("quotedCnxSpecOf", () => {
    it("reads a quoted spec", () => {
      expect(IncludeRewriter.quotedCnxSpecOf('#include "utils.cnext"')).toBe(
        "utils.cnext",
      );
    });

    it("returns null for an angle include, which is not validated", () => {
      expect(
        IncludeRewriter.quotedCnxSpecOf("#include <utils.cnx>"),
      ).toBeNull();
    });
  });

  describe("rewrite", () => {
    it.each([
      [".cnx", "#include <utils.cnx>", "utils.cnx"],
      [".cnext", "#include <utils.cnext>", "utils.cnext"],
    ])(
      "names the resolved header for a %s include",
      (_ext, directive, spec) => {
        const rewrites = new Map([[spec, "Display/utils.h"]]);
        expect(IncludeRewriter.rewrite(directive, rewrites, ".h")).toBe(
          "#include <Display/utils.h>",
        );
      },
    );

    it("keeps a quoted include quoted", () => {
      const rewrites = new Map([["utils.cnx", "Display/utils.h"]]);
      expect(
        IncludeRewriter.rewrite('#include "utils.cnx"', rewrites, ".h"),
      ).toBe('#include "Display/utils.h"');
    });

    it.each([
      ["#include <utils.cnx>", ".h", "#include <utils.h>"],
      ["#include <utils.cnext>", ".h", "#include <utils.h>"],
      ["#include <utils.cnx>", ".hpp", "#include <utils.hpp>"],
      ["#include <utils.cnext>", ".hpp", "#include <utils.hpp>"],
    ])(
      "falls back to the extension swap for %s in %s mode",
      (directive, ext, expected) => {
        expect(
          IncludeRewriter.rewrite(directive, none, ext as ".h" | ".hpp"),
        ).toBe(expected);
      },
    );

    it("leaves a non-C-Next directive alone", () => {
      const rewrites = new Map([["utils.cnx", "Display/utils.h"]]);
      expect(
        IncludeRewriter.rewrite("#include <stdint.h>", rewrites, ".h"),
      ).toBe("#include <stdint.h>");
    });

    it("does not rewrite a spec the owner has no answer for", () => {
      const rewrites = new Map([["other.cnx", "Elsewhere/other.h"]]);
      expect(
        IncludeRewriter.rewrite("#include <missing.cnx>", rewrites, ".h"),
      ).toBe("#include <missing.h>");
    });
  });
});
