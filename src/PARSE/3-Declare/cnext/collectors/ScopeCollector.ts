/**
 * ScopeCollector - Extracts scope declarations and their nested members.
 * ADR-016: Scopes group related functions and control member visibility.
 *
 * Produces TType-based symbols with proper IScopeSymbol references.
 * Uses SymbolRegistry for scope management.
 */

import * as Parser from "../../../../transpiler/logic/parser/grammar/CNextParser";
import DeclarationSite from "../../../../utils/DeclarationSite";
import ESourceLanguage from "../../../../utils/types/ESourceLanguage";
import ScopeUtils from "../../../../utils/ScopeUtils";
import TSymbol from "../../../../transpiler/types/symbols/TSymbol";
import TVisibility from "../../../../transpiler/types/TVisibility";
import IScopeCollectorResult from "../types/IScopeCollectorResult";
import SymbolRegistry from "../../../../transpiler/state/SymbolRegistry";
import BitmapCollector from "./BitmapCollector";
import EnumCollector from "./EnumCollector";
import StructCollector from "./StructCollector";
import FunctionCollector from "./FunctionCollector";
import VariableCollector from "./VariableCollector";
import RegisterCollector from "./RegisterCollector";
import type ISourceSpan from "../../../../transpiler/types/ISourceSpan";
import UNSET_SOURCE_SPAN from "../../../../transpiler/constants/UNSET_SOURCE_SPAN";
import ParserUtils from "../../../../utils/ParserUtils";

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
    const span = ParserUtils.getSpan(ctx);

    // Get or create the scope via SymbolRegistry
    const scope = SymbolRegistry.getOrCreateScope(scopeName);

    // #1298: members carry the scope's PATH, not the scope object. Derived once
    // here so the six member collectors below cannot disagree about it.
    const scopePath = ScopeUtils.pathOf(scope);

    // Update scope metadata (cast to mutable for initialization)
    const mutableScope = scope as unknown as {
      sourceFile: string;
      span: ISourceSpan;
      sourceLanguage: ESourceLanguage;
      visibility: TVisibility;
      declarationSites: Set<string>;
    };

    // #1334: RECORD this block; do not overwrite the previous one. ADR-016 lets a
    // scope be reopened, getOrCreateScope caches by path, and this method used
    // to assign sourceFile/sourceLine unconditionally -- so a scope declared in
    // four files reported only the fourth, and a conflict naming two definitions
    // printed one location twice because there was only ever one position.
    //
    // Set membership is keyed on the rendered `file:line`, so re-collecting the
    // same textual block is a no-op rather than a duplicate entry.
    //
    // #1301 removed the only thing that presented a duplicate: `CNextResolver.resolve`
    // ran twice per file while Transpiler stages 3 and 5 each declared every file,
    // and now runs once. A scope REOPENED across files does NOT present one either --
    // each declaring block contributes a DISTINCT `file:line`. So this dedup is now
    // a ratchet with nothing exercising it, kept so that a reintroduced second pass
    // is absorbed rather than silently duplicating. Stated plainly because the
    // alternative is a comment claiming coverage the code no longer has.
    mutableScope.declarationSites.add(
      DeclarationSite.format(sourceFile, span.line),
    );

    // The scalars keep the FIRST site. Lossless now that declarationSites holds
    // the rest: UNSET_SOURCE_SPAN is createScope's initial value and its line is
    // 0, which no real position can be because ANTLR lines are 1-based -- so an
    // unset span is distinguishable from a real one.
    if (mutableScope.span.line === UNSET_SOURCE_SPAN.line) {
      mutableScope.sourceFile = sourceFile;
      mutableScope.span = span;
    }
    mutableScope.sourceLanguage = ESourceLanguage.CNext;
    // A scope is a container, not a declaration -- it is never marked private,
    // and `PublicInterface` excludes kind "scope" from the header regardless.
    mutableScope.visibility = "public";

    // Cast readonly collections to mutable (scope is being populated)
    const memberVisibility = scope.memberVisibility as unknown as Map<
      string,
      TVisibility
    >;
    const members = scope.members as unknown as string[];
    const memberSymbols: TSymbol[] = [];

    // #1334: `scope.members` is a shared mutable array on the cached scope, and
    // `CNextResolver.resolve` USED TO run more than once per file, so every member
    // was re-pushed on each pass -- measured, a four-block scope grew to
    // [Point, Mode, fromC, runAll, Point, Mode, fromC]. #1301 removed that pass.
    //
    // Like the `declarationSites` dedup above, this one is now UNEXERCISED: a
    // reopened scope contributes distinct names, and two members sharing a name in
    // one scope are rejected as E0425 before this list is read. Kept as a ratchet
    // against a reintroduced second pass, not because anything reaches it today.
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
      const visibility = ScopeUtils.getMemberVisibility(member);

      // Handle variable declarations
      if (member.variableDeclaration()) {
        const varDecl = member.variableDeclaration()!;
        const varName = varDecl.IDENTIFIER().getText();
        memberVisibility.set(varName, visibility);
        addMember(varName);

        const varSymbol = VariableCollector.collect(
          varDecl,
          sourceFile,
          scopePath,
          visibility,
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
          scopePath,
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

        const enumSymbol = EnumCollector.collect(
          enumDecl,
          sourceFile,
          scopePath,
          visibility,
        );
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
          scopePath,
          visibility,
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
          scopePath,
          visibility,
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
          scopePath,
          visibility,
          isScopeType,
        );
        memberSymbols.push(regSymbol);
      }
    }

    return { scopeSymbol: scope, memberSymbols };
  }
}

export default ScopeCollector;
