import type IProgramSyntax from "../types/syntax/IProgramSyntax";
import type IVariableDeclarationSyntax from "../types/syntax/IVariableDeclarationSyntax";
import type TDeclarationSyntax from "../types/syntax/TDeclarationSyntax";
import type TExpression from "../types/syntax/TExpression";
import type TStatement from "../types/syntax/TStatement";
import type TTypeSyntax from "../types/syntax/TTypeSyntax";
import StatementChildren from "./StatementChildren";

/**
 * Every outermost expression 1.2 returned for a file, in source order: each
 * initializer, dimension, enum value, register address and offset, condition,
 * assignment side, return value and expression statement. The expressions
 * inside each one are `ExpressionChildren`'s. Every declaration and statement
 * kind has an arm, so a new kind does not compile until it is placed (#1991).
 */
class ProgramExpressions {
  static of(program: IProgramSyntax): readonly TExpression[] {
    return program.declarations.flatMap((member) =>
      ProgramExpressions.declaration(member.declaration),
    );
  }

  private static declaration(
    declaration: TDeclarationSyntax,
  ): readonly TExpression[] {
    switch (declaration.kind) {
      case "scope":
        return declaration.members.flatMap((member) =>
          ProgramExpressions.declaration(member.declaration),
        );
      case "variableDeclaration":
      case "constructorDeclaration":
        return ProgramExpressions.statement(declaration);
      case "function":
        return [
          ...ProgramExpressions.type(declaration.returnType),
          ...(declaration.parameters ?? []).flatMap((parameter) => [
            ...ProgramExpressions.type(parameter.type),
            ...ProgramExpressions.dimensions(parameter.dimensions),
          ]),
          ...ProgramExpressions.statements(declaration.body.statements),
        ];
      case "register":
        return [
          declaration.address,
          ...declaration.members.flatMap((member) => [
            ...ProgramExpressions.type(member.type),
            member.offset,
          ]),
        ];
      case "struct":
        return declaration.fields.flatMap((field) => [
          ...ProgramExpressions.type(field.type),
          ...ProgramExpressions.dimensions(field.dimensions),
        ]);
      case "enum":
        return declaration.members.flatMap((member) =>
          member.value === null ? [] : [member.value],
        );
      case "bitmap":
      case "missing":
        return [];
      default: {
        const unplaced: never = declaration;
        return unplaced;
      }
    }
  }

  private static statements(
    statements: readonly TStatement[],
  ): readonly TExpression[] {
    return statements.flatMap((statement) => [
      ...ProgramExpressions.statement(statement),
      ...ProgramExpressions.statements(StatementChildren.of(statement)),
    ]);
  }

  /** The statement's own expressions, not those of statements nested in it */
  private static statement(statement: TStatement): readonly TExpression[] {
    switch (statement.kind) {
      case "variableDeclaration":
        return ProgramExpressions.variable(statement);
      case "constructorDeclaration":
        return ProgramExpressions.type(statement.type);
      case "assignment":
        return [statement.target, statement.value];
      case "expression":
        return [statement.expression];
      case "if":
      case "while":
      case "doWhile":
        return [statement.condition];
      case "for":
        return [
          ...(statement.init === null
            ? []
            : ProgramExpressions.statement(statement.init)),
          ...(statement.condition === null ? [] : [statement.condition]),
          ...(statement.update === null
            ? []
            : [statement.update.target, statement.update.value]),
        ];
      case "switch":
        return [statement.subject];
      case "return":
        return statement.value === null ? [] : [statement.value];
      case "forever":
      case "critical":
      case "block":
      case "missing":
        return [];
      default: {
        const unplaced: never = statement;
        return unplaced;
      }
    }
  }

  private static variable(
    variable: IVariableDeclarationSyntax,
  ): readonly TExpression[] {
    return [
      ...ProgramExpressions.type(variable.type),
      ...ProgramExpressions.dimensions(variable.dimensions),
      ...(variable.initializer === null ? [] : [variable.initializer]),
    ];
  }

  private static type(type: TTypeSyntax): readonly TExpression[] {
    return type.kind === "array"
      ? [
          ...ProgramExpressions.type(type.element),
          ...ProgramExpressions.dimensions(type.dimensions),
        ]
      : [];
  }

  private static dimensions(
    dimensions: ReadonlyArray<TExpression | null>,
  ): readonly TExpression[] {
    return dimensions.filter((dimension) => dimension !== null);
  }
}

export default ProgramExpressions;
