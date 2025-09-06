import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  DidChangeConfigurationNotification,
  CompletionItem,
  TextDocumentPositionParams,
  TextDocumentSyncKind,
  InitializeResult,
  DocumentDiagnosticReportKind,
  type DocumentDiagnosticReport,
  DocumentSymbolParams,
  DocumentSymbol,
  SymbolKind
} from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';
import { CNextParser } from './parser/CNextParser';
import { CNextDiagnosticProvider } from './diagnostics/DiagnosticProvider';
import { CNextCompletionProvider } from './completion/CompletionProvider';
import { SymbolTable } from './semantic/SymbolTable';
import { CNextSymbolKind } from './types';

// Create connection and text document manager
const connection = createConnection(ProposedFeatures.all);
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

// Configuration and capabilities
let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;

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
  connection.console.log('c-next Language Server started successfully');
  
  if (hasConfigurationCapability) {
    // Register for all configuration changes
    connection.client.register(DidChangeConfigurationNotification.type, undefined);
  }
  if (hasWorkspaceFolderCapability) {
    connection.workspace.onDidChangeWorkspaceFolders((_event: any) => {
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
const documentSettings: Map<string, Promise<CNextSettings>> = new Map();

connection.onDidChangeConfiguration((change: any) => {
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

function getDocumentSettings(resource: string): Promise<CNextSettings> {
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
    return result;
  }
  return result;
}

// Only keep settings for open documents
documents.onDidClose((e: any) => {
  documentSettings.delete(e.document.uri);
});

// Document change handler
documents.onDidChangeContent((change: any) => {
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
connection.onHover(async (params: any) => {
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

// Document symbol handler
connection.onDocumentSymbol(async (params: DocumentSymbolParams): Promise<DocumentSymbol[]> => {
  const document = documents.get(params.textDocument.uri);
  if (!document) {
    return [];
  }

  try {
    const symbols = await parser.parseDocument(document, symbolTable);
    return symbols.map(symbol => ({
      name: symbol.name,
      detail: symbol.detail || symbol.type || '',
      kind: mapSymbolKind(symbol.kind),
      range: symbol.range,
      selectionRange: symbol.range,
      children: []
    }));
  } catch (error) {
    connection.console.error(`Error providing document symbols: ${error}`);
    return [];
  }
});

// Document diagnostic handler
connection.languages.diagnostics.on(async (params: any) => {
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

// Helper function to map c-next symbol kinds to LSP symbol kinds
function mapSymbolKind(cnextKind: CNextSymbolKind): SymbolKind {
  switch (cnextKind) {
    case CNextSymbolKind.Class:
      return SymbolKind.Class;
    case CNextSymbolKind.Function:
      return SymbolKind.Function;
    case CNextSymbolKind.Method:
      return SymbolKind.Method;
    case CNextSymbolKind.Variable:
      return SymbolKind.Variable;
    case CNextSymbolKind.Constant:
      return SymbolKind.Constant;
    case CNextSymbolKind.Property:
      return SymbolKind.Property;
    case CNextSymbolKind.Parameter:
      return SymbolKind.Variable;
    case CNextSymbolKind.Include:
      return SymbolKind.Module;
    case CNextSymbolKind.Import:
      return SymbolKind.Module;
    default:
      return SymbolKind.Variable;
  }
}

// Listen on the connection
connection.listen();

