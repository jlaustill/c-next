import type IAssignmentSyntax from "./syntax/IAssignmentSyntax";
import type IFunctionDeclarationSyntax from "./syntax/IFunctionDeclarationSyntax";
import type IVariableDeclarationSyntax from "./syntax/IVariableDeclarationSyntax";
import type TExpressionOf from "./syntax/TExpressionOf";

/**
 * The syntax that sets the type a value is rendered against (#1991). 2.1's
 * walk records it; 2.2 spells each one as the C it renders expects.
 */
type TValueSite =
  | {
      readonly kind: "declaration";
      readonly declaration: IVariableDeclarationSyntax;
    }
  | { readonly kind: "assignment"; readonly assignment: IAssignmentSyntax }
  | { readonly kind: "return"; readonly function: IFunctionDeclarationSyntax }
  | {
      readonly kind: "field";
      readonly initializer: TExpressionOf<"structInitializer">;
      readonly field: string;
    }
  | {
      readonly kind: "argument";
      readonly call: TExpressionOf<"postfix">;
      /** The call's index among the chain's operations */
      readonly op: number;
      readonly argument: number;
    }
  /** An assignment's target, whose indexes are written against no type */
  | { readonly kind: "target" }
  /** A subscript's index */
  | { readonly kind: "index" }
  /** An equality or relational operand, which no type is set for (#1032) */
  | { readonly kind: "comparison" };

export default TValueSite;
