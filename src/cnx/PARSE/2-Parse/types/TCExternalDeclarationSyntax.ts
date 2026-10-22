import type ISourceSpan from "../../../types/ISourceSpan";
import type ICTypeSpecifierSyntax from "./ICTypeSpecifierSyntax";
import type IHeaderDeclaratorSyntax from "./IHeaderDeclaratorSyntax";
import type ICStructSyntax from "./ICStructSyntax";
import type ICEnumSyntax from "./ICEnumSyntax";

type TCExternalDeclarationSyntax =
  | {
      readonly kind: "functionDefinition";
      readonly span: ISourceSpan;
      readonly typeSpecifiers: readonly ICTypeSpecifierSyntax[];
      readonly declarator: IHeaderDeclaratorSyntax | null;
    }
  | {
      readonly kind: "declaration";
      readonly span: ISourceSpan;
      readonly isTypedef: boolean;
      readonly isExtern: boolean;
      readonly isVolatile: boolean;
      /** #1619: `const` among the specifiers, e.g. `typedef const uint8_t CByte` */
      readonly isConst?: boolean;
      readonly typeSpecifiers: readonly ICTypeSpecifierSyntax[];
      readonly struct: ICStructSyntax | null;
      readonly enum: ICEnumSyntax | null;
      /** null when the declaration has no init-declarator list */
      readonly declarators: readonly IHeaderDeclaratorSyntax[] | null;
    };

export default TCExternalDeclarationSyntax;
