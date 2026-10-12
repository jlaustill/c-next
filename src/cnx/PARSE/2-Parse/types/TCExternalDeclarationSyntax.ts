import type ISourceSpan from "../../../types/ISourceSpan";
import type ICTypeSpecifierSyntax from "./ICTypeSpecifierSyntax";
import type ICDeclaratorSyntax from "./ICDeclaratorSyntax";
import type ICStructSyntax from "./ICStructSyntax";
import type ICEnumSyntax from "./ICEnumSyntax";

type TCExternalDeclarationSyntax =
  | {
      readonly kind: "functionDefinition";
      readonly span: ISourceSpan;
      readonly typeSpecifiers: readonly ICTypeSpecifierSyntax[];
      readonly declarator: ICDeclaratorSyntax | null;
    }
  | {
      readonly kind: "declaration";
      readonly span: ISourceSpan;
      readonly isTypedef: boolean;
      readonly isExtern: boolean;
      readonly isVolatile: boolean;
      readonly typeSpecifiers: readonly ICTypeSpecifierSyntax[];
      readonly struct: ICStructSyntax | null;
      readonly enum: ICEnumSyntax | null;
      /** null when the declaration has no init-declarator list */
      readonly declarators: readonly ICDeclaratorSyntax[] | null;
    };

export default TCExternalDeclarationSyntax;
