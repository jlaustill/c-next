/**
 * Unit tests for ServeCommand method handlers
 *
 * These tests verify the method handlers return correct structures.
 * The main run() loop is tested via integration tests.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import ServeCommand from "../ServeCommand";
import JsonRpcHandler from "../JsonRpcHandler";

// We need to test the private dispatch method indirectly by simulating line handling
// Since the methods are private, we test them via their JSON-RPC responses

describe("ServeCommand", () => {
  let stdoutWriteSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stdoutWriteSpy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutWriteSpy.mockRestore();
  });

  // Helper to send a request and capture the response
  async function sendRequest(request: object): Promise<object> {
    const line = JSON.stringify(request);
    // Access private handleLine method for testing
    const handleLine = (
      ServeCommand as unknown as { handleLine: (line: string) => void }
    ).handleLine.bind(ServeCommand);
    handleLine(line);

    // Parse the response from stdout.write call
    const writeCall = stdoutWriteSpy.mock.calls[0];
    if (writeCall) {
      const responseStr = writeCall[0] as string;
      return JSON.parse(responseStr.trim());
    }
    throw new Error("No response written");
  }

  describe("getVersion", () => {
    it("returns the version", async () => {
      const response = await sendRequest({ id: 1, method: "getVersion" });

      expect(response).toMatchObject({
        id: 1,
        result: { version: expect.any(String) },
      });
    });
  });

  describe("transpile", () => {
    it("transpiles valid C-Next source", async () => {
      const response = await sendRequest({
        id: 2,
        method: "transpile",
        params: { source: "u8 x <- 5;" },
      });

      expect(response).toMatchObject({
        id: 2,
        result: {
          success: true,
          code: expect.stringContaining("uint8_t x = 5;"),
          errors: [],
        },
      });
    });

    it("returns errors for invalid source", async () => {
      const response = await sendRequest({
        id: 3,
        method: "transpile",
        params: { source: "invalid @@@ syntax" },
      });

      const result = response as {
        id: number;
        result: { success: boolean; errors: unknown[] };
      };
      expect(result.id).toBe(3);
      expect(result.result.success).toBe(false);
      expect(result.result.errors.length).toBeGreaterThan(0);
    });

    it("returns error for missing source param", async () => {
      const response = await sendRequest({
        id: 4,
        method: "transpile",
        params: {},
      });

      expect(response).toMatchObject({
        id: 4,
        error: {
          code: JsonRpcHandler.ERROR_INVALID_PARAMS,
          message: "Missing required param: source",
        },
      });
    });

    it("returns error for missing params", async () => {
      const response = await sendRequest({
        id: 5,
        method: "transpile",
      });

      expect(response).toMatchObject({
        id: 5,
        error: {
          code: JsonRpcHandler.ERROR_INVALID_PARAMS,
          message: "Missing required param: source",
        },
      });
    });
  });

  describe("parseSymbols", () => {
    it("parses symbols from valid source", async () => {
      const response = await sendRequest({
        id: 6,
        method: "parseSymbols",
        params: { source: "void myFunc() { }" },
      });

      const result = response as {
        id: number;
        result: { success: boolean; symbols: Array<{ name: string }> };
      };
      expect(result.id).toBe(6);
      expect(result.result.success).toBe(true);
      expect(result.result.symbols).toEqual(
        expect.arrayContaining([expect.objectContaining({ name: "myFunc" })]),
      );
    });

    it("returns error for missing source param", async () => {
      const response = await sendRequest({
        id: 7,
        method: "parseSymbols",
        params: {},
      });

      expect(response).toMatchObject({
        id: 7,
        error: {
          code: JsonRpcHandler.ERROR_INVALID_PARAMS,
          message: "Missing required param: source",
        },
      });
    });
  });

  describe("shutdown", () => {
    it("returns success", async () => {
      // Note: We can't fully test shutdown behavior because it closes the readline
      // In tests, we just verify the response structure
      const response = await sendRequest({
        id: 8,
        method: "shutdown",
      });

      expect(response).toMatchObject({
        id: 8,
        result: { success: true },
      });
    });
  });

  describe("unknown method", () => {
    it("returns method not found error", async () => {
      const response = await sendRequest({
        id: 9,
        method: "unknownMethod",
      });

      expect(response).toMatchObject({
        id: 9,
        error: {
          code: JsonRpcHandler.ERROR_METHOD_NOT_FOUND,
          message: "Method not found: unknownMethod",
        },
      });
    });
  });

  describe("empty lines", () => {
    it("ignores empty lines", async () => {
      const handleLine = (
        ServeCommand as unknown as { handleLine: (line: string) => void }
      ).handleLine.bind(ServeCommand);
      handleLine("");
      handleLine("   ");

      // No response should be written for empty lines
      expect(stdoutWriteSpy).not.toHaveBeenCalled();
    });
  });

  describe("invalid JSON", () => {
    it("returns parse error", async () => {
      const handleLine = (
        ServeCommand as unknown as { handleLine: (line: string) => void }
      ).handleLine.bind(ServeCommand);
      handleLine("not valid json");

      const writeCall = stdoutWriteSpy.mock.calls[0];
      const response = JSON.parse((writeCall[0] as string).trim());

      expect(response).toMatchObject({
        id: 0,
        error: {
          code: JsonRpcHandler.ERROR_PARSE,
          message: "Parse error",
        },
      });
    });
  });
});
