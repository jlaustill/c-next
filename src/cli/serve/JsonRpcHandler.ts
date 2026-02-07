/**
 * JSON-RPC protocol utilities for the serve command
 */

import IJsonRpcRequest from "./types/IJsonRpcRequest";
import IJsonRpcResponse from "./types/IJsonRpcResponse";

/** Standard JSON-RPC error codes */
const ERROR_PARSE = -32700;
const ERROR_INVALID_REQUEST = -32600;
const ERROR_METHOD_NOT_FOUND = -32601;
const ERROR_INVALID_PARAMS = -32602;

/**
 * Result of parsing a JSON-RPC request
 */
interface IParseResult {
  success: boolean;
  request?: IJsonRpcRequest;
  error?: IJsonRpcResponse;
}

/**
 * JSON-RPC protocol handler
 */
class JsonRpcHandler {
  /** Parse error code */
  static readonly ERROR_PARSE = ERROR_PARSE;
  /** Invalid request code */
  static readonly ERROR_INVALID_REQUEST = ERROR_INVALID_REQUEST;
  /** Method not found code */
  static readonly ERROR_METHOD_NOT_FOUND = ERROR_METHOD_NOT_FOUND;
  /** Invalid params code */
  static readonly ERROR_INVALID_PARAMS = ERROR_INVALID_PARAMS;

  /**
   * Parse a JSON-RPC request from a line of input
   * @param line - Raw input line
   * @returns Parse result with request or error response
   */
  static parseRequest(line: string): IParseResult {
    // Try to parse JSON
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      return {
        success: false,
        error: this.formatError(null, ERROR_PARSE, "Parse error"),
      };
    }

    // Validate structure
    if (typeof parsed !== "object" || parsed === null) {
      return {
        success: false,
        error: this.formatError(null, ERROR_INVALID_REQUEST, "Invalid request"),
      };
    }

    const obj = parsed as Record<string, unknown>;

    // Check for required fields
    if (!("id" in obj) || !("method" in obj)) {
      return {
        success: false,
        error: this.formatError(null, ERROR_INVALID_REQUEST, "Invalid request"),
      };
    }

    // Validate id type
    const id = obj.id;
    if (typeof id !== "number" && typeof id !== "string") {
      return {
        success: false,
        error: this.formatError(null, ERROR_INVALID_REQUEST, "Invalid request"),
      };
    }

    // Validate method type
    const method = obj.method;
    if (typeof method !== "string") {
      return {
        success: false,
        error: this.formatError(id, ERROR_INVALID_REQUEST, "Invalid request"),
      };
    }

    // Validate params if present
    const params = obj.params;
    if (
      params !== undefined &&
      (typeof params !== "object" || params === null)
    ) {
      return {
        success: false,
        error: this.formatError(id, ERROR_INVALID_PARAMS, "Invalid params"),
      };
    }

    return {
      success: true,
      request: {
        id,
        method,
        params: params as Record<string, unknown> | undefined,
      },
    };
  }

  /**
   * Format a success response
   * @param id - Request identifier
   * @param result - Result value
   * @returns JSON-RPC response object
   */
  static formatResponse(
    id: number | string | null,
    result: unknown,
  ): IJsonRpcResponse {
    return {
      id: id ?? 0,
      result,
    };
  }

  /**
   * Format an error response
   * @param id - Request identifier (null if unknown)
   * @param code - Error code
   * @param message - Error message
   * @param data - Optional additional error context
   * @returns JSON-RPC response object
   */
  static formatError(
    id: number | string | null,
    code: number,
    message: string,
    data?: unknown,
  ): IJsonRpcResponse {
    const error: { code: number; message: string; data?: unknown } = {
      code,
      message,
    };
    if (data !== undefined) {
      error.data = data;
    }
    return {
      id: id ?? 0,
      error,
    };
  }
}

export default JsonRpcHandler;
