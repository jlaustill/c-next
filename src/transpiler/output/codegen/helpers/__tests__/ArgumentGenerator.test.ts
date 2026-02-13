/**
 * Unit tests for ArgumentGenerator
 * Issue #794: Extract Argument Generator from CodeGenerator
 */

import { describe, it, expect, beforeEach } from "vitest";
import ArgumentGenerator from "../ArgumentGenerator";
import CodeGenState from "../../../../state/CodeGenState";
import IArgumentGeneratorCallbacks from "../types/IArgumentGeneratorCallbacks";

describe("ArgumentGenerator", () => {
  // Mock callbacks that return predictable values
  const createMockCallbacks = (
    overrides: Partial<IArgumentGeneratorCallbacks> = {},
  ): IArgumentGeneratorCallbacks => ({
    getLvalueType: () => null,
    getMemberAccessArrayStatus: () => "not-array",
    needsCppMemberConversion: () => false,
    isStringSubscriptAccess: () => false,
    generateExpression: (ctx) => ctx.getText(),
    ...overrides,
  });

  beforeEach(() => {
    CodeGenState.reset();
  });

  describe("handleIdentifierArg", () => {
    describe("parameters", () => {
      it("returns parameter name unchanged (already pointers)", () => {
        CodeGenState.currentParameters.set("cfg", {
          name: "cfg",
          baseType: "Config",
          isArray: false,
          isStruct: true,
          isConst: false,
          isCallback: false,
          isString: false,
        });

        const result = ArgumentGenerator.handleIdentifierArg("cfg");
        expect(result).toBe("cfg");
      });
    });

    describe("local arrays", () => {
      it("returns array name unchanged (decay to pointers)", () => {
        CodeGenState.localArrays.add("buffer");

        const result = ArgumentGenerator.handleIdentifierArg("buffer");
        expect(result).toBe("buffer");
      });
    });

    describe("global arrays", () => {
      it("returns global array name unchanged", () => {
        CodeGenState.setVariableTypeInfo("globalArr", {
          baseType: "u8",
          bitWidth: 8,
          isArray: true,
          isConst: false,
        });

        const result = ArgumentGenerator.handleIdentifierArg("globalArr");
        expect(result).toBe("globalArr");
      });

      it("adds & for global strings (char arrays passed by reference)", () => {
        CodeGenState.cppMode = false;
        CodeGenState.setVariableTypeInfo("name", {
          baseType: "char",
          bitWidth: 8,
          isArray: true,
          isConst: false,
          isString: true,
        });

        const result = ArgumentGenerator.handleIdentifierArg("name");
        expect(result).toBe("&name");
      });
    });

    describe("scope members", () => {
      it("prefixes scope member and adds & in C mode", () => {
        CodeGenState.cppMode = false;
        CodeGenState.currentScope = "LED";
        CodeGenState.setScopeMembers("LED", new Set(["brightness"]));

        const result = ArgumentGenerator.handleIdentifierArg("brightness");
        expect(result).toBe("&LED_brightness");
      });

      it("prefixes scope member without & in C++ mode", () => {
        CodeGenState.cppMode = true;
        CodeGenState.currentScope = "LED";
        CodeGenState.setScopeMembers("LED", new Set(["brightness"]));

        const result = ArgumentGenerator.handleIdentifierArg("brightness");
        expect(result).toBe("LED_brightness");
      });
    });

    describe("local variables", () => {
      it("adds & for local variable in C mode", () => {
        CodeGenState.cppMode = false;

        const result = ArgumentGenerator.handleIdentifierArg("value");
        expect(result).toBe("&value");
      });

      it("returns local variable unchanged in C++ mode", () => {
        CodeGenState.cppMode = true;

        const result = ArgumentGenerator.handleIdentifierArg("value");
        expect(result).toBe("value");
      });
    });
  });

  describe("handleRvalueArg", () => {
    it("returns expression unchanged when no target type", () => {
      const callbacks = createMockCallbacks({
        generateExpression: () => "42",
      });

      const result = ArgumentGenerator.handleRvalueArg(
        null as never, // ctx not used in this path
        undefined,
        callbacks,
      );
      expect(result).toBe("42");
    });

    it("returns expression unchanged for void target type", () => {
      const callbacks = createMockCallbacks({
        generateExpression: () => "doSomething()",
      });

      const result = ArgumentGenerator.handleRvalueArg(
        null as never,
        "void",
        callbacks,
      );
      expect(result).toBe("doSomething()");
    });

    it("returns expression unchanged in C++ mode (rvalues bind to const T&)", () => {
      CodeGenState.cppMode = true;
      const callbacks = createMockCallbacks({
        generateExpression: () => "42",
      });

      const result = ArgumentGenerator.handleRvalueArg(
        null as never,
        "u8",
        callbacks,
      );
      expect(result).toBe("42");
    });

    it("wraps in compound literal for C mode", () => {
      CodeGenState.cppMode = false;
      const callbacks = createMockCallbacks({
        generateExpression: () => "42",
      });

      const result = ArgumentGenerator.handleRvalueArg(
        null as never,
        "u8",
        callbacks,
      );
      expect(result).toBe("&(uint8_t){42}");
    });

    it("uses correct C type for compound literal", () => {
      CodeGenState.cppMode = false;
      const callbacks = createMockCallbacks({
        generateExpression: () => "1000",
      });

      const result = ArgumentGenerator.handleRvalueArg(
        null as never,
        "i32",
        callbacks,
      );
      expect(result).toBe("&(int32_t){1000}");
    });
  });

  describe("createCppMemberConversionTemp", () => {
    it("creates temp variable with static_cast in C++ mode", () => {
      CodeGenState.cppMode = true;
      CodeGenState.tempVarCounter = 0;
      const callbacks = createMockCallbacks({
        generateExpression: () => "cfg.value",
      });

      const result = ArgumentGenerator.createCppMemberConversionTemp(
        null as never,
        "u8",
        callbacks,
      );

      expect(result).toBe("_cnx_tmp_0");
      expect(CodeGenState.pendingTempDeclarations).toContain(
        "uint8_t _cnx_tmp_0 = static_cast<uint8_t>(cfg.value);",
      );
      expect(CodeGenState.tempVarCounter).toBe(1);
    });

    it("increments temp counter for multiple temps", () => {
      CodeGenState.cppMode = true;
      CodeGenState.tempVarCounter = 5;
      const callbacks = createMockCallbacks({
        generateExpression: () => "x",
      });

      const result = ArgumentGenerator.createCppMemberConversionTemp(
        null as never,
        "i16",
        callbacks,
      );

      expect(result).toBe("_cnx_tmp_5");
      expect(CodeGenState.tempVarCounter).toBe(6);
    });
  });

  describe("maybeCastStringSubscript", () => {
    it("returns expr unchanged when no target type", () => {
      const callbacks = createMockCallbacks({
        isStringSubscriptAccess: () => true,
      });

      const result = ArgumentGenerator.maybeCastStringSubscript(
        null as never,
        "&buf[0]",
        undefined,
        callbacks,
      );
      expect(result).toBe("&buf[0]");
    });

    it("returns expr unchanged when not string subscript", () => {
      const callbacks = createMockCallbacks({
        isStringSubscriptAccess: () => false,
      });

      const result = ArgumentGenerator.maybeCastStringSubscript(
        null as never,
        "&arr[0]",
        "u8",
        callbacks,
      );
      expect(result).toBe("&arr[0]");
    });

    it("casts string subscript to integer pointer type in C mode", () => {
      CodeGenState.cppMode = false;
      const callbacks = createMockCallbacks({
        isStringSubscriptAccess: () => true,
      });

      const result = ArgumentGenerator.maybeCastStringSubscript(
        null as never,
        "&buf[0]",
        "u8",
        callbacks,
      );
      expect(result).toBe("(uint8_t*)&buf[0]");
    });

    it("casts string subscript with reinterpret_cast in C++ mode", () => {
      CodeGenState.cppMode = true;
      const callbacks = createMockCallbacks({
        isStringSubscriptAccess: () => true,
      });

      const result = ArgumentGenerator.maybeCastStringSubscript(
        null as never,
        "&buf[0]",
        "u8",
        callbacks,
      );
      expect(result).toBe("reinterpret_cast<uint8_t*>(&buf[0])");
    });

    it("does not cast for float types", () => {
      CodeGenState.cppMode = false;
      const callbacks = createMockCallbacks({
        isStringSubscriptAccess: () => true,
      });

      const result = ArgumentGenerator.maybeCastStringSubscript(
        null as never,
        "&buf[0]",
        "f32",
        callbacks,
      );
      expect(result).toBe("&buf[0]");
    });

    it("does not cast for bool type", () => {
      CodeGenState.cppMode = false;
      const callbacks = createMockCallbacks({
        isStringSubscriptAccess: () => true,
      });

      const result = ArgumentGenerator.maybeCastStringSubscript(
        null as never,
        "&buf[0]",
        "bool",
        callbacks,
      );
      expect(result).toBe("&buf[0]");
    });
  });

  describe("handleMemberAccessArg", () => {
    it("returns expression unchanged for array member (no & needed)", () => {
      const callbacks = createMockCallbacks({
        getMemberAccessArrayStatus: () => "array",
        generateExpression: () => "result.data",
      });

      const result = ArgumentGenerator.handleMemberAccessArg(
        null as never,
        "u8",
        callbacks,
      );
      expect(result).toBe("result.data");
    });

    it("creates temp for C++ conversion when needed", () => {
      CodeGenState.cppMode = true;
      CodeGenState.tempVarCounter = 0;
      const callbacks = createMockCallbacks({
        getMemberAccessArrayStatus: () => "not-array",
        needsCppMemberConversion: () => true,
        generateExpression: () => "cfg.enabled",
      });

      const result = ArgumentGenerator.handleMemberAccessArg(
        null as never,
        "u8",
        callbacks,
      );

      expect(result).toBe("_cnx_tmp_0");
      expect(CodeGenState.pendingTempDeclarations).toHaveLength(1);
    });

    it("returns null for default lvalue handling", () => {
      const callbacks = createMockCallbacks({
        getMemberAccessArrayStatus: () => "not-array",
        needsCppMemberConversion: () => false,
      });

      const result = ArgumentGenerator.handleMemberAccessArg(
        null as never,
        "u8",
        callbacks,
      );
      expect(result).toBeNull();
    });

    it("returns null when array status is unknown", () => {
      const callbacks = createMockCallbacks({
        getMemberAccessArrayStatus: () => "unknown",
        needsCppMemberConversion: () => false,
      });

      const result = ArgumentGenerator.handleMemberAccessArg(
        null as never,
        "u8",
        callbacks,
      );
      expect(result).toBeNull();
    });
  });

  describe("handleLvalueArg", () => {
    it("delegates to handleMemberAccessArg for member access", () => {
      const callbacks = createMockCallbacks({
        getMemberAccessArrayStatus: () => "array",
        generateExpression: () => "result.buffer",
      });

      const result = ArgumentGenerator.handleLvalueArg(
        null as never,
        "member",
        "u8",
        callbacks,
      );
      expect(result).toBe("result.buffer");
    });

    it("generates expression with & for member when not array", () => {
      CodeGenState.cppMode = false;
      const callbacks = createMockCallbacks({
        getMemberAccessArrayStatus: () => "not-array",
        needsCppMemberConversion: () => false,
        generateExpression: () => "obj.field",
      });

      const result = ArgumentGenerator.handleLvalueArg(
        null as never,
        "member",
        "u8",
        callbacks,
      );
      expect(result).toBe("&obj.field");
    });

    it("handles array access with & and string subscript cast", () => {
      CodeGenState.cppMode = false;
      const callbacks = createMockCallbacks({
        generateExpression: () => "buf[0]",
        isStringSubscriptAccess: () => true,
      });

      const result = ArgumentGenerator.handleLvalueArg(
        null as never,
        "array",
        "u8",
        callbacks,
      );
      expect(result).toBe("(uint8_t*)&buf[0]");
    });

    it("returns expression with & for array without string cast", () => {
      CodeGenState.cppMode = false;
      const callbacks = createMockCallbacks({
        generateExpression: () => "arr[i]",
        isStringSubscriptAccess: () => false,
      });

      const result = ArgumentGenerator.handleLvalueArg(
        null as never,
        "array",
        "u8",
        callbacks,
      );
      expect(result).toBe("&arr[i]");
    });
  });

  describe("generateArg (main dispatcher)", () => {
    it("handles simple identifier", () => {
      CodeGenState.cppMode = false;
      const callbacks = createMockCallbacks({
        getLvalueType: () => null,
      });

      const result = ArgumentGenerator.generateArg(
        null as never,
        "value",
        "u8",
        callbacks,
      );
      expect(result).toBe("&value");
    });

    it("handles parameter identifier", () => {
      CodeGenState.currentParameters.set("cfg", {
        name: "cfg",
        baseType: "Config",
        isArray: false,
        isStruct: true,
        isConst: false,
        isCallback: false,
        isString: false,
      });
      const callbacks = createMockCallbacks({
        getLvalueType: () => null,
      });

      const result = ArgumentGenerator.generateArg(
        null as never,
        "cfg",
        "Config",
        callbacks,
      );
      expect(result).toBe("cfg");
    });

    it("handles lvalue expressions", () => {
      CodeGenState.cppMode = false;
      const callbacks = createMockCallbacks({
        getLvalueType: () => "member",
        getMemberAccessArrayStatus: () => "not-array",
        needsCppMemberConversion: () => false,
        generateExpression: () => "obj.field",
      });

      const result = ArgumentGenerator.generateArg(
        null as never,
        null, // no simple identifier
        "u8",
        callbacks,
      );
      expect(result).toBe("&obj.field");
    });

    it("handles rvalue expressions", () => {
      CodeGenState.cppMode = false;
      const callbacks = createMockCallbacks({
        getLvalueType: () => null,
        generateExpression: () => "42",
      });

      const result = ArgumentGenerator.generateArg(
        null as never,
        null, // no simple identifier
        "u8",
        callbacks,
      );
      expect(result).toBe("&(uint8_t){42}");
    });
  });
});
