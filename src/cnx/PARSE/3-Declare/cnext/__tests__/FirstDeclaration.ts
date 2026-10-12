/**
 * The first declaration of a parsed test program, as 1.2 lowers it (#1991).
 */
import type { ProgramContext } from "../../../2-Parse/grammar/CNextParser";
import ProgramLowering from "../../../2-Parse/ProgramLowering";
import DeclarationSyntax from "../utils/DeclarationSyntax";

class FirstDeclaration {
  static enum(tree: ProgramContext) {
    return DeclarationSyntax.of(FirstDeclaration.lowered(tree), "enum");
  }

  static scope(tree: ProgramContext) {
    return DeclarationSyntax.of(FirstDeclaration.lowered(tree), "scope");
  }

  static bitmap(tree: ProgramContext) {
    return DeclarationSyntax.of(FirstDeclaration.lowered(tree), "bitmap");
  }

  private static lowered(tree: ProgramContext) {
    return ProgramLowering.program(tree, null).declarations[0].declaration;
  }
}

export default FirstDeclaration;
