/**
 * A declaration of a parsed test program, as 1.2 lowers it (#1991), narrowed
 * to the kind the test reads.
 */
import type { ProgramContext } from "../../../2-Parse/grammar/CnxParser";
import ProgramLowering from "../../../2-Parse/ProgramLowering";
import type TDeclarationSyntax from "../../../../types/syntax/TDeclarationSyntax";

type TKind = TDeclarationSyntax["kind"];

class FirstDeclaration {
  static enum(tree: ProgramContext) {
    return FirstDeclaration.at(tree, 0, "enum");
  }

  static scope(tree: ProgramContext) {
    return FirstDeclaration.at(tree, 0, "scope");
  }

  static struct(tree: ProgramContext) {
    return FirstDeclaration.at(tree, 0, "struct");
  }

  static register(tree: ProgramContext) {
    return FirstDeclaration.at(tree, 0, "register");
  }

  static function(tree: ProgramContext) {
    return FirstDeclaration.at(tree, 0, "function");
  }

  static bitmap(tree: ProgramContext) {
    return FirstDeclaration.at(tree, 0, "bitmap");
  }

  /** The `index`th declaration, which must be a `kind` */
  static at<K extends TKind>(
    tree: ProgramContext,
    index: number,
    kind: K,
  ): Extract<TDeclarationSyntax, { kind: K }> {
    const declaration = ProgramLowering.program(tree, null).declarations[index]
      .declaration;
    if (!FirstDeclaration.is(declaration, kind)) {
      throw new Error(`1.2 lowered a ${declaration.kind}, not a ${kind}`);
    }
    return declaration;
  }

  private static is<K extends TKind>(
    declaration: TDeclarationSyntax,
    kind: K,
  ): declaration is Extract<TDeclarationSyntax, { kind: K }> {
    return declaration.kind === kind;
  }
}

export default FirstDeclaration;
