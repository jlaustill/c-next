import type IParameterSyntax from "./IParameterSyntax";
import type ISyntaxNode from "./ISyntaxNode";
import type TBlockSyntax from "./TBlockSyntax";
import type TTypeSyntax from "./TTypeSyntax";

/** `type name(params) { ... }`; `parameters` is `null` when `()` is empty */
interface IFunctionDeclarationSyntax extends ISyntaxNode {
  readonly returnType: TTypeSyntax;
  readonly name: string;
  readonly parameters: readonly IParameterSyntax[] | null;
  readonly body: TBlockSyntax;
}

export default IFunctionDeclarationSyntax;
