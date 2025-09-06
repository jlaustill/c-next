import { CNextSymbol, CNextSymbolKind } from '../../../shared/types';

export interface TypeInfo {
  name: string;
  kind: 'primitive' | 'class' | 'interface';
  members?: Map<string, CNextSymbol>;
  methods?: Map<string, CNextSymbol>;
}

export class SymbolTable {
  private globalSymbols: Map<string, CNextSymbol> = new Map();
  private documentSymbols: Map<string, Map<string, CNextSymbol>> = new Map();
  private types: Map<string, TypeInfo> = new Map();

  constructor() {
    this.initializePrimitiveTypes();
  }

  addDocumentSymbols(uri: string, symbols: CNextSymbol[]): void {
    const docSymbols = new Map<string, CNextSymbol>();
    
    for (const symbol of symbols) {
      docSymbols.set(symbol.name, symbol);
      
      // Add class types to type registry
      if (symbol.kind === CNextSymbolKind.Class) {
        this.types.set(symbol.name, {
          name: symbol.name,
          kind: 'class',
          members: new Map(),
          methods: new Map()
        });
      }
    }
    
    this.documentSymbols.set(uri, docSymbols);
  }

  removeDocumentSymbols(uri: string): void {
    this.documentSymbols.delete(uri);
  }

  findSymbol(name: string, uri?: string): CNextSymbol | undefined {
    // First check document-specific symbols
    if (uri) {
      const docSymbols = this.documentSymbols.get(uri);
      if (docSymbols?.has(name)) {
        return docSymbols.get(name);
      }
    }

    // Then check all document symbols
    for (const [, docSymbols] of this.documentSymbols) {
      if (docSymbols.has(name)) {
        return docSymbols.get(name);
      }
    }

    // Finally check global symbols
    return this.globalSymbols.get(name);
  }

  getAllSymbols(uri?: string): CNextSymbol[] {
    const symbols: CNextSymbol[] = [];

    // Add document-specific symbols
    if (uri) {
      const docSymbols = this.documentSymbols.get(uri);
      if (docSymbols) {
        symbols.push(...Array.from(docSymbols.values()));
      }
    } else {
      // Add all document symbols if no URI specified
      for (const [, docSymbols] of this.documentSymbols) {
        symbols.push(...Array.from(docSymbols.values()));
      }
    }

    // Add global symbols
    symbols.push(...Array.from(this.globalSymbols.values()));

    return symbols;
  }

  getSymbolsByKind(kind: CNextSymbolKind, uri?: string): CNextSymbol[] {
    return this.getAllSymbols(uri).filter(symbol => symbol.kind === kind);
  }

  isTypeValid(typeName: string): boolean {
    return this.types.has(typeName);
  }

  getTypeInfo(typeName: string): TypeInfo | undefined {
    return this.types.get(typeName);
  }

  getAllTypes(): string[] {
    return Array.from(this.types.keys());
  }

  private initializePrimitiveTypes(): void {
    const primitiveTypes = [
      'void', 'int8', 'int16', 'int32', 'int64',
      'uint8', 'uint16', 'uint32', 'uint64',
      'float32', 'float64', 'bool', 'String', 'char'
    ];

    for (const type of primitiveTypes) {
      this.types.set(type, {
        name: type,
        kind: 'primitive'
      });
    }

    // Add some common Arduino types
    const arduinoTypes = ['HIGH', 'LOW', 'INPUT', 'OUTPUT', 'LED_BUILTIN'];
    for (const constant of arduinoTypes) {
      this.globalSymbols.set(constant, {
        name: constant,
        kind: CNextSymbolKind.Constant,
        type: 'int32',
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: constant.length }
        },
        detail: 'Arduino constant'
      });
    }

    // Add common Arduino functions
    const arduinoFunctions = [
      { name: 'pinMode', type: 'void', params: ['uint8', 'uint8'] },
      { name: 'digitalWrite', type: 'void', params: ['uint8', 'uint8'] },
      { name: 'digitalRead', type: 'uint8', params: ['uint8'] },
      { name: 'delay', type: 'void', params: ['uint32'] }
    ];

    for (const func of arduinoFunctions) {
      this.globalSymbols.set(func.name, {
        name: func.name,
        kind: CNextSymbolKind.Function,
        type: func.type,
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: func.name.length }
        },
        detail: `Arduino function: ${func.type} ${func.name}(${func.params.join(', ')})`
      });
    }
  }
}

export default SymbolTable;