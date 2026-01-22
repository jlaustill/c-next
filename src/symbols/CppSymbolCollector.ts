/**
 * C++ Symbol Collector
 * Extracts symbols from C++ parse trees for the unified symbol table
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { CPP14Parser } from "../parser/cpp/grammar/CPP14Parser";
import ISymbol from "../types/ISymbol";
import ESymbolKind from "../types/ESymbolKind";
import ESourceLanguage from "../types/ESourceLanguage";
import SymbolTable from "./SymbolTable";

// Import context types
type TranslationUnitContext = ReturnType<CPP14Parser["translationUnit"]>;

/**
 * Collects symbols from a C++ parse tree
 */
class CppSymbolCollector {
  private sourceFile: string;

  private symbols: ISymbol[] = [];

  private currentNamespace: string | undefined;

  private symbolTable: SymbolTable | null;

  constructor(sourceFile: string, symbolTable?: SymbolTable) {
    this.sourceFile = sourceFile;
    this.symbolTable = symbolTable ?? null;
  }

  /**
   * Collect all symbols from a C++ translation unit
   */
  collect(tree: TranslationUnitContext): ISymbol[] {
    this.symbols = [];
    this.currentNamespace = undefined;

    if (!tree) {
      return this.symbols;
    }

    const declSeq = tree.declarationseq?.();
    if (!declSeq) {
      return this.symbols;
    }

    for (const decl of declSeq.declaration()) {
      this.collectDeclaration(decl);
    }

    return this.symbols;
  }

  private collectDeclaration(decl: any): void {
    const line = decl.start?.line ?? 0;

    // Function definition
    const funcDef = decl.functionDefinition?.();
    if (funcDef) {
      this.collectFunctionDefinition(funcDef, line);
      return;
    }

    // Namespace definition
    const nsDef = decl.namespaceDefinition?.();
    if (nsDef) {
      this.collectNamespaceDefinition(nsDef, line);
      return;
    }

    // Template declaration
    const templDecl = decl.templateDeclaration?.();
    if (templDecl) {
      // Skip template declarations for now - complex to handle
      return;
    }

    // Block declaration (simpleDeclaration, etc.)
    const blockDecl = decl.blockDeclaration?.();
    if (blockDecl) {
      this.collectBlockDeclaration(blockDecl, line);
    }
  }

  private collectFunctionDefinition(funcDef: any, line: number): void {
    const declarator = funcDef.declarator?.();
    if (!declarator) return;

    const name = this.extractDeclaratorName(declarator);
    if (!name) return;

    // Get return type
    const declSpecSeq = funcDef.declSpecifierSeq?.();
    const returnType = declSpecSeq
      ? this.extractTypeFromDeclSpecSeq(declSpecSeq)
      : "void";

    const fullName = this.currentNamespace
      ? `${this.currentNamespace}::${name}`
      : name;

    // Issue #322: Extract function parameters
    const params = this.extractFunctionParameters(declarator);

    this.symbols.push({
      name: fullName,
      kind: ESymbolKind.Function,
      type: returnType,
      sourceFile: this.sourceFile,
      sourceLine: line,
      sourceLanguage: ESourceLanguage.Cpp,
      isExported: true,
      parent: this.currentNamespace,
      parameters: params.length > 0 ? params : undefined,
    });
  }

  private collectNamespaceDefinition(nsDef: any, line: number): void {
    const identifier = nsDef.Identifier?.();
    const originalNs = nsDef.originalNamespaceName?.();

    const name = identifier?.getText() ?? originalNs?.getText();
    if (!name) return;

    this.symbols.push({
      name,
      kind: ESymbolKind.Namespace,
      sourceFile: this.sourceFile,
      sourceLine: line,
      sourceLanguage: ESourceLanguage.Cpp,
      isExported: true,
    });

    // Process namespace body
    const savedNamespace = this.currentNamespace;
    this.currentNamespace = this.currentNamespace
      ? `${this.currentNamespace}::${name}`
      : name;

    const body = nsDef.declarationseq?.();
    if (body) {
      for (const decl of body.declaration()) {
        this.collectDeclaration(decl);
      }
    }

    this.currentNamespace = savedNamespace;
  }

  private collectBlockDeclaration(blockDecl: any, line: number): void {
    // Simple declaration (variables, typedefs, class declarations)
    const simpleDecl = blockDecl.simpleDeclaration?.();
    if (simpleDecl) {
      this.collectSimpleDeclaration(simpleDecl, line);
    }

    // Using declaration
    const usingDecl = blockDecl.usingDeclaration?.();
    if (usingDecl) {
      // Skip using declarations for now
    }

    // Alias declaration (using X = Y)
    const aliasDecl = blockDecl.aliasDeclaration?.();
    if (aliasDecl) {
      const identifier = aliasDecl.Identifier?.();
      if (identifier) {
        this.symbols.push({
          name: identifier.getText(),
          kind: ESymbolKind.Type,
          sourceFile: this.sourceFile,
          sourceLine: line,
          sourceLanguage: ESourceLanguage.Cpp,
          isExported: true,
          parent: this.currentNamespace,
        });
      }
    }
  }

  private collectSimpleDeclaration(simpleDecl: any, line: number): void {
    const declSpecSeq = simpleDecl.declSpecifierSeq?.();
    if (!declSpecSeq) return;

    const baseType = this.extractTypeFromDeclSpecSeq(declSpecSeq);

    // Issue #342: Track anonymous class specifiers for typedef handling
    let anonymousClassSpec: any = null;

    // Check for class specifier
    for (const spec of declSpecSeq.declSpecifier?.() ?? []) {
      const typeSpec = spec.typeSpecifier?.();
      if (typeSpec) {
        const classSpec = typeSpec.classSpecifier?.();
        if (classSpec) {
          // Check if this is a named struct/class
          const classHead = classSpec.classHead?.();
          const classHeadName = classHead?.classHeadName?.();
          const className = classHeadName?.className?.();
          const identifier = className?.Identifier?.();

          if (identifier?.getText()) {
            // Named struct - collect normally
            this.collectClassSpecifier(classSpec, line);
          } else {
            // Issue #342: Anonymous struct - save for typedef handling below
            anonymousClassSpec = classSpec;
          }
        }

        const enumSpec = typeSpec.enumSpecifier?.();
        if (enumSpec) {
          this.collectEnumSpecifier(enumSpec, line);
        }
      }
    }

    // Collect declarators (variables, function prototypes)
    const initDeclList = simpleDecl.initDeclaratorList?.();
    if (initDeclList) {
      for (const initDecl of initDeclList.initDeclarator()) {
        const declarator = initDecl.declarator?.();
        if (!declarator) continue;

        const name = this.extractDeclaratorName(declarator);
        if (!name) continue;

        const isFunction = this.declaratorIsFunction(declarator);
        const fullName = this.currentNamespace
          ? `${this.currentNamespace}::${name}`
          : name;

        // Issue #342: If we have an anonymous struct and this is a typedef,
        // collect struct fields using the typedef name
        if (anonymousClassSpec && this.symbolTable) {
          const memberSpec = anonymousClassSpec.memberSpecification?.();
          if (memberSpec) {
            // Add the type symbol
            this.symbols.push({
              name: fullName,
              kind: ESymbolKind.Class, // Treat typedef'd structs as classes
              sourceFile: this.sourceFile,
              sourceLine: line,
              sourceLanguage: ESourceLanguage.Cpp,
              isExported: true,
              parent: this.currentNamespace,
            });
            // Collect members using the typedef name
            this.collectClassMembers(fullName, memberSpec);
            continue;
          }
        }

        // Issue #322: Extract parameters for function declarations
        const params = isFunction
          ? this.extractFunctionParameters(declarator)
          : [];

        this.symbols.push({
          name: fullName,
          kind: isFunction ? ESymbolKind.Function : ESymbolKind.Variable,
          type: baseType,
          sourceFile: this.sourceFile,
          sourceLine: line,
          sourceLanguage: ESourceLanguage.Cpp,
          isExported: true,
          isDeclaration: isFunction,
          parent: this.currentNamespace,
          parameters: params.length > 0 ? params : undefined,
        });
      }
    }
  }

  private collectClassSpecifier(classSpec: any, line: number): void {
    const classHead = classSpec.classHead?.();
    if (!classHead) return;

    const classHeadName = classHead.classHeadName?.();
    if (!classHeadName) return;

    const className = classHeadName.className?.();
    if (!className) return;

    const identifier = className.Identifier?.();
    const name = identifier?.getText();
    if (!name) return;

    const fullName = this.currentNamespace
      ? `${this.currentNamespace}::${name}`
      : name;

    this.symbols.push({
      name: fullName,
      kind: ESymbolKind.Class,
      sourceFile: this.sourceFile,
      sourceLine: line,
      sourceLanguage: ESourceLanguage.Cpp,
      isExported: true,
      parent: this.currentNamespace,
    });

    // Extract struct/class field information if SymbolTable is available
    if (this.symbolTable) {
      const memberSpec = classSpec.memberSpecification?.();
      if (memberSpec) {
        this.collectClassMembers(fullName, memberSpec);
      }
    }
  }

  /**
   * Collect class/struct member fields
   */
  private collectClassMembers(className: string, memberSpec: any): void {
    // Iterate through member declarations
    for (const memberDecl of memberSpec.memberdeclaration?.() ?? []) {
      this.collectMemberDeclaration(className, memberDecl);
    }
  }

  /**
   * Collect a single member declaration
   */
  private collectMemberDeclaration(className: string, memberDecl: any): void {
    const line = memberDecl.start?.line ?? 0;

    // Issue #322: Check for inline function definition within the class
    const funcDef = memberDecl.functionDefinition?.();
    if (funcDef) {
      const declarator = funcDef.declarator?.();
      if (declarator) {
        const funcName = this.extractDeclaratorName(declarator);
        if (funcName) {
          const declSpecSeq = funcDef.declSpecifierSeq?.();
          const returnType = declSpecSeq
            ? this.extractTypeFromDeclSpecSeq(declSpecSeq)
            : "void";
          const params = this.extractFunctionParameters(declarator);
          const fullName = `${className}::${funcName}`;

          this.symbols.push({
            name: fullName,
            kind: ESymbolKind.Function,
            type: returnType,
            sourceFile: this.sourceFile,
            sourceLine: line,
            sourceLanguage: ESourceLanguage.Cpp,
            isExported: true,
            parent: className,
            parameters: params.length > 0 ? params : undefined,
          });
        }
      }
      return;
    }

    // Get member declaration list (for data members and function declarations)
    const declSpecSeq = memberDecl.declSpecifierSeq?.();
    if (!declSpecSeq) return;

    const fieldType = this.extractTypeFromDeclSpecSeq(declSpecSeq);

    // Get declarator list
    const memberDeclList = memberDecl.memberDeclaratorList?.();
    if (!memberDeclList) return;

    for (const memberDeclarator of memberDeclList.memberDeclarator?.() ?? []) {
      const declarator = memberDeclarator.declarator?.();
      if (!declarator) continue;

      const fieldName = this.extractDeclaratorName(declarator);
      if (!fieldName) continue;

      // Issue #322: Collect member functions with their parameters
      if (this.declaratorIsFunction(declarator)) {
        const params = this.extractFunctionParameters(declarator);
        const fullName = `${className}::${fieldName}`;

        this.symbols.push({
          name: fullName,
          kind: ESymbolKind.Function,
          type: fieldType,
          sourceFile: this.sourceFile,
          sourceLine: line,
          sourceLanguage: ESourceLanguage.Cpp,
          isExported: true,
          isDeclaration: true,
          parent: className,
          parameters: params.length > 0 ? params : undefined,
        });
        continue;
      }

      // Extract array dimensions if any
      const arrayDimensions = this.extractArrayDimensions(declarator);

      // Add to SymbolTable
      this.symbolTable!.addStructField(
        className,
        fieldName,
        fieldType,
        arrayDimensions.length > 0 ? arrayDimensions : undefined,
      );
    }
  }

  /**
   * Extract array dimensions from a declarator
   */
  private extractArrayDimensions(declarator: any): number[] {
    const dimensions: number[] = [];

    // For C++, we need to check both pointer and no-pointer declarators
    const ptrDecl = declarator.pointerDeclarator?.();
    if (ptrDecl) {
      const noPtr = ptrDecl.noPointerDeclarator?.();
      if (noPtr) {
        return this.extractArrayDimensionsFromNoPtr(noPtr);
      }
    }

    const noPtr = declarator.noPointerDeclarator?.();
    if (noPtr) {
      return this.extractArrayDimensionsFromNoPtr(noPtr);
    }

    return dimensions;
  }

  /**
   * Extract array dimensions from a noPointerDeclarator
   */
  private extractArrayDimensionsFromNoPtr(noPtr: any): number[] {
    const dimensions: number[] = [];

    // Check for array notation: noPointerDeclarator '[' ... ']'
    const text = noPtr.getText();
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

  private collectEnumSpecifier(enumSpec: any, line: number): void {
    const enumHead = enumSpec.enumHead?.();
    if (!enumHead) return;

    const identifier = enumHead.Identifier?.();
    if (!identifier) return;

    const name = identifier.getText();
    const fullName = this.currentNamespace
      ? `${this.currentNamespace}::${name}`
      : name;

    this.symbols.push({
      name: fullName,
      kind: ESymbolKind.Enum,
      sourceFile: this.sourceFile,
      sourceLine: line,
      sourceLanguage: ESourceLanguage.Cpp,
      isExported: true,
      parent: this.currentNamespace,
    });

    // Issue #208: Extract enum backing type for typed enums (e.g., enum EPressureType : uint8_t)
    if (this.symbolTable) {
      const enumbase = enumHead.enumbase?.();
      if (enumbase) {
        const typeSpecSeq = enumbase.typeSpecifierSeq?.();
        if (typeSpecSeq) {
          const typeName = typeSpecSeq.getText();
          const bitWidth = this.getTypeWidth(typeName);
          if (bitWidth > 0) {
            this.symbolTable.addEnumBitWidth(fullName, bitWidth);
          }
        }
      }
    }
  }

  /**
   * Issue #208: Map C/C++ type names to their bit widths
   * Supports standard integer types used as enum backing types
   */
  private getTypeWidth(typeName: string): number {
    const typeWidths: Record<string, number> = {
      // stdint.h types
      uint8_t: 8,
      int8_t: 8,
      uint16_t: 16,
      int16_t: 16,
      uint32_t: 32,
      int32_t: 32,
      uint64_t: 64,
      int64_t: 64,
      // Standard C types (common sizes)
      char: 8,
      "signed char": 8,
      "unsigned char": 8,
      short: 16,
      "short int": 16,
      "signed short": 16,
      "signed short int": 16,
      "unsigned short": 16,
      "unsigned short int": 16,
      int: 32,
      "signed int": 32,
      unsigned: 32,
      "unsigned int": 32,
      long: 32,
      "long int": 32,
      "signed long": 32,
      "signed long int": 32,
      "unsigned long": 32,
      "unsigned long int": 32,
      "long long": 64,
      "long long int": 64,
      "signed long long": 64,
      "signed long long int": 64,
      "unsigned long long": 64,
      "unsigned long long int": 64,
    };
    return typeWidths[typeName] ?? 0;
  }

  // Helper methods

  private extractDeclaratorName(declarator: any): string | null {
    // Pointer declarator -> noPointerDeclarator
    const ptrDecl = declarator.pointerDeclarator?.();
    if (ptrDecl) {
      const noPtr = ptrDecl.noPointerDeclarator?.();
      if (noPtr) {
        return this.extractNoPointerDeclaratorName(noPtr);
      }
    }

    // No pointer declarator
    const noPtr = declarator.noPointerDeclarator?.();
    if (noPtr) {
      return this.extractNoPointerDeclaratorName(noPtr);
    }

    return null;
  }

  private extractNoPointerDeclaratorName(noPtr: any): string | null {
    const declId = noPtr.declaratorid?.();
    if (declId) {
      const idExpr = declId.idExpression?.();
      if (idExpr) {
        const unqualId = idExpr.unqualifiedId?.();
        if (unqualId) {
          const identifier = unqualId.Identifier?.();
          if (identifier) {
            return identifier.getText();
          }
        }
      }
    }

    // Recursive case
    const innerNoPtr = noPtr.noPointerDeclarator?.();
    if (innerNoPtr) {
      return this.extractNoPointerDeclaratorName(innerNoPtr);
    }

    return null;
  }

  private declaratorIsFunction(declarator: any): boolean {
    const ptrDecl = declarator.pointerDeclarator?.();
    if (ptrDecl) {
      const noPtr = ptrDecl.noPointerDeclarator?.();
      if (noPtr?.parametersAndQualifiers?.()) {
        return true;
      }
    }

    const noPtr = declarator.noPointerDeclarator?.();
    if (noPtr?.parametersAndQualifiers?.()) {
      return true;
    }

    return false;
  }

  /**
   * Issue #322: Extract function parameters from a declarator.
   * Returns an array of parameter info objects with name, type, and pointer flag.
   */
  private extractFunctionParameters(declarator: any): Array<{
    name: string;
    type: string;
    isConst: boolean;
    isArray: boolean;
  }> {
    const params: Array<{
      name: string;
      type: string;
      isConst: boolean;
      isArray: boolean;
    }> = [];

    // Find parametersAndQualifiers from the declarator
    let paramsAndQuals: any = null;
    const ptrDecl = declarator.pointerDeclarator?.();
    if (ptrDecl) {
      const noPtr = ptrDecl.noPointerDeclarator?.();
      paramsAndQuals = noPtr?.parametersAndQualifiers?.();
    }
    if (!paramsAndQuals) {
      const noPtr = declarator.noPointerDeclarator?.();
      paramsAndQuals = noPtr?.parametersAndQualifiers?.();
    }
    if (!paramsAndQuals) {
      return params;
    }

    // Get parameterDeclarationClause
    const paramClause = paramsAndQuals.parameterDeclarationClause?.();
    if (!paramClause) {
      return params;
    }

    // Get parameterDeclarationList
    const paramList = paramClause.parameterDeclarationList?.();
    if (!paramList) {
      return params;
    }

    // Iterate over parameterDeclaration entries
    for (const paramDecl of paramList.parameterDeclaration?.() ?? []) {
      const paramInfo = this.extractParameterInfo(paramDecl);
      if (paramInfo) {
        params.push(paramInfo);
      }
    }

    return params;
  }

  /**
   * Issue #322: Extract type and name info from a single parameter declaration.
   */
  private extractParameterInfo(paramDecl: any): {
    name: string;
    type: string;
    isConst: boolean;
    isArray: boolean;
  } | null {
    // Get the type from declSpecifierSeq
    const declSpecSeq = paramDecl.declSpecifierSeq?.();
    if (!declSpecSeq) {
      return null;
    }

    let baseType = this.extractTypeFromDeclSpecSeq(declSpecSeq);
    let isConst = false;
    let isPointer = false;

    // Check for const qualifier
    const declText = declSpecSeq.getText();
    if (declText.includes("const")) {
      isConst = true;
    }

    // Check for pointer in declarator or abstractDeclarator
    const declarator = paramDecl.declarator?.();
    const abstractDecl = paramDecl.abstractDeclarator?.();

    if (declarator) {
      // Check if declarator has pointer operator
      if (this.declaratorHasPointer(declarator)) {
        isPointer = true;
      }
    }
    if (abstractDecl) {
      // Abstract declarator (no name) - check for pointer
      if (this.abstractDeclaratorHasPointer(abstractDecl)) {
        isPointer = true;
      }
    }

    // If pointer, append * to the type
    if (isPointer) {
      baseType = baseType + "*";
    }

    // Get parameter name (may be empty for abstract declarators)
    let paramName = "";
    if (declarator) {
      const name = this.extractDeclaratorName(declarator);
      if (name) {
        paramName = name;
      }
    }

    return {
      name: paramName,
      type: baseType,
      isConst,
      isArray: false, // Could be enhanced to detect arrays
    };
  }

  /**
   * Issue #322: Check if a declarator contains a pointer operator.
   */
  private declaratorHasPointer(declarator: any): boolean {
    const ptrDecl = declarator.pointerDeclarator?.();
    if (ptrDecl) {
      // Check for pointerOperator children
      const ptrOps = ptrDecl.pointerOperator?.();
      if (ptrOps && ptrOps.length > 0) {
        return true;
      }
      // Also check getText for *
      if (ptrDecl.getText().includes("*")) {
        return true;
      }
    }
    return false;
  }

  /**
   * Issue #322: Check if an abstract declarator (pointer without name) contains a pointer.
   */
  private abstractDeclaratorHasPointer(abstractDecl: any): boolean {
    // Check for pointerAbstractDeclarator
    const ptrAbstract = abstractDecl.pointerAbstractDeclarator?.();
    if (ptrAbstract) {
      const ptrOps = ptrAbstract.pointerOperator?.();
      if (ptrOps && ptrOps.length > 0) {
        return true;
      }
      if (ptrAbstract.getText().includes("*")) {
        return true;
      }
    }
    // Simple check for * in the text
    if (abstractDecl.getText().includes("*")) {
      return true;
    }
    return false;
  }

  private extractTypeFromDeclSpecSeq(declSpecSeq: any): string {
    const parts: string[] = [];

    for (const spec of declSpecSeq.declSpecifier?.() ?? []) {
      const typeSpec = spec.typeSpecifier?.();
      if (typeSpec) {
        const trailingType = typeSpec.trailingTypeSpecifier?.();
        if (trailingType) {
          const simpleType = trailingType.simpleTypeSpecifier?.();
          if (simpleType) {
            parts.push(simpleType.getText());
          }
        }
      }
    }

    return parts.join(" ") || "int";
  }
}

export default CppSymbolCollector;
