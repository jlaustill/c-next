import type ISyntaxNode from "./ISyntaxNode";
import type TExpression from "./TExpression";
import type TTypeSyntax from "./TTypeSyntax";
import type TBlockSyntax from "./TBlockSyntax";
import type TCaseLabelSyntax from "./TCaseLabelSyntax";
import type IVariableDeclarationSyntax from "./IVariableDeclarationSyntax";
import type IAssignmentSyntax from "./IAssignmentSyntax";

/**
 * A statement as plain data, lowered from the parse tree by `SyntaxLowering`
 * (#1932). Its expressions are `TExpression`s, so nothing under it is a parse
 * node. Today the walker lowers each function body when it reaches it; 1.2
 * carrying the lowered file forward waits for declarations (a later slice).
 *
 * The shape is the grammar's: one kind per `statement` alternative.
 */
type TStatement = ISyntaxNode &
  (
    | ({ readonly kind: "variableDeclaration" } & IVariableDeclarationSyntax)
    | {
        /** `Type name(a, b);` -- a C++ constructor call (#375) */
        readonly kind: "constructorDeclaration";
        readonly type: TTypeSyntax;
        readonly name: string;
        readonly arguments: readonly (ISyntaxNode & {
          readonly name: string;
        })[];
      }
    | ({ readonly kind: "assignment" } & IAssignmentSyntax)
    | { readonly kind: "expression"; readonly expression: TExpression }
    | {
        readonly kind: "if";
        readonly condition: TExpression;
        readonly whenTrue: TStatement;
        readonly whenFalse: TStatement | null;
      }
    | {
        readonly kind: "while";
        readonly condition: TExpression;
        readonly body: TStatement;
      }
    | {
        readonly kind: "doWhile";
        readonly body: TBlockSyntax;
        readonly condition: TExpression;
      }
    | {
        readonly kind: "for";
        readonly init:
          | ({
              readonly kind: "variableDeclaration";
            } & IVariableDeclarationSyntax)
          | ({ readonly kind: "assignment" } & IAssignmentSyntax)
          | null;
        readonly condition: TExpression | null;
        readonly update: IAssignmentSyntax | null;
        readonly body: TStatement;
      }
    | { readonly kind: "forever"; readonly body: TBlockSyntax }
    | {
        readonly kind: "switch";
        readonly subject: TExpression;
        readonly cases: readonly (ISyntaxNode & {
          readonly labels: readonly TCaseLabelSyntax[];
          readonly body: TBlockSyntax;
        })[];
        readonly defaultCase:
          | (ISyntaxNode & {
              /** `default(n)`: the count as written, or null */
              readonly count: string | null;
              readonly body: TBlockSyntax;
            })
          | null;
      }
    | { readonly kind: "return"; readonly value: TExpression | null }
    | { readonly kind: "critical"; readonly body: TBlockSyntax }
    | ({ readonly kind: "block" } & Pick<TBlockSyntax, "statements">)
  );

export default TStatement;
