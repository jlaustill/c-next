import type TCppDeclarationSyntax from "./TCppDeclarationSyntax";

/**
 * 1.2's plain-data form of one C++ header (#1991): what 1.3 declares from it,
 * read off the tree while 1.2 still holds it.
 */
interface ICppHeaderSyntax {
  readonly declarations: readonly TCppDeclarationSyntax[];
}

export default ICppHeaderSyntax;
