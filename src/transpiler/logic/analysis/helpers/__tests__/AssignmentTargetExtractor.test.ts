/**
 * Unit tests for AssignmentTargetExtractor
 * SonarCloud S3776: Tests for assignment target base identifier extraction
 */

import { describe, it, expect } from "vitest";
import CNextSourceParser from "../../../parser/CNextSourceParser.js";
import AssignmentTargetExtractor from "../AssignmentTargetExtractor.js";
import * as Parser from "../../../parser/grammar/CNextParser.js";

describe("AssignmentTargetExtractor", () => {
  /**
   * Helper to extract an assignment target context from C-Next source.
   */
  function getAssignmentTarget(
    source: string,
  ): Parser.AssignmentTargetContext | undefined {
    const fullSource = `void main() { ${source}; }`;
    const result = CNextSourceParser.parse(fullSource);
    const decl = result.tree.declaration(0);
    const funcDef = decl?.functionDeclaration();
    const block = funcDef?.block();
    const stmt = block?.statement(0);
    return stmt?.assignmentStatement()?.assignmentTarget();
  }

  describe("extract", () => {
    describe("simple identifier", () => {
      it("extracts base identifier from simple assignment", () => {
        const target = getAssignmentTarget("x <- 5");
        expect(target).toBeDefined();

        const result = AssignmentTargetExtractor.extract(target);
        expect(result.baseIdentifier).toBe("x");
        expect(result.hasSingleIndexSubscript).toBe(false);
      });

      it("extracts longer identifier names", () => {
        const target = getAssignmentTarget("myVariable <- 42");
        expect(target).toBeDefined();

        const result = AssignmentTargetExtractor.extract(target);
        expect(result.baseIdentifier).toBe("myVariable");
        expect(result.hasSingleIndexSubscript).toBe(false);
      });
    });

    describe("member access", () => {
      it("extracts base identifier from single member access", () => {
        const target = getAssignmentTarget("obj.field <- 10");
        expect(target).toBeDefined();

        const result = AssignmentTargetExtractor.extract(target);
        expect(result.baseIdentifier).toBe("obj");
        expect(result.hasSingleIndexSubscript).toBe(false);
      });

      it("extracts base identifier from chained member access", () => {
        const target = getAssignmentTarget("a.b.c <- 20");
        expect(target).toBeDefined();

        const result = AssignmentTargetExtractor.extract(target);
        expect(result.baseIdentifier).toBe("a");
        expect(result.hasSingleIndexSubscript).toBe(false);
      });
    });

    describe("array access", () => {
      it("extracts base identifier and flags single-index subscript", () => {
        const target = getAssignmentTarget("arr[0] <- 100");
        expect(target).toBeDefined();

        const result = AssignmentTargetExtractor.extract(target);
        expect(result.baseIdentifier).toBe("arr");
        expect(result.hasSingleIndexSubscript).toBe(true);
      });

      it("extracts base identifier with variable index", () => {
        const target = getAssignmentTarget("buffer[i] <- 50");
        expect(target).toBeDefined();

        const result = AssignmentTargetExtractor.extract(target);
        expect(result.baseIdentifier).toBe("buffer");
        expect(result.hasSingleIndexSubscript).toBe(true);
      });

      it("detects two-index subscript as bit extraction (not array)", () => {
        const target = getAssignmentTarget("value[0, 8] <- 255");
        expect(target).toBeDefined();

        const result = AssignmentTargetExtractor.extract(target);
        expect(result.baseIdentifier).toBe("value");
        expect(result.hasSingleIndexSubscript).toBe(false);
      });
    });

    describe("edge cases", () => {
      it("returns null for undefined target", () => {
        const result = AssignmentTargetExtractor.extract(undefined);
        expect(result.baseIdentifier).toBeNull();
        expect(result.hasSingleIndexSubscript).toBe(false);
      });
    });
  });
});
