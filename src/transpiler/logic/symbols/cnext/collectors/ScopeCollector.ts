/**
 * ScopeCollector - Extracts scope declarations and their nested members.
 * ADR-016: Scopes group related functions and control member visibility.
 *
 * Produces TType-based symbols with proper IScopeSymbol references.
 * Uses SymbolRegistry for scope management.
 */

import * as Parser from "../../../parser/grammar/CNextParser";
import DeclarationSite from "../../../../../utils/DeclarationSite";
import ESourceLanguage from "../../../../../utils/types/ESourceLanguage";
import ScopeUtils from "../../../../../utils/ScopeUtils";
import TSymbol from "../../../../types/symbols/TSymbol";
import TVisibility from "../../../../types/TVisibility";
import IScopeCollectorResult from "../types/IScopeCollectorResult";
import SymbolRegistry from "../../../../state/SymbolRegistry";
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
   * Uses SymbolRegistry to get/create the scope, ensuring proper scope
   * references in all member symbols.
   *
   * **Side-effect**: This method calls SymbolRegistry.getOrCreateScope(),
   * which creates the scope in global state if it doesn't exist. Tests
   * should call SymbolRegistry.reset() in beforeEach to ensure isolation.
   *
   * @param ctx The scope declaration context
   * @param sourceFile Source file path
   * @param knownBitmaps Set of known bitmap type names for register resolution
   * @param constValues Map of constant names to their numeric values (for resolving array dimensions)
   * @param isScopeType ADR-057: predicate answering whether a *qualified* name
   *                    is a type declared in a scope. Supplied by CNextResolver
   *                    from a pre-pass so the answer is complete before any
   *                    member's types are resolved.
   * @returns The scope symbol and all member symbols
   */
  static collect(
    ctx: Parser.ScopeDeclarationContext,
    sourceFile: string,
    knownBitmaps: Set<string>,
    constValues?: Map<string, number>,
    isScopeType?: (qualifiedName: string) => boolean,
  ): IScopeCollectorResult {
    const scopeName = ctx.IDENTIFIER().getText();
    const line = ctx.start?.line ?? 0;

    // Get or create the scope via SymbolRegistry
    const scope = SymbolRegistry.getOrCreateScope(scopeName);

    // Update scope metadata (cast to mutable for initialization)
    const mutableScope = scope as unknown as {
      sourceFile: string;
      sourceLine: number;
      sourceLanguage: ESourceLanguage;
      isExported: boolean;
      declarationSites: Set<string>;
    };

    // #1334: RECORD this block; do not overwrite the previous one. ADR-016 lets a
    // scope be reopened, getOrCreateScope caches by path, and this method used
    // to assign sourceFile/sourceLine unconditionally -- so a scope declared in
    // four files reported only the fourth, and a conflict naming two definitions
    // printed one location twice because there was only ever one position.
    //
    // Set membership is keyed on the rendered `file:line`, so re-collecting the
    // same textual block (CNextResolver.resolve runs more than once per file on
    // some paths) is a no-op rather than a duplicate entry.
    mutableScope.declarationSites.add(DeclarationSite.format(sourceFile, line));

    // The scalars keep the FIRST site. Lossless now that declarationSites holds
    // the rest: `sourceLine === 0` is createScope's initial value, so an unset
    // scalar is distinguishable from a real line.
    if (mutableScope.sourceLine === 0) {
      mutableScope.sourceFile = sourceFile;
      mutableScope.sourceLine = line;
    }
    mutableScope.sourceLanguage = ESourceLanguage.CNext;
    mutableScope.isExported = true;

    // Cast readonly collections to mutable (scope is being populated)
    const memberVisibility = scope.memberVisibility as unknown as Map<
      string,
      TVisibility
    >;
    const members = scope.members as unknown as string[];
    const memberSymbols: TSymbol[] = [];

    // #1334: `scope.members` is a shared mutable array on the cached scope, and
    // CNextResolver.resolve runs more than once per file on some paths, so every
    // member was re-pushed on each pass -- measured, a four-block scope grew to
    // [Point, Mode, fromC, runAll, Point, Mode, fromC].
    //
    // Harmless today only by coincidence: the one real consumer wraps it in a Set
    // (TSymbolInfoAdapter.ts:395). That is a latent divergence, not a working
    // path, so the duplication is stopped at the source instead. A scope cannot
    // legitimately hold two members of one name -- that case is a conflict, and
    // conflict detection reads the TSymbols, not this array.
    const addMember = (memberName: string): void => {
      if (!members.includes(memberName)) {
        members.push(memberName);
      }
    };

    for (const member of ctx.scopeMember()) {
      // ADR-016: Extract visibility with member-type-aware defaults
      const visibilityMod = member.visibilityModifier();
      const explicitVisibility = visibilityMod?.getText() as
        | TVisibility
        | undefined;
      const isFunction = member.functionDeclaration() !== null;
      const visibility: TVisibility =
        explicitVisibility ?? ScopeUtils.getDefaultVisibility(isFunction);
      const isPublic = visibility === "public";

      // Handle variable declarations
      if (member.variableDeclaration()) {
        const varDecl = member.variableDeclaration()!;
        const varName = varDecl.IDENTIFIER().getText();
        memberVisibility.set(varName, visibility);
        addMember(varName);

        const varSymbol = VariableCollector.collect(
          varDecl,
          sourceFile,
          scope,
          isPublic,
          constValues,
          isScopeType,
        );
        memberSymbols.push(varSymbol);
      }

      // Handle function declarations
      if (member.functionDeclaration()) {
        const funcDecl = member.functionDeclaration()!;
        const funcName = funcDecl.IDENTIFIER().getText();
        memberVisibility.set(funcName, visibility);
        addMember(funcName);

        // Use collectAndRegister to populate both memberSymbols and SymbolRegistry
        const body = funcDecl.block();
        const funcSymbol = FunctionCollector.collectAndRegister(
          funcDecl,
          sourceFile,
          scope,
          body,
          visibility,
          isScopeType,
        );
        memberSymbols.push(funcSymbol);
      }

      // Handle enum declarations
      if (member.enumDeclaration()) {
        const enumDecl = member.enumDeclaration()!;
        const enumName = enumDecl.IDENTIFIER().getText();
        memberVisibility.set(enumName, visibility);
        addMember(enumName);

        const enumSymbol = EnumCollector.collect(enumDecl, sourceFile, scope);
        memberSymbols.push(enumSymbol);
      }

      // Handle bitmap declarations
      if (member.bitmapDeclaration()) {
        const bitmapDecl = member.bitmapDeclaration()!;
        const bitmapName = bitmapDecl.IDENTIFIER().getText();
        memberVisibility.set(bitmapName, visibility);
        addMember(bitmapName);

        const bitmapSymbol = BitmapCollector.collect(
          bitmapDecl,
          sourceFile,
          scope,
        );
        memberSymbols.push(bitmapSymbol);
      }

      // Handle struct declarations
      if (member.structDeclaration()) {
        const structDecl = member.structDeclaration()!;
        const structName = structDecl.IDENTIFIER().getText();
        memberVisibility.set(structName, visibility);
        addMember(structName);

        const structSymbol = StructCollector.collect(
          structDecl,
          sourceFile,
          scope,
          constValues,
          isScopeType,
        );
        memberSymbols.push(structSymbol);
      }

      // Handle register declarations
      if (member.registerDeclaration()) {
        const regDecl = member.registerDeclaration()!;
        const regName = regDecl.IDENTIFIER().getText();
        memberVisibility.set(regName, visibility);
        addMember(regName);

        const regSymbol = RegisterCollector.collect(
          regDecl,
          sourceFile,
          knownBitmaps,
          scope,
          isScopeType,
        );
        memberSymbols.push(regSymbol);
      }
    }

    return { scopeSymbol: scope, memberSymbols };
  }
}

export default ScopeCollector;
