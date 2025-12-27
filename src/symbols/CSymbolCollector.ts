/**
 * C Symbol Collector
 * Extracts symbols from C parse trees for the unified symbol table
 */

import { CParser, CompilationUnitContext, ExternalDeclarationContext, FunctionDefinitionContext, DeclarationContext, DeclarationSpecifiersContext, InitDeclaratorListContext, StructOrUnionSpecifierContext, EnumSpecifierContext } from '../parser/c/grammar/CParser.js';
import ISymbol from '../types/ISymbol.js';
import ESymbolKind from '../types/ESymbolKind.js';
import ESourceLanguage from '../types/ESourceLanguage.js';

/**
 * Collects symbols from a C parse tree
 */
class CSymbolCollector {
    private sourceFile: string;
    private symbols: ISymbol[] = [];

    constructor(sourceFile: string) {
        this.sourceFile = sourceFile;
    }

    /**
     * Collect all symbols from a C compilation unit
     */
    collect(tree: CompilationUnitContext): ISymbol[] {
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

    private collectExternalDeclaration(extDecl: ExternalDeclarationContext): void {
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
        const returnType = declSpecs ? this.extractTypeFromDeclSpecs(declSpecs) : 'int';

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
        const isTypedef = this.hasStorageClass(declSpecs, 'typedef');
        const isExtern = this.hasStorageClass(declSpecs, 'extern');

        // Check for struct/union
        const structSpec = this.findStructOrUnionSpecifier(declSpecs);
        if (structSpec) {
            this.collectStructOrUnion(structSpec, line);
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
            this.collectInitDeclaratorList(initDeclList, baseType, isTypedef, isExtern, line);
        }
    }

    private collectInitDeclaratorList(
        initDeclList: InitDeclaratorListContext,
        baseType: string,
        isTypedef: boolean,
        isExtern: boolean,
        line: number
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
        line: number
    ): void {
        const identifier = structSpec.Identifier();
        if (!identifier) return;

        const name = identifier.getText();
        const isUnion = structSpec.structOrUnion()?.getText() === 'union';

        this.symbols.push({
            name,
            kind: ESymbolKind.Struct,
            type: isUnion ? 'union' : 'struct',
            sourceFile: this.sourceFile,
            sourceLine: line,
            sourceLanguage: ESourceLanguage.C,
            isExported: true,
        });
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

    // Helper methods

    private extractDeclaratorName(declarator: any): string | null {
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

    private declaratorIsFunction(declarator: any): boolean {
        const directDecl = declarator.directDeclarator?.();
        if (!directDecl) return false;

        // Check for parameter type list (function)
        return directDecl.parameterTypeList?.() !== null;
    }

    private extractTypeFromDeclSpecs(declSpecs: DeclarationSpecifiersContext): string {
        const parts: string[] = [];

        for (const spec of declSpecs.declarationSpecifier()) {
            const typeSpec = spec.typeSpecifier();
            if (typeSpec) {
                parts.push(typeSpec.getText());
            }
        }

        return parts.join(' ') || 'int';
    }

    private hasStorageClass(declSpecs: DeclarationSpecifiersContext, storage: string): boolean {
        for (const spec of declSpecs.declarationSpecifier()) {
            const storageSpec = spec.storageClassSpecifier();
            if (storageSpec && storageSpec.getText() === storage) {
                return true;
            }
        }
        return false;
    }

    private findStructOrUnionSpecifier(
        declSpecs: DeclarationSpecifiersContext
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
        declSpecs: DeclarationSpecifiersContext
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
