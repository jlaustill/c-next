import { cNextVisitor } from '../parser/cNextVisitor';
import { AbstractParseTreeVisitor } from 'antlr4ts/tree/AbstractParseTreeVisitor';
import {
  ClassDeclarationContext,
  DeclarationContext,
  ClassFunctionContext,
  ExpressionContext,
  ParameterContext,
  StatementContext,
  ValueExprContext,
  AddExprContext,
  ParenExprContext,
  IncludeDirectiveContext,
  SourceFileContext,
  MainSourceFileContext
} from '../parser/cNextParser';
import * as path from 'path';
import * as fs from 'fs';
import { CHeaderParser } from '../parsers/CHeaderParser';
import { SymbolTable } from '../SymbolTable';

interface CFunction {
  returnType: string;
  name: string;
  parameters: Array<{ type: string; name: string }>;
  body: string;
  isPublic: boolean;
}

interface CVariable {
  type: string;
  name: string;
  value: string;
  isStatic: boolean;
}

interface CClass {
  name: string;
  isStatic: boolean;
  functions: CFunction[];
  variables: CVariable[];
  includes: string[];
}

export class CGenerationVisitor 
  extends AbstractParseTreeVisitor<any> 
  implements cNextVisitor<any> 
{
  private currentClass?: CClass;
  private symbolTable: SymbolTable = new SymbolTable();
  private headerParser: CHeaderParser = new CHeaderParser();
  private includePaths: string[] = ['/usr/include', '/usr/local/include'];

  constructor(private outputDir: string, includePaths?: string[]) {
    super();
    if (includePaths) {
      this.includePaths = [...this.includePaths, ...includePaths];
    }
  }

  visitSourceFile(ctx: SourceFileContext) {
    // Process includes first
    ctx.fileDirective().forEach(directive => this.visit(directive));
    
    // Then process class declaration
    this.visit(ctx.classDeclaration());
    return null;
  }

  visitMainSourceFile(ctx: MainSourceFileContext) {
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

  visitIncludeDirective(ctx: IncludeDirectiveContext) {
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

  visitClassDeclaration(ctx: ClassDeclarationContext) {
    if (!this.currentClass) {
      this.currentClass = {
        name: ctx.ID().text,
        isStatic: ctx.STATIC() !== undefined,
        functions: [],
        variables: [],
        includes: []
      };
    } else {
      // Update existing class with declaration info
      this.currentClass.name = ctx.ID().text;
      this.currentClass.isStatic = ctx.STATIC() !== undefined;
    }

    this.visitChildren(ctx);
    this.generateCCode(this.currentClass);
    return this.currentClass;
  }

  visitDeclaration(ctx: DeclarationContext) {
    if (!this.currentClass) return;

    let isStaticContext = this.currentClass.isStatic;
    let parent = ctx.parent;
    while (parent) {
      if (parent.text.includes('static')) {
        isStaticContext = true;
        break;
      }
      parent = parent.parent;
    }

    const variable: CVariable = {
      type: ctx.type_specifier().text,
      name: ctx.ID().text,
      value: ctx.value().text,
      isStatic: isStaticContext
    };

    this.currentClass.variables.push(variable);
  }

  visitClassFunction(ctx: ClassFunctionContext) {
    if (!this.currentClass) return;

    const parameters = this.getParameters(ctx);
    const body = this.getFunctionBody(ctx);

    const func: CFunction = {
      returnType: ctx.returnType().text,
      name: ctx.ID().text,
      parameters,
      body,
      isPublic: ctx.PUBLIC() !== undefined
    };

    this.currentClass.functions.push(func);
  }

  private getParameters(ctx: ClassFunctionContext): Array<{ type: string; name: string }> {
    const params: Array<{ type: string; name: string }> = [];
    const paramList = ctx.parameterList();
    
    if (paramList) {
      paramList.parameter().forEach((param: ParameterContext) => {
        params.push({
          type: param.type_specifier().text,
          name: param.ID().text
        });
      });
    }
    
    return params;
  }

  private getFunctionBody(ctx: ClassFunctionContext): string {
    let body = '';
    
    ctx.statement().forEach((stmt: StatementContext) => {
      if (stmt.RETURN()) {
        body += '    return ' + this.getExpressionText(stmt.expression()) + ';\n';
      }
    });
    
    return body;
  }

  private getExpressionText(ctx: ExpressionContext | undefined): string {
    if (!ctx) return '';
    
    // Check which type of expression we're dealing with
    if (ctx instanceof ValueExprContext) {
        return ctx.value().text;
    }
    
    if (ctx instanceof AddExprContext) {
        const left = this.getExpressionText(ctx.expression(0));
        const right = this.getExpressionText(ctx.expression(1));
        return `${left} + ${right}`;
    }

    if (ctx instanceof ParenExprContext) {
        return `(${this.getExpressionText(ctx.expression())})`;
    }
    
    return ctx.text;
}

  private parseHeaderFile(filename: string) {
    // Try to find the header file in include paths
    let headerPath: string | null = null;
    
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
      } catch (error) {
        console.warn(`Failed to parse header ${filename}:`, error);
      }
    } else {
      console.warn(`Header file not found: ${filename}`);
    }
  }

  private generateCCode(classData: CClass) {
    // Generate header file (.h)
    let header = `#ifndef ${classData.name.toUpperCase()}_H\n`;
    header += `#define ${classData.name.toUpperCase()}_H\n\n`;
    header += '#include <stdint.h>\n';  // For int types
    
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

  private mapTypeToC(type: string): string {
    const typeMap: Record<string, string> = {
      'int8': 'int8_t',
      'int16': 'int16_t',
      'int32': 'int32_t',
      'int64': 'int64_t',
      'String': 'char*',
      'void': 'void'
    };
    return typeMap[type] || type;
  }

  private writeToFile(filename: string, content: string) {
    const filePath = path.join(this.outputDir, filename);
    // Ensure output directory exists
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
    fs.writeFileSync(filePath, content);
    console.log(`Generated: ${filePath}`);
  }

  // Public method to get symbol table for intellisense/validation
  getSymbolTable(): SymbolTable {
    return this.symbolTable;
  }
  
  // Method to validate function calls in c-next code
  validateFunctionCall(functionName: string, args: Array<{ type: string }>): { valid: boolean; error?: string } {
    return this.symbolTable.validateFunctionCall(functionName, args);
  }
  
  // Method to get completion suggestions
  getCompletionSuggestions(prefix: string = '') {
    return this.symbolTable.getCompletionSuggestions(prefix);
  }

  protected defaultResult() {
    return null;
  }
}