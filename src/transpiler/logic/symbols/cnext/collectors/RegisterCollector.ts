/**
 * RegisterCollector - Extracts register block declarations from parse trees.
 * Registers provide typed access to memory-mapped I/O locations.
 *
 * Produces TType-based IRegisterSymbol with proper IScopeSymbol references.
 */

import * as Parser from "../../../parser/grammar/CNextParser";
import ESourceLanguage from "../../../../../utils/types/ESourceLanguage";
import IRegisterSymbol from "../../../../types/symbols/IRegisterSymbol";
import type IRegisterMemberSymbol from "../../../../types/symbols/IRegisterMemberSymbol";
import TypeUtils from "../utils/TypeUtils";
import ScopeUtils from "../../../../../utils/ScopeUtils";
import TVisibility from "../../../../types/TVisibility";
import ParserUtils from "../../../../../utils/ParserUtils";
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

      // Check if member type is a bitmap
      // Try both scoped name and plain name for bitmap lookup
      const scopedTypeName = ScopeUtils.qualifyInScope(typeName, scopePath);
      let bitmapType: string | undefined;
      if (knownBitmaps.has(scopedTypeName)) {
        bitmapType = scopedTypeName;
      } else if (knownBitmaps.has(typeName)) {
        bitmapType = typeName;
      }

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
