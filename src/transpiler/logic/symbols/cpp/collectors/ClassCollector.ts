/**
 * ClassCollector - Extracts class/struct definitions from C++ parse trees.
 *
 * Handles class members including data fields and member functions.
 * Produces ICppClassSymbol instances with optional field information.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import ESourceLanguage from "../../../../../utils/types/ESourceLanguage";
import ICppClassSymbol from "../../../../types/symbols/cpp/ICppClassSymbol";
import ICppFunctionSymbol from "../../../../types/symbols/cpp/ICppFunctionSymbol";
import ICppFieldInfo from "../../../../types/symbols/cpp/ICppFieldInfo";
import SymbolTable from "../../SymbolTable";
import SymbolUtils from "../../SymbolUtils";
import DeclaratorUtils from "../utils/DeclaratorUtils";
import FunctionCollector from "./FunctionCollector";

/**
 * Result of collecting a class, including the class symbol and any member function symbols.
 */
interface IClassCollectorResult {
  classSymbol: ICppClassSymbol;
  memberFunctions: ICppFunctionSymbol[];
  warnings: string[];
}

/**
 * Internal context for member collection.
 */
interface IMemberCollectionContext {
  readonly className: string;
  readonly sourceFile: string;
  readonly symbolTable: SymbolTable | null;
  readonly fields: Map<string, ICppFieldInfo> | undefined;
  readonly memberFunctions: ICppFunctionSymbol[];
  readonly warnings: string[];
}

class ClassCollector {
  /**
   * Collect a class specifier and return an ICppClassSymbol with member functions.
   *
   * @param classSpec The class specifier context
   * @param sourceFile Source file path
   * @param line Line number
   * @param currentNamespace Optional current namespace
   * @param symbolTable Optional symbol table for storing field info
   * @returns The class symbol with member functions, or null if no name
   */
  static collect(
    classSpec: any,
    sourceFile: string,
    line: number,
    currentNamespace?: string,
    symbolTable?: SymbolTable | null,
  ): IClassCollectorResult | null {
    const classHead = classSpec.classHead?.();
    if (!classHead) return null;

    const classHeadName = classHead.classHeadName?.();
    if (!classHeadName) return null;

    const className = classHeadName.className?.();
    if (!className) return null;

    const identifier = className.Identifier?.();
    const name = identifier?.getText();
    if (!name) return null;

    const fullName = currentNamespace ? `${currentNamespace}::${name}` : name;

    const memberFunctions: ICppFunctionSymbol[] = [];
    const warnings: string[] = [];
    const fields: Map<string, ICppFieldInfo> | undefined = symbolTable
      ? new Map()
      : undefined;

    // Extract class members
    const memberSpec = classSpec.memberSpecification?.();
    if (memberSpec) {
      const ctx: IMemberCollectionContext = {
        className: fullName,
        sourceFile,
        symbolTable: symbolTable ?? null,
        fields,
        memberFunctions,
        warnings,
      };
      ClassCollector._collectClassMembers(ctx, memberSpec);
    }

    const classSymbol: ICppClassSymbol = {
      kind: "class",
      name: fullName,
      sourceFile,
      sourceLine: line,
      sourceLanguage: ESourceLanguage.Cpp,
      isExported: true,
      parent: currentNamespace,
      fields: fields && fields.size > 0 ? fields : undefined,
    };

    return { classSymbol, memberFunctions, warnings };
  }

  /**
   * Collect an anonymous class from a typedef.
   *
   * @param classSpec The class specifier context (anonymous)
   * @param typedefName The typedef name to use as the class name
   * @param sourceFile Source file path
   * @param line Line number
   * @param symbolTable Symbol table for storing field info
   * @returns The class symbol result, or null on error
   */
  static collectAnonymousTypedef(
    classSpec: any,
    typedefName: string,
    sourceFile: string,
    line: number,
    symbolTable: SymbolTable,
  ): IClassCollectorResult | null {
    const memberSpec = classSpec.memberSpecification?.();
    if (!memberSpec) return null;

    const memberFunctions: ICppFunctionSymbol[] = [];
    const warnings: string[] = [];
    const fields = new Map<string, ICppFieldInfo>();

    const ctx: IMemberCollectionContext = {
      className: typedefName,
      sourceFile,
      symbolTable,
      fields,
      memberFunctions,
      warnings,
    };
    ClassCollector._collectClassMembers(ctx, memberSpec);

    const classSymbol: ICppClassSymbol = {
      kind: "class",
      name: typedefName,
      sourceFile,
      sourceLine: line,
      sourceLanguage: ESourceLanguage.Cpp,
      isExported: true,
      fields: fields.size > 0 ? fields : undefined,
    };

    return { classSymbol, memberFunctions, warnings };
  }

  /**
   * Collect class members (data fields and member functions).
   */
  private static _collectClassMembers(
    ctx: IMemberCollectionContext,
    memberSpec: any,
  ): void {
    for (const memberDecl of memberSpec.memberdeclaration?.() ?? []) {
      ClassCollector._collectMemberDeclaration(memberDecl, ctx);
    }
  }

  /**
   * Collect a single member declaration.
   */
  private static _collectMemberDeclaration(
    memberDecl: any,
    ctx: IMemberCollectionContext,
  ): void {
    const line = memberDecl.start?.line ?? 0;

    // Check for inline function definition within the class
    const funcDef = memberDecl.functionDefinition?.();
    if (funcDef) {
      ClassCollector._collectInlineFunctionDef(
        ctx.className,
        funcDef,
        ctx.sourceFile,
        line,
        ctx.memberFunctions,
      );
      return;
    }

    // Get member declaration list (for data members and function declarations)
    const declSpecSeq = memberDecl.declSpecifierSeq?.();
    if (!declSpecSeq) return;

    const fieldType = DeclaratorUtils.extractTypeFromDeclSpecSeq(declSpecSeq);

    // Get declarator list
    const memberDeclList = memberDecl.memberDeclaratorList?.();
    if (!memberDeclList) return;

    for (const memberDeclarator of memberDeclList.memberDeclarator?.() ?? []) {
      ClassCollector._collectMemberDeclarator(
        memberDeclarator,
        fieldType,
        line,
        ctx,
      );
    }
  }

  /**
   * Collect an inline function definition within a class.
   */
  private static _collectInlineFunctionDef(
    className: string,
    funcDef: any,
    sourceFile: string,
    line: number,
    memberFunctions: ICppFunctionSymbol[],
  ): void {
    const declarator = funcDef.declarator?.();
    if (!declarator) return;

    const funcName = DeclaratorUtils.extractDeclaratorName(declarator);
    if (!funcName) return;

    const declSpecSeq = funcDef.declSpecifierSeq?.();
    const returnType = declSpecSeq
      ? DeclaratorUtils.extractTypeFromDeclSpecSeq(declSpecSeq)
      : "void";

    const symbol = FunctionCollector.collectMemberFunction(
      className,
      funcName,
      declarator,
      returnType,
      sourceFile,
      line,
      false, // not a declaration, it's a definition
    );
    memberFunctions.push(symbol);
  }

  /**
   * Collect a single member declarator (function or data field).
   */
  private static _collectMemberDeclarator(
    memberDeclarator: any,
    fieldType: string,
    line: number,
    ctx: IMemberCollectionContext,
  ): void {
    const declarator = memberDeclarator.declarator?.();
    if (!declarator) return;

    const fieldName = DeclaratorUtils.extractDeclaratorName(declarator);
    if (!fieldName) return;

    // Check if this is a member function
    if (DeclaratorUtils.declaratorIsFunction(declarator)) {
      const symbol = FunctionCollector.collectMemberFunction(
        ctx.className,
        fieldName,
        declarator,
        fieldType,
        ctx.sourceFile,
        line,
        true, // declaration
      );
      ctx.memberFunctions.push(symbol);
      return;
    }

    // Data field
    ClassCollector._collectDataField(fieldName, declarator, fieldType, ctx);
  }

  /**
   * Collect a data field declaration.
   */
  private static _collectDataField(
    fieldName: string,
    declarator: any,
    fieldType: string,
    ctx: IMemberCollectionContext,
  ): void {
    // Warn if field name conflicts with C-Next reserved property names
    if (SymbolUtils.isReservedFieldName(fieldName)) {
      ctx.warnings.push(
        SymbolUtils.getReservedFieldWarning("C++", ctx.className, fieldName),
      );
    }

    // Extract array dimensions if any
    const arrayDimensions = DeclaratorUtils.extractArrayDimensions(declarator);

    // Add to SymbolTable if provided
    if (ctx.symbolTable) {
      ctx.symbolTable.addStructField(
        ctx.className,
        fieldName,
        fieldType,
        arrayDimensions.length > 0 ? arrayDimensions : undefined,
      );
    }

    // Add to fields map if provided
    if (ctx.fields) {
      const fieldInfo: ICppFieldInfo = {
        name: fieldName,
        type: fieldType,
        arrayDimensions:
          arrayDimensions.length > 0 ? arrayDimensions : undefined,
      };
      ctx.fields.set(fieldName, fieldInfo);
    }
  }
}

export default ClassCollector;
