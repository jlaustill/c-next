import type ICDeclaratorSyntax from "../../../2-Parse/types/ICDeclaratorSyntax";
import type ICTypeSpecifierSyntax from "../../../2-Parse/types/ICTypeSpecifierSyntax";

/** The C type a declarator spells, from 1.2's plain-data declarator (#1991) */
class DeclaratorTypes {
  /** The type specifiers before `end`, joined; C's implicit `int` if none */
  static baseType(
    specifiers: readonly ICTypeSpecifierSyntax[],
    end: number = specifiers.length,
  ): string {
    return (
      specifiers
        .slice(0, end)
        .map((spec) => spec.text)
        .join(" ") || "int"
    );
  }

  /** `baseType` with one `*` for each the declarator's pointer spells */
  static pointerType(
    baseType: string,
    declarator: ICDeclaratorSyntax | null,
  ): string {
    return baseType + "*".repeat(declarator?.pointerDepth ?? 0);
  }

  /**
   * The declared type: `base (*)(params)` for a function-pointer declarator,
   * otherwise `pointerType`.
   */
  static declaredType(
    baseType: string,
    declarator: ICDeclaratorSyntax,
  ): string {
    if (declarator.functionPointerParams !== null) {
      return `${baseType} (*)(${declarator.functionPointerParams})`;
    }
    return DeclaratorTypes.pointerType(baseType, declarator);
  }
}

export default DeclaratorTypes;
