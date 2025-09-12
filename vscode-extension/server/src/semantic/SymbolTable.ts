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
        console.log(`[SYMBOL_TABLE] Adding class type: ${symbol.name}`);
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

  getObjectMethods(objectName: string): CNextSymbol[] {
    const objectMethods = this.objectMethods.get(objectName);
    console.log(`[SYMBOL_TABLE] getObjectMethods(${objectName}) found ${objectMethods?.size || 0} methods`);
    console.log(`[SYMBOL_TABLE] Available direct objects:`, Array.from(this.objectMethods.keys()));
    if (objectMethods) {
      return Array.from(objectMethods.values());
    }
    return [];
  }

  getObjectType(objectName: string): string | undefined {
    return this.objectInstances.get(objectName);
  }

  getClassMethods(className: string): CNextSymbol[] {
    const classMethods = this.classMethods.get(className);
    if (classMethods) {
      return Array.from(classMethods.values());
    }
    return [];
  }

  getObjectInstanceType(objectName: string): string | undefined {
    const result = this.objectInstances.get(objectName);
    console.log(`[SYMBOL_TABLE] getObjectInstanceType(${objectName}) = ${result}`);
    console.log(`[SYMBOL_TABLE] Available object instances:`, Array.from(this.objectInstances.entries()));
    return result;
  }

  getClassMembers(className: string): CNextSymbol[] {
    const members: CNextSymbol[] = [];
    console.log(`[SYMBOL_TABLE] getClassMembers(${className})`);
    
    // Get methods from the class
    const classMethods = this.classMethods.get(className);
    console.log(`[SYMBOL_TABLE] Found ${classMethods?.size || 0} class methods for ${className}`);
    if (classMethods) {
      members.push(...Array.from(classMethods.values()));
    }
    
    // Get properties/variables from the class by looking through all document symbols
    let variableCount = 0;
    for (const [, docSymbols] of this.documentSymbols) {
      for (const symbol of docSymbols.values()) {
        // Check if this symbol belongs to the class
        if (symbol.containerName === className && 
            (symbol.kind === CNextSymbolKind.Variable || 
             symbol.kind === CNextSymbolKind.Constant ||
             symbol.kind === CNextSymbolKind.Property)) {
          members.push(symbol);
          variableCount++;
        }
      }
    }
    console.log(`[SYMBOL_TABLE] Found ${variableCount} variables for ${className}`);
    console.log(`[SYMBOL_TABLE] Total members for ${className}: ${members.length}`);
    
    return members;
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

    // Add Arduino functions with documentation
    const arduinoFunctions = [
      { 
        name: 'pinMode', 
        type: 'void', 
        params: ['uint8', 'uint8'],
        documentation: 'Configure a digital pin. The mode can be INPUT, INPUT_PULLUP, INPUT_PULLDOWN, OUTPUT, OUTPUT_OPENDRAIN or INPUT_DISABLE. Use INPUT_DISABLE to minimize power consumption for unused pins and pins with analog voltages.'
      },
      { 
        name: 'digitalWrite', 
        type: 'void', 
        params: ['uint8', 'uint8'],
        documentation: 'Write a HIGH or LOW value to a digital pin. If the pin has been configured as OUTPUT, its voltage will be set to the corresponding value: 5V (or 3.3V on 3.3V boards) for HIGH, 0V for LOW.'
      },
      { 
        name: 'digitalRead', 
        type: 'uint8', 
        params: ['uint8'],
        documentation: 'Reads the value from a specified digital pin, either HIGH or LOW.'
      },
      { 
        name: 'delay', 
        type: 'void', 
        params: ['uint32'],
        documentation: 'Pauses the program for the amount of time (in milliseconds) specified as parameter. There are 1000 milliseconds in a second.'
      },
      { 
        name: 'delayMicroseconds', 
        type: 'void', 
        params: ['uint32'],
        documentation: 'Pauses the program for the amount of time (in microseconds) specified as parameter. There are a thousand microseconds in a millisecond, and a million microseconds in a second.'
      },
      { 
        name: 'millis', 
        type: 'uint32', 
        params: [],
        documentation: 'Returns the number of milliseconds passed since the Arduino board began running the current program. This number will overflow (go back to zero), after approximately 50 days.'
      },
      { 
        name: 'micros', 
        type: 'uint32', 
        params: [],
        documentation: 'Returns the number of microseconds since the Arduino board began running the current program. This number will overflow (go back to zero), after approximately 70 minutes.'
      },
      { 
        name: 'analogRead', 
        type: 'int32', 
        params: ['uint8'],
        documentation: 'Reads the value from the specified analog pin. Arduino boards contain a multichannel, 10-bit analog to digital converter. This means that it will map input voltages between 0 and the operating voltage (5V or 3.3V) into integer values between 0 and 1023.'
      },
      { 
        name: 'analogWrite', 
        type: 'void', 
        params: ['uint8', 'int32'],
        documentation: 'Writes an analog value (PWM wave) to a pin. Can be used to light a LED at varying brightnesses or drive a motor at various speeds. After a call to analogWrite(), the pin will generate a steady rectangular wave of the specified duty cycle until the next call to analogWrite() (or a call to digitalRead() or digitalWrite()) on the same pin.'
      }
    ];

    for (const func of arduinoFunctions) {
      this.globalSymbols.set(func.name, {
        name: func.name,
        kind: CNextSymbolKind.Function,
        type: func.type,
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: func.name.length } },
        detail: `Arduino function: ${func.type} ${func.name}(${func.params.join(', ')})`,
        documentation: func.documentation
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

    // Add Serial methods with documentation
    const serialMethods = new Map<string, CNextSymbol>();
    const serialMethodDefs = [
      { 
        name: 'begin', 
        type: 'void', 
        params: ['uint32'],
        documentation: 'Sets the data rate in bits per second (baud) for serial data transmission. For communicating with the computer, use one of these rates: 300, 600, 1200, 2400, 4800, 9600, 14400, 19200, 28800, 38400, 57600, or 115200.'
      },
      { 
        name: 'print', 
        type: 'void', 
        params: ['String'],
        documentation: 'Prints data to the serial port as human-readable ASCII text. This command can take many forms. Numbers are printed using an ASCII character for each digit. Floats are similarly printed as ASCII digits, defaulting to two decimal places.'
      },
      { 
        name: 'println', 
        type: 'void', 
        params: ['String'],
        documentation: 'Prints data to the serial port as human-readable ASCII text followed by a carriage return character (ASCII 13, or "\\r") and a newline character (ASCII 10, or "\\n"). This command takes the same forms as Serial.print().'
      },
      { 
        name: 'available', 
        type: 'int32', 
        params: [],
        documentation: 'Returns the number of bytes available for reading from the serial port. This is data that\'s already arrived and stored in the serial receive buffer (which holds 64 bytes).'
      },
      { 
        name: 'read', 
        type: 'int32', 
        params: [],
        documentation: 'Reads incoming serial data. Returns the first byte of incoming serial data available (or -1 if no data is available). Data type: int.'
      }
    ];

    for (const method of serialMethodDefs) {
      serialMethods.set(method.name, {
        name: method.name,
        kind: CNextSymbolKind.Method,
        type: method.type,
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: method.name.length } },
        detail: `Serial method: ${method.type} ${method.name}(${method.params.join(', ')})`,
        documentation: method.documentation
      });
    }

    this.objectMethods.set('Serial', serialMethods);
  }
}

export default SymbolTable;