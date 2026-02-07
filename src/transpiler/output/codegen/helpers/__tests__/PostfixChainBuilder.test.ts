import { describe, it, expect, vi } from "vitest";
import PostfixChainBuilder from "../PostfixChainBuilder";
import IPostfixOperation from "../../types/IPostfixOperation";
import IPostfixChainDeps from "../../types/IPostfixChainDeps";

describe("PostfixChainBuilder", () => {
  const createMockDeps = (
    overrides: Partial<IPostfixChainDeps> = {},
  ): IPostfixChainDeps => ({
    generateExpression: vi.fn((expr) => String(expr)),
    getSeparator: vi.fn(() => "."),
    ...overrides,
  });

  describe("build", () => {
    it("should return base result when no operations", () => {
      const deps = createMockDeps();
      const result = PostfixChainBuilder.build("foo", "foo", [], deps);
      expect(result).toBe("foo");
    });

    it("should handle single member access", () => {
      const deps = createMockDeps();
      const ops: IPostfixOperation[] = [{ memberName: "bar", expressions: [] }];

      const result = PostfixChainBuilder.build("foo", "foo", ops, deps);

      expect(result).toBe("foo.bar");
      expect(deps.getSeparator).toHaveBeenCalledWith(
        true,
        ["foo", "bar"],
        "bar",
      );
    });

    it("should handle multiple member accesses", () => {
      const deps = createMockDeps();
      const ops: IPostfixOperation[] = [
        { memberName: "bar", expressions: [] },
        { memberName: "baz", expressions: [] },
      ];

      const result = PostfixChainBuilder.build("foo", "foo", ops, deps);

      expect(result).toBe("foo.bar.baz");
      expect(deps.getSeparator).toHaveBeenCalledTimes(2);
      // First call is first op
      expect(deps.getSeparator).toHaveBeenNthCalledWith(
        1,
        true,
        ["foo", "bar"],
        "bar",
      );
      // Second call is not first op
      expect(deps.getSeparator).toHaveBeenNthCalledWith(
        2,
        false,
        ["foo", "bar", "baz"],
        "baz",
      );
    });

    it("should handle single array subscript", () => {
      const deps = createMockDeps({
        generateExpression: vi.fn(() => "0"),
      });
      const ops: IPostfixOperation[] = [
        { memberName: null, expressions: ["indexExpr"] },
      ];

      const result = PostfixChainBuilder.build("arr", "arr", ops, deps);

      expect(result).toBe("arr[0]");
      expect(deps.generateExpression).toHaveBeenCalledWith("indexExpr");
    });

    it("should handle bit range subscript", () => {
      const deps = createMockDeps({
        generateExpression: vi.fn((expr) => (expr === "start" ? "0" : "4")),
      });
      const ops: IPostfixOperation[] = [
        { memberName: null, expressions: ["start", "width"] },
      ];

      const result = PostfixChainBuilder.build("flags", "flags", ops, deps);

      expect(result).toBe("flags[0, 4]");
      expect(deps.generateExpression).toHaveBeenCalledTimes(2);
    });

    it("should handle mixed member access and subscript", () => {
      let callCount = 0;
      const deps = createMockDeps({
        generateExpression: vi.fn(() => {
          callCount++;
          return String(callCount - 1);
        }),
      });
      const ops: IPostfixOperation[] = [
        { memberName: "items", expressions: [] },
        { memberName: null, expressions: ["indexExpr"] },
        { memberName: "value", expressions: [] },
      ];

      const result = PostfixChainBuilder.build("obj", "obj", ops, deps);

      expect(result).toBe("obj.items[0].value");
    });

    it("should use arrow separator for struct params", () => {
      const deps = createMockDeps({
        getSeparator: vi.fn((isFirst) => (isFirst ? "->" : ".")),
      });
      const ops: IPostfixOperation[] = [
        { memberName: "x", expressions: [] },
        { memberName: "y", expressions: [] },
      ];

      const result = PostfixChainBuilder.build("point", "point", ops, deps);

      expect(result).toBe("point->x.y");
    });

    it("should use underscore separator for scope access", () => {
      const deps = createMockDeps({
        getSeparator: vi.fn(() => "_"),
      });
      const ops: IPostfixOperation[] = [
        { memberName: "speed", expressions: [] },
      ];

      const result = PostfixChainBuilder.build("Motor", "Motor", ops, deps);

      expect(result).toBe("Motor_speed");
    });

    it("should handle empty expressions array gracefully", () => {
      const deps = createMockDeps();
      const ops: IPostfixOperation[] = [{ memberName: null, expressions: [] }];

      const result = PostfixChainBuilder.build("arr", "arr", ops, deps);

      // No expressions means no subscript added
      expect(result).toBe("arr");
    });
  });
});
