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
class CGenerationVisitor extends AbstractParseTreeVisitor_1.AbstractParseTreeVisitor {
    constructor(outputDir) {
        super();
        this.outputDir = outputDir;
    }
    visitClassDeclaration(ctx) {
        this.currentClass = {
            name: ctx.ID().text,
            isStatic: ctx.STATIC() !== undefined,
            functions: [],
            variables: []
        };
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
    generateCCode(classData) {
        // Generate header file (.h)
        let header = `#ifndef ${classData.name.toUpperCase()}_H\n`;
        header += `#define ${classData.name.toUpperCase()}_H\n\n`;
        header += '#include <stdint.h>\n\n'; // For int types
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
        let impl = `#include "${classData.name.toLowerCase()}.h"\n\n`;
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
    defaultResult() {
        return null;
    }
}
exports.CGenerationVisitor = CGenerationVisitor;
