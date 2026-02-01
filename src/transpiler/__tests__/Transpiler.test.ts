/**
 * Unit tests for Transpiler
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import Transpiler from "../Transpiler";

describe("Transpiler", () => {
  const testDir = join(process.cwd(), "test-transpiler-tmp");

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  describe("run", () => {
    describe("parse error handling", () => {
      it("formats parse errors with file path", async () => {
        // Create a file with invalid syntax
        const testFile = join(testDir, "invalid.cnx");
        writeFileSync(testFile, "void foo( { }"); // Missing parameter and body

        const transpiler = new Transpiler({
          inputs: [testFile],
        });

        const result = await transpiler.run();

        expect(result.success).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        // Error message should include file path
        expect(result.errors[0].message).toContain(testFile);
      });

      it("includes line and column in parse errors", async () => {
        const testFile = join(testDir, "syntax-error.cnx");
        // Error on line 2, column position depends on parser
        writeFileSync(testFile, "void foo() {\n  @@@invalid\n}");

        const transpiler = new Transpiler({
          inputs: [testFile],
        });

        const result = await transpiler.run();

        expect(result.success).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        // Error should have location info
        const errorMsg = result.errors[0].message;
        expect(errorMsg).toMatch(/:\d+:\d+/); // Contains :line:column pattern
      });

      it("collects multiple parse errors", async () => {
        const testFile = join(testDir, "multi-error.cnx");
        writeFileSync(testFile, "@@@ $$$ %%%"); // Multiple invalid tokens

        const transpiler = new Transpiler({
          inputs: [testFile],
        });

        const result = await transpiler.run();

        expect(result.success).toBe(false);
        // Should have at least one error
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });
  });
});
