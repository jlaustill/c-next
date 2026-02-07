/**
 * Unit tests for JsonRpcHandler
 */

import { describe, it, expect } from "vitest";
import JsonRpcHandler from "../JsonRpcHandler";

describe("JsonRpcHandler", () => {
  describe("parseRequest", () => {
    it("parses a valid request with numeric id", () => {
      const line = '{"id":1,"method":"getVersion"}';

      const result = JsonRpcHandler.parseRequest(line);

      expect(result.success).toBe(true);
      expect(result.request).toEqual({
        id: 1,
        method: "getVersion",
        params: undefined,
      });
    });

    it("parses a valid request with string id", () => {
      const line =
        '{"id":"abc","method":"transpile","params":{"source":"u8 x;"}}';

      const result = JsonRpcHandler.parseRequest(line);

      expect(result.success).toBe(true);
      expect(result.request).toEqual({
        id: "abc",
        method: "transpile",
        params: { source: "u8 x;" },
      });
    });

    it("returns parse error for invalid JSON", () => {
      const line = "not valid json";

      const result = JsonRpcHandler.parseRequest(line);

      expect(result.success).toBe(false);
      expect(result.error).toEqual({
        id: 0,
        error: { code: -32700, message: "Parse error" },
      });
    });

    it("returns invalid request for non-object JSON", () => {
      const line = '"just a string"';

      const result = JsonRpcHandler.parseRequest(line);

      expect(result.success).toBe(false);
      expect(result.error).toEqual({
        id: 0,
        error: { code: -32600, message: "Invalid request" },
      });
    });

    it("returns invalid request for null JSON", () => {
      const line = "null";

      const result = JsonRpcHandler.parseRequest(line);

      expect(result.success).toBe(false);
      expect(result.error).toEqual({
        id: 0,
        error: { code: -32600, message: "Invalid request" },
      });
    });

    it("returns invalid request when id is missing", () => {
      const line = '{"method":"getVersion"}';

      const result = JsonRpcHandler.parseRequest(line);

      expect(result.success).toBe(false);
      expect(result.error?.error?.code).toBe(-32600);
    });

    it("returns invalid request when method is missing", () => {
      const line = '{"id":1}';

      const result = JsonRpcHandler.parseRequest(line);

      expect(result.success).toBe(false);
      expect(result.error?.error?.code).toBe(-32600);
    });

    it("returns invalid request for non-string/number id", () => {
      const line = '{"id":{},"method":"getVersion"}';

      const result = JsonRpcHandler.parseRequest(line);

      expect(result.success).toBe(false);
      expect(result.error?.error?.code).toBe(-32600);
    });

    it("returns invalid request for non-string method", () => {
      const line = '{"id":1,"method":123}';

      const result = JsonRpcHandler.parseRequest(line);

      expect(result.success).toBe(false);
      expect(result.error?.error?.code).toBe(-32600);
    });

    it("returns invalid params for non-object params", () => {
      const line = '{"id":1,"method":"test","params":"string"}';

      const result = JsonRpcHandler.parseRequest(line);

      expect(result.success).toBe(false);
      expect(result.error?.error?.code).toBe(-32602);
    });
  });

  describe("formatResponse", () => {
    it("formats a success response with numeric id", () => {
      const response = JsonRpcHandler.formatResponse(1, { version: "0.1.0" });

      expect(response).toEqual({
        id: 1,
        result: { version: "0.1.0" },
      });
    });

    it("formats a success response with string id", () => {
      const response = JsonRpcHandler.formatResponse("abc", { success: true });

      expect(response).toEqual({
        id: "abc",
        result: { success: true },
      });
    });

    it("uses 0 as default id when null", () => {
      const response = JsonRpcHandler.formatResponse(null, "result");

      expect(response.id).toBe(0);
    });
  });

  describe("formatError", () => {
    it("formats an error response", () => {
      const response = JsonRpcHandler.formatError(
        1,
        -32601,
        "Method not found",
      );

      expect(response).toEqual({
        id: 1,
        error: { code: -32601, message: "Method not found" },
      });
    });

    it("uses 0 as default id when null", () => {
      const response = JsonRpcHandler.formatError(null, -32700, "Parse error");

      expect(response.id).toBe(0);
    });
  });

  describe("error code constants", () => {
    it("exposes standard JSON-RPC error codes", () => {
      expect(JsonRpcHandler.ERROR_PARSE).toBe(-32700);
      expect(JsonRpcHandler.ERROR_INVALID_REQUEST).toBe(-32600);
      expect(JsonRpcHandler.ERROR_METHOD_NOT_FOUND).toBe(-32601);
      expect(JsonRpcHandler.ERROR_INVALID_PARAMS).toBe(-32602);
    });
  });
});
