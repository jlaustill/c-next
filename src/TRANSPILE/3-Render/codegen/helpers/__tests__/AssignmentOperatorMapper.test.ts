/**
 * Unit tests for AssignmentOperatorMapper (ADR-001).
 *
 * #1588: the lookup used to fall back to `"="` for an operator the map did not
 * know, so a grammar/map divergence emitted a plain assignment instead of
 * failing. In a `for` update that is an infinite loop in generated firmware, at
 * transpile exit 0 with no diagnostic.
 */
import { describe, it, expect } from "vitest";
import AssignmentOperatorMapper from "../AssignmentOperatorMapper";

describe("AssignmentOperatorMapper", () => {
  describe("toCOperator", () => {
    it("maps simple assignment", () => {
      expect(AssignmentOperatorMapper.toCOperator("<-", 1)).toBe("=");
    });

    it("maps every compound operator the grammar admits", () => {
      const expected: ReadonlyArray<readonly [string, string]> = [
        ["+<-", "+="],
        ["-<-", "-="],
        ["*<-", "*="],
        ["/<-", "/="],
        ["%<-", "%="],
        ["&<-", "&="],
        ["|<-", "|="],
        ["^<-", "^="],
        ["<<<-", "<<="],
        [">><-", ">>="],
      ];
      for (const [cnextOp, cOp] of expected) {
        expect(AssignmentOperatorMapper.toCOperator(cnextOp, 1)).toBe(cOp);
      }
    });

    // #1588. The defect was returning `"="` here, which is a WRONG ANSWER
    // rather than a missing one: `i +<- 1` became `i = 1`.
    it("throws on an operator the map does not know", () => {
      expect(() => AssignmentOperatorMapper.toCOperator("**<-", 1)).toThrow(
        /\*\*<-/,
      );
    });

    // Negative control: the throw must be reachable only by an unknown
    // operator, not by a falsy line or an operator whose C form is itself "=".
    it("does not throw for a known operator with no line", () => {
      expect(AssignmentOperatorMapper.toCOperator("<-", undefined)).toBe("=");
    });
  });
});
