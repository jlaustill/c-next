import type ISourceSpan from "../../../types/ISourceSpan";
import type ICppFunctionDefinitionSyntax from "./ICppFunctionDefinitionSyntax";
import type IHeaderDeclaratorSyntax from "./IHeaderDeclaratorSyntax";

/** One member of a C++ class as 1.2 lowers it (#1991) */
type TCppMemberSyntax =
  | ICppFunctionDefinitionSyntax
  | {
      readonly kind: "declaration";
      readonly span: ISourceSpan;
      readonly fieldType: string;
      /** `static`: the class's one value, not a field of each instance */
      readonly isStatic: boolean;
      readonly declarators: readonly IHeaderDeclaratorSyntax[];
    };

export default TCppMemberSyntax;
