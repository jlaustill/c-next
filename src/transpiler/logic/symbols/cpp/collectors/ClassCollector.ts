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
    let fields: Map<string, ICppFieldInfo> | undefined;

    // Extract class members if symbolTable is provided
    const memberSpec = classSpec.memberSpecification?.();
    if (memberSpec && symbolTable) {
      fields = new Map();
      ClassCollector._collectClassMembers(
        fullName,
        memberSpec,
        sourceFile,
        symbolTable,
        fields,
        memberFunctions,
        warnings,
      );
    } else if (memberSpec) {
      // Still collect member functions even without symbolTable
      ClassCollector._collectClassMembers(
        fullName,
        memberSpec,
        sourceFile,
        null,
        undefined,
        memberFunctions,
        warnings,
      );
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

    ClassCollector._collectClassMembers(
      typedefName,
      memberSpec,
      sourceFile,
      symbolTable,
      fields,
      memberFunctions,
      warnings,
    );

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
    className: string,
    memberSpec: any,
    sourceFile: string,
    symbolTable: SymbolTable | null,
    fields: Map<string, ICppFieldInfo> | undefined,
    memberFunctions: ICppFunctionSymbol[],
    warnings: string[],
  ): void {
    for (const memberDecl of memberSpec.memberdeclaration?.() ?? []) {
      ClassCollector._collectMemberDeclaration(
        className,
        memberDecl,
        sourceFile,
        symbolTable,
        fields,
        memberFunctions,
        warnings,
      );
    }
  }

  /**
   * Collect a single member declaration.
   */
  private static _collectMemberDeclaration(
    className: string,
    memberDecl: any,
    sourceFile: string,
    symbolTable: SymbolTable | null,
    fields: Map<string, ICppFieldInfo> | undefined,
    memberFunctions: ICppFunctionSymbol[],
    warnings: string[],
  ): void {
    const line = memberDecl.start?.line ?? 0;

    // Check for inline function definition within the class
    const funcDef = memberDecl.functionDefinition?.();
    if (funcDef) {
      ClassCollector._collectInlineFunctionDef(
        className,
        funcDef,
        sourceFile,
        line,
        memberFunctions,
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
        className,
        memberDeclarator,
        fieldType,
        sourceFile,
        line,
        symbolTable,
        fields,
        memberFunctions,
        warnings,
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
    className: string,
    memberDeclarator: any,
    fieldType: string,
    sourceFile: string,
    line: number,
    symbolTable: SymbolTable | null,
    fields: Map<string, ICppFieldInfo> | undefined,
    memberFunctions: ICppFunctionSymbol[],
    warnings: string[],
  ): void {
    const declarator = memberDeclarator.declarator?.();
    if (!declarator) return;

    const fieldName = DeclaratorUtils.extractDeclaratorName(declarator);
    if (!fieldName) return;

    // Check if this is a member function
    if (DeclaratorUtils.declaratorIsFunction(declarator)) {
      const symbol = FunctionCollector.collectMemberFunction(
        className,
        fieldName,
        declarator,
        fieldType,
        sourceFile,
        line,
        true, // declaration
      );
      memberFunctions.push(symbol);
      return;
    }

    // Data field
    ClassCollector._collectDataField(
      className,
      fieldName,
      declarator,
      fieldType,
      symbolTable,
      fields,
      warnings,
    );
  }

  /**
   * Collect a data field declaration.
   */
  private static _collectDataField(
    className: string,
    fieldName: string,
    declarator: any,
    fieldType: string,
    symbolTable: SymbolTable | null,
    fields: Map<string, ICppFieldInfo> | undefined,
    warnings: string[],
  ): void {
    // Warn if field name conflicts with C-Next reserved property names
    if (SymbolUtils.isReservedFieldName(fieldName)) {
      warnings.push(
        SymbolUtils.getReservedFieldWarning("C++", className, fieldName),
      );
    }

    // Extract array dimensions if any
    const arrayDimensions = DeclaratorUtils.extractArrayDimensions(declarator);

    // Add to SymbolTable if provided
    if (symbolTable) {
      symbolTable.addStructField(
        className,
        fieldName,
        fieldType,
        arrayDimensions.length > 0 ? arrayDimensions : undefined,
      );
    }

    // Add to fields map if provided
    if (fields) {
      const fieldInfo: ICppFieldInfo = {
        name: fieldName,
        type: fieldType,
        arrayDimensions:
          arrayDimensions.length > 0 ? arrayDimensions : undefined,
      };
      fields.set(fieldName, fieldInfo);
    }
  }
}

export default ClassCollector;
