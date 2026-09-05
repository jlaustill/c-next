/**
 * RegisterCollector - Extracts register block declarations from parse trees.
 * Registers provide typed access to memory-mapped I/O locations.
 *
 * Produces TType-based IRegisterSymbol with proper IScopeSymbol references.
 */

import * as Parser from "../../../../transpiler/logic/parser/grammar/CNextParser";
import ESourceLanguage from "../../../../utils/types/ESourceLanguage";
import IRegisterSymbol from "../../../../transpiler/types/symbols/IRegisterSymbol";
import type IRegisterMemberSymbol from "../../../../transpiler/types/symbols/IRegisterMemberSymbol";
import TypeUtils from "../utils/TypeUtils";
import ScopeUtils from "../../../../utils/ScopeUtils";
import TVisibility from "../../../../transpiler/types/TVisibility";
import ParserUtils from "../../../../utils/ParserUtils";
import MemberSymbolBase from "../utils/MemberSymbolBase";

/** Access mode type for register members */
type TAccessMode = "rw" | "ro" | "wo" | "w1c" | "w1s";

class RegisterCollector {
  /**
   * Collect a register declaration and return an IRegisterSymbol.
   *
   * @param ctx The register declaration context
   * @param sourceFile Source file path
   * @param knownBitmaps Set of known bitmap type names for reference resolution
   * @param scopePath The path of the scope this register belongs to (dotted path, "" at file scope)
   * @param isScopeType ADR-057 predicate: is this *qualified* name a scope type?
   * @returns The register symbol with proper scope reference
   */
  static collect(
    ctx: Parser.RegisterDeclarationContext,
    sourceFile: string,
    knownBitmaps: Set<string>,
    scopePath: string,
    visibility: TVisibility,
    isScopeType?: (qualifiedName: string) => boolean,
  ): IRegisterSymbol {
    const name = ctx.IDENTIFIER().getText();
    const span = ParserUtils.getSpan(ctx);
    // #1298: members carry the scope's PATH, not the scope object. The path
    // holds every outer component, so nothing downstream can flatten it to a
    // leaf -- which is what the reference threaded here used to protect against.
    const baseAddress = ctx.expression().getText();

    // Collect register members
    const members = new Map<string, IRegisterMemberSymbol>();
    // #1318: a member hangs off the REGISTER, not the enclosing scope.
    const identity = ScopeUtils.identityOf({ name, scopePath });
    const ownerScopedName = identity.cnxScopedName;

    for (const member of ctx.registerMember()) {
      const memberName = member.IDENTIFIER().getText();
      const offset = member.expression().getText();
      const accessMod = member.accessModifier().getText() as TAccessMode;

      // Get member type and convert to C type
      const typeName = TypeUtils.getTypeName(
        member.type(),
        scopePath,
        isScopeType,
      );
      const cType = TypeUtils.cnextTypeToCType(typeName);

      // Is the member type a bitmap? ONE key, the one the ladder produced.
      //
      // ADR-057: "Qualify from the parse tree, never from a resolved name."
      // `typeName` has already been through the single TypeBinding ladder
      // above, which qualified it if and only if the syntax and the scope
      // called for it. Re-qualifying it here was a SECOND qualification
      // decision taken on an already-resolved name -- and by that point
      // `global.Flags` and a bare `Flags` are byte-identical, so probing the
      // re-qualified key FIRST let a scope-local `Chip__Flags` capture a
      // deliberate `global.Flags`. The transpiler exited 0 and emitted
      // `volatile Chip__Flags*`, whose bit names differ, so the field access
      // was never lowered and gcc rejected the generated C.
      //
      // One key is sufficient because `knownBitmaps` is keyed exactly as the
      // ladder resolves: file-scope bitmaps by their bare `name`, scope
      // bitmaps by `fullyQualifiedCName`. The two shapes are complementary,
      // never alternatives for the same declaration.
      const bitmapType = knownBitmaps.has(typeName) ? typeName : undefined;

      const memberInfo: IRegisterMemberSymbol = {
        ...MemberSymbolBase.of({
          kind: "register_member" as const,
          name: memberName,
          parentScopedName: ownerScopedName,
          memberCtx: member,
          parentSpan: span,
          sourceFile,
          visibility,
        }),
        offset,
        cType,
        access: accessMod,
        bitmapType,
      };

      members.set(memberName, memberInfo);
    }

    return {
      kind: "register",
      name,
      scopePath,
      // #1285: identity computed once, from the scope chain, not
      // re-derived by every consumer.
      // #1318 review: the same identity the members were keyed by, not a
      // second call with the same arguments -- change one and the members
      // would keep the old parent name while this reported the new one.
      ...identity,
      sourceFile,
      span,
      sourceLanguage: ESourceLanguage.CNext,
      visibility,
      baseAddress,
      members,
    };
  }
}

export default RegisterCollector;
