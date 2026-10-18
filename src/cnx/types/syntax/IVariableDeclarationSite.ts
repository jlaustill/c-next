import type IVariableDeclarationSyntax from "./IVariableDeclarationSyntax";
import type TVariableSite from "./TVariableSite";

/** A variable declaration and where it is written (#2073) */
interface IVariableDeclarationSite {
  readonly declaration: IVariableDeclarationSyntax;
  readonly site: TVariableSite;
}

export default IVariableDeclarationSite;
