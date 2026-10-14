import type ISourceSpan from "../../../types/ISourceSpan";
import type IHeaderDeclaratorSyntax from "./IHeaderDeclaratorSyntax";

/** A C++ function definition, at namespace scope or inside a class (#1991) */
interface ICppFunctionDefinitionSyntax {
  readonly kind: "functionDefinition";
  readonly span: ISourceSpan;
  readonly returnType: string;
  readonly declarator: IHeaderDeclaratorSyntax;
}

export default ICppFunctionDefinitionSyntax;
