import type IFunctionDeclarationSyntax from "./IFunctionDeclarationSyntax";
import type IRegisterDeclarationSyntax from "./IRegisterDeclarationSyntax";
import type IStructDeclarationSyntax from "./IStructDeclarationSyntax";
import type ISyntaxNode from "./ISyntaxNode";
import type TStatement from "./TStatement";

/** A declaration that may stand in a scope */
type TMemberDeclaration =
  | Extract<
      TStatement,
      { kind: "variableDeclaration" | "constructorDeclaration" }
    >
  | ({ readonly kind: "function" } & IFunctionDeclarationSyntax)
  | ({ readonly kind: "register" } & IRegisterDeclarationSyntax)
  | ({ readonly kind: "struct" } & IStructDeclarationSyntax)
  | (ISyntaxNode & { readonly kind: "enum" | "bitmap"; readonly name: string })
  | (ISyntaxNode & { readonly kind: "missing" });

/** One `declaration`: a scope, or any declaration a scope may also hold */
type TDeclarationSyntax =
  | TMemberDeclaration
  | (ISyntaxNode & {
      readonly kind: "scope";
      readonly name: string;
      readonly members: ReadonlyArray<
        ISyntaxNode & {
          readonly visibility: "private" | "public" | null;
          readonly declaration: TMemberDeclaration;
        }
      >;
    });

export default TDeclarationSyntax;
