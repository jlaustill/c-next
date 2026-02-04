import { describe, it, expect, beforeEach } from "vitest";
import AssignmentExpectedTypeResolver from "../AssignmentExpectedTypeResolver.js";
import CNextSourceParser from "../../../../logic/parser/CNextSourceParser.js";

/**
 * Create a mock assignment target context by parsing a minimal assignment statement.
 */
function parseAssignmentTarget(target: string) {
  const source = `void test() { ${target} <- 0; }`;
  const { tree } = CNextSourceParser.parse(source);
  const decl = tree.declaration(0);
  const func = decl!.functionDeclaration();
  const block = func!.block();
  const stmt = block!.statement(0)!;
  const assignStmt = stmt.assignmentStatement()!;
  return assignStmt.assignmentTarget();
}

describe("AssignmentExpectedTypeResolver", () => {
  let resolver: AssignmentExpectedTypeResolver;
  let typeRegistry: Map<
    string,
    { baseType: string; overflowBehavior?: string }
  >;
  let structFields: Map<string, Map<string, string>>;
  let knownStructs: Set<string>;

  beforeEach(() => {
    typeRegistry = new Map();
    structFields = new Map();
    knownStructs = new Set();

    resolver = new AssignmentExpectedTypeResolver({
      typeRegistry: typeRegistry as any,
      structFields,
      isKnownStruct: (name) => knownStructs.has(name),
    });
  });

  describe("resolve()", () => {
    describe("simple identifier", () => {
      it("should resolve expected type for known variable", () => {
        typeRegistry.set("counter", { baseType: "u32" });
        const target = parseAssignmentTarget("counter");

        const result = resolver.resolve(target);

        expect(result.expectedType).toBe("u32");
        expect(result.assignmentContext).toEqual({
          targetName: "counter",
          targetType: "u32",
          overflowBehavior: "clamp",
        });
      });

      it("should use specified overflow behavior", () => {
        typeRegistry.set("counter", {
          baseType: "u8",
          overflowBehavior: "wrap",
        });
        const target = parseAssignmentTarget("counter");

        const result = resolver.resolve(target);

        expect(result.assignmentContext?.overflowBehavior).toBe("wrap");
      });

      it("should return null for unknown variable", () => {
        const target = parseAssignmentTarget("unknown");

        const result = resolver.resolve(target);

        expect(result.expectedType).toBeNull();
        expect(result.assignmentContext).toBeNull();
      });
    });

    describe("member access", () => {
      it("should resolve expected type for struct field", () => {
        typeRegistry.set("config", { baseType: "Config" });
        knownStructs.add("Config");
        structFields.set("Config", new Map([["status", "Status"]]));
        const target = parseAssignmentTarget("config.status");

        const result = resolver.resolve(target);

        expect(result.expectedType).toBe("Status");
      });

      it("should walk nested struct chain", () => {
        typeRegistry.set("app", { baseType: "App" });
        knownStructs.add("App");
        knownStructs.add("Config");
        structFields.set("App", new Map([["config", "Config"]]));
        structFields.set("Config", new Map([["mode", "Mode"]]));
        const target = parseAssignmentTarget("app.config.mode");

        const result = resolver.resolve(target);

        expect(result.expectedType).toBe("Mode");
      });

      it("should return null for non-struct root", () => {
        typeRegistry.set("counter", { baseType: "u32" });
        const target = parseAssignmentTarget("counter.value");

        const result = resolver.resolve(target);

        expect(result.expectedType).toBeNull();
      });

      it("should return null for unknown field", () => {
        typeRegistry.set("config", { baseType: "Config" });
        knownStructs.add("Config");
        structFields.set("Config", new Map([["status", "Status"]]));
        const target = parseAssignmentTarget("config.unknown");

        const result = resolver.resolve(target);

        expect(result.expectedType).toBeNull();
      });
    });

    describe("array access", () => {
      it("should return null for array access target", () => {
        typeRegistry.set("arr", { baseType: "u32" });
        const target = parseAssignmentTarget("arr[0]");

        const result = resolver.resolve(target);

        expect(result.expectedType).toBeNull();
        expect(result.assignmentContext).toBeNull();
      });
    });
  });
});
