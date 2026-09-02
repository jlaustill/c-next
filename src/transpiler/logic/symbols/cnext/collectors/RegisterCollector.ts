/**
 * RegisterCollector - Extracts register block declarations from parse trees.
 * Registers provide typed access to memory-mapped I/O locations.
 *
 * Produces TType-based IRegisterSymbol with proper IScopeSymbol references.
 */

import * as Parser from "../../../parser/grammar/CNextParser";
import ESourceLanguage from "../../../../../utils/types/ESourceLanguage";
import IRegisterSymbol from "../../../../types/symbols/IRegisterSymbol";
import IRegisterMemberInfo from "../../../../types/symbols/IRegisterMemberInfo";
import TypeUtils from "../utils/TypeUtils";
import ScopeUtils from "../../../../../utils/ScopeUtils";
import TVisibility from "../../../../types/TVisibility";

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
    const line = ctx.start?.line ?? 0;
    // #1298: members carry the scope's PATH, not the scope object. The path
    // holds every outer component, so nothing downstream can flatten it to a
    // leaf -- which is what the reference threaded here used to protect against.
    const baseAddress = ctx.expression().getText();

    // Collect register members
    const members = new Map<string, IRegisterMemberInfo>();

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

      const memberInfo: IRegisterMemberInfo = {
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
      ...ScopeUtils.identityOf({ name, scopePath }),
      sourceFile,
      sourceLine: line,
      sourceLanguage: ESourceLanguage.CNext,
      visibility,
      baseAddress,
      members,
    };
  }
}

export default RegisterCollector;
