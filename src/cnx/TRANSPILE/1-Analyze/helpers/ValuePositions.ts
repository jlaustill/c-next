import type IAssignmentSyntax from "../../../types/syntax/IAssignmentSyntax";
import type IProgramSyntax from "../../../types/syntax/IProgramSyntax";
import type IVariableDeclarationSyntax from "../../../types/syntax/IVariableDeclarationSyntax";
import type TDeclarationSyntax from "../../../types/syntax/TDeclarationSyntax";
import type TExpression from "../../../types/syntax/TExpression";
import type TStatement from "../../../types/syntax/TStatement";
import OperandTyper from "../../../utils/OperandTyper";
import StatementNodes from "../../../utils/StatementNodes";
import TypeResolver from "../../../utils/TypeResolver";
import FunctionReference from "./FunctionReference";
import StructInitializerType from "./StructInitializerType";
import TypeText from "./TypeText";
import type IAnalysisContext from "../types/IAnalysisContext";
import type IValuePosition from "../types/IValuePosition";

const NOWHERE: IValuePosition = {
  typeText: null,
  isArray: false,
  isDeclaration: false,
  inList: false,
  supplied: false,
};

const NO_TYPE: IValuePosition = { ...NOWHERE, supplied: true };

type TPostfix = Extract<TExpression, { kind: "postfix" }>;
type TStructInitializer = Extract<TExpression, { kind: "structInitializer" }>;

/**
 * Carries each position's type down 1.2's syntax to the values under it
 * (#1991), where the parse-tree reading walked up from each value to the first
 * establishing parent. A `for`'s init and update assignments establish
 * nothing, as their parse-tree rules were not assignment statements.
 */
class ValuePositionWalk {
  private readonly forClauses = new Set<IAssignmentSyntax>();

  public constructor(
    private readonly positions: Map<TExpression, IValuePosition>,
    private readonly context: IAnalysisContext,
  ) {}

  public declaration(declaration: TDeclarationSyntax): void {
    if (declaration.kind === "scope") {
      for (const member of declaration.members) {
        this.declaration(member.declaration);
      }
      return;
    }
    if (declaration.kind === "variableDeclaration") {
      this.variable(declaration);
      return;
    }
    if (declaration.kind !== "function") return;
    const statements = StatementNodes.in(declaration);
    for (const statement of statements) {
      if (statement.kind !== "for") continue;
      if (statement.init?.kind === "assignment") {
        this.forClauses.add(statement.init);
      }
    }
    const returnType = TypeText.ofType(declaration.returnType);
    for (const statement of statements) this.statement(statement, returnType);
  }

  private statement(statement: TStatement, returnType: string): void {
    switch (statement.kind) {
      case "variableDeclaration":
        this.variable(statement);
        return;
      case "assignment":
        this.assignment(statement);
        return;
      case "expression":
        this.place(statement.expression, NOWHERE);
        return;
      case "if":
      case "while":
      case "doWhile":
        this.place(statement.condition, NOWHERE);
        return;
      case "for":
        if (statement.condition) this.place(statement.condition, NOWHERE);
        if (statement.update) this.unplacedAssignment(statement.update);
        return;
      case "switch":
        this.place(statement.subject, NOWHERE);
        return;
      case "return":
        if (statement.value) {
          this.place(statement.value, { ...NO_TYPE, typeText: returnType });
        }
        return;
      default:
        return;
    }
  }

  private variable(declaration: IVariableDeclarationSyntax): void {
    for (const dimension of declaration.dimensions) {
      if (dimension) this.place(dimension, NOWHERE);
    }
    if (!declaration.initializer) return;
    const typeText = TypeText.ofType(declaration.type);
    this.place(declaration.initializer, {
      ...NO_TYPE,
      typeText,
      isArray:
        declaration.dimensions.length > 0 ||
        TypeText.withoutDimensions(typeText) !== typeText,
      isDeclaration: true,
    });
  }

  private assignment(site: IAssignmentSyntax): void {
    if (this.forClauses.has(site)) {
      this.unplacedAssignment(site);
      return;
    }
    const target = OperandTyper.typeOfTarget(site.target, this.context);
    this.place(site.target, NOWHERE);
    this.place(site.value, {
      ...NO_TYPE,
      typeText: target?.typeName ?? null,
      isArray: (target?.dimensions.length ?? 0) > 0,
    });
  }

  private unplacedAssignment(site: IAssignmentSyntax): void {
    this.place(site.target, NOWHERE);
    this.place(site.value, NOWHERE);
  }

  private place(expr: TExpression, at: IValuePosition): void {
    this.positions.set(expr, at);
    switch (expr.kind) {
      case "ternary":
        this.place(expr.condition, at);
        this.place(expr.whenTrue, at);
        this.place(expr.whenFalse, at);
        return;
      case "binary":
        for (const operand of expr.operands) this.place(operand, at);
        return;
      case "unary":
      case "cast":
        this.place(expr.operand, at);
        return;
      case "parenthesized":
        this.place(expr.expression, at);
        return;
      case "sizeof":
        if (expr.expression) this.place(expr.expression, at);
        return;
      case "postfix":
        this.postfix(expr, at);
        return;
      case "structInitializer":
        this.fields(expr, at);
        return;
      case "arrayInitializer": {
        const listed = { ...at, inList: true };
        for (const element of expr.elements) this.place(element, listed);
        if (expr.fill) this.place(expr.fill, listed);
        return;
      }
      default:
        return;
    }
  }

  private postfix(chain: TPostfix, at: IValuePosition): void {
    this.place(chain.primary, at);
    for (const op of chain.ops) {
      if (op.kind === "subscript") {
        for (const index of op.indexes) this.place(index, NOWHERE);
      } else if (op.kind === "call") {
        op.arguments.forEach((argument, index) =>
          this.place(argument, this.parameter(chain, index)),
        );
      }
    }
  }

  private parameter(chain: TPostfix, index: number): IValuePosition {
    const callee = FunctionReference.ofCallChain(
      chain,
      OperandTyper.scopePathAt(chain.span, this.context),
      this.context,
    );
    const param = callee?.parameters[index];
    return param === undefined
      ? NO_TYPE
      : {
          ...NO_TYPE,
          typeText: TypeResolver.getTypeName(param.type),
          isArray: param.isArray,
        };
  }

  private fields(init: TStructInitializer, at: IValuePosition): void {
    const structName =
      at.typeText === null
        ? null
        : StructInitializerType.structNamed(
            at.typeText,
            OperandTyper.scopePathAt(init.span, this.context),
            this.context,
          );
    const symbols = this.context.symbols;
    for (const field of init.fields) {
      this.place(
        field.value,
        structName === null
          ? NO_TYPE
          : {
              ...NO_TYPE,
              typeText:
                symbols.structFields.get(structName)?.get(field.name) ?? null,
              isArray:
                symbols.structFieldArrays.get(structName)?.has(field.name) ??
                false,
            },
      );
    }
  }
}

/** Where every value in a file stands (#1991) */
class ValuePositions {
  static of(
    program: IProgramSyntax,
    context: IAnalysisContext,
  ): ReadonlyMap<TExpression, IValuePosition> {
    const positions = new Map<TExpression, IValuePosition>();
    const walk = new ValuePositionWalk(positions, context);
    for (const member of program.declarations) {
      walk.declaration(member.declaration);
    }
    return positions;
  }

  /** `expr`'s position; one the walk never placed stands nowhere */
  static at(
    positions: ReadonlyMap<TExpression, IValuePosition>,
    expr: TExpression,
  ): IValuePosition {
    return positions.get(expr) ?? NOWHERE;
  }
}

export default ValuePositions;
