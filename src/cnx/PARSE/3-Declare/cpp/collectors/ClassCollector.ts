/**
 * ClassCollector - C++ class/struct symbols from 1.2's lowered header (#1991).
 *
 * Handles class members including data fields and member functions.
 * Produces ICppClassSymbol instances with optional field information.
 */

import ESourceLanguage from "../../../../utils/types/ESourceLanguage";
import ICppClassSymbol from "../../../../types/symbols/cpp/ICppClassSymbol";
import ICppFunctionSymbol from "../../../../types/symbols/cpp/ICppFunctionSymbol";
import ICppFieldInfo from "../../../../types/symbols/cpp/ICppFieldInfo";
import SymbolTable from "../../SymbolTable";
import SymbolUtils from "../../SymbolUtils";
import DeclaratorTypes from "../../shared/DeclaratorTypes";
import FunctionCollector from "./FunctionCollector";
import type ISourceSpan from "../../../../types/ISourceSpan";
import type ICppClassSyntax from "../../../2-Parse/types/ICppClassSyntax";
import type ICppFunctionDefinitionSyntax from "../../../2-Parse/types/ICppFunctionDefinitionSyntax";
import type IHeaderDeclaratorSyntax from "../../../2-Parse/types/IHeaderDeclaratorSyntax";
import type TCppMemberSyntax from "../../../2-Parse/types/TCppMemberSyntax";

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
   * @param classSyntax The class 1.2 lowered
   * @param sourceFile Source file path
   * @param span Source span of the declaration
   * @param currentNamespace Optional current namespace
   * @param symbolTable Optional symbol table for storing field info
   * @returns The class symbol with member functions, or null if no name
   */
  static collect(
    classSyntax: ICppClassSyntax,
    sourceFile: string,
    span: ISourceSpan,
    currentNamespace?: string,
    symbolTable?: SymbolTable | null,
  ): IClassCollectorResult | null {
    const name = classSyntax.name;
    if (!name) return null;

    const fullName = currentNamespace ? `${currentNamespace}::${name}` : name;

    const memberFunctions: ICppFunctionSymbol[] = [];
    const warnings: string[] = [];
    const fields: Map<string, ICppFieldInfo> | undefined = symbolTable
      ? new Map()
      : undefined;

    // Extract class members
    const members = classSyntax.members;
    if (members) {
      const ctx: IMemberCollectionContext = {
        className: fullName,
        sourceFile,
        symbolTable: symbolTable ?? null,
        fields,
        memberFunctions,
        warnings,
      };
      ClassCollector._collectClassMembers(ctx, members);
    }

    const classSymbol: ICppClassSymbol = {
      kind: "class",
      name: fullName,
      sourceFile,
      span,
      sourceLanguage: ESourceLanguage.Cpp,
      visibility: "public",
      parent: currentNamespace,
      fields: fields && fields.size > 0 ? fields : undefined,
    };

    return { classSymbol, memberFunctions, warnings };
  }

  /**
   * Collect an anonymous class from a typedef.
   *
   * @param classSyntax The anonymous class 1.2 lowered
   * @param typedefName The typedef name to use as the class name
   * @param sourceFile Source file path
   * @param span Source span of the declaration
   * @param symbolTable Symbol table for storing field info
   * @returns The class symbol result, or null on error
   */
  static collectAnonymousTypedef(
    classSyntax: ICppClassSyntax,
    typedefName: string,
    sourceFile: string,
    span: ISourceSpan,
    symbolTable: SymbolTable,
  ): IClassCollectorResult | null {
    const members = classSyntax.members;
    if (!members) return null;

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
    ClassCollector._collectClassMembers(ctx, members);

    const classSymbol: ICppClassSymbol = {
      kind: "class",
      name: typedefName,
      sourceFile,
      span,
      sourceLanguage: ESourceLanguage.Cpp,
      visibility: "public",
      fields: fields.size > 0 ? fields : undefined,
    };

    return { classSymbol, memberFunctions, warnings };
  }

  /**
   * Collect class members (data fields and member functions). 1.2 does not
   * lower access labels, so every member is recorded "public" (#1475).
   */
  private static _collectClassMembers(
    ctx: IMemberCollectionContext,
    members: readonly TCppMemberSyntax[],
  ): void {
    for (const member of members) {
      if (member.kind === "functionDefinition") {
        ClassCollector._collectInlineFunctionDef(member, ctx);
        continue;
      }
      for (const declarator of member.declarators) {
        ClassCollector._collectMemberDeclarator(
          declarator,
          member.fieldType,
          member.span,
          ctx,
        );
      }
    }
  }

  /**
   * Collect an inline function definition within a class.
   */
  private static _collectInlineFunctionDef(
    funcDef: ICppFunctionDefinitionSyntax,
    ctx: IMemberCollectionContext,
  ): void {
    const funcName = funcDef.declarator.name;
    if (!funcName) return;
    ctx.memberFunctions.push(
      FunctionCollector.collectMemberFunction(
        ctx.className,
        funcName,
        funcDef.declarator,
        funcDef.returnType,
        ctx.sourceFile,
        funcDef.span,
        false, // not a declaration, it's a definition
      ),
    );
  }

  /**
   * Collect a single member declarator (function or data field).
   */
  private static _collectMemberDeclarator(
    declarator: IHeaderDeclaratorSyntax,
    fieldType: string,
    span: ISourceSpan,
    ctx: IMemberCollectionContext,
  ): void {
    const fieldName = declarator.name;
    if (!fieldName) return;

    // Check if this is a member function -- a pointer to one is a data
    // member, as a C struct's function-pointer field is (#1760 review)
    if (declarator.isFunction && declarator.functionPointerParams === null) {
      ctx.memberFunctions.push(
        FunctionCollector.collectMemberFunction(
          ctx.className,
          fieldName,
          declarator,
          fieldType,
          ctx.sourceFile,
          span,
          true, // declaration
        ),
      );
      return;
    }

    ClassCollector._collectDataField(fieldName, declarator, fieldType, ctx);
  }

  /**
   * Collect a data field declaration.
   */
  private static _collectDataField(
    fieldName: string,
    declarator: IHeaderDeclaratorSyntax,
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
    const arrayDimensions = [...declarator.arrayDimensions];
    // The declarator's indirection, recorded as the C side records it
    const declaredType = DeclaratorTypes.declaredType(fieldType, declarator);

    // Add to SymbolTable if provided
    if (ctx.symbolTable) {
      ctx.symbolTable.addStructField(
        ctx.className,
        fieldName,
        declaredType,
        arrayDimensions.length > 0 ? arrayDimensions : undefined,
      );
    }

    // Add to fields map if provided
    if (ctx.fields) {
      const fieldInfo: ICppFieldInfo = {
        name: fieldName,
        type: declaredType,
        arrayDimensions:
          arrayDimensions.length > 0 ? arrayDimensions : undefined,
      };
      ctx.fields.set(fieldName, fieldInfo);
    }
  }
}

export default ClassCollector;
