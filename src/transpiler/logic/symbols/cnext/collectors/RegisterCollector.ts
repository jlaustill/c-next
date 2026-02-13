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
import IScopeSymbol from "../../../../types/symbols/IScopeSymbol";
import TypeUtils from "../utils/TypeUtils";

/** Access mode type for register members */
type TAccessMode = "rw" | "ro" | "wo" | "w1c" | "w1s";

class RegisterCollector {
  /**
   * Collect a register declaration and return an IRegisterSymbol.
   *
   * @param ctx The register declaration context
   * @param sourceFile Source file path
   * @param knownBitmaps Set of known bitmap type names for reference resolution
   * @param scope The scope this register belongs to (IScopeSymbol)
   * @returns The register symbol with proper scope reference
   */
  static collect(
    ctx: Parser.RegisterDeclarationContext,
    sourceFile: string,
    knownBitmaps: Set<string>,
    scope: IScopeSymbol,
  ): IRegisterSymbol {
    const name = ctx.IDENTIFIER().getText();
    const line = ctx.start?.line ?? 0;
    const scopeName = scope.name === "" ? undefined : scope.name;

    // Get base address
    const baseAddress = ctx.expression().getText();

    // Collect register members
    const members = new Map<string, IRegisterMemberInfo>();

    for (const member of ctx.registerMember()) {
      const memberName = member.IDENTIFIER().getText();
      const offset = member.expression().getText();
      const accessMod = member.accessModifier().getText() as TAccessMode;

      // Get member type and convert to C type
      const typeName = TypeUtils.getTypeName(member.type(), scopeName);
      const cType = TypeUtils.cnextTypeToCType(typeName);

      // Check if member type is a bitmap
      // Try both scoped name and plain name for bitmap lookup
      const scopedTypeName = scopeName ? `${scopeName}_${typeName}` : typeName;
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
      scope,
      sourceFile,
      sourceLine: line,
      sourceLanguage: ESourceLanguage.CNext,
      isExported: true,
      baseAddress,
      members,
    };
  }
}

export default RegisterCollector;
