import * as vscode from "vscode";
import CNextServerClient from "./server/CNextServerClient";

/**
 * Shared extension context
 * Replaces exported module-level globals with an injectable object
 */
export default class CNextExtensionContext {
  readonly outputChannel: vscode.OutputChannel;
  readonly lastGoodOutputPath: Map<string, string> = new Map();
  serverClient: CNextServerClient | null = null;

  constructor(outputChannel: vscode.OutputChannel) {
    this.outputChannel = outputChannel;
  }

  /**
   * Set the server client
   */
  setServerClient(client: CNextServerClient): void {
    this.serverClient = client;
  }

  debug(message: string): void {
    this.outputChannel.appendLine(message);
  }
}
