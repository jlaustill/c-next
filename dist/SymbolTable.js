"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SymbolTable = void 0;
class SymbolTable {
    constructor() {
        this.symbols = new Map();
        this.includes = new Set();
    }
    addHeaderSymbols(headerPath, parsedHeader) {
        // Add includes
        parsedHeader.includes.forEach(include => this.includes.add(include));
        // Add functions
        parsedHeader.functions.forEach(func => {
            const symbol = {
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
            const symbol = {
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
            const symbol = {
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
    getSymbol(name) {
        return this.symbols.get(name);
    }
    getFunctionSymbol(name) {
        const symbol = this.symbols.get(name);
        return symbol?.type === 'function' ? symbol : undefined;
    }
    getVariableSymbol(name) {
        const symbol = this.symbols.get(name);
        return symbol?.type === 'variable' ? symbol : undefined;
    }
    getTypeSymbol(name) {
        const symbol = this.symbols.get(name);
        return symbol?.type === 'type' ? symbol : undefined;
    }
    hasSymbol(name) {
        return this.symbols.has(name);
    }
    getAllSymbols() {
        return Array.from(this.symbols.values());
    }
    getSymbolsByType(type) {
        return Array.from(this.symbols.values()).filter(symbol => symbol.type === type);
    }
    getIncludes() {
        return Array.from(this.includes);
    }
    // Validation methods for c-next code
    validateFunctionCall(name, args) {
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
    isCompatibleType(expected, actual) {
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
    getCompletionSuggestions(prefix = '') {
        const suggestions = [];
        this.symbols.forEach(symbol => {
            if (symbol.name.startsWith(prefix)) {
                let detail = '';
                let documentation = '';
                switch (symbol.type) {
                    case 'function':
                        const funcSymbol = symbol;
                        const params = funcSymbol.parameters.map(p => `${p.type} ${p.name}`).join(', ');
                        detail = `${funcSymbol.returnType} ${funcSymbol.name}(${params})`;
                        documentation = `Function from ${symbol.sourceFile}`;
                        break;
                    case 'variable':
                        const varSymbol = symbol;
                        detail = `${varSymbol.variableType} ${varSymbol.name}`;
                        documentation = `Variable from ${symbol.sourceFile}`;
                        break;
                    case 'type':
                        const typeSymbol = symbol;
                        if (typeSymbol.isStruct) {
                            detail = `struct ${typeSymbol.name}`;
                        }
                        else if (typeSymbol.isEnum) {
                            detail = `enum ${typeSymbol.name}`;
                        }
                        else {
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
exports.SymbolTable = SymbolTable;
