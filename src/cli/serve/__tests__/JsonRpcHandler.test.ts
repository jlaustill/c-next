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

    it.each([
      [
        "returns parse error for invalid JSON",
        "not valid json",
        32700,
        "Parse error",
      ],
      [
        "returns invalid request for non-object JSON",
        '"just a string"',
        32600,
        "Invalid request",
      ],
      [
        "returns invalid request for null JSON",
        "null",
        32600,
        "Invalid request",
      ],
    ])("%s", (_label, source, value2, source3) => {
      const line = source;

      const result = JsonRpcHandler.parseRequest(line);

      expect(result.success).toBe(false);
      expect(result.error).toEqual({
        id: 0,
        error: { code: -value2, message: source3 },
      });
    });

    it.each([
      [
        "returns invalid request when id is missing",
        '{"method":"getVersion"}',
        32600,
      ],
      ["returns invalid request when method is missing", '{"id":1}', 32600],
      [
        "returns invalid request for non-string/number id",
        '{"id":{},"method":"getVersion"}',
        32600,
      ],
      [
        "returns invalid request for non-string method",
        '{"id":1,"method":123}',
        32600,
      ],
      [
        "returns invalid params for non-object params",
        '{"id":1,"method":"test","params":"string"}',
        32602,
      ],
    ])("%s", (_label, source, expected) => {
      const line = source;

      const result = JsonRpcHandler.parseRequest(line);

      expect(result.success).toBe(false);
      expect(result.error?.error?.code).toBe(-expected);
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

    it("includes optional data field when provided", () => {
      const response = JsonRpcHandler.formatError(1, -32602, "Invalid params", {
        details: "source must be a string",
      });

      expect(response).toEqual({
        id: 1,
        error: {
          code: -32602,
          message: "Invalid params",
          data: { details: "source must be a string" },
        },
      });
    });

    it("omits data field when not provided", () => {
      const response = JsonRpcHandler.formatError(
        1,
        -32601,
        "Method not found",
      );

      expect(response.error).not.toHaveProperty("data");
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
