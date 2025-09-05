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
  ImportDirectiveContext,
  SourceFileContext,
  MainSourceFileContext,
  GlobalDeclarationContext,
  FunctionDeclarationContext
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

interface CMainFile {
  functions: CFunction[];
  globalVariables: Array<{ type: string; name: string }>;
  includes: string[];
}

export class CGenerationVisitor 
  extends AbstractParseTreeVisitor<any> 
  implements cNextVisitor<any> 
{
  private currentClass?: CClass;
  private currentMainFile?: CMainFile;
  private symbolTable: SymbolTable = new SymbolTable();
  private instanceToClassMap: Map<string, string> = new Map();
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

  visitIncludeDirective(ctx: IncludeDirectiveContext) {
    const filename = ctx.FILENAME().text.slice(1, -1); // Remove quotes
    
    // Add include to current context (either class or main file)
    if (this.currentMainFile) {
      this.currentMainFile.includes.push(filename);
    } else if (this.currentClass) {
      this.currentClass.includes.push(filename);
    } else {
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

  visitImportDirective(ctx: ImportDirectiveContext) {
    const filename = ctx.FILENAME().text.slice(1, -1); // Remove quotes
    
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
    } else if (this.currentClass) {
      this.currentClass.includes.push(includeFile);
    } else {
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

  visitGlobalDeclaration(ctx: GlobalDeclarationContext) {
    if (!this.currentMainFile) return;

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

  visitFunctionDeclaration(ctx: FunctionDeclarationContext) {
    if (!this.currentMainFile) return;

    const returnType = ctx.returnType().text;
    const name = ctx.ID().text;
    const parameters: Array<{ type: string; name: string }> = [];
    
    if (ctx.parameterList()) {
      ctx.parameterList()!.parameter().forEach(param => {
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
        // Handle return statements
        const expr = stmt.expression();
        if (expr) {
          body += '    return ' + this.getExpressionText(expr) + ';\n';
        } else {
          body += '    return;\n';
        }
      } else if (stmt.functionCall()) {
        // Handle function calls like pinMode(LED_BUILTIN, OUTPUT);
        body += '    ' + this.getFunctionCallText(stmt.functionCall()) + ';\n';
      } else if (stmt.methodCall()) {
        // Handle method calls like Serial.begin(115200);
        body += '    ' + this.getMethodCallText(stmt.methodCall()) + ';\n';
      } else if (stmt.declaration()) {
        // Handle variable declarations
        body += '    ' + this.getDeclarationText(stmt.declaration()) + ';\n';
      } else if (stmt.expression()) {
        // Handle general expressions
        body += '    ' + this.getExpressionText(stmt.expression()) + ';\n';
      }
    });
    
    return body;
  }

  private getFunctionDeclarationBody(ctx: FunctionDeclarationContext): string {
    let body = '';
    
    ctx.statement().forEach((stmt: StatementContext) => {
      if (stmt.RETURN()) {
        // Handle return statements
        const expr = stmt.expression();
        if (expr) {
          body += '    return ' + this.getExpressionText(expr) + ';\n';
        } else {
          body += '    return;\n';
        }
      } else if (stmt.functionCall()) {
        // Handle function calls like pinMode(LED_BUILTIN, OUTPUT);
        body += '    ' + this.getFunctionCallText(stmt.functionCall()) + ';\n';
      } else if (stmt.methodCall()) {
        // Handle method calls like Serial.begin(115200);
        body += '    ' + this.getMethodCallText(stmt.methodCall()) + ';\n';
      } else if (stmt.declaration()) {
        // Handle variable declarations
        body += '    ' + this.getDeclarationText(stmt.declaration()) + ';\n';
      } else if (stmt.expression()) {
        // Handle general expressions
        body += '    ' + this.getExpressionText(stmt.expression()) + ';\n';
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

  private getFunctionCallText(ctx: any): string {
    if (!ctx) return '';
    
    // Get function name
    const functionName = ctx.ID().text;
    
    // Get arguments
    let args = '';
    const argList = ctx.argumentList();
    if (argList) {
      const expressions = argList.expression();
      args = expressions.map((expr: any) => this.getExpressionText(expr)).join(', ');
    }
    
    return `${functionName}(${args})`;
  }

  private getMethodCallText(ctx: any): string {
    if (!ctx) return '';
    
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
        args = expressions.map((expr: any) => this.getExpressionText(expr)).join(', ');
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

  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  private getDeclarationText(ctx: any): string {
    if (!ctx) return '';
    
    // Get type, name, and value
    const type = this.mapTypeToC(ctx.type_specifier().text);
    const name = ctx.ID().text;
    const value = ctx.value().text;
    
    return `${type} ${name} = ${value}`;
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
    this.writeToFile(`${classData.name.toLowerCase()}.cpp`, impl);
  }

  private generateMainCCode(mainData: CMainFile) {
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

  private mapTypeToC(type: string): string {
    const typeMap: Record<string, string> = {
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