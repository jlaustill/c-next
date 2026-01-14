"use strict";
/**
 * C++ Symbol Collector
 * Extracts symbols from C++ parse trees for the unified symbol table
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
 * Collects symbols from a C++ parse tree
 */
class CppSymbolCollector {
  sourceFile;
  symbols = [];
  currentNamespace;
  constructor(sourceFile) {
    this.sourceFile = sourceFile;
  }
  /**
   * Collect all symbols from a C++ translation unit
   */
  collect(tree) {
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
  collectDeclaration(decl) {
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
  collectFunctionDefinition(funcDef, line) {
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
    this.symbols.push({
      name: fullName,
      kind: ESymbolKind_1.default.Function,
      type: returnType,
      sourceFile: this.sourceFile,
      sourceLine: line,
      sourceLanguage: ESourceLanguage_1.default.Cpp,
      isExported: true,
      parent: this.currentNamespace,
    });
  }
  collectNamespaceDefinition(nsDef, line) {
    const identifier = nsDef.Identifier?.();
    const originalNs = nsDef.originalNamespaceName?.();
    const name = identifier?.getText() ?? originalNs?.getText();
    if (!name) return;
    this.symbols.push({
      name,
      kind: ESymbolKind_1.default.Namespace,
      sourceFile: this.sourceFile,
      sourceLine: line,
      sourceLanguage: ESourceLanguage_1.default.Cpp,
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
  collectBlockDeclaration(blockDecl, line) {
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
          kind: ESymbolKind_1.default.Type,
          sourceFile: this.sourceFile,
          sourceLine: line,
          sourceLanguage: ESourceLanguage_1.default.Cpp,
          isExported: true,
          parent: this.currentNamespace,
        });
      }
    }
  }
  collectSimpleDeclaration(simpleDecl, line) {
    const declSpecSeq = simpleDecl.declSpecifierSeq?.();
    if (!declSpecSeq) return;
    const baseType = this.extractTypeFromDeclSpecSeq(declSpecSeq);
    // Check for class specifier
    for (const spec of declSpecSeq.declSpecifier?.() ?? []) {
      const typeSpec = spec.typeSpecifier?.();
      if (typeSpec) {
        const classSpec = typeSpec.classSpecifier?.();
        if (classSpec) {
          this.collectClassSpecifier(classSpec, line);
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
        this.symbols.push({
          name: fullName,
          kind: isFunction
            ? ESymbolKind_1.default.Function
            : ESymbolKind_1.default.Variable,
          type: baseType,
          sourceFile: this.sourceFile,
          sourceLine: line,
          sourceLanguage: ESourceLanguage_1.default.Cpp,
          isExported: true,
          isDeclaration: isFunction,
          parent: this.currentNamespace,
        });
      }
    }
  }
  collectClassSpecifier(classSpec, line) {
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
      kind: ESymbolKind_1.default.Class,
      sourceFile: this.sourceFile,
      sourceLine: line,
      sourceLanguage: ESourceLanguage_1.default.Cpp,
      isExported: true,
      parent: this.currentNamespace,
    });
  }
  collectEnumSpecifier(enumSpec, line) {
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
      kind: ESymbolKind_1.default.Enum,
      sourceFile: this.sourceFile,
      sourceLine: line,
      sourceLanguage: ESourceLanguage_1.default.Cpp,
      isExported: true,
      parent: this.currentNamespace,
    });
  }
  // Helper methods
  extractDeclaratorName(declarator) {
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
  extractNoPointerDeclaratorName(noPtr) {
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
  declaratorIsFunction(declarator) {
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
  extractTypeFromDeclSpecSeq(declSpecSeq) {
    const parts = [];
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
exports.default = CppSymbolCollector;
