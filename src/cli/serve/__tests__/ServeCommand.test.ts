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

  // Helper to send a request and capture the async response
  async function sendRequest(request: object): Promise<object> {
    const line = JSON.stringify(request);
    // Access private handleLine method for testing
    const handleLine = (
      ServeCommand as unknown as { handleLine: (line: string) => void }
    ).handleLine.bind(ServeCommand);
    handleLine(line);

    // Wait for async dispatch to complete and write response
    await vi.waitFor(() => {
      expect(stdoutWriteSpy.mock.calls.length).toBeGreaterThan(0);
    });

    // Parse the response from the latest stdout.write call
    const writeCall =
      stdoutWriteSpy.mock.calls[stdoutWriteSpy.mock.calls.length - 1];
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

  describe("initialize", () => {
    it("initializes with workspace path", async () => {
      const response = await sendRequest({
        id: 10,
        method: "initialize",
        params: { workspacePath: "/tmp" },
      });

      expect(response).toMatchObject({
        id: 10,
        result: { success: true },
      });
    });

    it("returns error for missing workspacePath param", async () => {
      const response = await sendRequest({
        id: 11,
        method: "initialize",
        params: {},
      });

      expect(response).toMatchObject({
        id: 11,
        error: {
          code: JsonRpcHandler.ERROR_INVALID_PARAMS,
          message: "Missing required param: workspacePath",
        },
      });
    });
  });

  describe("transpile", () => {
    it("returns error when server not initialized", async () => {
      // Reset transpiler to null by accessing private field
      (ServeCommand as unknown as { transpiler: null }).transpiler = null;
      stdoutWriteSpy.mockClear();

      const response = await sendRequest({
        id: 50,
        method: "transpile",
        params: { source: "u8 x <- 5;" },
      });

      expect(response).toMatchObject({
        id: 50,
        error: {
          code: JsonRpcHandler.ERROR_INVALID_PARAMS,
          message: "Server not initialized. Call initialize first.",
        },
      });
    });

    it("transpiles valid C-Next source", async () => {
      // Initialize first (required for transpile)
      await sendRequest({
        id: 100,
        method: "initialize",
        params: { workspacePath: "/tmp" },
      });
      stdoutWriteSpy.mockClear();

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
      // Initialize first
      await sendRequest({
        id: 101,
        method: "initialize",
        params: { workspacePath: "/tmp" },
      });
      stdoutWriteSpy.mockClear();

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

    it("parses symbols with filePath after initialization", async () => {
      // Initialize first
      await sendRequest({
        id: 60,
        method: "initialize",
        params: { workspacePath: "/tmp" },
      });
      stdoutWriteSpy.mockClear();

      const response = await sendRequest({
        id: 61,
        method: "parseSymbols",
        params: {
          source: "void myFunc() { }",
          filePath: "/tmp/test.cnx",
        },
      });

      const result = response as {
        id: number;
        result: { success: boolean; symbols: Array<{ name: string }> };
      };
      expect(result.id).toBe(61);
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

    it("returns error for missing params", async () => {
      const response = await sendRequest({
        id: 70,
        method: "parseSymbols",
      });

      expect(response).toMatchObject({
        id: 70,
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

      // Wait a tick to ensure any async work would have started
      await new Promise((r) => setTimeout(r, 10));

      // No response should be written for empty lines
      expect(stdoutWriteSpy).not.toHaveBeenCalled();
    });
  });

  describe("debug logging", () => {
    it("writes debug messages to stderr when debug mode is enabled", async () => {
      const stderrWriteSpy = vi
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);

      // Enable debug mode via private field
      (ServeCommand as unknown as { debugMode: boolean }).debugMode = true;

      const response = await sendRequest({
        id: 80,
        method: "getVersion",
      });

      expect(response).toMatchObject({
        id: 80,
        result: { version: expect.any(String) },
      });

      // Debug logs should have been written to stderr
      expect(stderrWriteSpy).toHaveBeenCalled();
      const debugOutput = stderrWriteSpy.mock.calls.map((c) => c[0]).join("");
      expect(debugOutput).toContain("[serve]");

      // Clean up
      (ServeCommand as unknown as { debugMode: boolean }).debugMode = false;
      stderrWriteSpy.mockRestore();
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
