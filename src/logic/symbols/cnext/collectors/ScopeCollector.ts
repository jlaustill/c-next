/**
 * ScopeCollector - Extracts scope declarations and their nested members.
 * ADR-016: Scopes group related functions and control member visibility.
 */

import * as Parser from "../../../parser/grammar/CNextParser";
import ESourceLanguage from "../../../../utils/types/ESourceLanguage";
import ESymbolKind from "../../../../utils/types/ESymbolKind";
import IScopeSymbol from "../../types/IScopeSymbol";
import TSymbol from "../../types/TSymbol";
import IScopeCollectorResult from "../types/IScopeCollectorResult";
import BitmapCollector from "./BitmapCollector";
import EnumCollector from "./EnumCollector";
import StructCollector from "./StructCollector";
import FunctionCollector from "./FunctionCollector";
import VariableCollector from "./VariableCollector";
import RegisterCollector from "./RegisterCollector";

class ScopeCollector {
  /**
   * Collect a scope declaration and all its nested members.
   *
   * @param ctx The scope declaration context
   * @param sourceFile Source file path
   * @param knownBitmaps Set of known bitmap type names for register resolution
   * @param constValues Map of constant names to their numeric values (for resolving array dimensions)
   * @returns The scope symbol and all member symbols
   */
  static collect(
    ctx: Parser.ScopeDeclarationContext,
    sourceFile: string,
    knownBitmaps: Set<string>,
    constValues?: Map<string, number>,
  ): IScopeCollectorResult {
    const scopeName = ctx.IDENTIFIER().getText();
    const line = ctx.start?.line ?? 0;

    const memberNames: string[] = [];
    const memberVisibility = new Map<string, "public" | "private">();
    const memberSymbols: TSymbol[] = [];

    for (const member of ctx.scopeMember()) {
      // ADR-016: Extract visibility (private by default)
      const visibilityMod = member.visibilityModifier();
      const visibility: "public" | "private" =
        (visibilityMod?.getText() as "public" | "private") ?? "private";
      const isPublic = visibility === "public";

      // Handle variable declarations
      if (member.variableDeclaration()) {
        const varDecl = member.variableDeclaration()!;
        const varName = varDecl.IDENTIFIER().getText();
        memberNames.push(varName);
        memberVisibility.set(varName, visibility);

        const varSymbol = VariableCollector.collect(
          varDecl,
          sourceFile,
          scopeName,
          isPublic,
          constValues,
        );
        memberSymbols.push(varSymbol);
      }

      // Handle function declarations
      if (member.functionDeclaration()) {
        const funcDecl = member.functionDeclaration()!;
        const funcName = funcDecl.IDENTIFIER().getText();
        memberNames.push(funcName);
        memberVisibility.set(funcName, visibility);

        const funcSymbol = FunctionCollector.collect(
          funcDecl,
          sourceFile,
          scopeName,
          visibility,
        );
        memberSymbols.push(funcSymbol);
      }

      // Handle enum declarations
      if (member.enumDeclaration()) {
        const enumDecl = member.enumDeclaration()!;
        const enumName = enumDecl.IDENTIFIER().getText();
        memberNames.push(enumName);
        memberVisibility.set(enumName, visibility);

        const enumSymbol = EnumCollector.collect(
          enumDecl,
          sourceFile,
          scopeName,
        );
        memberSymbols.push(enumSymbol);
      }

      // Handle bitmap declarations
      if (member.bitmapDeclaration()) {
        const bitmapDecl = member.bitmapDeclaration()!;
        const bitmapName = bitmapDecl.IDENTIFIER().getText();
        memberNames.push(bitmapName);
        memberVisibility.set(bitmapName, visibility);

        const bitmapSymbol = BitmapCollector.collect(
          bitmapDecl,
          sourceFile,
          scopeName,
        );
        memberSymbols.push(bitmapSymbol);
      }

      // Handle struct declarations
      if (member.structDeclaration()) {
        const structDecl = member.structDeclaration()!;
        const structName = structDecl.IDENTIFIER().getText();
        memberNames.push(structName);
        memberVisibility.set(structName, visibility);

        const structSymbol = StructCollector.collect(
          structDecl,
          sourceFile,
          scopeName,
        );
        memberSymbols.push(structSymbol);
      }

      // Handle register declarations
      if (member.registerDeclaration()) {
        const regDecl = member.registerDeclaration()!;
        const regName = regDecl.IDENTIFIER().getText();
        memberNames.push(regName);
        memberVisibility.set(regName, visibility);

        const regSymbol = RegisterCollector.collect(
          regDecl,
          sourceFile,
          knownBitmaps,
          scopeName,
        );
        memberSymbols.push(regSymbol);
      }
    }

    const scopeSymbol: IScopeSymbol = {
      name: scopeName,
      sourceFile,
      sourceLine: line,
      sourceLanguage: ESourceLanguage.CNext,
      isExported: true,
      kind: ESymbolKind.Namespace,
      members: memberNames,
      memberVisibility,
    };

    return { scopeSymbol, memberSymbols };
  }
}

export default ScopeCollector;
