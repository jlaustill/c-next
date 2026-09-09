/**
 * Tests for IFunctionSymbol - C-Next function symbol representation
 */
import { describe, it, expect } from "vitest";
import FunctionUtils from "../FunctionUtils";
import ScopeUtils from "../../../utils/ScopeUtils";
import ParameterUtils from "../../../utils/ParameterUtils";
import TTypeUtils from "../../../utils/TTypeUtils";
import TestSourceSpan from "../../../transpiler/types/__testUtils__/testSourceSpan";

describe("IFunctionSymbol", () => {
  describe("FunctionUtils.create", () => {
    it("creates function with bare name and scope reference", () => {
      const func = FunctionUtils.create({
        name: "fillData", // Bare name, NOT "Test__fillData"
        scopePath: "Test",
        parameters: [
          ParameterUtils.create({
            name: "d",
            type: TTypeUtils.createPrimitive("u32"),
            isConst: false,
            isArray: false,
          }),
        ],
        returnType: TTypeUtils.createPrimitive("void"),
        visibility: "private",
        sourceFile: "test.cnx",
        span: TestSourceSpan.at(10),
      });

      expect(func.kind).toBe("function");
      expect(func.name).toBe("fillData");
      expect(func.scopePath).toBe("Test");
      expect(func.parameters).toHaveLength(1);
      expect(func.parameters[0].name).toBe("d");
      expect(func.returnType.kind).toBe("primitive");
      expect(func.visibility).toBe("private");
      expect(func.sourceFile).toBe("test.cnx");
      expect(func.span.line).toBe(10);
    });

    it("creates public function in global scope", () => {
      const func = FunctionUtils.create({
        name: "main",
        scopePath: "",
        parameters: [],
        returnType: TTypeUtils.createPrimitive("i32"),
        visibility: "public",
        sourceFile: "main.cnx",
        span: TestSourceSpan.at(1),
      });

      expect(func.scopePath).toBe("");
      expect(func.visibility).toBe("public");
      expect(func.name).toBe("main");
      expect(ScopeUtils.isGlobalScopePath(func.scopePath)).toBe(true);
    });

    it("creates function with multiple parameters", () => {
      const func = FunctionUtils.create({
        name: "calculate",
        scopePath: "",
        parameters: [
          ParameterUtils.create({
            name: "a",
            type: TTypeUtils.createPrimitive("i32"),
            isConst: true,
            isArray: false,
          }),
          ParameterUtils.create({
            name: "b",
            type: TTypeUtils.createPrimitive("i32"),
            isConst: true,
            isArray: false,
          }),
          ParameterUtils.create({
            name: "result",
            type: TTypeUtils.createPrimitive("i32"),
            isConst: false,
            isArray: false,
          }),
        ],
        returnType: TTypeUtils.createPrimitive("void"),
        visibility: "public",
        sourceFile: "calc.cnx",
        span: TestSourceSpan.at(5),
      });

      expect(func.parameters).toHaveLength(3);
      expect(func.parameters[0].isConst).toBe(true);
      expect(func.parameters[1].isConst).toBe(true);
      expect(func.parameters[2].isConst).toBe(false);
    });

    it("creates function with struct return type", () => {
      const func = FunctionUtils.create({
        name: "createPoint",
        scopePath: "",
        parameters: [
          ParameterUtils.create({
            name: "x",
            type: TTypeUtils.createPrimitive("i32"),
            isConst: false,
            isArray: false,
          }),
          ParameterUtils.create({
            name: "y",
            type: TTypeUtils.createPrimitive("i32"),
            isConst: false,
            isArray: false,
          }),
        ],
        returnType: TTypeUtils.createStruct("Point"),
        visibility: "public",
        sourceFile: "point.cnx",
        span: TestSourceSpan.at(10),
      });

      expect(func.returnType.kind).toBe("struct");
      if (func.returnType.kind === "struct") {
        expect(func.returnType.name).toBe("Point");
      }
    });
  });

  describe("FunctionUtils.isInGlobalScope", () => {
    it("returns true for function in global scope", () => {
      const func = FunctionUtils.create({
        name: "main",
        scopePath: "",
        parameters: [],
        returnType: TTypeUtils.createPrimitive("i32"),
        visibility: "public",
        sourceFile: "main.cnx",
        span: TestSourceSpan.at(1),
      });

      expect(FunctionUtils.isInGlobalScope(func)).toBe(true);
    });

    it("returns false for function in named scope", () => {
      const func = FunctionUtils.create({
        name: "helper",
        scopePath: "Test",
        parameters: [],
        returnType: TTypeUtils.createPrimitive("void"),
        visibility: "private",
        sourceFile: "test.cnx",
        span: TestSourceSpan.at(5),
      });

      expect(FunctionUtils.isInGlobalScope(func)).toBe(false);
    });
  });
});
