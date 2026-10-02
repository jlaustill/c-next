/**
 * Unit tests for IncludeRewriter
 *
 * Issue #1467: it decides no paths -- `PathResolver` does -- and since #1444
 * it decides no kinds either: whether a directive names C-Next source is 1.1
 * Discover's answer, which its callers ask first (owner ruling 1). These cover
 * what it IS responsible for: using the owner's answer in preference to the
 * extension-swap fallback, and keeping the author's form and spacing.
 */

import { describe, it, expect } from "vitest";
import IncludeRewriter from "../IncludeRewriter";

describe("IncludeRewriter", () => {
  const none = new Map<string, string>();

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
      // #1672: the C-Next extension FileDiscovery recognizes, in any case
      ['#include "Utils.CNX"', ".h", '#include "Utils.h"'],
      // only the path is replaced: the author's spacing survives
      ["#  include  <utils.cnx>", ".h", "#  include  <utils.h>"],
    ])(
      "falls back to the extension swap for %s in %s mode",
      (directive, ext, expected) => {
        expect(
          IncludeRewriter.rewrite(directive, none, ext as ".h" | ".hpp"),
        ).toBe(expected);
      },
    );

    it("does not rewrite a spec the owner has no answer for", () => {
      const rewrites = new Map([["other.cnx", "Elsewhere/other.h"]]);
      expect(
        IncludeRewriter.rewrite("#include <missing.cnx>", rewrites, ".h"),
      ).toBe("#include <missing.h>");
    });
  });
});
