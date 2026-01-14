"use strict";
/**
 * C Symbol Collector
 * Extracts symbols from C parse trees for the unified symbol table
 */
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, "__esModule", { value: true });
const ESymbolKind_1 = __importDefault(require("../types/ESymbolKind"));
const ESourceLanguage_1 = __importDefault(require("../types/ESourceLanguage"));
/**
 * Collects symbols from a C parse tree
 */
class CSymbolCollector {
  sourceFile;
  symbols = [];
  symbolTable;
  constructor(sourceFile, symbolTable) {
    this.sourceFile = sourceFile;
    this.symbolTable = symbolTable ?? null;
  }
  /**
   * Collect all symbols from a C compilation unit
   */
  collect(tree) {
    this.symbols = [];
    const translationUnit = tree.translationUnit();
    if (!translationUnit) {
      return this.symbols;
    }
    for (const extDecl of translationUnit.externalDeclaration()) {
      this.collectExternalDeclaration(extDecl);
    }
    return this.symbols;
  }
  collectExternalDeclaration(extDecl) {
    // Function definition
    const funcDef = extDecl.functionDefinition();
    if (funcDef) {
      this.collectFunctionDefinition(funcDef);
      return;
    }
    // Declaration (typedef, struct, variable, function prototype)
    const decl = extDecl.declaration();
    if (decl) {
      this.collectDeclaration(decl);
    }
  }
  collectFunctionDefinition(funcDef) {
    const declarator = funcDef.declarator();
    if (!declarator) return;
    // Extract function name from declarator
    const name = this.extractDeclaratorName(declarator);
    if (!name) return;
    const line = funcDef.start?.line ?? 0;
    // Get return type from declaration specifiers
    const declSpecs = funcDef.declarationSpecifiers();
    const returnType = declSpecs
      ? this.extractTypeFromDeclSpecs(declSpecs)
      : "int";
    this.symbols.push({
      name,
      kind: ESymbolKind_1.default.Function,
      type: returnType,
      sourceFile: this.sourceFile,
      sourceLine: line,
      sourceLanguage: ESourceLanguage_1.default.C,
      isExported: true,
      isDeclaration: false,
    });
  }
  collectDeclaration(decl) {
    const declSpecs = decl.declarationSpecifiers();
    if (!declSpecs) return;
    const line = decl.start?.line ?? 0;
    // Check for typedef
    const isTypedef = this.hasStorageClass(declSpecs, "typedef");
    const isExtern = this.hasStorageClass(declSpecs, "extern");
    // Check for struct/union
    const structSpec = this.findStructOrUnionSpecifier(declSpecs);
    if (structSpec) {
      // For typedef struct, extract the typedef name from declarationSpecifiers
      // Example: typedef struct { ... } AppConfig;
      // "AppConfig" appears as a typedefName in declarationSpecifiers
      let typedefName;
      if (isTypedef) {
        for (const spec of declSpecs.declarationSpecifier()) {
          const typeSpec = spec.typeSpecifier();
          if (typeSpec) {
            const typeName = typeSpec.typedefName?.();
            if (typeName) {
              typedefName = typeName.getText();
              break;
            }
          }
        }
      }
      this.collectStructOrUnion(structSpec, line, typedefName);
    }
    // Check for enum
    const enumSpec = this.findEnumSpecifier(declSpecs);
    if (enumSpec) {
      this.collectEnum(enumSpec, line);
    }
    // Collect declarators (variables, function prototypes, typedefs)
    const initDeclList = decl.initDeclaratorList();
    if (initDeclList) {
      const baseType = this.extractTypeFromDeclSpecs(declSpecs);
      this.collectInitDeclaratorList(
        initDeclList,
        baseType,
        isTypedef,
        isExtern,
        line,
      );
    }
  }
  collectInitDeclaratorList(initDeclList, baseType, isTypedef, isExtern, line) {
    for (const initDecl of initDeclList.initDeclarator()) {
      const declarator = initDecl.declarator();
      if (!declarator) continue;
      const name = this.extractDeclaratorName(declarator);
      if (!name) continue;
      // Check if this is a function declaration (has parameter list)
      const isFunction = this.declaratorIsFunction(declarator);
      if (isTypedef) {
        this.symbols.push({
          name,
          kind: ESymbolKind_1.default.Type,
          type: baseType,
          sourceFile: this.sourceFile,
          sourceLine: line,
          sourceLanguage: ESourceLanguage_1.default.C,
          isExported: true,
        });
      } else if (isFunction) {
        this.symbols.push({
          name,
          kind: ESymbolKind_1.default.Function,
          type: baseType,
          sourceFile: this.sourceFile,
          sourceLine: line,
          sourceLanguage: ESourceLanguage_1.default.C,
          isExported: !isExtern,
          isDeclaration: true,
        });
      } else {
        this.symbols.push({
          name,
          kind: ESymbolKind_1.default.Variable,
          type: baseType,
          sourceFile: this.sourceFile,
          sourceLine: line,
          sourceLanguage: ESourceLanguage_1.default.C,
          isExported: !isExtern,
          isDeclaration: isExtern,
        });
      }
    }
  }
  collectStructOrUnion(structSpec, line, typedefName) {
    const identifier = structSpec.Identifier();
    // Use typedef name for anonymous structs (e.g., typedef struct { ... } AppConfig;)
    const name = identifier?.getText() || typedefName;
    if (!name) return; // Skip if no name available
    const isUnion = structSpec.structOrUnion()?.getText() === "union";
    this.symbols.push({
      name,
      kind: ESymbolKind_1.default.Struct,
      type: isUnion ? "union" : "struct",
      sourceFile: this.sourceFile,
      sourceLine: line,
      sourceLanguage: ESourceLanguage_1.default.C,
      isExported: true,
    });
    // Extract struct field information if SymbolTable is available
    if (this.symbolTable) {
      const declList = structSpec.structDeclarationList();
      if (declList) {
        for (const structDecl of declList.structDeclaration()) {
          this.collectStructFields(name, structDecl);
        }
      }
    }
  }
  collectEnum(enumSpec, line) {
    const identifier = enumSpec.Identifier();
    if (!identifier) return;
    const name = identifier.getText();
    this.symbols.push({
      name,
      kind: ESymbolKind_1.default.Enum,
      sourceFile: this.sourceFile,
      sourceLine: line,
      sourceLanguage: ESourceLanguage_1.default.C,
      isExported: true,
    });
    // Collect enum members
    const enumList = enumSpec.enumeratorList();
    if (enumList) {
      for (const enumeratorDef of enumList.enumerator()) {
        const enumConst = enumeratorDef.enumerationConstant();
        if (enumConst) {
          const memberName = enumConst.Identifier()?.getText();
          if (memberName) {
            this.symbols.push({
              name: memberName,
              kind: ESymbolKind_1.default.EnumMember,
              sourceFile: this.sourceFile,
              sourceLine: enumeratorDef.start?.line ?? line,
              sourceLanguage: ESourceLanguage_1.default.C,
              isExported: true,
              parent: name,
            });
          }
        }
      }
    }
  }
  /**
   * Collect struct field information
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  collectStructFields(structName, structDecl) {
    const specQualList = structDecl.specifierQualifierList?.();
    if (!specQualList) return;
    // Extract the field type from specifierQualifierList
    const fieldType = this.extractTypeFromSpecQualList(specQualList);
    // Extract field names from structDeclaratorList
    const structDeclList = structDecl.structDeclaratorList?.();
    if (!structDeclList) return;
    for (const structDeclarator of structDeclList.structDeclarator()) {
      const declarator = structDeclarator.declarator?.();
      if (!declarator) continue;
      const fieldName = this.extractDeclaratorName(declarator);
      if (!fieldName) continue;
      // Check if this field is an array and extract dimensions
      const arrayDimensions = this.extractArrayDimensions(declarator);
      // Add to SymbolTable
      this.symbolTable.addStructField(
        structName,
        fieldName,
        fieldType,
        arrayDimensions.length > 0 ? arrayDimensions : undefined,
      );
    }
  }
  /**
   * Extract type from specifierQualifierList (for struct fields)
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extractTypeFromSpecQualList(specQualList) {
    const parts = [];
    // Traverse the specifierQualifierList
    let current = specQualList;
    while (current) {
      const typeSpec = current.typeSpecifier?.();
      if (typeSpec) {
        parts.push(typeSpec.getText());
      }
      const typeQual = current.typeQualifier?.();
      if (typeQual) {
        parts.push(typeQual.getText());
      }
      current = current.specifierQualifierList?.();
    }
    return parts.join(" ") || "int";
  }
  /**
   * Extract array dimensions from a declarator
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extractArrayDimensions(declarator) {
    const dimensions = [];
    // Navigate to directDeclarator
    const directDecl = declarator.directDeclarator?.();
    if (!directDecl) return dimensions;
    // Check for array syntax: directDeclarator '[' ... ']'
    // This is a simplified extraction - may need enhancement for complex cases
    const text = directDecl.getText();
    const arrayMatches = text.match(/\[(\d+)\]/g);
    if (arrayMatches) {
      for (const match of arrayMatches) {
        const size = parseInt(match.slice(1, -1), 10);
        if (!isNaN(size)) {
          dimensions.push(size);
        }
      }
    }
    return dimensions;
  }
  // Helper methods
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extractDeclaratorName(declarator) {
    // Direct declarator contains the identifier
    const directDecl = declarator.directDeclarator?.();
    if (!directDecl) return null;
    // Check for identifier
    const identifier = directDecl.Identifier?.();
    if (identifier) {
      return identifier.getText();
    }
    // Nested declarator - recurse
    const nestedDecl = directDecl.declarator?.();
    if (nestedDecl) {
      return this.extractDeclaratorName(nestedDecl);
    }
    return null;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  declaratorIsFunction(declarator) {
    const directDecl = declarator.directDeclarator?.();
    if (!directDecl) return false;
    // Check for parameter type list (function)
    return directDecl.parameterTypeList?.() !== null;
  }
  extractTypeFromDeclSpecs(declSpecs) {
    const parts = [];
    for (const spec of declSpecs.declarationSpecifier()) {
      const typeSpec = spec.typeSpecifier();
      if (typeSpec) {
        parts.push(typeSpec.getText());
      }
    }
    return parts.join(" ") || "int";
  }
  hasStorageClass(declSpecs, storage) {
    for (const spec of declSpecs.declarationSpecifier()) {
      const storageSpec = spec.storageClassSpecifier();
      if (storageSpec && storageSpec.getText() === storage) {
        return true;
      }
    }
    return false;
  }
  findStructOrUnionSpecifier(declSpecs) {
    for (const spec of declSpecs.declarationSpecifier()) {
      const typeSpec = spec.typeSpecifier();
      if (typeSpec) {
        const structSpec = typeSpec.structOrUnionSpecifier?.();
        if (structSpec) {
          return structSpec;
        }
      }
    }
    return null;
  }
  findEnumSpecifier(declSpecs) {
    for (const spec of declSpecs.declarationSpecifier()) {
      const typeSpec = spec.typeSpecifier();
      if (typeSpec) {
        const enumSpec = typeSpec.enumSpecifier?.();
        if (enumSpec) {
          return enumSpec;
        }
      }
    }
    return null;
  }
}
exports.default = CSymbolCollector;
