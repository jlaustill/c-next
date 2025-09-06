import * as path from 'path';
import { workspace, ExtensionContext } from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind
} from 'vscode-languageclient/node';

let client: LanguageClient;

export function activate(context: ExtensionContext) {
  console.log('[EXTENSION] c-next extension activating...');
  
  // Debug: Check what language ID VSCode assigns to our files
  workspace.onDidOpenTextDocument((document) => {
    if (document.fileName.endsWith('.cn') || document.fileName.endsWith('.cnm')) {
      console.log(`[EXTENSION] Opened file: ${document.fileName}`);
      console.log(`[EXTENSION] Language ID: ${document.languageId}`);
      console.log(`[EXTENSION] URI scheme: ${document.uri.scheme}`);
    }
  });
  // The server is implemented in node
  const serverModule = context.asAbsolutePath(
    path.join('server', 'out', 'server.js')
  );
  
  // If the extension is launched in debug mode then the debug server options are used
  // Otherwise the run options are used
  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
    }
  };

  // Options to control the language client
  const clientOptions: LanguageClientOptions = {
    // Register the server for c-next documents
    documentSelector: [
      { scheme: 'file', language: 'cnext' },
      { scheme: 'file', pattern: '**/*.cn' },
      { scheme: 'file', pattern: '**/*.cnm' }
    ],
    synchronize: {
      // Notify the server about file changes to '.clientrc files contained in the workspace
      fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
    },
    // Configuration section name
    initializationOptions: {
      settings: {
        cnextLanguageServer: {
          maxNumberOfProblems: 1000,
          enableDiagnostics: true
        }
      }
    },
    // Add middleware to debug what's happening
    middleware: {
      provideCompletionItem: (document, position, context, token, next) => {
        console.log('[CLIENT] provideCompletionItem called for:', document.uri.toString());
        console.log('[CLIENT] File extension:', document.uri.fsPath.split('.').pop());
        console.log('[CLIENT] Language ID:', document.languageId);
        return next(document, position, context, token);
      }
    }
  };

  // Create the language client and start the client.
  client = new LanguageClient(
    'cnextLanguageServer',
    'c-next Language Server',
    serverOptions,
    clientOptions
  );

  // Start the client. This will also launch the server
  client.start();

  console.log('c-next Language Client activated successfully');
  console.log('Document selector:', JSON.stringify(clientOptions.documentSelector));
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}