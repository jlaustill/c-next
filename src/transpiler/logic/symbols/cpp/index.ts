/**
 * CppResolver - Orchestrates symbol collection from C++ parse trees.
 *
 * Uses composable collectors to extract symbols from different C++ constructs.
 * Produces TCppSymbol instances (discriminated union of C++ symbol types).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { CPP14Parser } from "../../parser/cpp/grammar/CPP14Parser";
import type { DeclSpecifierSeqContext } from "../../parser/cpp/grammar/CPP14Parser";
import TCppSymbol from "../../../types/symbols/cpp/TCppSymbol";
import SymbolTable from "../SymbolTable";
import NamespaceCollector from "./collectors/NamespaceCollector";
import EnumCollector from "./collectors/EnumCollector";
import TypeAliasCollector from "./collectors/TypeAliasCollector";
import FunctionCollector from "./collectors/FunctionCollector";
import ClassCollector from "./collectors/ClassCollector";
import VariableCollector from "./collectors/VariableCollector";
import DeclaratorUtils from "./utils/DeclaratorUtils";
import type ISourceSpan from "../../../types/ISourceSpan";
import ParserUtils from "../../../../utils/ParserUtils";

// Import context types
type TranslationUnitContext = ReturnType<CPP14Parser["translationUnit"]>;

/**
 * Result of resolving C++ symbols.
 */
interface ICppResolverResult {
  symbols: TCppSymbol[];
  warnings: string[];
}

/**
 * Internal context for declaration processing.
 */
interface ICppDeclarationContext {
  readonly sourceFile: string;
  readonly currentNamespace: string | undefined;
  readonly symbolTable: SymbolTable | undefined;
  readonly symbols: TCppSymbol[];
  readonly warnings: string[];
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

    const ctx: ICppDeclarationContext = {
      sourceFile,
      currentNamespace: undefined,
      symbolTable,
      symbols,
      warnings,
    };

    for (const decl of declSeq.declaration()) {
      CppResolver._collectDeclaration(decl, ctx);
    }

    return { symbols, warnings };
  }

  /**
   * Collect symbols from a single declaration.
   */
  private static _collectDeclaration(
    decl: any,
    ctx: ICppDeclarationContext,
  ): void {
    const span = ParserUtils.getSpan(decl);

    // Function definition
    const funcDef = decl.functionDefinition?.();
    if (funcDef) {
      const symbol = FunctionCollector.collectDefinition(
        funcDef,
        ctx.sourceFile,
        span,
        ctx.currentNamespace,
      );
      if (symbol) {
        ctx.symbols.push(symbol);
      }
      return;
    }

    // Namespace definition
    const nsDef = decl.namespaceDefinition?.();
    if (nsDef) {
      CppResolver._collectNamespaceDefinition(nsDef, span, ctx);
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
      CppResolver._collectBlockDeclaration(blockDecl, span, ctx);
    }
  }

  /**
   * Collect symbols from a namespace definition.
   */
  private static _collectNamespaceDefinition(
    nsDef: any,
    span: ISourceSpan,
    ctx: ICppDeclarationContext,
  ): void {
    const nsSymbol = NamespaceCollector.collect(
      nsDef,
      ctx.sourceFile,
      span,
      ctx.currentNamespace,
    );
    if (nsSymbol) {
      ctx.symbols.push(nsSymbol);
    }

    // Process namespace body with updated namespace
    const newNamespace = NamespaceCollector.getFullNamespaceName(
      nsDef,
      ctx.currentNamespace,
    );

    const body = nsDef.declarationseq?.();
    if (body) {
      const nestedCtx: ICppDeclarationContext = {
        ...ctx,
        currentNamespace: newNamespace,
      };
      for (const decl of body.declaration()) {
        CppResolver._collectDeclaration(decl, nestedCtx);
      }
    }
  }

  /**
   * Collect symbols from a block declaration.
   */
  private static _collectBlockDeclaration(
    blockDecl: any,
    span: ISourceSpan,
    ctx: ICppDeclarationContext,
  ): void {
    // Simple declaration (variables, typedefs, class declarations)
    const simpleDecl = blockDecl.simpleDeclaration?.();
    if (simpleDecl) {
      CppResolver._collectSimpleDeclaration(simpleDecl, span, ctx);
    }

    // Alias declaration (using X = Y)
    const aliasDecl = blockDecl.aliasDeclaration?.();
    if (aliasDecl) {
      const symbol = TypeAliasCollector.collect(
        aliasDecl,
        ctx.sourceFile,
        span,
        ctx.currentNamespace,
      );
      if (symbol) {
        ctx.symbols.push(symbol);
      }
    }
  }

  /**
   * Collect symbols from a simple declaration.
   */
  private static _collectSimpleDeclaration(
    simpleDecl: any,
    span: ISourceSpan,
    ctx: ICppDeclarationContext,
  ): void {
    const declSpecSeq = simpleDecl.declSpecifierSeq?.();
    if (!declSpecSeq) return;

    const baseType = DeclaratorUtils.extractTypeFromDeclSpecSeq(declSpecSeq);

    // Process type specifiers (classes, enums)
    const anonymousClassSpec = CppResolver._processTypeSpecifiers(
      declSpecSeq,
      span,
      ctx,
    );

    // Collect declarators (variables, function prototypes)
    const initDeclList = simpleDecl.initDeclaratorList?.();
    if (!initDeclList) return;

    // Issue #1164: `typedef struct opaque_t* handle_t;` is a type, not a
    // variable. Nothing here checked for `typedef`, so it was collected as a
    // variable named handle_t of type int -- and the generated header then
    // emitted both a bogus `typedef struct handle_t handle_t;` forward
    // declaration and a conflicting `typedef int handle_t`.
    const isTypedef = CppResolver._hasTypedefSpecifier(declSpecSeq);

    for (const initDecl of initDeclList.initDeclarator()) {
      const declarator = initDecl.declarator?.();
      if (!declarator) {
        continue;
      }

      if (isTypedef && DeclaratorUtils.declaratorHasPointer(declarator)) {
        const typedefName = DeclaratorUtils.extractDeclaratorName(declarator);
        if (typedefName) {
          // Recorded so the header includes the defining file rather than
          // forward-declaring a struct of the same name, which is a different
          // type entirely.
          ctx.symbolTable?.markPointerTypedef(typedefName);
        }
        continue;
      }

      // A NON-pointer typedef (`typedef unsigned char byte_t;`) is still
      // collected as a variable, which is wrong -- but downstream code depends
      // on the symbol existing, and simply skipping it changes generated C for
      // any file including such a header. Registering it as a type instead is
      // tracked as #1213.

      CppResolver._collectDeclarator(
        declarator,
        baseType,
        span,
        ctx,
        anonymousClassSpec,
      );
    }
  }

  /**
   * Whether a declaration specifier sequence carries the `typedef` keyword.
   */
  private static _hasTypedefSpecifier(
    declSpecSeq: DeclSpecifierSeqContext,
  ): boolean {
    for (const spec of declSpecSeq.declSpecifier?.() ?? []) {
      if (spec.getText?.() === "typedef") {
        return true;
      }
    }
    return false;
  }

  /**
   * Process type specifiers in a declaration, collecting classes and enums.
   * Returns anonymous class specifier if found (for typedef handling).
   */
  private static _processTypeSpecifiers(
    declSpecSeq: any,
    span: ISourceSpan,
    ctx: ICppDeclarationContext,
  ): any {
    let anonymousClassSpec: any = null;

    for (const spec of declSpecSeq.declSpecifier?.() ?? []) {
      const typeSpec = spec.typeSpecifier?.();
      if (!typeSpec) continue;

      const classSpec = typeSpec.classSpecifier?.();
      if (classSpec) {
        const result = CppResolver._handleClassSpecInDecl(classSpec, span, ctx);
        if (result) {
          anonymousClassSpec = result;
        }
      }

      const enumSpec = typeSpec.enumSpecifier?.();
      if (enumSpec) {
        const enumSymbol = EnumCollector.collect(
          enumSpec,
          ctx.sourceFile,
          span,
          ctx.currentNamespace,
          ctx.symbolTable,
        );
        if (enumSymbol) {
          ctx.symbols.push(enumSymbol);
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
    span: ISourceSpan,
    ctx: ICppDeclarationContext,
  ): any {
    const classHead = classSpec.classHead?.();
    const classHeadName = classHead?.classHeadName?.();
    const className = classHeadName?.className?.();
    const identifier = className?.Identifier?.();

    if (identifier?.getText()) {
      // Named struct - collect normally
      const result = ClassCollector.collect(
        classSpec,
        ctx.sourceFile,
        span,
        ctx.currentNamespace,
        ctx.symbolTable,
      );
      if (result) {
        ctx.symbols.push(result.classSymbol, ...result.memberFunctions);
        ctx.warnings.push(...result.warnings);
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
    span: ISourceSpan,
    ctx: ICppDeclarationContext,
    anonymousClassSpec: any,
  ): void {
    const name = DeclaratorUtils.extractDeclaratorName(declarator);
    if (!name) return;

    const isFunction = DeclaratorUtils.declaratorIsFunction(declarator);
    const fullName = ctx.currentNamespace
      ? `${ctx.currentNamespace}::${name}`
      : name;

    // Handle anonymous struct typedef
    if (anonymousClassSpec && ctx.symbolTable) {
      const result = ClassCollector.collectAnonymousTypedef(
        anonymousClassSpec,
        fullName,
        ctx.sourceFile,
        span,
        ctx.symbolTable,
      );
      if (result) {
        ctx.symbols.push(result.classSymbol, ...result.memberFunctions);
        ctx.warnings.push(...result.warnings);
        return;
      }
    }

    if (isFunction) {
      const funcSymbol = FunctionCollector.collectDeclaration(
        declarator,
        baseType,
        ctx.sourceFile,
        span,
        ctx.currentNamespace,
      );
      if (funcSymbol) {
        ctx.symbols.push(funcSymbol);
      }
    } else {
      const varSymbol = VariableCollector.collect(
        declarator,
        baseType,
        ctx.sourceFile,
        span,
        ctx.currentNamespace,
      );
      if (varSymbol) {
        ctx.symbols.push(varSymbol);
      }
    }
  }
}

export default CppResolver;
