/**
 * Unit tests for AssignmentHandlerRegistry.
 * Tests the static registry for assignment handlers.
 */

import { describe, expect, it } from "vitest";
// Import from parent module to ensure handlers are registered
import AssignmentHandlerRegistry from "../../index";
import AssignmentKind from "../../AssignmentKind";

describe("AssignmentHandlerRegistry", () => {
  describe("getHandler", () => {
    it("returns handler for registered assignment kind", () => {
      const handler = AssignmentHandlerRegistry.getHandler(
        AssignmentKind.SIMPLE,
      );

      expect(handler).toBeDefined();
      expect(typeof handler).toBe("function");
    });

    it("throws error for unregistered assignment kind", () => {
      // Use an invalid enum value to test the error path
      const invalidKind = 9999 as AssignmentKind;

      expect(() => AssignmentHandlerRegistry.getHandler(invalidKind)).toThrow(
        "No handler registered for assignment kind:",
      );
    });

    it("returns correct handler for each registered kind", () => {
      // Verify all registered kinds return handlers
      const registeredKinds = [
        AssignmentKind.SIMPLE,
        AssignmentKind.BITMAP_FIELD_SINGLE_BIT,
        AssignmentKind.ARRAY_ELEMENT,
        AssignmentKind.STRING_SIMPLE,
        AssignmentKind.REGISTER_BIT,
        AssignmentKind.INTEGER_BIT,
        AssignmentKind.GLOBAL_MEMBER,
        AssignmentKind.THIS_MEMBER,
      ];

      for (const kind of registeredKinds) {
        const handler = AssignmentHandlerRegistry.getHandler(kind);
        expect(handler).toBeDefined();
        expect(typeof handler).toBe("function");
      }
    });
  });

  describe("register", () => {
    it("registers a new handler", () => {
      // Use a very high number that won't conflict with real enum values
      const testKind = 99999 as AssignmentKind;
      const testHandler = () => "test result";

      AssignmentHandlerRegistry.register(testKind, testHandler);

      const handler = AssignmentHandlerRegistry.getHandler(testKind);
      expect(handler).toBe(testHandler);
    });
  });

  describe("registerAll", () => {
    it("registers multiple handlers at once", () => {
      const testKind1 = 88881 as AssignmentKind;
      const testKind2 = 88882 as AssignmentKind;
      const handler1 = () => "result 1";
      const handler2 = () => "result 2";

      AssignmentHandlerRegistry.registerAll([
        [testKind1, handler1],
        [testKind2, handler2],
      ]);

      expect(AssignmentHandlerRegistry.getHandler(testKind1)).toBe(handler1);
      expect(AssignmentHandlerRegistry.getHandler(testKind2)).toBe(handler2);
    });
  });
});
