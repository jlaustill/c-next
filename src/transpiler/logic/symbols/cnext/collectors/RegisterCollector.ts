/**
 * RegisterCollector - Extracts register block declarations from parse trees.
 * Registers provide typed access to memory-mapped I/O locations.
 */

import * as Parser from "../../../parser/grammar/CNextParser";
import ESourceLanguage from "../../../../../utils/types/ESourceLanguage";
import ESymbolKind from "../../../../../utils/types/ESymbolKind";
import IRegisterSymbol from "../../types/IRegisterSymbol";
import IRegisterMemberInfo from "../../types/IRegisterMemberInfo";
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
   * @param scopeName Optional scope name for nested registers
   * @returns The register symbol
   */
  static collect(
    ctx: Parser.RegisterDeclarationContext,
    sourceFile: string,
    knownBitmaps: Set<string>,
    scopeName?: string,
  ): IRegisterSymbol {
    const name = ctx.IDENTIFIER().getText();
    const fullName = scopeName ? `${scopeName}_${name}` : name;
    const line = ctx.start?.line ?? 0;

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

      const memberInfo: IRegisterMemberInfo = {
        offset,
        cType,
        access: accessMod,
      };

      // Check if member type is a bitmap
      // Try both scoped name and plain name for bitmap lookup
      const scopedTypeName = scopeName ? `${scopeName}_${typeName}` : typeName;
      if (knownBitmaps.has(scopedTypeName)) {
        memberInfo.bitmapType = scopedTypeName;
      } else if (knownBitmaps.has(typeName)) {
        memberInfo.bitmapType = typeName;
      }

      members.set(memberName, memberInfo);
    }

    return {
      name: fullName,
      sourceFile,
      sourceLine: line,
      sourceLanguage: ESourceLanguage.CNext,
      isExported: true,
      kind: ESymbolKind.Register,
      baseAddress,
      members,
    };
  }
}

export default RegisterCollector;
