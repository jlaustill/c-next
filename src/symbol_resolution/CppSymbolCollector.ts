/**
 * C++ Symbol Collector
 * Extracts symbols from C++ parse trees for the unified symbol table
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  CPP14Parser,
  ClassSpecifierContext,
} from "../antlr_parser/cpp/grammar/CPP14Parser";
import ISymbol from "../types/ISymbol";
import ESymbolKind from "../types/ESymbolKind";
import ESourceLanguage from "../types/ESourceLanguage";
import SymbolTable from "./SymbolTable";
import SymbolUtils from "./SymbolUtils";
import SymbolCollectorContext from "./SymbolCollectorContext";
import ICollectorContext from "./types/ICollectorContext";

// Import context types
type TranslationUnitContext = ReturnType<CPP14Parser["translationUnit"]>;

/**
 * Collects symbols from a C++ parse tree
 */
class CppSymbolCollector {
  private ctx: ICollectorContext;

  private currentNamespace: string | undefined;

  constructor(sourceFile: string, symbolTable?: SymbolTable) {
    this.ctx = SymbolCollectorContext.create(sourceFile, symbolTable);
  }

  /**
   * Get warnings generated during symbol collection
   */
  getWarnings(): string[] {
    return SymbolCollectorContext.getWarnings(this.ctx);
  }

  /**
   * Collect all symbols from a C++ translation unit
   */
  collect(tree: TranslationUnitContext): ISymbol[] {
    SymbolCollectorContext.reset(this.ctx);
    this.currentNamespace = undefined;

    if (!tree) {
      return SymbolCollectorContext.getSymbols(this.ctx);
    }

    const declSeq = tree.declarationseq?.();
    if (!declSeq) {
      return SymbolCollectorContext.getSymbols(this.ctx);
    }

    for (const decl of declSeq.declaration()) {
      this.collectDeclaration(decl);
    }

    return SymbolCollectorContext.getSymbols(this.ctx);
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

    SymbolCollectorContext.addSymbol(this.ctx, {
      name: fullName,
      kind: ESymbolKind.Function,
      type: returnType,
      sourceFile: this.ctx.sourceFile,
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

    SymbolCollectorContext.addSymbol(this.ctx, {
      name,
      kind: ESymbolKind.Namespace,
      sourceFile: this.ctx.sourceFile,
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
        SymbolCollectorContext.addSymbol(this.ctx, {
          name: identifier.getText(),
          kind: ESymbolKind.Type,
          sourceFile: this.ctx.sourceFile,
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
    let anonymousClassSpec: ClassSpecifierContext | null = null;

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
        if (anonymousClassSpec && this.ctx.symbolTable) {
          const memberSpec = anonymousClassSpec.memberSpecification?.();
          if (memberSpec) {
            // Add the type symbol
            SymbolCollectorContext.addSymbol(this.ctx, {
              name: fullName,
              kind: ESymbolKind.Class, // Treat typedef'd structs as classes
              sourceFile: this.ctx.sourceFile,
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

        SymbolCollectorContext.addSymbol(this.ctx, {
          name: fullName,
          kind: isFunction ? ESymbolKind.Function : ESymbolKind.Variable,
          type: baseType,
          sourceFile: this.ctx.sourceFile,
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

    SymbolCollectorContext.addSymbol(this.ctx, {
      name: fullName,
      kind: ESymbolKind.Class,
      sourceFile: this.ctx.sourceFile,
      sourceLine: line,
      sourceLanguage: ESourceLanguage.Cpp,
      isExported: true,
      parent: this.currentNamespace,
    });

    // Extract struct/class field information if SymbolTable is available
    if (this.ctx.symbolTable) {
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

          SymbolCollectorContext.addSymbol(this.ctx, {
            name: fullName,
            kind: ESymbolKind.Function,
            type: returnType,
            sourceFile: this.ctx.sourceFile,
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

        SymbolCollectorContext.addSymbol(this.ctx, {
          name: fullName,
          kind: ESymbolKind.Function,
          type: fieldType,
          sourceFile: this.ctx.sourceFile,
          sourceLine: line,
          sourceLanguage: ESourceLanguage.Cpp,
          isExported: true,
          isDeclaration: true,
          parent: className,
          parameters: params.length > 0 ? params : undefined,
        });
        continue;
      }

      // Warn if field name conflicts with C-Next reserved property names
      if (SymbolUtils.isReservedFieldName(fieldName)) {
        SymbolCollectorContext.addWarning(
          this.ctx,
          `Warning: C++ header struct '${className}' has field '${fieldName}' which conflicts with C-Next's .${fieldName} property. ` +
            `Consider renaming the field or be aware that '${className}.${fieldName}' may not work as expected in C-Next code.`,
        );
      }

      // Extract array dimensions if any
      const arrayDimensions = this.extractArrayDimensions(declarator);

      // Add to SymbolTable
      this.ctx.symbolTable!.addStructField(
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
    // Use shared utility for regex-based extraction
    return SymbolUtils.parseArrayDimensions(noPtr.getText());
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

    SymbolCollectorContext.addSymbol(this.ctx, {
      name: fullName,
      kind: ESymbolKind.Enum,
      sourceFile: this.ctx.sourceFile,
      sourceLine: line,
      sourceLanguage: ESourceLanguage.Cpp,
      isExported: true,
      parent: this.currentNamespace,
    });

    // Issue #208: Extract enum backing type for typed enums (e.g., enum EPressureType : uint8_t)
    if (this.ctx.symbolTable) {
      const enumbase = enumHead.enumbase?.();
      if (enumbase) {
        const typeSpecSeq = enumbase.typeSpecifierSeq?.();
        if (typeSpecSeq) {
          const typeName = typeSpecSeq.getText();
          const bitWidth = this.getTypeWidth(typeName);
          if (bitWidth > 0) {
            this.ctx.symbolTable.addEnumBitWidth(fullName, bitWidth);
          }
        }
      }
    }
  }

  /**
   * Issue #208: Map C/C++ type names to their bit widths
   * Delegates to shared utility for consistent type width mapping
   */
  private getTypeWidth(typeName: string): number {
    return SymbolUtils.getTypeWidth(typeName);
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
