/**
 * ServeCommand
 * JSON-RPC server for VS Code extension communication
 *
 * Phase 2b (ADR-060): Uses the full Transpiler for transpilation and symbol
 * extraction, enabling include resolution, C++ auto-detection, and cross-file
 * symbol support.
 */

import { createInterface, Interface } from "node:readline";
import { dirname } from "node:path";
import JsonRpcHandler from "./JsonRpcHandler";
import IJsonRpcRequest from "./types/IJsonRpcRequest";
import IJsonRpcResponse from "./types/IJsonRpcResponse";
import ConfigPrinter from "../ConfigPrinter";
import ConfigLoader from "../ConfigLoader";
import Transpiler from "../../transpiler/Transpiler";
import CNextSourceParser from "../../transpiler/logic/parser/CNextSourceParser";
import CNextResolver from "../../transpiler/logic/symbols/cnext";
import TSymbolAdapter from "../../transpiler/logic/symbols/cnext/adapters/TSymbolAdapter";
import SymbolTable from "../../transpiler/logic/symbols/SymbolTable";
import ESymbolKind from "../../utils/types/ESymbolKind";
import ISymbolInfo from "../../lib/types/ISymbolInfo";
import TSymbolKind from "../../lib/types/TSymbolKind";

/**
 * Method handler type (async to support Transpiler.transpileSource)
 */
type MethodHandler = (
  params?: Record<string, unknown>,
) => Promise<IMethodResult>;

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
 * Options for the serve command
 */
interface IServeOptions {
  /** Enable debug logging to stderr */
  debug?: boolean;
}

/**
 * Map ESymbolKind to TSymbolKind for extension use
 */
function mapSymbolKind(kind: ESymbolKind): TSymbolKind {
  switch (kind) {
    case ESymbolKind.Namespace:
      return "namespace";
    case ESymbolKind.Struct:
      return "struct";
    case ESymbolKind.Register:
      return "register";
    case ESymbolKind.Function:
      return "function";
    case ESymbolKind.Variable:
      return "variable";
    case ESymbolKind.RegisterMember:
      return "registerMember";
    case ESymbolKind.Enum:
      return "enum";
    case ESymbolKind.EnumMember:
      return "enumMember";
    case ESymbolKind.Bitmap:
      return "bitmap";
    case ESymbolKind.BitmapField:
      return "bitmapField";
    default:
      return "variable";
  }
}

/**
 * Extract local name from full qualified name
 * e.g., "LED_toggle" with parent "LED" -> "toggle"
 */
function extractLocalName(fullName: string, parent?: string): string {
  if (parent && fullName.startsWith(parent + "_")) {
    return fullName.substring(parent.length + 1);
  }
  return fullName;
}

/**
 * JSON-RPC server command
 */
class ServeCommand {
  private static shouldShutdown = false;
  private static readline: Interface | null = null;
  private static debugMode = false;
  private static transpiler: Transpiler | null = null;

  /**
   * Method handlers registry
   */
  private static readonly methods: Record<string, MethodHandler> = {
    getVersion: ServeCommand.handleGetVersion,
    initialize: ServeCommand.handleInitialize,
    transpile: ServeCommand.handleTranspile,
    parseSymbols: ServeCommand.handleParseSymbols,
    shutdown: ServeCommand.handleShutdown,
  };

  /**
   * Run the JSON-RPC server
   * Reads requests from stdin, writes responses to stdout
   * @param options - Server options
   */
  static async run(options: IServeOptions = {}): Promise<void> {
    this.debugMode = options.debug ?? false;
    this.shouldShutdown = false;

    this.log("server starting");

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
        this.log("server stopped");
        resolve();
      });
    });
  }

  /**
   * Log a debug message to stderr
   */
  private static log(message: string): void {
    if (this.debugMode) {
      process.stderr.write(`[serve] ${message}\n`);
    }
  }

  /**
   * Handle a single line of input
   */
  private static handleLine(line: string): void {
    // Skip empty lines
    if (line.trim() === "") {
      return;
    }

    this.log(`received: ${line}`);

    // Parse the request
    const parseResult = JsonRpcHandler.parseRequest(line);

    if (!parseResult.success) {
      this.log(`parse error`);
      this.writeResponse(parseResult.error!);
      return;
    }

    const request = parseResult.request!;
    this.log(`method: ${request.method}`);

    // Dispatch to method handler (async)
    this.dispatch(request).then((response) => {
      this.writeResponse(response);

      // Handle shutdown after response is written
      if (this.shouldShutdown) {
        this.readline?.close();
      }
    });
  }

  /**
   * Dispatch a request to the appropriate handler
   */
  private static async dispatch(
    request: IJsonRpcRequest,
  ): Promise<IJsonRpcResponse> {
    const handler = this.methods[request.method];

    if (!handler) {
      return JsonRpcHandler.formatError(
        request.id,
        JsonRpcHandler.ERROR_METHOD_NOT_FOUND,
        `Method not found: ${request.method}`,
      );
    }

    const result = await handler(request.params);

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
  private static async handleGetVersion(): Promise<IMethodResult> {
    return {
      success: true,
      result: { version: ConfigPrinter.getVersion() },
    };
  }

  /**
   * Handle initialize method
   * Loads project config and creates a Transpiler instance
   */
  private static async handleInitialize(
    params?: Record<string, unknown>,
  ): Promise<IMethodResult> {
    if (!params || typeof params.workspacePath !== "string") {
      return {
        success: false,
        errorCode: JsonRpcHandler.ERROR_INVALID_PARAMS,
        errorMessage: "Missing required param: workspacePath",
      };
    }

    const workspacePath = params.workspacePath as string;
    ServeCommand.log(`initializing with workspace: ${workspacePath}`);

    const config = ConfigLoader.load(workspacePath);

    ServeCommand.transpiler = new Transpiler({
      inputs: [],
      includeDirs: config.include ?? [],
      cppRequired: config.cppRequired ?? false,
      target: config.target ?? "",
      debugMode: config.debugMode ?? false,
      noCache: config.noCache ?? false,
    });

    ServeCommand.log(
      `initialized (cppRequired=${config.cppRequired ?? false}, includeDirs=${(config.include ?? []).length})`,
    );

    return {
      success: true,
      result: { success: true },
    };
  }

  /**
   * Handle transpile method
   * Uses full Transpiler for include resolution and C++ auto-detection
   */
  private static async handleTranspile(
    params?: Record<string, unknown>,
  ): Promise<IMethodResult> {
    if (!params || typeof params.source !== "string") {
      return {
        success: false,
        errorCode: JsonRpcHandler.ERROR_INVALID_PARAMS,
        errorMessage: "Missing required param: source",
      };
    }

    if (!ServeCommand.transpiler) {
      return {
        success: false,
        errorCode: JsonRpcHandler.ERROR_INVALID_PARAMS,
        errorMessage: "Server not initialized. Call initialize first.",
      };
    }

    const source = params.source as string;
    const filePath =
      typeof params.filePath === "string" ? params.filePath : undefined;

    const options = filePath
      ? { workingDir: dirname(filePath), sourcePath: filePath }
      : undefined;

    const result = await ServeCommand.transpiler.transpileSource(
      source,
      options,
    );

    return {
      success: true,
      result: {
        success: result.success,
        code: result.code,
        errors: result.errors,
        cppDetected: ServeCommand.transpiler.isCppDetected(),
      },
    };
  }

  /**
   * Handle parseSymbols method
   * Runs full transpilation for include/C++ detection, then extracts symbols
   * from the parse tree (preserving "extract symbols even with parse errors" behavior)
   */
  private static async handleParseSymbols(
    params?: Record<string, unknown>,
  ): Promise<IMethodResult> {
    if (!params || typeof params.source !== "string") {
      return {
        success: false,
        errorCode: JsonRpcHandler.ERROR_INVALID_PARAMS,
        errorMessage: "Missing required param: source",
      };
    }

    const source = params.source as string;
    const filePath =
      typeof params.filePath === "string" ? params.filePath : undefined;

    // If transpiler is initialized, run transpileSource to trigger header
    // resolution and C++ detection (results are discarded, we just want
    // the side effects on the symbol table)
    if (ServeCommand.transpiler && filePath) {
      try {
        await ServeCommand.transpiler.transpileSource(source, {
          workingDir: dirname(filePath),
          sourcePath: filePath,
        });
      } catch {
        // Ignore transpilation errors - we still extract symbols below
      }
    }

    // Extract symbols from the parse tree (works even with parse errors)
    const { tree, errors } = CNextSourceParser.parse(source);
    const tSymbols = CNextResolver.resolve(tree, "<source>");
    const symbolTable = new SymbolTable();
    const rawSymbols = TSymbolAdapter.toISymbols(tSymbols, symbolTable);

    const symbols: ISymbolInfo[] = rawSymbols.map((sym) => ({
      name: extractLocalName(sym.name, sym.parent),
      fullName: sym.name,
      kind: mapSymbolKind(sym.kind),
      type: sym.type,
      parent: sym.parent,
      signature: sym.signature,
      accessModifier: sym.accessModifier,
      line: sym.sourceLine,
      size: sym.size,
    }));

    return {
      success: true,
      result: {
        success: errors.length === 0,
        errors,
        symbols,
      },
    };
  }

  /**
   * Handle shutdown method
   */
  private static async handleShutdown(): Promise<IMethodResult> {
    ServeCommand.shouldShutdown = true;
    return {
      success: true,
      result: { success: true },
    };
  }
}

export default ServeCommand;
