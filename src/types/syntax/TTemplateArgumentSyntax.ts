import type ISyntaxNode from "./ISyntaxNode";
import type TTypeSyntax from "./TTypeSyntax";

/** One argument of a C++ template type, as the grammar's `templateArgument` */
type TTemplateArgumentSyntax =
  | (ISyntaxNode & { readonly kind: "type"; readonly type: TTypeSyntax })
  | (ISyntaxNode & { readonly kind: "name"; readonly name: string })
  | (ISyntaxNode & { readonly kind: "integer"; readonly text: string });

export default TTemplateArgumentSyntax;
