"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.CGenerationVisitor = void 0;
const AbstractParseTreeVisitor_1 = require("antlr4ts/tree/AbstractParseTreeVisitor");
const cNextParser_1 = require("../parser/cNextParser");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const CHeaderParser_1 = require("../parsers/CHeaderParser");
const SymbolTable_1 = require("../SymbolTable");
class CGenerationVisitor extends AbstractParseTreeVisitor_1.AbstractParseTreeVisitor {
    constructor(outputDir, includePaths) {
        super();
        this.outputDir = outputDir;
        this.symbolTable = new SymbolTable_1.SymbolTable();
        this.headerParser = new CHeaderParser_1.CHeaderParser();
        this.includePaths = ['/usr/include', '/usr/local/include'];
        if (includePaths) {
            this.includePaths = [...this.includePaths, ...includePaths];
        }
    }
    visitSourceFile(ctx) {
        // Process includes first
        ctx.fileDirective().forEach(directive => this.visit(directive));
        // Then process class declaration
        this.visit(ctx.classDeclaration());
        return null;
    }
    visitMainSourceFile(ctx) {
        // Process includes first
        ctx.fileDirective().forEach(directive => this.visit(directive));
        // Process all global declarations, function declarations, and class declarations
        if (ctx.globalDeclaration) {
            ctx.globalDeclaration().forEach(decl => this.visit(decl));
        }
        if (ctx.functionDeclaration) {
            ctx.functionDeclaration().forEach(func => this.visit(func));
        }
        if (ctx.classDeclaration) {
            ctx.classDeclaration().forEach(classDecl => this.visit(classDecl));
        }
        return null;
    }
    visitIncludeDirective(ctx) {
        const filename = ctx.FILENAME().text.slice(1, -1); // Remove quotes
        if (!this.currentClass) {
            this.currentClass = {
                name: 'temp',
                isStatic: false,
                functions: [],
                variables: [],
                includes: []
            };
        }
        this.currentClass.includes.push(filename);
        // Parse the header file for symbols
        this.parseHeaderFile(filename);
        return null;
    }
    visitClassDeclaration(ctx) {
        if (!this.currentClass) {
            this.currentClass = {
                name: ctx.ID().text,
                isStatic: ctx.STATIC() !== undefined,
                functions: [],
                variables: [],
                includes: []
            };
        }
        else {
            // Update existing class with declaration info
            this.currentClass.name = ctx.ID().text;
            this.currentClass.isStatic = ctx.STATIC() !== undefined;
        }
        this.visitChildren(ctx);
        this.generateCCode(this.currentClass);
        return this.currentClass;
    }
    visitDeclaration(ctx) {
        if (!this.currentClass)
            return;
        let isStaticContext = this.currentClass.isStatic;
        let parent = ctx.parent;
        while (parent) {
            if (parent.text.includes('static')) {
                isStaticContext = true;
                break;
            }
            parent = parent.parent;
        }
        const variable = {
            type: ctx.type_specifier().text,
            name: ctx.ID().text,
            value: ctx.value().text,
            isStatic: isStaticContext
        };
        this.currentClass.variables.push(variable);
    }
    visitClassFunction(ctx) {
        if (!this.currentClass)
            return;
        const parameters = this.getParameters(ctx);
        const body = this.getFunctionBody(ctx);
        const func = {
            returnType: ctx.returnType().text,
            name: ctx.ID().text,
            parameters,
            body,
            isPublic: ctx.PUBLIC() !== undefined
        };
        this.currentClass.functions.push(func);
    }
    getParameters(ctx) {
        const params = [];
        const paramList = ctx.parameterList();
        if (paramList) {
            paramList.parameter().forEach((param) => {
                params.push({
                    type: param.type_specifier().text,
                    name: param.ID().text
                });
            });
        }
        return params;
    }
    getFunctionBody(ctx) {
        let body = '';
        ctx.statement().forEach((stmt) => {
            if (stmt.RETURN()) {
                body += '    return ' + this.getExpressionText(stmt.expression()) + ';\n';
            }
        });
        return body;
    }
    getExpressionText(ctx) {
        if (!ctx)
            return '';
        // Check which type of expression we're dealing with
        if (ctx instanceof cNextParser_1.ValueExprContext) {
            return ctx.value().text;
        }
        if (ctx instanceof cNextParser_1.AddExprContext) {
            const left = this.getExpressionText(ctx.expression(0));
            const right = this.getExpressionText(ctx.expression(1));
            return `${left} + ${right}`;
        }
        if (ctx instanceof cNextParser_1.ParenExprContext) {
            return `(${this.getExpressionText(ctx.expression())})`;
        }
        return ctx.text;
    }
    parseHeaderFile(filename) {
        // Try to find the header file in include paths
        let headerPath = null;
        for (const includePath of this.includePaths) {
            const fullPath = path.join(includePath, filename);
            if (fs.existsSync(fullPath)) {
                headerPath = fullPath;
                break;
            }
        }
        // Also try relative to current directory
        if (!headerPath && fs.existsSync(filename)) {
            headerPath = filename;
        }
        if (headerPath) {
            try {
                const parsedHeader = this.headerParser.parse(headerPath);
                this.symbolTable.addHeaderSymbols(headerPath, parsedHeader);
                console.log(`Parsed header: ${filename} (${parsedHeader.functions.length} functions, ${parsedHeader.variables.length} variables, ${parsedHeader.types.length} types)`);
            }
            catch (error) {
                console.warn(`Failed to parse header ${filename}:`, error);
            }
        }
        else {
            console.warn(`Header file not found: ${filename}`);
        }
    }
    generateCCode(classData) {
        // Generate header file (.h)
        let header = `#ifndef ${classData.name.toUpperCase()}_H\n`;
        header += `#define ${classData.name.toUpperCase()}_H\n\n`;
        header += '#include <stdint.h>\n'; // For int types
        // Add includes from parsed headers
        classData.includes.forEach(include => {
            header += `#include "${include}"\n`;
        });
        header += '\n';
        // Add variables
        classData.variables.forEach(v => {
            if (v.isStatic) {
                header += `static const ${this.mapTypeToC(v.type)} ${v.name} = ${v.value};\n`;
            }
        });
        // Add function declarations
        classData.functions.forEach(f => {
            if (f.isPublic) {
                const params = f.parameters
                    .map(p => `${this.mapTypeToC(p.type)} ${p.name}`)
                    .join(', ');
                header += `${this.mapTypeToC(f.returnType)} ${classData.name}_${f.name}(${params});\n`;
            }
        });
        header += '\n#endif\n';
        // Generate implementation file (.c)
        let impl = `#include "${classData.name.toLowerCase()}.h"\n`;
        // Add includes from parsed headers to implementation as well
        classData.includes.forEach(include => {
            impl += `#include "${include}"\n`;
        });
        impl += '\n';
        // Add function implementations
        classData.functions.forEach(f => {
            if (f.isPublic) {
                const params = f.parameters
                    .map(p => `${this.mapTypeToC(p.type)} ${p.name}`)
                    .join(', ');
                impl += `${this.mapTypeToC(f.returnType)} ${classData.name}_${f.name}(${params}) {\n`;
                impl += f.body;
                impl += '}\n\n';
            }
        });
        // Write files
        this.writeToFile(`${classData.name.toLowerCase()}.h`, header);
        this.writeToFile(`${classData.name.toLowerCase()}.c`, impl);
    }
    mapTypeToC(type) {
        const typeMap = {
            'int8': 'int8_t',
            'int16': 'int16_t',
            'int32': 'int32_t',
            'int64': 'int64_t',
            'String': 'char*',
            'void': 'void'
        };
        return typeMap[type] || type;
    }
    writeToFile(filename, content) {
        const filePath = path.join(this.outputDir, filename);
        // Ensure output directory exists
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
        fs.writeFileSync(filePath, content);
        console.log(`Generated: ${filePath}`);
    }
    // Public method to get symbol table for intellisense/validation
    getSymbolTable() {
        return this.symbolTable;
    }
    // Method to validate function calls in c-next code
    validateFunctionCall(functionName, args) {
        return this.symbolTable.validateFunctionCall(functionName, args);
    }
    // Method to get completion suggestions
    getCompletionSuggestions(prefix = '') {
        return this.symbolTable.getCompletionSuggestions(prefix);
    }
    defaultResult() {
        return null;
    }
}
exports.CGenerationVisitor = CGenerationVisitor;
