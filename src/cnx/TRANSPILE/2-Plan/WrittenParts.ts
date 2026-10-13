import type IProgramSyntax from "../../types/syntax/IProgramSyntax";
import type TDeclarationSyntax from "../../types/syntax/TDeclarationSyntax";
import DeclarationParts from "../../utils/DeclarationParts";
import MainSignature from "../../utils/MainSignature";
import type IWrittenPart from "./types/IWrittenPart";

/**
 * Every outermost type and expression 2.3 writes in one file, with the scope it
 * is written in: what 2.2 decides before 2.3 renders any of the file (#1991).
 */
class WrittenParts {
  /** `unwritten`: declarations 2.2 decided 2.3 writes nothing of, e.g. an inlined private const (#282) */
  static of(
    program: IProgramSyntax,
    unwritten: ReadonlySet<TDeclarationSyntax>,
  ): readonly IWrittenPart[] {
    return program.declarations.flatMap(({ declaration }) =>
      declaration.kind === "scope"
        ? declaration.members
            .filter(
              (member) =>
                !WrittenParts.headerText(member.declaration) &&
                !unwritten.has(member.declaration),
            )
            .flatMap((member) =>
              WrittenParts.inDeclaration(member.declaration, declaration.name),
            )
        : WrittenParts.inDeclaration(declaration, null),
    );
  }

  /**
   * #1300: a scope's struct, enum or bitmap is written into the `.c` as the
   * header's text, so 2.3 renders none of its parts
   */
  private static headerText(declaration: TDeclarationSyntax): boolean {
    return (
      declaration.kind === "struct" ||
      declaration.kind === "enum" ||
      declaration.kind === "bitmap"
    );
  }

  private static inDeclaration(
    declaration: TDeclarationSyntax,
    scope: string | null,
  ): IWrittenPart[] {
    return DeclarationParts.of(WrittenParts.asSpelled(declaration)).map(
      (part) => ({ part, scope }),
    );
  }

  /** `main(string args[])` is written `int main(int argc, char *argv[])`, so 2.3 spells none of its parameters */
  private static asSpelled(
    declaration: TDeclarationSyntax,
  ): TDeclarationSyntax {
    return declaration.kind === "function" &&
      MainSignature.takesArgs(declaration.name, declaration.parameters)
      ? { ...declaration, parameters: null }
      : declaration;
  }
}

export default WrittenParts;
