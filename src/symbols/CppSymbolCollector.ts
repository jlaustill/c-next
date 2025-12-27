/**
 * C++ Symbol Collector
 * Extracts symbols from C++ parse trees for the unified symbol table
 */

import { CPP14Parser } from '../parser/cpp/grammar/CPP14Parser.js';
import ISymbol from '../types/ISymbol.js';
import ESymbolKind from '../types/ESymbolKind.js';
import ESourceLanguage from '../types/ESourceLanguage.js';

// Import context types
type TranslationUnitContext = ReturnType<CPP14Parser['translationUnit']>;
type DeclarationContext = InstanceType<typeof CPP14Parser>['declaration'] extends () => infer R ? R : never;

/**
 * Collects symbols from a C++ parse tree
 */
class CppSymbolCollector {
    private sourceFile: string;
    private symbols: ISymbol[] = [];
    private currentNamespace: string | undefined;

    constructor(sourceFile: string) {
        this.sourceFile = sourceFile;
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
        const returnType = declSpecSeq ? this.extractTypeFromDeclSpecSeq(declSpecSeq) : 'void';

        const fullName = this.currentNamespace ? `${this.currentNamespace}::${name}` : name;

        this.symbols.push({
            name: fullName,
            kind: ESymbolKind.Function,
            type: returnType,
            sourceFile: this.sourceFile,
            sourceLine: line,
            sourceLanguage: ESourceLanguage.Cpp,
            isExported: true,
            parent: this.currentNamespace,
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
        this.currentNamespace = this.currentNamespace ? `${this.currentNamespace}::${name}` : name;

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
                const fullName = this.currentNamespace ? `${this.currentNamespace}::${name}` : name;

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

        const fullName = this.currentNamespace ? `${this.currentNamespace}::${name}` : name;

        this.symbols.push({
            name: fullName,
            kind: ESymbolKind.Class,
            sourceFile: this.sourceFile,
            sourceLine: line,
            sourceLanguage: ESourceLanguage.Cpp,
            isExported: true,
            parent: this.currentNamespace,
        });
    }

    private collectEnumSpecifier(enumSpec: any, line: number): void {
        const enumHead = enumSpec.enumHead?.();
        if (!enumHead) return;

        const identifier = enumHead.Identifier?.();
        if (!identifier) return;

        const name = identifier.getText();
        const fullName = this.currentNamespace ? `${this.currentNamespace}::${name}` : name;

        this.symbols.push({
            name: fullName,
            kind: ESymbolKind.Enum,
            sourceFile: this.sourceFile,
            sourceLine: line,
            sourceLanguage: ESourceLanguage.Cpp,
            isExported: true,
            parent: this.currentNamespace,
        });
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

        return parts.join(' ') || 'int';
    }
}

export default CppSymbolCollector;
