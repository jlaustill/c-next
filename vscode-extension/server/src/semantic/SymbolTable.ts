import { CNextSymbol, CNextSymbolKind } from '../types';
import { CHeaderParser, ParsedHeader } from '../parsers/CHeaderParser';
import * as path from 'path';

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
  private objectMethods: Map<string, Map<string, CNextSymbol>> = new Map(); // object -> methods
  private classMethods: Map<string, Map<string, CNextSymbol>> = new Map(); // class -> methods
  private objectInstances: Map<string, string> = new Map(); // variable -> class type
  private headerParser: CHeaderParser = new CHeaderParser();
  private parsedHeaders: Set<string> = new Set();

  constructor() {
    this.initializePrimitiveTypes();
    this.initializeArduinoSymbols();
  }

  addDocumentSymbols(uri: string, symbols: CNextSymbol[]): void {
    const docSymbols = new Map<string, CNextSymbol>();
    
    for (const symbol of symbols) {
      docSymbols.set(symbol.name, symbol);
      
      // Handle class definitions
      if (symbol.kind === CNextSymbolKind.Class) {
        this.types.set(symbol.name, {
          name: symbol.name,
          kind: 'class',
          members: new Map(),
          methods: new Map()
        });
        
        // Initialize class methods map
        if (!this.classMethods.has(symbol.name)) {
          this.classMethods.set(symbol.name, new Map());
        }
      }
      
      // Handle method definitions
      else if (symbol.kind === CNextSymbolKind.Method && symbol.containerName) {
        const classMethodsMap = this.classMethods.get(symbol.containerName);
        if (classMethodsMap) {
          classMethodsMap.set(symbol.name, symbol);
        }
      }
      
      // Handle variable declarations (potential object instances)
      else if (symbol.kind === CNextSymbolKind.Variable && symbol.type) {
        console.log(`Processing variable: ${symbol.name} of type ${symbol.type}`);
        console.log(`Available types:`, Array.from(this.types.keys()));
        // Check if the type is a known class
        if (this.types.has(symbol.type)) {
          this.objectInstances.set(symbol.name, symbol.type);
          console.log(`Added object instance: ${symbol.name} -> ${symbol.type}`);
        } else {
          console.log(`Type ${symbol.type} not found in known types`);
        }
      }
    }
    
    this.documentSymbols.set(uri, docSymbols);
  }

  removeDocumentSymbols(uri: string): void {
    this.documentSymbols.delete(uri);
  }

  findSymbol(name: string, uri?: string): CNextSymbol | undefined {
    // Check for object method calls (e.g., "Serial.begin")
    if (name.includes('.')) {
      const [objectName, methodName] = name.split('.', 2);
      return this.findObjectMethod(objectName, methodName);
    }

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

  findObjectMethod(objectName: string, methodName: string): CNextSymbol | undefined {
    console.log(`Looking for method: ${objectName}.${methodName}`);
    
    // First check if it's a direct object (like Serial)
    const objectMethods = this.objectMethods.get(objectName);
    if (objectMethods) {
      console.log(`Found direct object ${objectName} with ${objectMethods.size} methods`);
      const method = objectMethods.get(methodName);
      if (method) {
        console.log(`Found direct method: ${objectName}.${methodName}`);
        return method;
      }
    }

    // Then check if it's a class instance
    const className = this.objectInstances.get(objectName);
    console.log(`Checking if ${objectName} is instance of class: ${className || 'not found'}`);
    console.log(`Available object instances:`, Array.from(this.objectInstances.entries()));
    
    if (className) {
      const classMethods = this.classMethods.get(className);
      console.log(`Class ${className} has ${classMethods?.size || 0} methods`);
      if (classMethods) {
        console.log(`Available methods for ${className}:`, Array.from(classMethods.keys()));
        const method = classMethods.get(methodName);
        if (method) {
          console.log(`Found class method: ${className}.${methodName}`);
          return method;
        }
      }
    }

    console.log(`Method ${objectName}.${methodName} not found`);
    return undefined;
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

  findSymbolOriginUri(targetSymbol: CNextSymbol): string | null {
    // Search through all document symbols to find where this symbol was originally defined
    for (const [uri, docSymbols] of this.documentSymbols) {
      for (const [name, symbol] of docSymbols) {
        if (symbol.name === targetSymbol.name && 
            symbol.kind === targetSymbol.kind && 
            symbol.containerName === targetSymbol.containerName) {
          return uri;
        }
      }
    }
    return null;
  }

  parseHeaderFile(headerPath: string): void {
    if (this.parsedHeaders.has(headerPath)) {
      return; // Already parsed
    }

    try {
      const parsed = this.headerParser.parse(headerPath);
      this.addParsedHeaderSymbols(parsed);
      this.parsedHeaders.add(headerPath);
    } catch (error) {
      console.warn(`Could not parse header file ${headerPath}:`, error);
    }
  }

  private addParsedHeaderSymbols(parsed: ParsedHeader): void {
    // Add functions as global symbols
    for (const func of parsed.functions) {
      this.globalSymbols.set(func.name, {
        name: func.name,
        kind: CNextSymbolKind.Function,
        type: func.returnType,
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
        detail: `${func.returnType} ${func.name}(${func.parameters.map(p => `${p.type} ${p.name}`).join(', ')})`
      });
    }

    // Add variables as global symbols
    for (const variable of parsed.variables) {
      this.globalSymbols.set(variable.name, {
        name: variable.name,
        kind: variable.isConst ? CNextSymbolKind.Constant : CNextSymbolKind.Variable,
        type: variable.type,
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
        detail: `${variable.type} ${variable.name}`
      });
    }

    // Add types
    for (const type of parsed.types) {
      this.types.set(type.name, {
        name: type.name,
        kind: type.isStruct ? 'class' : 'primitive'
      });
    }
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
  }

  private initializeArduinoSymbols(): void {
    // Add Arduino constants
    const arduinoConstants = ['HIGH', 'LOW', 'INPUT', 'OUTPUT', 'LED_BUILTIN'];
    for (const constant of arduinoConstants) {
      this.globalSymbols.set(constant, {
        name: constant,
        kind: CNextSymbolKind.Constant,
        type: 'int32',
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: constant.length } },
        detail: 'Arduino constant'
      });
    }

    // Add Arduino functions
    const arduinoFunctions = [
      { name: 'pinMode', type: 'void', params: ['uint8', 'uint8'] },
      { name: 'digitalWrite', type: 'void', params: ['uint8', 'uint8'] },
      { name: 'digitalRead', type: 'uint8', params: ['uint8'] },
      { name: 'delay', type: 'void', params: ['uint32'] },
      { name: 'delayMicroseconds', type: 'void', params: ['uint32'] },
      { name: 'millis', type: 'uint32', params: [] },
      { name: 'micros', type: 'uint32', params: [] },
      { name: 'analogRead', type: 'int32', params: ['uint8'] },
      { name: 'analogWrite', type: 'void', params: ['uint8', 'int32'] }
    ];

    for (const func of arduinoFunctions) {
      this.globalSymbols.set(func.name, {
        name: func.name,
        kind: CNextSymbolKind.Function,
        type: func.type,
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: func.name.length } },
        detail: `Arduino function: ${func.type} ${func.name}(${func.params.join(', ')})`
      });
    }

    // Add Serial object and its methods
    this.globalSymbols.set('Serial', {
      name: 'Serial',
      kind: CNextSymbolKind.Variable,
      type: 'SerialClass',
      range: { start: { line: 0, character: 0 }, end: { line: 0, character: 6 } },
      detail: 'Arduino Serial communication object'
    });

    // Add Serial methods
    const serialMethods = new Map<string, CNextSymbol>();
    const serialMethodDefs = [
      { name: 'begin', type: 'void', params: ['uint32'] },
      { name: 'print', type: 'void', params: ['String'] },
      { name: 'println', type: 'void', params: ['String'] },
      { name: 'available', type: 'int32', params: [] },
      { name: 'read', type: 'int32', params: [] }
    ];

    for (const method of serialMethodDefs) {
      serialMethods.set(method.name, {
        name: method.name,
        kind: CNextSymbolKind.Method,
        type: method.type,
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: method.name.length } },
        detail: `Serial method: ${method.type} ${method.name}(${method.params.join(', ')})`
      });
    }

    this.objectMethods.set('Serial', serialMethods);
  }
}

export default SymbolTable;