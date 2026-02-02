import { describe, it, expect } from "vitest";
import generateRegister from "../RegisterGenerator";
import IGeneratorInput from "../../IGeneratorInput";
import IGeneratorState from "../../IGeneratorState";
import IOrchestrator from "../../IOrchestrator";
import * as Parser from "../../../../../logic/parser/grammar/CNextParser";

// ========================================================================
// Test Helpers
// ========================================================================

/**
 * Register member definition for test setup.
 */
interface IRegisterMemberDef {
  name: string;
  type: string;
  cType: string;
  access: "ro" | "wo" | "rw";
  offset: string;
}

/**
 * Create a minimal mock register member context.
 */
function createMockRegisterMember(def: IRegisterMemberDef) {
  return {
    IDENTIFIER: () => ({ getText: () => def.name }),
    type: () => ({ getText: () => def.type }),
    accessModifier: () => ({ getText: () => def.access }),
    expression: () => ({ __mockOffset: def.offset }),
  };
}

/**
 * Create a minimal mock register declaration context.
 */
function createMockRegisterContext(
  name: string,
  baseAddress: string,
  members: IRegisterMemberDef[],
): Parser.RegisterDeclarationContext {
  return {
    IDENTIFIER: () => ({ getText: () => name }),
    expression: () => ({ __mockBaseAddress: baseAddress }),
    registerMember: () => members.map(createMockRegisterMember),
  } as unknown as Parser.RegisterDeclarationContext;
}

/**
 * Create minimal mock input (RegisterGenerator doesn't use input).
 */
function createMockInput(): IGeneratorInput {
  return {} as unknown as IGeneratorInput;
}

/**
 * Create minimal mock state (RegisterGenerator doesn't use state).
 */
function createMockState(): IGeneratorState {
  return {} as IGeneratorState;
}

/**
 * Create mock orchestrator with generateExpression and generateType.
 */
function createMockOrchestrator(typeMap: Map<string, string>): IOrchestrator {
  return {
    generateExpression: (ctx: {
      __mockBaseAddress?: string;
      __mockOffset?: string;
    }) => {
      return ctx.__mockBaseAddress ?? ctx.__mockOffset ?? "0";
    },
    generateType: (ctx: { getText: () => string }) => {
      const cnextType = ctx.getText();
      return typeMap.get(cnextType) ?? cnextType;
    },
  } as unknown as IOrchestrator;
}

// ========================================================================
// Tests
// ========================================================================

describe("RegisterGenerator", () => {
  // Standard type mappings
  const standardTypes = new Map([
    ["u8", "uint8_t"],
    ["u16", "uint16_t"],
    ["u32", "uint32_t"],
    ["u64", "uint64_t"],
    ["i8", "int8_t"],
    ["i16", "int16_t"],
    ["i32", "int32_t"],
    ["i64", "int64_t"],
  ]);

  describe("basic register generation", () => {
    it("generates register with single rw member", () => {
      const ctx = createMockRegisterContext("GPIO7", "0x42004000", [
        {
          name: "DR",
          type: "u32",
          cType: "uint32_t",
          access: "rw",
          offset: "0x00",
        },
      ]);
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator(standardTypes);

      const result = generateRegister(ctx, input, state, orchestrator);

      expect(result.code).toBe(
        `/* Register: GPIO7 @ 0x42004000 */
#define GPIO7_DR (*(volatile uint32_t*)(0x42004000 + 0x00))
`,
      );
      expect(result.effects).toEqual([]);
    });

    it("generates register with multiple members", () => {
      const ctx = createMockRegisterContext("TIMER", "0x40000000", [
        {
          name: "CTRL",
          type: "u32",
          cType: "uint32_t",
          access: "rw",
          offset: "0x00",
        },
        {
          name: "COUNT",
          type: "u32",
          cType: "uint32_t",
          access: "ro",
          offset: "0x04",
        },
        {
          name: "LOAD",
          type: "u32",
          cType: "uint32_t",
          access: "rw",
          offset: "0x08",
        },
      ]);
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator(standardTypes);

      const result = generateRegister(ctx, input, state, orchestrator);

      expect(result.code).toContain("/* Register: TIMER @ 0x40000000 */");
      expect(result.code).toContain(
        "#define TIMER_CTRL (*(volatile uint32_t*)(0x40000000 + 0x00))",
      );
      expect(result.code).toContain(
        "#define TIMER_COUNT (*(volatile uint32_t const *)(0x40000000 + 0x04))",
      );
      expect(result.code).toContain(
        "#define TIMER_LOAD (*(volatile uint32_t*)(0x40000000 + 0x08))",
      );
    });
  });

  describe("access modifiers (ADR-004)", () => {
    it("generates read-only member with const qualifier", () => {
      const ctx = createMockRegisterContext("STATUS", "0x50000000", [
        {
          name: "FLAGS",
          type: "u8",
          cType: "uint8_t",
          access: "ro",
          offset: "0x00",
        },
      ]);
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator(standardTypes);

      const result = generateRegister(ctx, input, state, orchestrator);

      expect(result.code).toContain(
        "#define STATUS_FLAGS (*(volatile uint8_t const *)(0x50000000 + 0x00))",
      );
    });

    it("generates write-only member without const qualifier", () => {
      const ctx = createMockRegisterContext("COMMAND", "0x50000000", [
        {
          name: "SET",
          type: "u16",
          cType: "uint16_t",
          access: "wo",
          offset: "0x00",
        },
      ]);
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator(standardTypes);

      const result = generateRegister(ctx, input, state, orchestrator);

      expect(result.code).toContain(
        "#define COMMAND_SET (*(volatile uint16_t*)(0x50000000 + 0x00))",
      );
    });

    it("generates read-write member without const qualifier", () => {
      const ctx = createMockRegisterContext("CONFIG", "0x50000000", [
        {
          name: "VALUE",
          type: "u32",
          cType: "uint32_t",
          access: "rw",
          offset: "0x00",
        },
      ]);
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator(standardTypes);

      const result = generateRegister(ctx, input, state, orchestrator);

      expect(result.code).toContain(
        "#define CONFIG_VALUE (*(volatile uint32_t*)(0x50000000 + 0x00))",
      );
    });
  });

  describe("various type widths", () => {
    it("generates 8-bit register members", () => {
      const ctx = createMockRegisterContext("BYTE_REG", "0x40000000", [
        {
          name: "DATA",
          type: "u8",
          cType: "uint8_t",
          access: "rw",
          offset: "0x00",
        },
      ]);
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator(standardTypes);

      const result = generateRegister(ctx, input, state, orchestrator);

      expect(result.code).toContain("volatile uint8_t*");
    });

    it("generates 16-bit register members", () => {
      const ctx = createMockRegisterContext("WORD_REG", "0x40000000", [
        {
          name: "DATA",
          type: "u16",
          cType: "uint16_t",
          access: "rw",
          offset: "0x00",
        },
      ]);
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator(standardTypes);

      const result = generateRegister(ctx, input, state, orchestrator);

      expect(result.code).toContain("volatile uint16_t*");
    });

    it("generates 64-bit register members", () => {
      const ctx = createMockRegisterContext("LONG_REG", "0x40000000", [
        {
          name: "DATA",
          type: "u64",
          cType: "uint64_t",
          access: "rw",
          offset: "0x00",
        },
      ]);
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator(standardTypes);

      const result = generateRegister(ctx, input, state, orchestrator);

      expect(result.code).toContain("volatile uint64_t*");
    });
  });

  describe("non-contiguous register layouts", () => {
    it("handles gaps in register offsets (like i.MX RT1062)", () => {
      const ctx = createMockRegisterContext("GPIO", "0x401B8000", [
        {
          name: "DR",
          type: "u32",
          cType: "uint32_t",
          access: "rw",
          offset: "0x00",
        },
        {
          name: "GDIR",
          type: "u32",
          cType: "uint32_t",
          access: "rw",
          offset: "0x04",
        },
        {
          name: "PSR",
          type: "u32",
          cType: "uint32_t",
          access: "ro",
          offset: "0x08",
        },
        {
          name: "ICR1",
          type: "u32",
          cType: "uint32_t",
          access: "rw",
          offset: "0x0C",
        },
        {
          name: "ICR2",
          type: "u32",
          cType: "uint32_t",
          access: "rw",
          offset: "0x10",
        },
        // Gap at 0x14
        {
          name: "IMR",
          type: "u32",
          cType: "uint32_t",
          access: "rw",
          offset: "0x14",
        },
        {
          name: "ISR",
          type: "u32",
          cType: "uint32_t",
          access: "rw",
          offset: "0x18",
        },
        // Large gap
        {
          name: "DR_SET",
          type: "u32",
          cType: "uint32_t",
          access: "wo",
          offset: "0x84",
        },
        {
          name: "DR_CLEAR",
          type: "u32",
          cType: "uint32_t",
          access: "wo",
          offset: "0x88",
        },
        {
          name: "DR_TOGGLE",
          type: "u32",
          cType: "uint32_t",
          access: "wo",
          offset: "0x8C",
        },
      ]);
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator(standardTypes);

      const result = generateRegister(ctx, input, state, orchestrator);

      expect(result.code).toContain(
        "#define GPIO_DR (*(volatile uint32_t*)(0x401B8000 + 0x00))",
      );
      expect(result.code).toContain(
        "#define GPIO_DR_SET (*(volatile uint32_t*)(0x401B8000 + 0x84))",
      );
      expect(result.code).toContain(
        "#define GPIO_DR_CLEAR (*(volatile uint32_t*)(0x401B8000 + 0x88))",
      );
      expect(result.code).toContain(
        "#define GPIO_DR_TOGGLE (*(volatile uint32_t*)(0x401B8000 + 0x8C))",
      );
    });
  });

  describe("effects", () => {
    it("returns empty effects array", () => {
      const ctx = createMockRegisterContext("TEST", "0x40000000", [
        {
          name: "DATA",
          type: "u32",
          cType: "uint32_t",
          access: "rw",
          offset: "0x00",
        },
      ]);
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator(standardTypes);

      const result = generateRegister(ctx, input, state, orchestrator);

      expect(result.effects).toEqual([]);
    });
  });
});
