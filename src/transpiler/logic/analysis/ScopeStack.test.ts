/**
 * Unit tests for ScopeStack
 * Tests the generic scope management data structure
 */
import { describe, it, expect, beforeEach } from "vitest";
import ScopeStack from "./ScopeStack";

/**
 * Simple test state for variables
 */
interface ITestState {
  initialized: boolean;
  value: number;
}

describe("ScopeStack", () => {
  let stack: ScopeStack<ITestState>;

  beforeEach(() => {
    stack = new ScopeStack<ITestState>();
  });

  // ========================================================================
  // Basic Scope Operations
  // ========================================================================

  describe("scope management", () => {
    it("should start with no active scope", () => {
      expect(stack.hasActiveScope()).toBe(false);
      expect(stack.getDepth()).toBe(0);
    });

    it("should create scope on enterScope", () => {
      stack.enterScope();
      expect(stack.hasActiveScope()).toBe(true);
      expect(stack.getDepth()).toBe(1);
    });

    it("should nest scopes correctly", () => {
      stack.enterScope();
      stack.enterScope();
      stack.enterScope();
      expect(stack.getDepth()).toBe(3);
    });

    it("should exit scopes correctly", () => {
      stack.enterScope();
      stack.enterScope();
      expect(stack.getDepth()).toBe(2);

      stack.exitScope();
      expect(stack.getDepth()).toBe(1);

      stack.exitScope();
      expect(stack.getDepth()).toBe(0);
      expect(stack.hasActiveScope()).toBe(false);
    });

    it("should handle exitScope when no scope exists", () => {
      const result = stack.exitScope();
      expect(result).toBeNull();
      expect(stack.getDepth()).toBe(0);
    });

    it("should return exited scope from exitScope", () => {
      stack.enterScope();
      stack.declare("x", { initialized: true, value: 42 });

      const exited = stack.exitScope();
      expect(exited).not.toBeNull();
      expect(exited!.variables.get("x")?.value).toBe(42);
    });
  });

  // ========================================================================
  // Variable Declaration
  // ========================================================================

  describe("declare", () => {
    it("should declare variable in current scope", () => {
      stack.enterScope();
      stack.declare("x", { initialized: false, value: 0 });

      expect(stack.has("x")).toBe(true);
      expect(stack.lookup("x")).toEqual({ initialized: false, value: 0 });
    });

    it("should throw when declaring without active scope", () => {
      expect(() => {
        stack.declare("x", { initialized: false, value: 0 });
      }).toThrow("no active scope");
    });

    it("should allow same name in different scopes (shadowing)", () => {
      stack.enterScope();
      stack.declare("x", { initialized: true, value: 1 });

      stack.enterScope();
      stack.declare("x", { initialized: false, value: 2 });

      // Inner scope shadows outer
      expect(stack.lookup("x")?.value).toBe(2);

      stack.exitScope();

      // Back to outer scope
      expect(stack.lookup("x")?.value).toBe(1);
    });
  });

  // ========================================================================
  // Variable Lookup
  // ========================================================================

  describe("lookup", () => {
    it("should find variable in current scope", () => {
      stack.enterScope();
      stack.declare("x", { initialized: true, value: 10 });

      expect(stack.lookup("x")?.value).toBe(10);
    });

    it("should find variable in parent scope", () => {
      stack.enterScope();
      stack.declare("outer", { initialized: true, value: 1 });

      stack.enterScope();
      stack.declare("inner", { initialized: true, value: 2 });

      // Can find both
      expect(stack.lookup("outer")?.value).toBe(1);
      expect(stack.lookup("inner")?.value).toBe(2);
    });

    it("should find variable in grandparent scope", () => {
      stack.enterScope();
      stack.declare("global", { initialized: true, value: 100 });

      stack.enterScope();
      stack.enterScope();
      stack.enterScope();

      expect(stack.lookup("global")?.value).toBe(100);
    });

    it("should return null for undefined variable", () => {
      stack.enterScope();
      expect(stack.lookup("nonexistent")).toBeNull();
    });

    it("should return null when no scope exists", () => {
      expect(stack.lookup("anything")).toBeNull();
    });
  });

  // ========================================================================
  // has / hasInCurrentScope
  // ========================================================================

  describe("has", () => {
    it("should return true for existing variable", () => {
      stack.enterScope();
      stack.declare("x", { initialized: true, value: 0 });
      expect(stack.has("x")).toBe(true);
    });

    it("should return false for non-existing variable", () => {
      stack.enterScope();
      expect(stack.has("x")).toBe(false);
    });

    it("should find variable in parent scope", () => {
      stack.enterScope();
      stack.declare("x", { initialized: true, value: 0 });
      stack.enterScope();

      expect(stack.has("x")).toBe(true);
    });
  });

  describe("hasInCurrentScope", () => {
    it("should return true for variable in current scope", () => {
      stack.enterScope();
      stack.declare("x", { initialized: true, value: 0 });
      expect(stack.hasInCurrentScope("x")).toBe(true);
    });

    it("should return false for variable in parent scope", () => {
      stack.enterScope();
      stack.declare("x", { initialized: true, value: 0 });
      stack.enterScope();

      expect(stack.hasInCurrentScope("x")).toBe(false);
      expect(stack.has("x")).toBe(true); // But has() finds it
    });

    it("should return false when no scope exists", () => {
      expect(stack.hasInCurrentScope("x")).toBe(false);
    });
  });

  // ========================================================================
  // Update
  // ========================================================================

  describe("update", () => {
    it("should update variable in current scope", () => {
      stack.enterScope();
      stack.declare("x", { initialized: false, value: 0 });

      const updated = stack.update("x", (state) => ({
        ...state,
        initialized: true,
        value: 42,
      }));

      expect(updated).toBe(true);
      expect(stack.lookup("x")).toEqual({ initialized: true, value: 42 });
    });

    it("should update variable in parent scope", () => {
      stack.enterScope();
      stack.declare("x", { initialized: false, value: 0 });
      stack.enterScope();

      const updated = stack.update("x", (state) => ({
        ...state,
        initialized: true,
      }));

      expect(updated).toBe(true);
      expect(stack.lookup("x")?.initialized).toBe(true);
    });

    it("should return false for non-existing variable", () => {
      stack.enterScope();
      const updated = stack.update("nonexistent", (state) => state);
      expect(updated).toBe(false);
    });

    it("should update shadowed variable in inner scope only", () => {
      stack.enterScope();
      stack.declare("x", { initialized: true, value: 1 });

      stack.enterScope();
      stack.declare("x", { initialized: false, value: 2 });

      stack.update("x", (state) => ({ ...state, value: 99 }));

      // Inner was updated
      expect(stack.lookup("x")?.value).toBe(99);

      stack.exitScope();

      // Outer unchanged
      expect(stack.lookup("x")?.value).toBe(1);
    });
  });

  // ========================================================================
  // getAllVisible
  // ========================================================================

  describe("getAllVisible", () => {
    it("should return all variables from all scopes", () => {
      stack.enterScope();
      stack.declare("a", { initialized: true, value: 1 });

      stack.enterScope();
      stack.declare("b", { initialized: true, value: 2 });

      const visible = stack.getAllVisible();

      expect(visible.size).toBe(2);
      expect(visible.get("a")?.value).toBe(1);
      expect(visible.get("b")?.value).toBe(2);
    });

    it("should respect shadowing (inner wins)", () => {
      stack.enterScope();
      stack.declare("x", { initialized: true, value: 1 });

      stack.enterScope();
      stack.declare("x", { initialized: false, value: 2 });

      const visible = stack.getAllVisible();

      expect(visible.size).toBe(1);
      expect(visible.get("x")?.value).toBe(2); // Inner value
    });

    it("should return empty map when no scope", () => {
      const visible = stack.getAllVisible();
      expect(visible.size).toBe(0);
    });
  });

  // ========================================================================
  // cloneState / restoreState
  // ========================================================================

  describe("cloneState", () => {
    it("should deep clone all variable states", () => {
      stack.enterScope();
      stack.declare("x", { initialized: false, value: 10 });

      const cloned = stack.cloneState((s) => ({ ...s }));

      // Modify original
      stack.update("x", () => ({ initialized: true, value: 99 }));

      // Clone unchanged
      expect(cloned.get("x")).toEqual({ initialized: false, value: 10 });
    });

    it("should clone across multiple scopes", () => {
      stack.enterScope();
      stack.declare("a", { initialized: true, value: 1 });
      stack.enterScope();
      stack.declare("b", { initialized: false, value: 2 });

      const cloned = stack.cloneState((s) => ({ ...s }));

      expect(cloned.size).toBe(2);
      expect(cloned.get("a")?.value).toBe(1);
      expect(cloned.get("b")?.value).toBe(2);
    });
  });

  describe("restoreState", () => {
    it("should restore variable states from snapshot", () => {
      stack.enterScope();
      stack.declare("x", { initialized: false, value: 0 });

      // Save state
      const saved = stack.cloneState((s) => ({ ...s }));

      // Modify
      stack.update("x", () => ({ initialized: true, value: 42 }));
      expect(stack.lookup("x")?.initialized).toBe(true);

      // Restore
      stack.restoreState(saved, (_current, saved) => ({ ...saved }));

      expect(stack.lookup("x")).toEqual({ initialized: false, value: 0 });
    });

    it("should only restore variables that exist in both", () => {
      stack.enterScope();
      stack.declare("a", { initialized: false, value: 1 });

      const saved = stack.cloneState((s) => ({ ...s }));

      // Add new variable after snapshot
      stack.declare("b", { initialized: true, value: 2 });

      // Modify a
      stack.update("a", () => ({ initialized: true, value: 99 }));

      // Restore only affects 'a', not 'b'
      stack.restoreState(saved, (_current, saved) => ({ ...saved }));

      expect(stack.lookup("a")?.value).toBe(1); // Restored
      expect(stack.lookup("b")?.value).toBe(2); // Unchanged
    });
  });

  // ========================================================================
  // currentScopeVariables iterator
  // ========================================================================

  describe("currentScopeVariables", () => {
    it("should iterate over current scope only", () => {
      stack.enterScope();
      stack.declare("outer", { initialized: true, value: 1 });

      stack.enterScope();
      stack.declare("inner1", { initialized: true, value: 2 });
      stack.declare("inner2", { initialized: true, value: 3 });

      const names = [...stack.currentScopeVariables()].map(([name]) => name);

      expect(names).toEqual(["inner1", "inner2"]);
      expect(names).not.toContain("outer");
    });

    it("should yield nothing when no scope", () => {
      const result = [...stack.currentScopeVariables()];
      expect(result).toHaveLength(0);
    });
  });

  // ========================================================================
  // Real-world scenarios
  // ========================================================================

  describe("real-world scenarios", () => {
    it("should handle function with nested blocks", () => {
      // function foo() {
      //   u32 x;
      //   if (cond) {
      //     u32 y;
      //   }
      //   // y not visible here
      // }

      stack.enterScope(); // function
      stack.declare("x", { initialized: false, value: 0 });

      stack.enterScope(); // if block
      stack.declare("y", { initialized: false, value: 0 });
      expect(stack.has("x")).toBe(true);
      expect(stack.has("y")).toBe(true);

      stack.exitScope(); // exit if block

      expect(stack.has("x")).toBe(true);
      expect(stack.has("y")).toBe(false); // y out of scope
    });

    it("should handle control flow state save/restore", () => {
      // if (cond) {
      //   x <- 1;  // initializes x in this branch
      // }
      // // x may or may not be initialized

      stack.enterScope();
      stack.declare("x", { initialized: false, value: 0 });

      // Save state before if
      const beforeIf = stack.cloneState((s) => ({ ...s }));

      // Simulate if branch initializing x
      stack.update("x", () => ({ initialized: true, value: 1 }));

      // No else branch, so restore to "maybe uninitialized" state
      stack.restoreState(beforeIf, (_current, saved) => ({ ...saved }));

      expect(stack.lookup("x")?.initialized).toBe(false);
    });
  });
});
