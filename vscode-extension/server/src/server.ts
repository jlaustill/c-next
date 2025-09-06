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
  SymbolKind,
  DefinitionParams,
  Definition,
  Location
} from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';
import { CNextParser } from './parser/CNextParser';
import { CNextDiagnosticProvider } from './diagnostics/DiagnosticProvider';
import { CNextCompletionProvider } from './completion/CompletionProvider';
import { SymbolTable } from './semantic/SymbolTable';
import { CNextSymbolKind, CNextSymbol } from './types';

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
    connection.console.log(`[SERVER] Completion requested for URI: ${textDocumentPosition.textDocument.uri} at position ${textDocumentPosition.position.line}:${textDocumentPosition.position.character}`);
    
    const document = documents.get(textDocumentPosition.textDocument.uri);
    if (!document) {
      connection.console.log('[SERVER] Document not found in documents cache');
      return [];
    }

    try {
      const completions = await completionProvider.getCompletions(document, textDocumentPosition.position);
      connection.console.log(`[SERVER] Returning ${completions.length} completions`);
      return completions;
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

// Go-to-definition handler
connection.onDefinition(async (params: DefinitionParams): Promise<Definition | null> => {
  const document = documents.get(params.textDocument.uri);
  if (!document) {
    return null;
  }

  try {
    // Get the word at the cursor position
    const text = document.getText();
    const lines = text.split('\n');
    const line = lines[params.position.line];
    const position = params.position.character;
    
    // Extract the symbol at the cursor position
    const symbolInfo = extractSymbolAtPosition(line, position);
    if (!symbolInfo) {
      return null;
    }

    console.log(`Go-to-definition request for: ${symbolInfo.fullSymbol} (type: ${symbolInfo.type})`);

    // Handle method calls like "blinker.setup" or "Serial.begin"
    if (symbolInfo.type === 'method' && symbolInfo.objectName && symbolInfo.methodName) {
      const methodSymbol = symbolTable.findObjectMethod(symbolInfo.objectName, symbolInfo.methodName);
      if (methodSymbol && methodSymbol.range) {
        // Find the document URI that contains this symbol
        const definitionUri = findSymbolDefinitionUri(methodSymbol);
        if (definitionUri) {
          return {
            uri: definitionUri,
            range: methodSymbol.range
          } as Location;
        }
      }
    }
    
    // Handle variable/class references
    else if (symbolInfo.type === 'identifier') {
      const symbol = symbolTable.findSymbol(symbolInfo.fullSymbol, document.uri);
      if (symbol && symbol.range) {
        // For imported symbols, find their original definition
        const definitionUri = findSymbolDefinitionUri(symbol);
        if (definitionUri) {
          return {
            uri: definitionUri,  
            range: symbol.range
          } as Location;
        }
      }
    }

    return null;
  } catch (error) {
    connection.console.error(`Error in go-to-definition: ${error}`);
    return null;
  }
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

// Helper function to extract symbol information at cursor position
function extractSymbolAtPosition(line: string, position: number): {
  fullSymbol: string;
  type: 'method' | 'identifier';
  objectName?: string;
  methodName?: string;
} | null {
  // Find word boundaries around the cursor position
  let start = position;
  let end = position;
  
  // Expand backwards
  while (start > 0 && /[\w.]/.test(line[start - 1])) {
    start--;
  }
  
  // Expand forwards  
  while (end < line.length && /[\w.]/.test(line[end])) {
    end++;
  }
  
  const fullSymbol = line.substring(start, end);
  if (!fullSymbol) {
    return null;
  }
  
  // Check if it's a method call (contains a dot)
  if (fullSymbol.includes('.')) {
    const parts = fullSymbol.split('.');
    if (parts.length === 2) {
      return {
        fullSymbol,
        type: 'method',
        objectName: parts[0],
        methodName: parts[1]
      };
    }
  }
  
  // It's a regular identifier
  return {
    fullSymbol,
    type: 'identifier'
  };
}

// Helper function to find the URI where a symbol is defined
function findSymbolDefinitionUri(symbol: CNextSymbol): string | null {
  // Use the SymbolTable's method to find where the symbol is defined
  return symbolTable.findSymbolOriginUri(symbol);
}

// Listen on the connection
connection.listen();

