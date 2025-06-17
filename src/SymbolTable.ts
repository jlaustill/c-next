import { CFunction, CVariable, CType, ParsedHeader } from './parsers/CHeaderParser';

export interface Symbol {
  name: string;
  type: 'function' | 'variable' | 'type';
  sourceFile: string;
  cNextType?: string;
}

export interface FunctionSymbol extends Symbol {
  type: 'function';
  returnType: string;
  parameters: Array<{ type: string; name: string }>;
  isStatic?: boolean;
  isInline?: boolean;
}

export interface VariableSymbol extends Symbol {
  type: 'variable';
  variableType: string;
  isConst?: boolean;
  isStatic?: boolean;
  isExtern?: boolean;
}

export interface TypeSymbol extends Symbol {
  type: 'type';
  isStruct?: boolean;
  isEnum?: boolean;
  isTypedef?: boolean;
  members?: Array<{ type: string; name: string }>;
}

export class SymbolTable {
  private symbols: Map<string, Symbol> = new Map();
  private includes: Set<string> = new Set();

  addHeaderSymbols(headerPath: string, parsedHeader: ParsedHeader) {
    // Add includes
    parsedHeader.includes.forEach(include => this.includes.add(include));
    
    // Add functions
    parsedHeader.functions.forEach(func => {
      const symbol: FunctionSymbol = {
        name: func.name,
        type: 'function',
        sourceFile: headerPath,
        returnType: func.returnType,
        parameters: func.parameters,
        isStatic: func.isStatic,
        isInline: func.isInline
      };
      this.symbols.set(func.name, symbol);
    });
    
    // Add variables
    parsedHeader.variables.forEach(variable => {
      const symbol: VariableSymbol = {
        name: variable.name,
        type: 'variable',
        sourceFile: headerPath,
        variableType: variable.type,
        isConst: variable.isConst,
        isStatic: variable.isStatic,
        isExtern: variable.isExtern
      };
      this.symbols.set(variable.name, symbol);
    });
    
    // Add types
    parsedHeader.types.forEach(type => {
      const symbol: TypeSymbol = {
        name: type.name,
        type: 'type',
        sourceFile: headerPath,
        isStruct: type.isStruct,
        isEnum: type.isEnum,
        isTypedef: type.isTypedef,
        members: type.members
      };
      this.symbols.set(type.name, symbol);
    });
  }

  getSymbol(name: string): Symbol | undefined {
    return this.symbols.get(name);
  }

  getFunctionSymbol(name: string): FunctionSymbol | undefined {
    const symbol = this.symbols.get(name);
    return symbol?.type === 'function' ? symbol as FunctionSymbol : undefined;
  }

  getVariableSymbol(name: string): VariableSymbol | undefined {
    const symbol = this.symbols.get(name);
    return symbol?.type === 'variable' ? symbol as VariableSymbol : undefined;
  }

  getTypeSymbol(name: string): TypeSymbol | undefined {
    const symbol = this.symbols.get(name);
    return symbol?.type === 'type' ? symbol as TypeSymbol : undefined;
  }

  hasSymbol(name: string): boolean {
    return this.symbols.has(name);
  }

  getAllSymbols(): Symbol[] {
    return Array.from(this.symbols.values());
  }

  getSymbolsByType(type: 'function' | 'variable' | 'type'): Symbol[] {
    return Array.from(this.symbols.values()).filter(symbol => symbol.type === type);
  }

  getIncludes(): string[] {
    return Array.from(this.includes);
  }

  // Validation methods for c-next code
  validateFunctionCall(name: string, args: Array<{ type: string }>): { valid: boolean; error?: string } {
    const funcSymbol = this.getFunctionSymbol(name);
    if (!funcSymbol) {
      return { valid: false, error: `Function '${name}' not found` };
    }

    if (funcSymbol.parameters.length !== args.length) {
      return { 
        valid: false, 
        error: `Function '${name}' expects ${funcSymbol.parameters.length} arguments, got ${args.length}` 
      };
    }

    // Type checking could be enhanced here
    for (let i = 0; i < args.length; i++) {
      const expectedType = funcSymbol.parameters[i].type;
      const actualType = args[i].type;
      
      if (expectedType !== actualType && !this.isCompatibleType(expectedType, actualType)) {
        return {
          valid: false,
          error: `Argument ${i + 1} of function '${name}': expected ${expectedType}, got ${actualType}`
        };
      }
    }

    return { valid: true };
  }

  private isCompatibleType(expected: string, actual: string): boolean {
    // Basic type compatibility rules
    const numericTypes = ['int8', 'int16', 'int32', 'int64', 'uint8', 'uint16', 'uint32', 'uint64'];
    const floatTypes = ['float32', 'float64', 'float96'];
    
    if (numericTypes.includes(expected) && numericTypes.includes(actual)) {
      return true; // Allow numeric conversions
    }
    
    if (floatTypes.includes(expected) && (floatTypes.includes(actual) || numericTypes.includes(actual))) {
      return true; // Allow numeric to float conversions
    }
    
    return false;
  }

  // Generate intellisense/completion data
  getCompletionSuggestions(prefix: string = ''): Array<{
    name: string;
    type: string;
    detail: string;
    documentation?: string;
  }> {
    const suggestions: Array<{
      name: string;
      type: string;
      detail: string;
      documentation?: string;
    }> = [];

    this.symbols.forEach(symbol => {
      if (symbol.name.startsWith(prefix)) {
        let detail = '';
        let documentation = '';
        
        switch (symbol.type) {
          case 'function':
            const funcSymbol = symbol as FunctionSymbol;
            const params = funcSymbol.parameters.map(p => `${p.type} ${p.name}`).join(', ');
            detail = `${funcSymbol.returnType} ${funcSymbol.name}(${params})`;
            documentation = `Function from ${symbol.sourceFile}`;
            break;
            
          case 'variable':
            const varSymbol = symbol as VariableSymbol;
            detail = `${varSymbol.variableType} ${varSymbol.name}`;
            documentation = `Variable from ${symbol.sourceFile}`;
            break;
            
          case 'type':
            const typeSymbol = symbol as TypeSymbol;
            if (typeSymbol.isStruct) {
              detail = `struct ${typeSymbol.name}`;
            } else if (typeSymbol.isEnum) {
              detail = `enum ${typeSymbol.name}`;
            } else {
              detail = `type ${typeSymbol.name}`;
            }
            documentation = `Type from ${symbol.sourceFile}`;
            break;
        }
        
        suggestions.push({
          name: symbol.name,
          type: symbol.type,
          detail,
          documentation
        });
      }
    });

    return suggestions.sort((a, b) => a.name.localeCompare(b.name));
  }
}