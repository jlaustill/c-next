import { describe, it, expect } from "vitest";
import MisraSuppressionUtils from "../MisraSuppressionUtils";

/**
 * #1450: what is asserted here is the comment FORM. Which header is banned and
 * under which rule is `2-Plan/MisraSuppressions`, asserted in its own suite --
 * these cases would pass unchanged if the table grew, and that is the point of
 * the split.
 */
describe("MisraSuppressionUtils", () => {
  describe("getMisraSuppressionComment", () => {
    it("spells a cited rule as a cppcheck-suppress line", () => {
      expect(
        MisraSuppressionUtils.getMisraSuppressionComment("#include <stdio.h>"),
      ).toBe("// cppcheck-suppress misra-c2012-21.6");
    });

    it("returns null when the plan cites no rule", () => {
      expect(
        MisraSuppressionUtils.getMisraSuppressionComment("#include <stdint.h>"),
      ).toBeNull();
      expect(
        MisraSuppressionUtils.getMisraSuppressionComment('#include "stdio.h"'),
      ).toBeNull();
      expect(
        MisraSuppressionUtils.getMisraSuppressionComment("void foo();"),
      ).toBeNull();
    });

    it("handles whitespace in include directives", () => {
      expect(
        MisraSuppressionUtils.getMisraSuppressionComment(
          "#include  <stdio.h>  ",
        ),
      ).toBe("// cppcheck-suppress misra-c2012-21.6");
    });
  });
});
