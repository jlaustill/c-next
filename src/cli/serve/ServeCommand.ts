/**
 * ServeCommand
 * JSON-RPC server for VS Code extension communication
 */

import { createInterface, Interface } from "node:readline";
import JsonRpcHandler from "./JsonRpcHandler";
import IJsonRpcRequest from "./types/IJsonRpcRequest";
import IJsonRpcResponse from "./types/IJsonRpcResponse";
import ConfigPrinter from "../ConfigPrinter";
import transpile from "../../lib/transpiler";
import parseWithSymbols from "../../lib/parseWithSymbols";

/**
 * Method handler type
 */
type MethodHandler = (params?: Record<string, unknown>) => IMethodResult;

/**
 * Result from a method handler
 */
interface IMethodResult {
  success: boolean;
  result?: unknown;
  errorCode?: number;
  errorMessage?: string;
}

/**
 * JSON-RPC server command
 */
class ServeCommand {
  private static shouldShutdown = false;
  private static readline: Interface | null = null;

  /**
   * Method handlers registry
   */
  private static readonly methods: Record<string, MethodHandler> = {
    getVersion: ServeCommand.handleGetVersion,
    transpile: ServeCommand.handleTranspile,
    parseSymbols: ServeCommand.handleParseSymbols,
    shutdown: ServeCommand.handleShutdown,
  };

  /**
   * Run the JSON-RPC server
   * Reads requests from stdin, writes responses to stdout
   */
  static async run(): Promise<void> {
    this.readline = createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false,
    });

    // Disable default output - we write responses manually
    this.readline.on("line", (line: string) => {
      this.handleLine(line);
    });

    // Wait for close or shutdown
    await new Promise<void>((resolve) => {
      this.readline!.on("close", () => {
        resolve();
      });
    });
  }

  /**
   * Handle a single line of input
   */
  private static handleLine(line: string): void {
    // Skip empty lines
    if (line.trim() === "") {
      return;
    }

    // Parse the request
    const parseResult = JsonRpcHandler.parseRequest(line);

    if (!parseResult.success) {
      this.writeResponse(parseResult.error!);
      return;
    }

    const request = parseResult.request!;

    // Dispatch to method handler
    const response = this.dispatch(request);
    this.writeResponse(response);

    // Handle shutdown after response is written
    if (this.shouldShutdown) {
      this.readline?.close();
    }
  }

  /**
   * Dispatch a request to the appropriate handler
   */
  private static dispatch(request: IJsonRpcRequest): IJsonRpcResponse {
    const handler = this.methods[request.method];

    if (!handler) {
      return JsonRpcHandler.formatError(
        request.id,
        JsonRpcHandler.ERROR_METHOD_NOT_FOUND,
        `Method not found: ${request.method}`,
      );
    }

    const result = handler(request.params);

    if (result.success) {
      return JsonRpcHandler.formatResponse(request.id, result.result);
    }

    return JsonRpcHandler.formatError(
      request.id,
      result.errorCode ?? JsonRpcHandler.ERROR_INVALID_PARAMS,
      result.errorMessage ?? "Unknown error",
    );
  }

  /**
   * Write a JSON response to stdout
   */
  private static writeResponse(response: IJsonRpcResponse): void {
    process.stdout.write(JSON.stringify(response) + "\n");
  }

  /**
   * Handle getVersion method
   */
  private static handleGetVersion(): IMethodResult {
    return {
      success: true,
      result: { version: ConfigPrinter.getVersion() },
    };
  }

  /**
   * Handle transpile method
   */
  private static handleTranspile(
    params?: Record<string, unknown>,
  ): IMethodResult {
    if (!params || typeof params.source !== "string") {
      return {
        success: false,
        errorCode: JsonRpcHandler.ERROR_INVALID_PARAMS,
        errorMessage: "Missing required param: source",
      };
    }

    const result = transpile(params.source);

    return {
      success: true,
      result: {
        success: result.success,
        code: result.code,
        errors: result.errors,
      },
    };
  }

  /**
   * Handle parseSymbols method
   */
  private static handleParseSymbols(
    params?: Record<string, unknown>,
  ): IMethodResult {
    if (!params || typeof params.source !== "string") {
      return {
        success: false,
        errorCode: JsonRpcHandler.ERROR_INVALID_PARAMS,
        errorMessage: "Missing required param: source",
      };
    }

    const result = parseWithSymbols(params.source);

    return {
      success: true,
      result: {
        success: result.success,
        errors: result.errors,
        symbols: result.symbols,
      },
    };
  }

  /**
   * Handle shutdown method
   */
  private static handleShutdown(): IMethodResult {
    ServeCommand.shouldShutdown = true;
    return {
      success: true,
      result: { success: true },
    };
  }
}

export default ServeCommand;
