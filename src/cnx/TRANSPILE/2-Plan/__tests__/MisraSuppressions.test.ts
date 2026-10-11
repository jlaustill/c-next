import { describe, it, expect } from "vitest";
import MisraSuppressions from "../MisraSuppressions";

/**
 * #1450: these assertions came from `MisraSuppressionUtils.needsMisraSuppression`,
 * which was deleted as a second derivation of this decision. The behavior it
 * asserted is this one -- `ruleFor` returning a rule is the same answer as its
 * `true` -- so the cases moved here with it rather than going away.
 */
describe("MisraSuppressions", () => {
  describe("ruleFor", () => {
    it("cites 21.6 for stdio.h", () => {
      expect(MisraSuppressions.ruleFor("#include <stdio.h>")).toBe(
        "misra-c2012-21.6",
      );
    });

    it("cites nothing for other system headers", () => {
      expect(MisraSuppressions.ruleFor("#include <stdint.h>")).toBeNull();
      expect(MisraSuppressions.ruleFor("#include <string.h>")).toBeNull();
    });

    it("cites nothing for a quoted include", () => {
      // A quoted include is a project header; the banned set is the standard
      // library, so the same name in quotes is deliberately not matched.
      expect(MisraSuppressions.ruleFor('#include "stdio.h"')).toBeNull();
    });

    it("cites nothing for text that is not an include", () => {
      expect(MisraSuppressions.ruleFor("void foo();")).toBeNull();
    });

    it("tolerates whitespace around the directive", () => {
      expect(MisraSuppressions.ruleFor("#include  <stdio.h>  ")).toBe(
        "misra-c2012-21.6",
      );
    });
  });
});
