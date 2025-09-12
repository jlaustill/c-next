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
        this.instanceToClassMap = new Map();
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
        // Initialize main file data structure
        this.currentMainFile = {
            functions: [],
            globalVariables: [],
            includes: []
        };
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
        // Generate main.c file
        this.generateMainCCode(this.currentMainFile);
        return null;
    }
    visitIncludeDirective(ctx) {
        const filename = ctx.STRING().text.slice(1, -1); // Remove backticks
        // Add include to current context (either class or main file)
        if (this.currentMainFile) {
            this.currentMainFile.includes.push(filename);
        }
        else if (this.currentClass) {
            this.currentClass.includes.push(filename);
        }
        else {
            // Create temporary class for include processing
            this.currentClass = {
                name: 'temp',
                isStatic: false,
                functions: [],
                variables: [],
                includes: []
            };
            this.currentClass.includes.push(filename);
        }
        // Parse the header file for symbols
        this.parseHeaderFile(filename);
        return null;
    }
    visitImportDirective(ctx) {
        const filename = ctx.STRING().text.slice(1, -1); // Remove backticks
        // Convert .cn files to .h includes
        let includeFile = filename;
        if (filename.endsWith('.cn')) {
            // Extract class name, convert to lowercase, and add .h extension
            const className = filename.replace('.cn', '');
            includeFile = className.toLowerCase() + '.h';
        }
        // Add include to current context (either class or main file)
        if (this.currentMainFile) {
            this.currentMainFile.includes.push(includeFile);
        }
        else if (this.currentClass) {
            this.currentClass.includes.push(includeFile);
        }
        else {
            // Create temporary class for include processing
            this.currentClass = {
                name: 'temp',
                isStatic: false,
                functions: [],
                variables: [],
                includes: []
            };
            this.currentClass.includes.push(includeFile);
        }
        return null;
    }
    visitGlobalDeclaration(ctx) {
        if (!this.currentMainFile)
            return;
        const type = ctx.ID(0).text; // First ID is the type (class name)
        const name = ctx.ID(1).text; // Second ID is the variable name
        // Store the mapping from instance name to class name
        // e.g., "blinker" -> "Blink"
        this.instanceToClassMap.set(name, type);
        // Skip global object declarations for C compilation
        // Object instantiations like "Blink blinker;" are not needed
        // since we're calling functions directly like Blink_setup()
        // Don't add to globalVariables - we don't need object instances in C
        return null;
    }
    visitFunctionDeclaration(ctx) {
        if (!this.currentMainFile)
            return;
        const returnType = ctx.returnType().text;
        const name = ctx.ID().text;
        const parameters = [];
        if (ctx.parameterList()) {
            ctx.parameterList().parameter().forEach(param => {
                parameters.push({
                    type: param.type_specifier().text,
                    name: param.ID().text
                });
            });
        }
        const body = this.getFunctionDeclarationBody(ctx);
        this.currentMainFile.functions.push({
            returnType,
            name,
            parameters,
            body,
            isPublic: true // Global functions are always public
        });
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
            value: ctx.value() ? ctx.value().text : undefined,
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
                // Handle return statements
                const expr = stmt.expression();
                if (expr) {
                    body += '    return ' + this.getExpressionText(expr) + ';\n';
                }
                else {
                    body += '    return;\n';
                }
            }
            else if (stmt.functionCall()) {
                // Handle function calls like pinMode(LED_BUILTIN, OUTPUT);
                body += '    ' + this.getFunctionCallText(stmt.functionCall()) + ';\n';
            }
            else if (stmt.methodCall()) {
                // Handle method calls like Serial.begin(115200);
                body += '    ' + this.getMethodCallText(stmt.methodCall()) + ';\n';
            }
            else if (stmt.declaration()) {
                // Handle variable declarations
                body += '    ' + this.getDeclarationText(stmt.declaration()) + ';\n';
            }
            else if (stmt.ID() && stmt.ASSIGN()) {
                // Handle assignment statements: ID ASSIGN value SEMI
                const idNode = stmt.ID();
                const valueNode = stmt.value();
                if (idNode && valueNode) {
                    const varName = idNode.text;
                    const value = valueNode.text;
                    body += `    ${varName} = ${value};\n`;
                }
            }
            else if (stmt.expression()) {
                // Handle general expressions
                body += '    ' + this.getExpressionText(stmt.expression()) + ';\n';
            }
        });
        return body;
    }
    getFunctionDeclarationBody(ctx) {
        let body = '';
        ctx.statement().forEach((stmt) => {
            if (stmt.RETURN()) {
                // Handle return statements
                const expr = stmt.expression();
                if (expr) {
                    body += '    return ' + this.getExpressionText(expr) + ';\n';
                }
                else {
                    body += '    return;\n';
                }
            }
            else if (stmt.functionCall()) {
                // Handle function calls like pinMode(LED_BUILTIN, OUTPUT);
                body += '    ' + this.getFunctionCallText(stmt.functionCall()) + ';\n';
            }
            else if (stmt.methodCall()) {
                // Handle method calls like Serial.begin(115200);
                body += '    ' + this.getMethodCallText(stmt.methodCall()) + ';\n';
            }
            else if (stmt.declaration()) {
                // Handle variable declarations
                body += '    ' + this.getDeclarationText(stmt.declaration()) + ';\n';
            }
            else if (stmt.ID() && stmt.ASSIGN()) {
                // Handle assignment statements: ID ASSIGN value SEMI
                const idNode = stmt.ID();
                const valueNode = stmt.value();
                if (idNode && valueNode) {
                    const varName = idNode.text;
                    const value = valueNode.text;
                    body += `    ${varName} = ${value};\n`;
                }
            }
            else if (stmt.expression()) {
                // Handle general expressions
                body += '    ' + this.getExpressionText(stmt.expression()) + ';\n';
            }
        });
        return body;
    }
    getExpressionText(ctx) {
        if (!ctx)
            return '';
        // Check which type of expression we're dealing with
        if (ctx instanceof cNextParser_1.ValueExprContext) {
            const valueText = ctx.value().text;
            // Handle c-next template strings with backticks
            if (valueText.startsWith('`') && valueText.endsWith('`')) {
                return this.convertTemplateString(valueText);
            }
            return valueText;
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
    convertTemplateString(templateStr) {
        // Remove backticks
        let content = templateStr.slice(1, -1);
        // Convert template expressions ${...} to C++ string concatenation
        // e.g., `Hello ${name}!` becomes "Hello " + String(name) + "!"
        let result = '';
        let lastIndex = 0;
        const templateRegex = /\$\{([^}]+)\}/g;
        let match;
        const parts = [];
        while ((match = templateRegex.exec(content)) !== null) {
            // Add the text before the template expression
            if (match.index > lastIndex) {
                const textPart = content.substring(lastIndex, match.index);
                if (textPart) {
                    parts.push(`"${textPart}"`);
                }
            }
            // Add the template expression as a String() conversion
            const expr = match[1];
            parts.push(`String(${expr})`);
            lastIndex = match.index + match[0].length;
        }
        // Add any remaining text
        if (lastIndex < content.length) {
            const remainingText = content.substring(lastIndex);
            if (remainingText) {
                parts.push(`"${remainingText}"`);
            }
        }
        // If no template expressions found, just return as a regular string
        if (parts.length === 0) {
            return `"${content}"`;
        }
        // Join with + operators
        return parts.join(' + ');
    }
    getFunctionCallText(ctx) {
        if (!ctx)
            return '';
        // Get function name
        const functionName = ctx.ID().text;
        // Get arguments
        let args = '';
        const argList = ctx.argumentList();
        if (argList) {
            const expressions = argList.expression();
            args = expressions.map((expr) => this.getExpressionText(expr)).join(', ');
        }
        return `${functionName}(${args})`;
    }
    getMethodCallText(ctx) {
        if (!ctx)
            return '';
        // Get object and method names
        const ids = ctx.ID();
        if (ids.length >= 2) {
            const objectName = ids[0].text;
            const methodName = ids[1].text;
            // Get arguments
            let args = '';
            const argList = ctx.argumentList();
            if (argList) {
                const expressions = argList.expression();
                args = expressions.map((expr) => this.getExpressionText(expr)).join(', ');
            }
            // Keep Arduino/system objects as C++ method calls
            // Convert only c-next object instances to C function calls
            const systemObjects = ['Serial', 'Wire', 'SPI'];
            if (systemObjects.includes(objectName)) {
                return `${objectName}.${methodName}(${args})`;
            }
            // Convert c-next object method calls to C-style function calls
            // e.g., blinker.setup() -> Blink_setup()
            // Use the mapping from instance name to class name
            const className = this.instanceToClassMap.get(objectName) || this.capitalizeFirst(objectName);
            return `${className}_${methodName}(${args})`;
        }
        return ctx.text;
    }
    capitalizeFirst(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
    getDeclarationText(ctx) {
        if (!ctx)
            return '';
        // Get type, name, and value
        const type = this.mapTypeToC(ctx.type_specifier().text);
        const name = ctx.ID().text;
        const value = ctx.value().text;
        return `${type} ${name} = ${value}`;
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
        // Add variables (only initialized ones in header)
        classData.variables.forEach(v => {
            if (v.isStatic && v.value !== undefined) {
                header += `static const ${this.mapTypeToC(v.type)} ${v.name} = ${v.value};\n`;
            }
            else if (v.isStatic) {
                // Declare uninitialized static variables as extern in header
                header += `extern ${this.mapTypeToC(v.type)} ${v.name};\n`;
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
        // Add uninitialized static variable definitions
        classData.variables.forEach(v => {
            if (v.isStatic && v.value === undefined) {
                impl += `${this.mapTypeToC(v.type)} ${v.name};\n`;
            }
        });
        if (classData.variables.some(v => v.isStatic && v.value === undefined)) {
            impl += '\n';
        }
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
        this.writeToFile(`${classData.name.toLowerCase()}.cpp`, impl);
    }
    generateMainCCode(mainData) {
        // Generate main.c file
        let impl = '';
        // Add includes
        mainData.includes.forEach(include => {
            impl += `#include "${include}"\n`;
        });
        if (mainData.includes.length > 0) {
            impl += '\n';
        }
        // Add global variable declarations
        mainData.globalVariables.forEach(v => {
            impl += `${v.type} ${v.name};\n`;
        });
        if (mainData.globalVariables.length > 0) {
            impl += '\n';
        }
        // Add function implementations
        mainData.functions.forEach(f => {
            const params = f.parameters.map(p => `${this.mapTypeToC(p.type)} ${p.name}`).join(', ');
            impl += `${this.mapTypeToC(f.returnType)} ${f.name}(${params}) {\n`;
            impl += f.body;
            impl += '}\n\n';
        });
        // Write main.cpp file
        this.writeToFile('main.cpp', impl);
    }
    mapTypeToC(type) {
        const typeMap = {
            'int8': 'int8_t',
            'int16': 'int16_t',
            'int32': 'int32_t',
            'int64': 'int64_t',
            'uint8': 'uint8_t',
            'uint16': 'uint16_t',
            'uint32': 'uint32_t',
            'uint64': 'uint64_t',
            'float32': 'float',
            'float64': 'double',
            'float96': 'long double',
            'String': 'char*',
            'boolean': 'bool',
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
