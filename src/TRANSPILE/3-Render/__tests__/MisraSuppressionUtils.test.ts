import { describe, it, expect } from "vitest";
import MisraSuppressionUtils from "../MisraSuppressionUtils";

describe("MisraSuppressionUtils", () => {
  describe("needsMisraSuppression", () => {
    it("returns true for stdio.h", () => {
      expect(
        MisraSuppressionUtils.needsMisraSuppression("#include <stdio.h>"),
      ).toBe(true);
    });

    it("returns false for other system headers", () => {
      expect(
        MisraSuppressionUtils.needsMisraSuppression("#include <stdint.h>"),
      ).toBe(false);
      expect(
        MisraSuppressionUtils.needsMisraSuppression("#include <string.h>"),
      ).toBe(false);
    });

    it("returns false for quote includes", () => {
      expect(
        MisraSuppressionUtils.needsMisraSuppression('#include "stdio.h"'),
      ).toBe(false);
    });

    it("returns false for non-include text", () => {
      expect(MisraSuppressionUtils.needsMisraSuppression("void foo();")).toBe(
        false,
      );
    });
  });

  describe("getMisraSuppressionComment", () => {
    it("returns suppression comment for stdio.h", () => {
      expect(
        MisraSuppressionUtils.getMisraSuppressionComment("#include <stdio.h>"),
      ).toBe("// cppcheck-suppress misra-c2012-21.6");
    });

    it("returns null for other system headers", () => {
      expect(
        MisraSuppressionUtils.getMisraSuppressionComment("#include <stdint.h>"),
      ).toBeNull();
    });

    it("returns null for quote includes", () => {
      expect(
        MisraSuppressionUtils.getMisraSuppressionComment('#include "stdio.h"'),
      ).toBeNull();
    });

    it("returns null for non-include text", () => {
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
