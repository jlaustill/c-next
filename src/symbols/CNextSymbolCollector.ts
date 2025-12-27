/**
 * C-Next Symbol Collector
 * Extracts symbols from C-Next parse trees for the unified symbol table
 */

import * as Parser from '../parser/grammar/CNextParser.js';
import ISymbol from '../types/ISymbol.js';
import ESymbolKind from '../types/ESymbolKind.js';
import ESourceLanguage from '../types/ESourceLanguage.js';

/**
 * Collects symbols from a C-Next parse tree
 */
class CNextSymbolCollector {
    private sourceFile: string;
    private symbols: ISymbol[] = [];

    constructor(sourceFile: string) {
        this.sourceFile = sourceFile;
    }

    /**
     * Collect all symbols from a C-Next program
     */
    collect(tree: Parser.ProgramContext): ISymbol[] {
        this.symbols = [];

        for (const decl of tree.declaration()) {
            this.collectDeclaration(decl);
        }

        return this.symbols;
    }

    private collectDeclaration(decl: Parser.DeclarationContext): void {
        if (decl.namespaceDeclaration()) {
            this.collectNamespace(decl.namespaceDeclaration()!);
        }

        if (decl.classDeclaration()) {
            this.collectClass(decl.classDeclaration()!);
        }

        if (decl.structDeclaration()) {
            this.collectStruct(decl.structDeclaration()!);
        }

        if (decl.registerDeclaration()) {
            this.collectRegister(decl.registerDeclaration()!);
        }

        if (decl.functionDeclaration()) {
            this.collectFunction(decl.functionDeclaration()!, undefined);
        }

        if (decl.variableDeclaration()) {
            this.collectVariable(decl.variableDeclaration()!, undefined);
        }
    }

    private collectNamespace(ns: Parser.NamespaceDeclarationContext): void {
        const name = ns.IDENTIFIER().getText();
        const line = ns.start?.line ?? 0;

        this.symbols.push({
            name,
            kind: ESymbolKind.Namespace,
            sourceFile: this.sourceFile,
            sourceLine: line,
            sourceLanguage: ESourceLanguage.CNext,
            isExported: true,
        });

        // Collect namespace members
        for (const member of ns.namespaceMember()) {
            if (member.variableDeclaration()) {
                this.collectVariable(member.variableDeclaration()!, name);
            }
            if (member.functionDeclaration()) {
                this.collectFunction(member.functionDeclaration()!, name);
            }
        }
    }

    private collectClass(cls: Parser.ClassDeclarationContext): void {
        const name = cls.IDENTIFIER().getText();
        const line = cls.start?.line ?? 0;

        this.symbols.push({
            name,
            kind: ESymbolKind.Class,
            sourceFile: this.sourceFile,
            sourceLine: line,
            sourceLanguage: ESourceLanguage.CNext,
            isExported: true,
        });

        // Collect class members
        for (const member of cls.classMember()) {
            if (member.fieldDeclaration()) {
                const fieldName = member.fieldDeclaration()!.IDENTIFIER().getText();
                const fieldLine = member.start?.line ?? 0;
                const typeCtx = member.fieldDeclaration()!.type();
                const fieldType = typeCtx ? typeCtx.getText() : 'unknown';

                this.symbols.push({
                    name: fieldName,
                    kind: ESymbolKind.Variable,
                    type: fieldType,
                    sourceFile: this.sourceFile,
                    sourceLine: fieldLine,
                    sourceLanguage: ESourceLanguage.CNext,
                    isExported: true,
                    parent: name,
                });
            }

            if (member.methodDeclaration()) {
                const methodName = member.methodDeclaration()!.IDENTIFIER().getText();
                const methodLine = member.start?.line ?? 0;
                const returnType = member.methodDeclaration()!.type()?.getText() ?? 'void';

                this.symbols.push({
                    name: `${name}_${methodName}`,
                    kind: ESymbolKind.Function,
                    type: returnType,
                    sourceFile: this.sourceFile,
                    sourceLine: methodLine,
                    sourceLanguage: ESourceLanguage.CNext,
                    isExported: true,
                    parent: name,
                });
            }

            if (member.constructorDeclaration()) {
                const ctorLine = member.start?.line ?? 0;

                this.symbols.push({
                    name: `${name}_init`,
                    kind: ESymbolKind.Function,
                    type: 'void',
                    sourceFile: this.sourceFile,
                    sourceLine: ctorLine,
                    sourceLanguage: ESourceLanguage.CNext,
                    isExported: true,
                    parent: name,
                });
            }
        }
    }

    private collectStruct(struct: Parser.StructDeclarationContext): void {
        const name = struct.IDENTIFIER().getText();
        const line = struct.start?.line ?? 0;

        this.symbols.push({
            name,
            kind: ESymbolKind.Struct,
            sourceFile: this.sourceFile,
            sourceLine: line,
            sourceLanguage: ESourceLanguage.CNext,
            isExported: true,
        });
    }

    private collectRegister(reg: Parser.RegisterDeclarationContext): void {
        const name = reg.IDENTIFIER().getText();
        const line = reg.start?.line ?? 0;

        this.symbols.push({
            name,
            kind: ESymbolKind.Register,
            sourceFile: this.sourceFile,
            sourceLine: line,
            sourceLanguage: ESourceLanguage.CNext,
            isExported: true,
        });

        // Collect register members
        for (const member of reg.registerMember()) {
            const memberName = member.IDENTIFIER().getText();
            const memberLine = member.start?.line ?? 0;
            const accessMod = member.accessModifier().getText();
            const memberType = member.type()?.getText() ?? 'u32';

            this.symbols.push({
                name: `${name}_${memberName}`,
                kind: ESymbolKind.RegisterMember,
                type: memberType,
                sourceFile: this.sourceFile,
                sourceLine: memberLine,
                sourceLanguage: ESourceLanguage.CNext,
                isExported: true,
                parent: name,
                accessModifier: accessMod,
            });
        }
    }

    private collectFunction(
        func: Parser.FunctionDeclarationContext,
        parent: string | undefined
    ): void {
        const name = func.IDENTIFIER().getText();
        const line = func.start?.line ?? 0;
        const returnType = func.type()?.getText() ?? 'void';
        const fullName = parent ? `${parent}_${name}` : name;

        // Build signature for overload detection
        const params = func.parameterList()?.parameter() ?? [];
        const paramTypes = params.map(p => p.type()?.getText() ?? 'unknown');
        const signature = `${returnType} ${fullName}(${paramTypes.join(', ')})`;

        this.symbols.push({
            name: fullName,
            kind: ESymbolKind.Function,
            type: returnType,
            sourceFile: this.sourceFile,
            sourceLine: line,
            sourceLanguage: ESourceLanguage.CNext,
            isExported: true,
            parent,
            signature,
        });
    }

    private collectVariable(
        varDecl: Parser.VariableDeclarationContext,
        parent: string | undefined
    ): void {
        const name = varDecl.IDENTIFIER().getText();
        const line = varDecl.start?.line ?? 0;
        const typeCtx = varDecl.type();
        const varType = typeCtx ? typeCtx.getText() : 'unknown';
        const fullName = parent ? `${parent}_${name}` : name;

        // Check for array
        const arrayDim = varDecl.arrayDimension();
        let size: number | undefined;
        if (arrayDim) {
            const dimText = arrayDim.getText();
            const match = dimText.match(/\[(\d+)\]/);
            if (match) {
                size = parseInt(match[1], 10);
            }
        }

        this.symbols.push({
            name: fullName,
            kind: ESymbolKind.Variable,
            type: varType,
            sourceFile: this.sourceFile,
            sourceLine: line,
            sourceLanguage: ESourceLanguage.CNext,
            isExported: true,
            parent,
            size,
        });
    }
}

export default CNextSymbolCollector;
