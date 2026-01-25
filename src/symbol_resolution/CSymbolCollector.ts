/**
 * C Symbol Collector
 * Extracts symbols from C parse trees for the unified symbol table
 */

import {
  CompilationUnitContext,
  ExternalDeclarationContext,
  FunctionDefinitionContext,
  DeclarationContext,
  DeclarationSpecifiersContext,
  InitDeclaratorListContext,
  StructOrUnionSpecifierContext,
  EnumSpecifierContext,
} from "../antlr_parser/c/grammar/CParser";
import ISymbol from "../types/ISymbol";
import ESymbolKind from "../types/ESymbolKind";
import ESourceLanguage from "../types/ESourceLanguage";
import SymbolTable from "./SymbolTable";
import SymbolUtils from "./SymbolUtils";

/**
 * Collects symbols from a C parse tree
 */
class CSymbolCollector {
  private sourceFile: string;

  private symbols: ISymbol[] = [];

  private warnings: string[] = [];

  private symbolTable: SymbolTable | null;

  constructor(sourceFile: string, symbolTable?: SymbolTable) {
    this.sourceFile = sourceFile;
    this.symbolTable = symbolTable ?? null;
  }

  /**
   * Get warnings generated during symbol collection
   */
  getWarnings(): string[] {
    return this.warnings;
  }

  /**
   * Collect all symbols from a C compilation unit
   */
  collect(tree: CompilationUnitContext): ISymbol[] {
    this.symbols = [];
    this.warnings = [];

    const translationUnit = tree.translationUnit();
    if (!translationUnit) {
      return this.symbols;
    }

    for (const extDecl of translationUnit.externalDeclaration()) {
      this.collectExternalDeclaration(extDecl);
    }

    return this.symbols;
  }

  private collectExternalDeclaration(
    extDecl: ExternalDeclarationContext,
  ): void {
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

  private collectFunctionDefinition(funcDef: FunctionDefinitionContext): void {
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
      kind: ESymbolKind.Function,
      type: returnType,
      sourceFile: this.sourceFile,
      sourceLine: line,
      sourceLanguage: ESourceLanguage.C,
      isExported: true,
      isDeclaration: false,
    });
  }

  private collectDeclaration(decl: DeclarationContext): void {
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
      let typedefName: string | undefined;
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

      this.collectStructOrUnion(structSpec, line, typedefName, isTypedef);
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

  private collectInitDeclaratorList(
    initDeclList: InitDeclaratorListContext,
    baseType: string,
    isTypedef: boolean,
    isExtern: boolean,
    line: number,
  ): void {
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
          kind: ESymbolKind.Type,
          type: baseType,
          sourceFile: this.sourceFile,
          sourceLine: line,
          sourceLanguage: ESourceLanguage.C,
          isExported: true,
        });
      } else if (isFunction) {
        this.symbols.push({
          name,
          kind: ESymbolKind.Function,
          type: baseType,
          sourceFile: this.sourceFile,
          sourceLine: line,
          sourceLanguage: ESourceLanguage.C,
          isExported: !isExtern,
          isDeclaration: true,
        });
      } else {
        this.symbols.push({
          name,
          kind: ESymbolKind.Variable,
          type: baseType,
          sourceFile: this.sourceFile,
          sourceLine: line,
          sourceLanguage: ESourceLanguage.C,
          isExported: !isExtern,
          isDeclaration: isExtern,
        });
      }
    }
  }

  private collectStructOrUnion(
    structSpec: StructOrUnionSpecifierContext,
    line: number,
    typedefName?: string,
    isTypedef?: boolean,
  ): void {
    const identifier = structSpec.Identifier();

    // Use typedef name for anonymous structs (e.g., typedef struct { ... } AppConfig;)
    const name = identifier?.getText() || typedefName;
    if (!name) return; // Skip if no name available

    const isUnion = structSpec.structOrUnion()?.getText() === "union";

    this.symbols.push({
      name,
      kind: ESymbolKind.Struct,
      type: isUnion ? "union" : "struct",
      sourceFile: this.sourceFile,
      sourceLine: line,
      sourceLanguage: ESourceLanguage.C,
      isExported: true,
    });

    // Issue #196 Bug 3: Mark named structs that are not typedef'd
    // These require 'struct' keyword when referenced in C
    // Example: "struct NamedPoint { ... };" -> needs "struct NamedPoint var"
    // But "typedef struct { ... } Rectangle;" -> just "Rectangle var"
    if (this.symbolTable && identifier && !isTypedef) {
      this.symbolTable.markNeedsStructKeyword(name);
    }

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

  private collectEnum(enumSpec: EnumSpecifierContext, line: number): void {
    const identifier = enumSpec.Identifier();
    if (!identifier) return;

    const name = identifier.getText();

    this.symbols.push({
      name,
      kind: ESymbolKind.Enum,
      sourceFile: this.sourceFile,
      sourceLine: line,
      sourceLanguage: ESourceLanguage.C,
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
              kind: ESymbolKind.EnumMember,
              sourceFile: this.sourceFile,
              sourceLine: enumeratorDef.start?.line ?? line,
              sourceLanguage: ESourceLanguage.C,
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
  private collectStructFields(structName: string, structDecl: any): void {
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

      // Warn if field name conflicts with C-Next reserved property names
      if (SymbolUtils.isReservedFieldName(fieldName)) {
        this.warnings.push(
          `Warning: C header struct '${structName}' has field '${fieldName}' which conflicts with C-Next's .${fieldName} property. ` +
            `Consider renaming the field or be aware that '${structName}.${fieldName}' may not work as expected in C-Next code.`,
        );
      }

      // Check if this field is an array and extract dimensions
      const arrayDimensions = this.extractArrayDimensions(declarator);

      // Add to SymbolTable
      this.symbolTable!.addStructField(
        structName,
        fieldName,
        fieldType,
        arrayDimensions.length > 0 ? arrayDimensions : undefined,
      );
    }
  }

  /**
   * Extract type from specifierQualifierList (for struct fields)
   * Issue #196 Bug 1 Fix: For struct/union field types, extract just the
   * identifier (e.g., "InnerConfig") not the concatenated text ("structInnerConfig")
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private extractTypeFromSpecQualList(specQualList: any): string {
    const parts: string[] = [];

    // Traverse the specifierQualifierList
    let current = specQualList;
    while (current) {
      const typeSpec = current.typeSpecifier?.();
      if (typeSpec) {
        // Check for struct/union specifier - need to extract just the identifier
        const structSpec = typeSpec.structOrUnionSpecifier?.();
        if (structSpec) {
          const identifier = structSpec.Identifier?.();
          if (identifier) {
            // Use just the struct/union name, not "structName" concatenated
            parts.push(identifier.getText());
          } else {
            // Anonymous struct - use full text
            parts.push(typeSpec.getText());
          }
        } else {
          parts.push(typeSpec.getText());
        }
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
  private extractArrayDimensions(declarator: any): number[] {
    // Navigate to directDeclarator
    const directDecl = declarator.directDeclarator?.();
    if (!directDecl) return [];

    // Use shared utility for regex-based extraction
    return SymbolUtils.parseArrayDimensions(directDecl.getText());
  }

  // Helper methods

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private extractDeclaratorName(declarator: any): string | null {
    // Direct declarator contains the identifier
    const directDecl = declarator.directDeclarator?.();
    if (!directDecl) return null;

    return this.extractDirectDeclaratorName(directDecl);
  }

  /**
   * Issue #355: Extract identifier from directDeclarator, handling arrays and function pointers.
   * The C grammar has recursive directDeclarator for arrays: `directDeclarator '[' ... ']'`
   * so `buf[8]` is parsed as directDeclarator('[', directDeclarator('buf'), ']')
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private extractDirectDeclaratorName(directDecl: any): string | null {
    // Check for identifier (base case)
    const identifier = directDecl.Identifier?.();
    if (identifier) {
      return identifier.getText();
    }

    // Nested declarator in parentheses: '(' declarator ')'
    const nestedDecl = directDecl.declarator?.();
    if (nestedDecl) {
      return this.extractDeclaratorName(nestedDecl);
    }

    // Issue #355: Nested directDeclarator for arrays/functions
    // Grammar: directDeclarator '[' ... ']' or directDeclarator '(' ... ')'
    const nestedDirectDecl = directDecl.directDeclarator?.();
    if (nestedDirectDecl) {
      return this.extractDirectDeclaratorName(nestedDirectDecl);
    }

    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private declaratorIsFunction(declarator: any): boolean {
    const directDecl = declarator.directDeclarator?.();
    if (!directDecl) return false;

    // Check for parameter type list (function)
    return directDecl.parameterTypeList?.() !== null;
  }

  private extractTypeFromDeclSpecs(
    declSpecs: DeclarationSpecifiersContext,
  ): string {
    const parts: string[] = [];

    for (const spec of declSpecs.declarationSpecifier()) {
      const typeSpec = spec.typeSpecifier();
      if (typeSpec) {
        parts.push(typeSpec.getText());
      }
    }

    return parts.join(" ") || "int";
  }

  private hasStorageClass(
    declSpecs: DeclarationSpecifiersContext,
    storage: string,
  ): boolean {
    for (const spec of declSpecs.declarationSpecifier()) {
      const storageSpec = spec.storageClassSpecifier();
      if (storageSpec && storageSpec.getText() === storage) {
        return true;
      }
    }
    return false;
  }

  private findStructOrUnionSpecifier(
    declSpecs: DeclarationSpecifiersContext,
  ): StructOrUnionSpecifierContext | null {
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

  private findEnumSpecifier(
    declSpecs: DeclarationSpecifiersContext,
  ): EnumSpecifierContext | null {
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

export default CSymbolCollector;
