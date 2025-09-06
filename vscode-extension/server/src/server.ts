import {
  createConnection,
  TextDocuments,
  Diagnostic,
  DiagnosticSeverity,
  ProposedFeatures,
  InitializeParams,
  DidChangeConfigurationNotification,
  CompletionItem,
  CompletionItemKind,
  TextDocumentPositionParams,
  TextDocumentSyncKind,
  InitializeResult,
  DocumentDiagnosticReportKind,
  type DocumentDiagnosticReport
} from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';
import { CNextParser } from './parser/CNextParser';
import { CNextDiagnosticProvider } from './diagnostics/DiagnosticProvider';
import { CNextCompletionProvider } from './completion/CompletionProvider';
import { SymbolTable } from './semantic/SymbolTable';

// Create connection and text document manager
const connection = createConnection(ProposedFeatures.all);
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

// Configuration and capabilities
let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;

// Language service components
const parser = new CNextParser();
const symbolTable = new SymbolTable();
const diagnosticProvider = new CNextDiagnosticProvider(parser, symbolTable);
const completionProvider = new CNextCompletionProvider(parser, symbolTable);

connection.onInitialize((params: InitializeParams) => {
  const capabilities = params.capabilities;

  // Check client capabilities
  hasConfigurationCapability = !!(
    capabilities.workspace && !!capabilities.workspace.configuration
  );
  hasWorkspaceFolderCapability = !!(
    capabilities.workspace && !!capabilities.workspace.workspaceFolders
  );
  hasDiagnosticRelatedInformationCapability = !!(
    capabilities.textDocument &&
    capabilities.textDocument.publishDiagnostics &&
    capabilities.textDocument.publishDiagnostics.relatedInformation
  );

  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      // Tell the client that this server supports code completion
      completionProvider: {
        resolveProvider: true,
        triggerCharacters: ['.', '-', '>', '<']
      },
      // Support document diagnostics
      diagnosticProvider: {
        interFileDependencies: false,
        workspaceDiagnostics: false
      },
      // Support hover information
      hoverProvider: true,
      // Support go to definition
      definitionProvider: true,
      // Support document symbols
      documentSymbolProvider: true
    }
  };

  if (hasWorkspaceFolderCapability) {
    result.capabilities.workspace = {
      workspaceFolders: {
        supported: true
      }
    };
  }

  return result;
});

connection.onInitialized(() => {
  if (hasConfigurationCapability) {
    // Register for all configuration changes
    connection.client.register(DidChangeConfigurationNotification.type, undefined);
  }
  if (hasWorkspaceFolderCapability) {
    connection.workspace.onDidChangeWorkspaceFolders(_event => {
      connection.console.log('Workspace folder change event received.');
    });
  }
});

// Configuration interface
interface CNextSettings {
  maxNumberOfProblems: number;
  enableDiagnostics: boolean;
  transpilerPath?: string;
}

// Default settings
const defaultSettings: CNextSettings = {
  maxNumberOfProblems: 1000,
  enableDiagnostics: true
};
let globalSettings: CNextSettings = defaultSettings;

// Cache settings per document
const documentSettings: Map<string, Thenable<CNextSettings>> = new Map();

connection.onDidChangeConfiguration(change => {
  if (hasConfigurationCapability) {
    // Reset all cached document settings
    documentSettings.clear();
  } else {
    globalSettings = <CNextSettings>(
      (change.settings.cnextLanguageServer || defaultSettings)
    );
  }

  // Revalidate all open text documents
  documents.all().forEach(validateTextDocument);
});

function getDocumentSettings(resource: string): Thenable<CNextSettings> {
  if (!hasConfigurationCapability) {
    return Promise.resolve(globalSettings);
  }
  let result = documentSettings.get(resource);
  if (!result) {
    result = connection.workspace.getConfiguration({
      scopeUri: resource,
      section: 'cnextLanguageServer'
    });
    documentSettings.set(resource, result);
  }
  return result;
}

// Only keep settings for open documents
documents.onDidClose(e => {
  documentSettings.delete(e.document.uri);
});

// Document change handler
documents.onDidChangeContent(change => {
  validateTextDocument(change.document);
});

// Diagnostic validation
async function validateTextDocument(textDocument: TextDocument): Promise<void> {
  const settings = await getDocumentSettings(textDocument.uri);
  
  if (!settings.enableDiagnostics) {
    return;
  }

  try {
    const diagnostics = await diagnosticProvider.getDiagnostics(textDocument);
    
    // Limit the number of problems
    const limitedDiagnostics = diagnostics.slice(0, settings.maxNumberOfProblems);
    
    // Send the computed diagnostics to VSCode
    connection.sendDiagnostics({ 
      uri: textDocument.uri, 
      diagnostics: limitedDiagnostics 
    });
  } catch (error) {
    connection.console.error(`Error validating document ${textDocument.uri}: ${error}`);
  }
}

// Completion handler
connection.onCompletion(
  async (textDocumentPosition: TextDocumentPositionParams): Promise<CompletionItem[]> => {
    const document = documents.get(textDocumentPosition.textDocument.uri);
    if (!document) {
      return [];
    }

    try {
      return await completionProvider.getCompletions(document, textDocumentPosition.position);
    } catch (error) {
      connection.console.error(`Error providing completions: ${error}`);
      return [];
    }
  }
);

// Completion resolve handler
connection.onCompletionResolve(
  (item: CompletionItem): CompletionItem => {
    // Add additional information to completion items
    return item;
  }
);

// Hover handler
connection.onHover(async (params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) {
    return null;
  }

  try {
    // TODO: Implement hover provider
    return null;
  } catch (error) {
    connection.console.error(`Error providing hover: ${error}`);
    return null;
  }
});

// Document diagnostic handler
connection.languages.diagnostics.on(async (params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) {
    return {
      kind: DocumentDiagnosticReportKind.Full,
      items: []
    } satisfies DocumentDiagnosticReport;
  }

  const diagnostics = await diagnosticProvider.getDiagnostics(document);
  return {
    kind: DocumentDiagnosticReportKind.Full,
    items: diagnostics
  } satisfies DocumentDiagnosticReport;
});

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();

// Log server start
connection.onInitialize(() => {
  connection.console.log('c-next Language Server started');
  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental
    }
  };
});