/**
 * Unit tests for the ADR-004 register generator.
 *
 * #1445 merged `generateRegister` and `generateScopedRegister` into one
 * `registerGeneratorFor(path)`; this file merges the two suites that tested
 * them. They had drifted into ~100 lines of duplicated scaffolding and two
 * copies of the access-modifier and effects assertions, differing only in the
 * macro prefix -- the S5976 cluster CLAUDE.md says to convert in the PR that
 * creates it, and, against one implementation, the same two-places-to-edit
 * shape the merge removed from the source.
 *
 * Everything that is one decision at both scopes runs under `describe.each`.
 * What stays separate is what is genuinely scope-specific: the #1472 guards
 * that nothing below the TypeBinding ladder re-qualifies a resolved name.
 */
import { describe, it, expect } from "vitest";
import registerGeneratorFor from "../RegisterGenerator";
import IGeneratorInput from "../../IGeneratorInput";
import IGeneratorState from "../../IGeneratorState";
import IOrchestrator from "../../IOrchestrator";
import * as Parser from "../../../../../../transpiler/logic/parser/grammar/CNextParser";
import TestGeneratorState from "../../__tests__/testGeneratorState";

// ========================================================================
// Test Helpers
// ========================================================================

/**
 * Register member definition for test setup.
 *
 * No `cType`: the C type a member renders to is whatever the mock
 * orchestrator's `generateType` returns, which is the point of the ADR-057
 * guards below. The field used to be set on every literal and read by nothing.
 */
interface IRegisterMemberDef {
  name: string;
  type: string;
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
 * Create minimal mock input.
 *
 * Empty on purpose: this generator takes `_input`. The scoped suite used to
 * build a twenty-field `symbols` object here, including a `knownBitmaps` set
 * whose contents nothing could read -- scaffolding that looked like it was
 * setting up the bitmap cases when the orchestrator's type map is what
 * decides them.
 */
function createMockInput(): IGeneratorInput {
  return {} as unknown as IGeneratorInput;
}

/**
 * Create minimal mock state (this generator takes `_state`).
 */
function createMockState(): IGeneratorState {
  return TestGeneratorState.create();
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

/** Standard type mappings. */
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

/** Run the generator for one scope path. */
function generate(
  scopePath: string,
  ctx: Parser.RegisterDeclarationContext,
  typeMap: Map<string, string> = standardTypes,
) {
  return registerGeneratorFor(scopePath)(
    ctx,
    createMockInput(),
    createMockState(),
    createMockOrchestrator(typeMap),
  );
}

// ========================================================================
// Tests — identical at file scope and inside a scope, modulo the prefix
// ========================================================================

describe.each([
  ["file scope", "", ""],
  ["inside a scope", "Teensy4", "Teensy4__"],
])("RegisterGenerator (%s)", (_label, scopePath, prefix) => {
  describe("basic register generation", () => {
    it("generates register with single rw member", () => {
      const ctx = createMockRegisterContext("GPIO7", "0x42004000", [
        { name: "DR", type: "u32", access: "rw", offset: "0x00" },
      ]);

      const result = generate(scopePath, ctx);

      expect(result.code).toBe(
        `/* Register: ${prefix}GPIO7 @ 0x42004000 */
#define ${prefix}GPIO7__DR (*(volatile uint32_t*)(0x42004000 + 0x00))
`,
      );
      expect(result.effects).toEqual([]);
    });

    it("generates register with multiple members", () => {
      const ctx = createMockRegisterContext("TIMER", "0x40000000", [
        { name: "CTRL", type: "u32", access: "rw", offset: "0x00" },
        { name: "COUNT", type: "u32", access: "ro", offset: "0x04" },
        { name: "LOAD", type: "u32", access: "rw", offset: "0x08" },
      ]);

      const result = generate(scopePath, ctx);

      expect(result.code).toContain(
        `/* Register: ${prefix}TIMER @ 0x40000000 */`,
      );
      expect(result.code).toContain(
        `#define ${prefix}TIMER__CTRL (*(volatile uint32_t*)(0x40000000 + 0x00))`,
      );
      expect(result.code).toContain(
        `#define ${prefix}TIMER__COUNT (*(volatile uint32_t const *)(0x40000000 + 0x04))`,
      );
      expect(result.code).toContain(
        `#define ${prefix}TIMER__LOAD (*(volatile uint32_t*)(0x40000000 + 0x08))`,
      );
    });
  });

  describe("access modifiers (ADR-004)", () => {
    it.each([
      ["read-only member gets a const qualifier", "ro", "uint8_t const *"],
      ["write-only member does not", "wo", "uint8_t*"],
      ["read-write member does not", "rw", "uint8_t*"],
    ])("%s", (_case, access, cast) => {
      const ctx = createMockRegisterContext("STATUS", "0x50000000", [
        {
          name: "FLAGS",
          type: "u8",
          access: access as IRegisterMemberDef["access"],
          offset: "0x00",
        },
      ]);

      const result = generate(scopePath, ctx);

      expect(result.code).toContain(
        `#define ${prefix}STATUS__FLAGS (*(volatile ${cast})(0x50000000 + 0x00))`,
      );
    });
  });

  describe("various type widths", () => {
    it.each([
      ["8-bit", "u8", "uint8_t"],
      ["16-bit", "u16", "uint16_t"],
      ["32-bit", "u32", "uint32_t"],
      ["64-bit", "u64", "uint64_t"],
    ])("generates %s register members", (_case, cnextType, cType) => {
      const ctx = createMockRegisterContext("REG", "0x40000000", [
        { name: "DATA", type: cnextType, access: "rw", offset: "0x00" },
      ]);

      const result = generate(scopePath, ctx);

      expect(result.code).toContain(`volatile ${cType}*`);
    });
  });

  describe("non-contiguous register layouts", () => {
    it("handles gaps in register offsets (like i.MX RT1062)", () => {
      const ctx = createMockRegisterContext("GPIO", "0x401B8000", [
        { name: "DR", type: "u32", access: "rw", offset: "0x00" },
        { name: "GDIR", type: "u32", access: "rw", offset: "0x04" },
        { name: "PSR", type: "u32", access: "ro", offset: "0x08" },
        { name: "ICR1", type: "u32", access: "rw", offset: "0x0C" },
        { name: "ICR2", type: "u32", access: "rw", offset: "0x10" },
        // Gap at 0x14
        { name: "IMR", type: "u32", access: "rw", offset: "0x14" },
        { name: "ISR", type: "u32", access: "rw", offset: "0x18" },
        // Large gap
        { name: "DR_SET", type: "u32", access: "wo", offset: "0x84" },
        { name: "DR_CLEAR", type: "u32", access: "wo", offset: "0x88" },
        { name: "DR_TOGGLE", type: "u32", access: "wo", offset: "0x8C" },
      ]);

      const result = generate(scopePath, ctx);

      expect(result.code).toContain(
        `#define ${prefix}GPIO__DR (*(volatile uint32_t*)(0x401B8000 + 0x00))`,
      );
      expect(result.code).toContain(
        `#define ${prefix}GPIO__DR_SET (*(volatile uint32_t*)(0x401B8000 + 0x84))`,
      );
      expect(result.code).toContain(
        `#define ${prefix}GPIO__DR_CLEAR (*(volatile uint32_t*)(0x401B8000 + 0x88))`,
      );
      expect(result.code).toContain(
        `#define ${prefix}GPIO__DR_TOGGLE (*(volatile uint32_t*)(0x401B8000 + 0x8C))`,
      );
    });
  });

  describe("effects", () => {
    it("returns empty effects array", () => {
      const ctx = createMockRegisterContext("TEST", "0x40000000", [
        { name: "DATA", type: "u32", access: "rw", offset: "0x00" },
      ]);

      expect(generate(scopePath, ctx).effects).toEqual([]);
    });
  });
});

// ========================================================================
// Tests — scope-specific: the ADR-057 resolution point is upstream
// ========================================================================

describe("RegisterGenerator (scoped bitmap type resolution)", () => {
  it("emits the name the ladder resolved, without re-deriving it", () => {
    // ADR-057 qualification belongs to `orchestrator.generateType`, which is
    // the single resolution point. This generator is transparent to it: a
    // bare `GPIO7Pins` inside `scope Teensy4` arrives ALREADY qualified.
    const ctx = createMockRegisterContext("GPIO7", "0x42004000", [
      { name: "PINS", type: "GPIO7Pins", access: "rw", offset: "0x00" },
    ]);

    // The ladder qualified it -- that is what production hands over.
    const result = generate(
      "Teensy4",
      ctx,
      new Map([["GPIO7Pins", "Teensy4__GPIO7Pins"]]),
    );

    expect(result.code).toContain("volatile Teensy4__GPIO7Pins*");
  });

  it("does not re-qualify a resolved name, so an explicit global. survives", () => {
    // The regression guard for #1472. `global.GPIO7Pins` opts out of scope
    // resolution, so the ladder hands over the BARE name -- while a
    // same-named scoped bitmap also exists. The generator used to re-qualify
    // that resolved name and probe the scoped key first, binding
    // `Teensy4__GPIO7Pins` and typing the register with a bitmap whose bit
    // names differ. By this point the two forms are byte-identical, which is
    // exactly why nothing below the ladder may qualify.
    const ctx = createMockRegisterContext("GPIO7", "0x42004000", [
      { name: "PINS", type: "GPIO7Pins", access: "rw", offset: "0x00" },
    ]);

    // The `global.` branch returns the bare identifier.
    const result = generate(
      "Teensy4",
      ctx,
      new Map([["GPIO7Pins", "GPIO7Pins"]]),
    );

    expect(result.code).toContain("volatile GPIO7Pins*");
    expect(result.code).not.toContain("Teensy4__GPIO7Pins");
  });

  it("keeps original type when scoped bitmap does not exist", () => {
    const ctx = createMockRegisterContext("GPIO7", "0x42004000", [
      { name: "DATA", type: "u32", access: "rw", offset: "0x00" },
    ]);

    const result = generate("Teensy4", ctx);

    expect(result.code).toContain("volatile uint32_t*");
    expect(result.code).not.toContain("Teensy4__u32");
  });
});
