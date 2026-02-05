import * as vscode from "vscode";

/**
 * Shared extension context
 * Replaces exported module-level globals with an injectable object
 */
export default class CNextExtensionContext {
  readonly outputChannel: vscode.OutputChannel;
  readonly lastGoodOutputPath: Map<string, string> = new Map();

  constructor(outputChannel: vscode.OutputChannel) {
    this.outputChannel = outputChannel;
  }

  debug(message: string): void {
    this.outputChannel.appendLine(message);
  }
}
