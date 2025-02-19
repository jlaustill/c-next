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
  ParenExprContext
} from '../parser/cNextParser';
import * as path from 'path';
import * as fs from 'fs';

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
}

export class CGenerationVisitor 
  extends AbstractParseTreeVisitor<any> 
  implements cNextVisitor<any> 
{
  private currentClass?: CClass;

  constructor(private outputDir: string) {
    super();
  }

  visitClassDeclaration(ctx: ClassDeclarationContext) {
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

  private generateCCode(classData: CClass) {
    // Generate header file (.h)
    let header = `#ifndef ${classData.name.toUpperCase()}_H\n`;
    header += `#define ${classData.name.toUpperCase()}_H\n\n`;
    header += '#include <stdint.h>\n\n';  // For int types
    
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

  protected defaultResult() {
    return null;
  }
}