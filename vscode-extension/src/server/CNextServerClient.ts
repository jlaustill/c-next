/**
 * CNextServerClient
 * Manages communication with the cnext --serve JSON-RPC server
 */

import { spawn, ChildProcess } from "node:child_process";
import { createInterface, Interface } from "node:readline";
import * as path from "node:path";
import * as fs from "node:fs";
import * as vscode from "vscode";

/**
 * Transpile result from server
 */
export interface ITranspileResult {
  success: boolean;
  code: string;
  errors: Array<{
    line: number;
    column: number;
    message: string;
    severity: "error" | "warning";
  }>;
}

/**
 * Symbol info from server
 */
export interface ISymbolInfo {
  name: string;
  fullName: string;
  kind: string;
  type?: string;
  parent?: string;
  signature?: string;
  accessModifier?: string;
  line?: number;
  size?: number;
}

/**
 * Parse symbols result from server
 */
export interface IParseSymbolsResult {
  success: boolean;
  errors: Array<{
    line: number;
    column: number;
    message: string;
    severity: "error" | "warning";
  }>;
  symbols: ISymbolInfo[];
}

/**
 * Pending request tracker
 */
interface IPendingRequest {
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

/**
 * Server client for cnext --serve
 */
class CNextServerClient {
  private process: ChildProcess | null = null;
  private readline: Interface | null = null;
  private requestId = 0;
  private pendingRequests: Map<number, IPendingRequest> = new Map();
  private outputChannel: vscode.OutputChannel;
  private isStarting = false;
  private hasRestarted = false;
  private serverPath: string = "";

  constructor(outputChannel: vscode.OutputChannel) {
    this.outputChannel = outputChannel;
  }

  /**
   * Start the server process
   */
  async start(): Promise<boolean> {
    if (this.process || this.isStarting) {
      return true;
    }

    this.isStarting = true;

    try {
      const serverPath = this.findServerBinary();
      if (!serverPath) {
        this.outputChannel.appendLine(
          "C-Next server not found. Install with: npm i -g @jlaustill/cnext",
        );
        vscode.window.showWarningMessage(
          "C-Next server not found. Install with: npm i -g @jlaustill/cnext",
        );
        return false;
      }

      this.serverPath = serverPath;
      this.outputChannel.appendLine(`Starting C-Next server: ${serverPath}`);

      // Check if this is a TypeScript file (development mode)
      const args = ["--serve"];
      let command = serverPath;

      if (serverPath.endsWith(".ts")) {
        // Development mode: use tsx to run TypeScript
        command = "npx";
        args.unshift("tsx", serverPath);
      }

      this.process = spawn(command, args, {
        stdio: ["pipe", "pipe", "pipe"],
        shell: false,
      });

      // Set up readline for stdout
      this.readline = createInterface({
        input: this.process.stdout!,
        terminal: false,
      });

      this.readline.on("line", (line) => this.handleResponse(line));

      // Log stderr for debugging
      this.process.stderr?.on("data", (data) => {
        this.outputChannel.appendLine(
          `[server stderr] ${data.toString().trim()}`,
        );
      });

      // Handle process exit
      this.process.on("exit", (code, signal) => {
        this.outputChannel.appendLine(
          `C-Next server exited (code: ${code}, signal: ${signal})`,
        );
        this.cleanup();

        // Auto-restart once on crash
        if (code !== 0 && !this.hasRestarted) {
          this.hasRestarted = true;
          this.outputChannel.appendLine("Attempting to restart server...");
          setTimeout(() => this.start(), 1000);
        } else if (code !== 0) {
          vscode.window.showErrorMessage(
            "C-Next server crashed. Please check the output channel for details.",
          );
        }
      });

      this.process.on("error", (err) => {
        this.outputChannel.appendLine(`Server error: ${err.message}`);
        this.cleanup();
      });

      // Verify server is responsive
      const version = await this.getVersion();
      if (version) {
        this.outputChannel.appendLine(`C-Next server v${version} started`);
        this.isStarting = false;
        this.hasRestarted = false; // Reset so future crashes can trigger restart
        return true;
      }

      this.outputChannel.appendLine("Server did not respond to getVersion");
      this.stop();
      return false;
    } catch (err) {
      this.outputChannel.appendLine(
        `Failed to start server: ${err instanceof Error ? err.message : String(err)}`,
      );
      this.isStarting = false;
      return false;
    }
  }

  /**
   * Stop the server process
   */
  async stop(): Promise<void> {
    if (!this.process) {
      return;
    }

    try {
      await this.sendRequest("shutdown", {});
    } catch {
      // Ignore shutdown errors
    }

    // Give the process a moment to exit gracefully
    await new Promise((resolve) => setTimeout(resolve, 100));

    if (this.process) {
      this.process.kill();
    }

    this.cleanup();
  }

  /**
   * Check if server is running
   */
  isRunning(): boolean {
    return this.process !== null && !this.process.killed;
  }

  /**
   * Get server version
   */
  async getVersion(): Promise<string | null> {
    try {
      const result = (await this.sendRequest("getVersion", {})) as {
        version: string;
      };
      return result.version;
    } catch {
      return null;
    }
  }

  /**
   * Transpile C-Next source code
   */
  async transpile(source: string): Promise<ITranspileResult> {
    const result = (await this.sendRequest("transpile", {
      source,
    })) as ITranspileResult;
    return result;
  }

  /**
   * Parse symbols from C-Next source
   */
  async parseSymbols(source: string): Promise<IParseSymbolsResult> {
    const result = (await this.sendRequest("parseSymbols", {
      source,
    })) as IParseSymbolsResult;
    return result;
  }

  /**
   * Find the cnext binary
   */
  private findServerBinary(): string | null {
    const config = vscode.workspace.getConfiguration("cnext");
    const customPath = config.get<string>("serverPath", "");

    // 1. Check custom path from settings
    if (customPath && fs.existsSync(customPath)) {
      return customPath;
    }

    // 2. Check workspace node_modules
    const workspaceFolders = vscode.workspace.workspaceFolders;
    const binName = process.platform === "win32" ? "cnext.cmd" : "cnext";
    if (workspaceFolders) {
      for (const folder of workspaceFolders) {
        const localPath = path.join(
          folder.uri.fsPath,
          "node_modules",
          ".bin",
          binName,
        );
        if (fs.existsSync(localPath)) {
          return localPath;
        }
      }
    }

    // 3. Check if we're in development mode (running from source)
    const devPath = path.join(__dirname, "..", "..", "..", "src", "index.ts");
    if (fs.existsSync(devPath)) {
      return devPath;
    }

    // 4. Fall back to global cnext (assumes it's in PATH)
    // We'll verify it exists by trying to spawn it
    return "cnext";
  }

  /**
   * Send a JSON-RPC request
   */
  private sendRequest(
    method: string,
    params: Record<string, unknown>,
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.process || !this.process.stdin) {
        reject(new Error("Server not running"));
        return;
      }

      const id = ++this.requestId;
      const config = vscode.workspace.getConfiguration("cnext");
      const timeout = config.get<number>("serverTimeout", 30000);

      // Set up timeout
      const timer = setTimeout(() => {
        const pending = this.pendingRequests.get(id);
        if (pending) {
          this.pendingRequests.delete(id);
          reject(new Error(`Request ${method} timed out after ${timeout}ms`));
        }
      }, timeout);

      // Store pending request
      this.pendingRequests.set(id, { resolve, reject, timer });

      // Send request
      const request = JSON.stringify({ id, method, params });
      this.process.stdin.write(request + "\n");
    });
  }

  /**
   * Handle a response line from the server
   */
  private handleResponse(line: string): void {
    try {
      const response = JSON.parse(line) as {
        id: number;
        result?: unknown;
        error?: { code: number; message: string };
      };

      const pending = this.pendingRequests.get(response.id);
      if (!pending) {
        this.outputChannel.appendLine(
          `Received response for unknown request: ${response.id}`,
        );
        return;
      }

      this.pendingRequests.delete(response.id);
      clearTimeout(pending.timer);

      if (response.error) {
        pending.reject(new Error(response.error.message));
      } else {
        pending.resolve(response.result);
      }
    } catch (err) {
      this.outputChannel.appendLine(`Failed to parse response: ${line}`);
    }
  }

  /**
   * Clean up resources
   */
  private cleanup(): void {
    // Reject all pending requests
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(new Error("Server stopped"));
      this.pendingRequests.delete(id);
    }

    if (this.readline) {
      this.readline.close();
      this.readline = null;
    }

    this.process = null;
    this.isStarting = false;
  }
}

export default CNextServerClient;
