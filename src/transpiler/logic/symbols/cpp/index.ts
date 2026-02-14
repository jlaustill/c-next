/**
 * CppResolver - Orchestrates symbol collection from C++ parse trees.
 *
 * Uses composable collectors to extract symbols from different C++ constructs.
 * Produces TCppSymbol instances (discriminated union of C++ symbol types).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { CPP14Parser } from "../../parser/cpp/grammar/CPP14Parser";
import TCppSymbol from "../../../types/symbols/cpp/TCppSymbol";
import SymbolTable from "../SymbolTable";
import NamespaceCollector from "./collectors/NamespaceCollector";
import EnumCollector from "./collectors/EnumCollector";
import TypeAliasCollector from "./collectors/TypeAliasCollector";
import FunctionCollector from "./collectors/FunctionCollector";
import ClassCollector from "./collectors/ClassCollector";
import VariableCollector from "./collectors/VariableCollector";
import DeclaratorUtils from "./utils/DeclaratorUtils";

// Import context types
type TranslationUnitContext = ReturnType<CPP14Parser["translationUnit"]>;

/**
 * Result of resolving C++ symbols.
 */
interface ICppResolverResult {
  symbols: TCppSymbol[];
  warnings: string[];
}

class CppResolver {
  /**
   * Resolve all symbols from a C++ translation unit.
   *
   * @param tree The translation unit context from the parser
   * @param sourceFile Source file path
   * @param symbolTable Optional symbol table for storing struct fields, enum bit widths
   * @returns Result containing symbols and warnings
   */
  static resolve(
    tree: TranslationUnitContext,
    sourceFile: string,
    symbolTable?: SymbolTable,
  ): ICppResolverResult {
    const symbols: TCppSymbol[] = [];
    const warnings: string[] = [];

    if (!tree) {
      return { symbols, warnings };
    }

    const declSeq = tree.declarationseq?.();
    if (!declSeq) {
      return { symbols, warnings };
    }

    for (const decl of declSeq.declaration()) {
      CppResolver._collectDeclaration(
        decl,
        sourceFile,
        undefined, // currentNamespace
        symbolTable,
        symbols,
        warnings,
      );
    }

    return { symbols, warnings };
  }

  /**
   * Collect symbols from a single declaration.
   */
  private static _collectDeclaration(
    decl: any,
    sourceFile: string,
    currentNamespace: string | undefined,
    symbolTable: SymbolTable | undefined,
    symbols: TCppSymbol[],
    warnings: string[],
  ): void {
    const line = decl.start?.line ?? 0;

    // Function definition
    const funcDef = decl.functionDefinition?.();
    if (funcDef) {
      const symbol = FunctionCollector.collectDefinition(
        funcDef,
        sourceFile,
        line,
        currentNamespace,
      );
      if (symbol) {
        symbols.push(symbol);
      }
      return;
    }

    // Namespace definition
    const nsDef = decl.namespaceDefinition?.();
    if (nsDef) {
      CppResolver._collectNamespaceDefinition(
        nsDef,
        sourceFile,
        line,
        currentNamespace,
        symbolTable,
        symbols,
        warnings,
      );
      return;
    }

    // Template declaration - skip for now (complex to handle)
    const templDecl = decl.templateDeclaration?.();
    if (templDecl) {
      return;
    }

    // Block declaration (simpleDeclaration, etc.)
    const blockDecl = decl.blockDeclaration?.();
    if (blockDecl) {
      CppResolver._collectBlockDeclaration(
        blockDecl,
        sourceFile,
        line,
        currentNamespace,
        symbolTable,
        symbols,
        warnings,
      );
    }
  }

  /**
   * Collect symbols from a namespace definition.
   */
  private static _collectNamespaceDefinition(
    nsDef: any,
    sourceFile: string,
    line: number,
    currentNamespace: string | undefined,
    symbolTable: SymbolTable | undefined,
    symbols: TCppSymbol[],
    warnings: string[],
  ): void {
    const nsSymbol = NamespaceCollector.collect(
      nsDef,
      sourceFile,
      line,
      currentNamespace,
    );
    if (nsSymbol) {
      symbols.push(nsSymbol);
    }

    // Process namespace body
    const newNamespace = NamespaceCollector.getFullNamespaceName(
      nsDef,
      currentNamespace,
    );

    const body = nsDef.declarationseq?.();
    if (body) {
      for (const decl of body.declaration()) {
        CppResolver._collectDeclaration(
          decl,
          sourceFile,
          newNamespace,
          symbolTable,
          symbols,
          warnings,
        );
      }
    }
  }

  /**
   * Collect symbols from a block declaration.
   */
  private static _collectBlockDeclaration(
    blockDecl: any,
    sourceFile: string,
    line: number,
    currentNamespace: string | undefined,
    symbolTable: SymbolTable | undefined,
    symbols: TCppSymbol[],
    warnings: string[],
  ): void {
    // Simple declaration (variables, typedefs, class declarations)
    const simpleDecl = blockDecl.simpleDeclaration?.();
    if (simpleDecl) {
      CppResolver._collectSimpleDeclaration(
        simpleDecl,
        sourceFile,
        line,
        currentNamespace,
        symbolTable,
        symbols,
        warnings,
      );
    }

    // Alias declaration (using X = Y)
    const aliasDecl = blockDecl.aliasDeclaration?.();
    if (aliasDecl) {
      const symbol = TypeAliasCollector.collect(
        aliasDecl,
        sourceFile,
        line,
        currentNamespace,
      );
      if (symbol) {
        symbols.push(symbol);
      }
    }
  }

  /**
   * Collect symbols from a simple declaration.
   */
  private static _collectSimpleDeclaration(
    simpleDecl: any,
    sourceFile: string,
    line: number,
    currentNamespace: string | undefined,
    symbolTable: SymbolTable | undefined,
    symbols: TCppSymbol[],
    warnings: string[],
  ): void {
    const declSpecSeq = simpleDecl.declSpecifierSeq?.();
    if (!declSpecSeq) return;

    const baseType = DeclaratorUtils.extractTypeFromDeclSpecSeq(declSpecSeq);
    let anonymousClassSpec: any = null;

    // Process type specifiers (classes, enums)
    anonymousClassSpec = CppResolver._processTypeSpecifiers(
      declSpecSeq,
      sourceFile,
      line,
      currentNamespace,
      symbolTable,
      symbols,
      warnings,
    );

    // Collect declarators (variables, function prototypes)
    const initDeclList = simpleDecl.initDeclaratorList?.();
    if (!initDeclList) return;

    for (const initDecl of initDeclList.initDeclarator()) {
      const declarator = initDecl.declarator?.();
      if (declarator) {
        CppResolver._collectDeclarator(
          declarator,
          baseType,
          sourceFile,
          line,
          currentNamespace,
          symbolTable,
          symbols,
          warnings,
          anonymousClassSpec,
        );
      }
    }
  }

  /**
   * Process type specifiers in a declaration, collecting classes and enums.
   * Returns anonymous class specifier if found (for typedef handling).
   */
  private static _processTypeSpecifiers(
    declSpecSeq: any,
    sourceFile: string,
    line: number,
    currentNamespace: string | undefined,
    symbolTable: SymbolTable | undefined,
    symbols: TCppSymbol[],
    warnings: string[],
  ): any {
    let anonymousClassSpec: any = null;

    for (const spec of declSpecSeq.declSpecifier?.() ?? []) {
      const typeSpec = spec.typeSpecifier?.();
      if (!typeSpec) continue;

      const classSpec = typeSpec.classSpecifier?.();
      if (classSpec) {
        const result = CppResolver._handleClassSpecInDecl(
          classSpec,
          sourceFile,
          line,
          currentNamespace,
          symbolTable,
          symbols,
          warnings,
        );
        if (result) {
          anonymousClassSpec = result;
        }
      }

      const enumSpec = typeSpec.enumSpecifier?.();
      if (enumSpec) {
        const enumSymbol = EnumCollector.collect(
          enumSpec,
          sourceFile,
          line,
          currentNamespace,
          symbolTable,
        );
        if (enumSymbol) {
          symbols.push(enumSymbol);
        }
      }
    }

    return anonymousClassSpec;
  }

  /**
   * Handle a class specifier in a declaration.
   * Returns the class spec if it's anonymous (for typedef handling).
   */
  private static _handleClassSpecInDecl(
    classSpec: any,
    sourceFile: string,
    line: number,
    currentNamespace: string | undefined,
    symbolTable: SymbolTable | undefined,
    symbols: TCppSymbol[],
    warnings: string[],
  ): any {
    const classHead = classSpec.classHead?.();
    const classHeadName = classHead?.classHeadName?.();
    const className = classHeadName?.className?.();
    const identifier = className?.Identifier?.();

    if (identifier?.getText()) {
      // Named struct - collect normally
      const result = ClassCollector.collect(
        classSpec,
        sourceFile,
        line,
        currentNamespace,
        symbolTable,
      );
      if (result) {
        symbols.push(result.classSymbol);
        symbols.push(...result.memberFunctions);
        warnings.push(...result.warnings);
      }
      return null;
    }

    // Anonymous struct - return for typedef handling
    return classSpec;
  }

  /**
   * Process a single declarator (variable or function).
   */
  private static _collectDeclarator(
    declarator: any,
    baseType: string,
    sourceFile: string,
    line: number,
    currentNamespace: string | undefined,
    symbolTable: SymbolTable | undefined,
    symbols: TCppSymbol[],
    warnings: string[],
    anonymousClassSpec: any,
  ): void {
    const name = DeclaratorUtils.extractDeclaratorName(declarator);
    if (!name) return;

    const isFunction = DeclaratorUtils.declaratorIsFunction(declarator);
    const fullName = currentNamespace ? `${currentNamespace}::${name}` : name;

    // Handle anonymous struct typedef
    if (anonymousClassSpec && symbolTable) {
      const result = ClassCollector.collectAnonymousTypedef(
        anonymousClassSpec,
        fullName,
        sourceFile,
        line,
        symbolTable,
      );
      if (result) {
        symbols.push(result.classSymbol);
        symbols.push(...result.memberFunctions);
        warnings.push(...result.warnings);
        return;
      }
    }

    if (isFunction) {
      const funcSymbol = FunctionCollector.collectDeclaration(
        declarator,
        baseType,
        sourceFile,
        line,
        currentNamespace,
      );
      if (funcSymbol) {
        symbols.push(funcSymbol);
      }
    } else {
      const varSymbol = VariableCollector.collect(
        declarator,
        baseType,
        sourceFile,
        line,
        currentNamespace,
      );
      if (varSymbol) {
        symbols.push(varSymbol);
      }
    }
  }
}

export default CppResolver;
