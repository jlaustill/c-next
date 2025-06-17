import * as fs from 'fs';
import * as path from 'path';

export interface CFunction {
  name: string;
  returnType: string;
  parameters: Array<{ type: string; name: string }>;
  isStatic?: boolean;
  isInline?: boolean;
}

export interface CVariable {
  name: string;
  type: string;
  isConst?: boolean;
  isStatic?: boolean;
  isExtern?: boolean;
}

export interface CType {
  name: string;
  isStruct?: boolean;
  isEnum?: boolean;
  isTypedef?: boolean;
  members?: Array<{ type: string; name: string }>;
}

export interface ParsedHeader {
  functions: CFunction[];
  variables: CVariable[];
  types: CType[];
  includes: string[];
}

export class CHeaderParser {
  private typeMapping: Record<string, string> = {
    'int': 'int32',
    'short': 'int16',
    'long': 'int64',
    'char': 'int8',
    'unsigned int': 'uint32',
    'unsigned short': 'uint16',
    'unsigned long': 'uint64',
    'unsigned char': 'uint8',
    'float': 'float32',
    'double': 'float64',
    'long double': 'float96',
    'char*': 'String',
    'const char*': 'String',
    'void': 'void',
    'bool': 'boolean',
    '_Bool': 'boolean'
  };

  parse(headerPath: string): ParsedHeader {
    const content = fs.readFileSync(headerPath, 'utf8');
    const cleanContent = this.preprocessContent(content);
    
    return {
      functions: this.extractFunctions(cleanContent),
      variables: this.extractVariables(cleanContent),
      types: this.extractTypes(cleanContent),
      includes: this.extractIncludes(cleanContent)
    };
  }

  private preprocessContent(content: string): string {
    // Remove comments
    content = content.replace(/\/\*[\s\S]*?\*\//g, '');
    content = content.replace(/\/\/.*$/gm, '');
    
    // Remove preprocessor directives except includes
    content = content.replace(/^#(?!include).*$/gm, '');
    
    // Normalize whitespace
    content = content.replace(/\s+/g, ' ');
    content = content.replace(/\s*([{}();,])\s*/g, '$1');
    
    return content;
  }

  private extractIncludes(content: string): string[] {
    const includeRegex = /#include\s*[<"]([^>"]+)[>"]/g;
    const includes: string[] = [];
    let match;
    
    while ((match = includeRegex.exec(content)) !== null) {
      includes.push(match[1]);
    }
    
    return includes;
  }

  private extractFunctions(content: string): CFunction[] {
    const functions: CFunction[] = [];
    
    // Pattern for C function declarations/definitions
    const functionRegex = /(?:(static|inline|extern)\s+)?(\w+(?:\s*\*)*)\s+(\w+)\s*\(([^)]*)\)\s*(?:[{;])/g;
    let match;
    
    while ((match = functionRegex.exec(content)) !== null) {
      const [, modifiers, returnType, name, paramStr] = match;
      
      // Skip if it looks like a macro or struct member
      if (name.startsWith('_') && name.toUpperCase() === name) continue;
      
      const parameters = this.parseParameters(paramStr);
      
      functions.push({
        name,
        returnType: this.mapCTypeToCNext(returnType.trim()),
        parameters: parameters.map(p => ({
          type: this.mapCTypeToCNext(p.type),
          name: p.name
        })),
        isStatic: modifiers?.includes('static'),
        isInline: modifiers?.includes('inline')
      });
    }
    
    return functions;
  }

  private extractVariables(content: string): CVariable[] {
    const variables: CVariable[] = [];
    
    // Pattern for global variable declarations
    const variableRegex = /(?:(static|extern|const)\s+)*(\w+(?:\s*\*)*)\s+(\w+)(?:\s*=\s*[^;]+)?\s*;/g;
    let match;
    
    while ((match = variableRegex.exec(content)) !== null) {
      const [, modifiers, type, name] = match;
      
      // Skip function declarations that might match
      if (content.includes(`${name}(`)) continue;
      
      variables.push({
        name,
        type: this.mapCTypeToCNext(type.trim()),
        isConst: modifiers?.includes('const'),
        isStatic: modifiers?.includes('static'),
        isExtern: modifiers?.includes('extern')
      });
    }
    
    return variables;
  }

  private extractTypes(content: string): CType[] {
    const types: CType[] = [];
    
    // Extract typedefs
    const typedefRegex = /typedef\s+(?:struct\s+)?(\w+)\s+(\w+)\s*;/g;
    let match;
    
    while ((match = typedefRegex.exec(content)) !== null) {
      const [, originalType, newType] = match;
      types.push({
        name: newType,
        isTypedef: true
      });
    }
    
    // Extract struct definitions
    const structRegex = /struct\s+(\w+)\s*\{([^}]+)\}/g;
    while ((match = structRegex.exec(content)) !== null) {
      const [, name, membersStr] = match;
      const members = this.parseStructMembers(membersStr);
      
      types.push({
        name,
        isStruct: true,
        members: members.map(m => ({
          type: this.mapCTypeToCNext(m.type),
          name: m.name
        }))
      });
    }
    
    // Extract enum definitions
    const enumRegex = /enum\s+(\w+)\s*\{([^}]+)\}/g;
    while ((match = enumRegex.exec(content)) !== null) {
      const [, name] = match;
      types.push({
        name,
        isEnum: true
      });
    }
    
    return types;
  }

  private parseParameters(paramStr: string): Array<{ type: string; name: string }> {
    if (!paramStr.trim() || paramStr.trim() === 'void') {
      return [];
    }
    
    const params: Array<{ type: string; name: string }> = [];
    const paramList = paramStr.split(',');
    
    for (const param of paramList) {
      const trimmed = param.trim();
      if (!trimmed) continue;
      
      // Simple parsing - split on last space to separate type and name
      const parts = trimmed.split(/\s+/);
      if (parts.length >= 2) {
        const name = parts.pop()!;
        const type = parts.join(' ');
        params.push({ type, name });
      } else {
        // Parameter with no name (just type)
        params.push({ type: trimmed, name: 'param' + params.length });
      }
    }
    
    return params;
  }

  private parseStructMembers(membersStr: string): Array<{ type: string; name: string }> {
    const members: Array<{ type: string; name: string }> = [];
    const memberDecls = membersStr.split(';');
    
    for (const decl of memberDecls) {
      const trimmed = decl.trim();
      if (!trimmed) continue;
      
      const parts = trimmed.split(/\s+/);
      if (parts.length >= 2) {
        const name = parts.pop()!;
        const type = parts.join(' ');
        members.push({ type, name });
      }
    }
    
    return members;
  }

  private mapCTypeToCNext(cType: string): string {
    // Clean up the type string
    const cleanType = cType.replace(/\s+/g, ' ').trim();
    
    // Direct mapping
    if (this.typeMapping[cleanType]) {
      return this.typeMapping[cleanType];
    }
    
    // Handle pointer types
    if (cleanType.endsWith('*')) {
      const baseType = cleanType.slice(0, -1).trim();
      if (baseType === 'char' || baseType === 'const char') {
        return 'String';
      }
      // For other pointers, we might need to create a special handling
      return `${this.mapCTypeToCNext(baseType)}*`;
    }
    
    // Handle array types
    if (cleanType.includes('[')) {
      const baseType = cleanType.split('[')[0].trim();
      return `${this.mapCTypeToCNext(baseType)}[]`;
    }
    
    // Return as-is if no mapping found
    return cleanType;
  }

  getCNextType(cType: string): string {
    return this.mapCTypeToCNext(cType);
  }
}