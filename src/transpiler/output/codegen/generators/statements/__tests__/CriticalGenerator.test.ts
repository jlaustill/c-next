import { describe, it, expect, vi } from "vitest";
import generateCriticalStatement from "../CriticalGenerator";
import IGeneratorInput from "../../IGeneratorInput";
import IGeneratorState from "../../IGeneratorState";
import IOrchestrator from "../../IOrchestrator";
import * as Parser from "../../../../../logic/parser/grammar/CNextParser";
import TestGeneratorState from "../../__tests__/testGeneratorState";

// ========================================================================
// Test Helpers
// ========================================================================

/**
 * Create a minimal mock block context.
 */
function createMockBlockContext(): Parser.BlockContext {
  return {} as Parser.BlockContext;
}

/**
 * Create a minimal mock critical statement context.
 * CriticalGenerator only uses node.block()
 */
function createMockCriticalContext(
  blockCtx?: Parser.BlockContext,
): Parser.CriticalStatementContext {
  const block = blockCtx ?? createMockBlockContext();
  return {
    block: () => block,
  } as unknown as Parser.CriticalStatementContext;
}

/**
 * Create minimal mock input.
 * CriticalGenerator doesn't use input (_input parameter).
 */
function createMockInput(): IGeneratorInput {
  return {
    symbols: null,
    symbolTable: null,
    typeRegistry: new Map(),
    functionSignatures: new Map(),
    knownFunctions: new Set(),
    knownStructs: new Set(),
    constValues: new Map(),
    callbackTypes: new Map(),
    callbackFieldTypes: new Map(),
    targetCapabilities: { hasAtomicSupport: false },
    debugMode: false,
  } as unknown as IGeneratorInput;
}

/**
 * Create minimal mock state.
 * CriticalGenerator doesn't use state (_state parameter).
 */
function createMockState(): IGeneratorState {
  return TestGeneratorState.create({ inFunctionBody: true });
}

/**
 * Create mock orchestrator for CriticalGenerator.
 * CriticalGenerator uses:
 * - generateBlock(block) - block generation
 */
function createMockOrchestrator(options?: {
  blockCode?: string;
}): IOrchestrator {
  const generateBlock = vi.fn(() => options?.blockCode ?? "{\n    x <- 1;\n}");

  return {
    generateBlock,
  } as unknown as IOrchestrator;
}

// ========================================================================
// Tests
// ========================================================================

describe("CriticalGenerator", () => {
  describe("basic critical section generation", () => {
    it("generates PRIMASK save/restore wrapper with block contents", () => {
      const blockCtx = createMockBlockContext();
      const ctx = createMockCriticalContext(blockCtx);
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        blockCode: "{\n    counter <- counter + 1;\n}",
      });

      const result = generateCriticalStatement(ctx, input, state, orchestrator);

      expect(result.code).toContain("uint32_t __primask = __cnx_get_PRIMASK()");
      expect(result.code).toContain("__cnx_disable_irq()");
      expect(result.code).toContain("counter <- counter + 1;");
      expect(result.code).toContain("__cnx_set_PRIMASK(__primask)");
    });

    it("strips outer braces from block code", () => {
      const ctx = createMockCriticalContext();
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        blockCode: "{\n    x = 1;\n    y = 2;\n}",
      });

      const result = generateCriticalStatement(ctx, input, state, orchestrator);

      // Should not have double braces
      expect(result.code).not.toContain("{\n{");
      expect(result.code).not.toContain("}\n}");
      // Should have the inner content
      expect(result.code).toContain("x = 1;");
      expect(result.code).toContain("y = 2;");
    });

    it("generates correct wrapper structure", () => {
      const ctx = createMockCriticalContext();
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        blockCode: "{\n    operation();\n}",
      });

      const result = generateCriticalStatement(ctx, input, state, orchestrator);

      // Check the exact structure: opening brace, PRIMASK save, disable, content, restore, closing brace
      const lines = result.code.split("\n");
      expect(lines[0]).toBe("{");
      expect(lines[1]).toContain("__primask = __cnx_get_PRIMASK()");
      expect(lines[2]).toContain("__cnx_disable_irq()");
      expect(lines[3]).toContain("operation()");
      expect(lines[4]).toContain("__cnx_set_PRIMASK(__primask)");
      expect(lines[5]).toBe("}");
    });
  });

  // #1322: `CriticalGenerator` no longer validates. E0853 is authored in pass
  // 2.1, so by the time this generator runs the program is already known legal
  // -- and the check reaches every statement the grammar can nest, including
  // `switch`, which the recursion it replaced did not descend into.
  // Covered by `1-Analyze/__tests__/CriticalSectionAnalyzer.test.ts`.

  describe("effects", () => {
    it("returns irq_wrappers include effect", () => {
      const ctx = createMockCriticalContext();
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator();

      const result = generateCriticalStatement(ctx, input, state, orchestrator);

      expect(result.effects).toHaveLength(1);
      expect(result.effects[0]).toEqual({
        type: "include",
        header: "irq_wrappers",
      });
    });

    it("uses __cnx_ prefixed functions (avoids macro collisions)", () => {
      const ctx = createMockCriticalContext();
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator();

      const result = generateCriticalStatement(ctx, input, state, orchestrator);

      // ADR-050: Use __cnx_ prefixed wrappers to avoid collision with platform headers
      expect(result.code).toContain("__cnx_get_PRIMASK");
      expect(result.code).toContain("__cnx_disable_irq");
      expect(result.code).toContain("__cnx_set_PRIMASK");
      // Should NOT use bare CMSIS names
      expect(result.code).not.toMatch(/[^_]get_PRIMASK/);
      expect(result.code).not.toMatch(/[^_]disable_irq/);
      expect(result.code).not.toMatch(/[^_]set_PRIMASK/);
    });
  });

  describe("block content handling", () => {
    it("handles empty block", () => {
      const ctx = createMockCriticalContext();
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        blockCode: "{\n}",
      });

      const result = generateCriticalStatement(ctx, input, state, orchestrator);

      expect(result.code).toContain("__cnx_get_PRIMASK");
      expect(result.code).toContain("__cnx_set_PRIMASK");
    });

    it("handles block with multiple statements", () => {
      const ctx = createMockCriticalContext();
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        blockCode: "{\n    a = 1;\n    b = 2;\n    c = 3;\n}",
      });

      const result = generateCriticalStatement(ctx, input, state, orchestrator);

      expect(result.code).toContain("a = 1;");
      expect(result.code).toContain("b = 2;");
      expect(result.code).toContain("c = 3;");
    });

    it("preserves indentation of inner block content", () => {
      const ctx = createMockCriticalContext();
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        blockCode: "{\n    if (x) {\n        y = 1;\n    }\n}",
      });

      const result = generateCriticalStatement(ctx, input, state, orchestrator);

      // The inner content should be preserved with its structure
      expect(result.code).toContain("if (x)");
      expect(result.code).toContain("y = 1;");
    });
  });

  describe("orchestrator delegation", () => {
    it("calls generateBlock with the block context", () => {
      const blockCtx = createMockBlockContext();
      const ctx = createMockCriticalContext(blockCtx);
      const input = createMockInput();
      const state = createMockState();
      const generateBlock = vi.fn(() => "{\n    code;\n}");
      const orchestrator = {
        validateNoEarlyExits: vi.fn(),
        generateBlock,
      } as unknown as IOrchestrator;

      generateCriticalStatement(ctx, input, state, orchestrator);

      expect(generateBlock).toHaveBeenCalledOnce();
      expect(generateBlock).toHaveBeenCalledWith(blockCtx);
    });
  });
});
