import type { ParserRuleContext, ParseTree, TerminalNode } from "antlr4ng";
import * as Parser from "./grammar/CNextParser";
import type CommentScanner from "./CommentScanner";
import SyntaxLowering from "./SyntaxLowering";
import StatementLowering from "./StatementLowering";
import type IComment from "../../types/IComment";
import type TRegisterAccessMode from "../../types/TRegisterAccessMode";
import type IFunctionDeclarationSyntax from "../../types/syntax/IFunctionDeclarationSyntax";
import type IParameterSyntax from "../../types/syntax/IParameterSyntax";
import type IProgramSyntax from "../../types/syntax/IProgramSyntax";
import type IRegisterDeclarationSyntax from "../../types/syntax/IRegisterDeclarationSyntax";
import type IStructDeclarationSyntax from "../../types/syntax/IStructDeclarationSyntax";
import type TDeclarationSyntax from "../../types/syntax/TDeclarationSyntax";
import type TExpression from "../../types/syntax/TExpression";

type TMemberDeclaration = Exclude<TDeclarationSyntax, { kind: "scope" }>;
type TDirective = IProgramSyntax["directives"][number];

/**
 * 1.2 Parse: a whole `program` as plain data (#1932), so no pass after 2.1
 * needs the parse tree or its token stream. Leading comments are read here,
 * while the token stream is still at hand.
 */
class ProgramLowering {
  static program(
    tree: Parser.ProgramContext,
    comments: CommentScanner | null,
  ): IProgramSyntax {
    const leadingComments = (ctx: ParserRuleContext): readonly IComment[] =>
      comments && ctx.start
        ? comments.getCommentsBefore(ctx.start.tokenIndex)
        : [];
    return {
      includes: tree.includeDirective().map((include) => ({
        ...SyntaxLowering.node(include),
        leadingComments: leadingComments(include),
      })),
      directives: tree.preprocessorDirective().map((directive) => ({
        ...ProgramLowering.directive(directive),
        ...SyntaxLowering.node(directive),
        leadingComments: leadingComments(directive),
      })),
      declarations: tree.declaration().map((declaration) => ({
        declaration: ProgramLowering.declaration(declaration),
        leadingComments: leadingComments(declaration),
      })),
    };
  }

  static declaration(ctx: Parser.DeclarationContext): TDeclarationSyntax {
    const scope = ctx.scopeDeclaration();
    if (!scope) {
      return ProgramLowering.member(ctx);
    }
    if (ProgramLowering.isRepaired(scope.IDENTIFIER())) {
      return { kind: "missing", ...SyntaxLowering.node(ctx) };
    }
    return {
      kind: "scope",
      name: scope.IDENTIFIER().getText(),
      members: scope.scopeMember().map((member) => ({
        visibility: ProgramLowering.visibilityOf(member),
        declaration: ProgramLowering.member(member),
        ...SyntaxLowering.node(member),
      })),
      ...SyntaxLowering.node(scope),
    };
  }

  private static visibilityOf(
    member: Parser.ScopeMemberContext,
  ): "private" | "public" | null {
    const written = member.visibilityModifier()?.getText();
    return written === "private" || written === "public" ? written : null;
  }

  private static member(
    ctx: Parser.DeclarationContext | Parser.ScopeMemberContext,
  ): TMemberDeclaration {
    if (ProgramLowering.isRepairedMember(ctx)) {
      return { kind: "missing", ...SyntaxLowering.node(ctx) };
    }
    const variable = ctx.variableDeclaration();
    if (variable) return StatementLowering.declaration(variable);
    const fn = ctx.functionDeclaration();
    if (fn) return { kind: "function", ...ProgramLowering.function(fn) };
    const register = ctx.registerDeclaration();
    if (register) {
      return { kind: "register", ...ProgramLowering.register(register) };
    }
    const struct = ctx.structDeclaration();
    if (struct) return { kind: "struct", ...ProgramLowering.struct(struct) };
    const named = ctx.enumDeclaration() ?? ctx.bitmapDeclaration();
    if (named) {
      return {
        kind:
          named instanceof Parser.EnumDeclarationContext ? "enum" : "bitmap",
        name: named.IDENTIFIER().getText(),
        ...SyntaxLowering.node(named),
      };
    }
    return { kind: "missing", ...SyntaxLowering.node(ctx) };
  }

  /**
   * A member recovery repaired lowers as `missing`, as a statement does
   * (#1932): 1.2 lowers every file, so a recovered one must not throw here,
   * and a name the parser invented must not reach a reader as if written.
   */
  private static isRepairedMember(
    ctx: Parser.DeclarationContext | Parser.ScopeMemberContext,
  ): boolean {
    const variable = ctx.variableDeclaration();
    if (variable) {
      return ProgramLowering.isRepaired(variable.IDENTIFIER(), variable.type());
    }
    const fn = ctx.functionDeclaration();
    if (fn) {
      const parameters = fn.parameterList()?.parameter() ?? [];
      return (
        ProgramLowering.isRepaired(fn.IDENTIFIER(), fn.type(), fn.block()) ||
        parameters.some((parameter) =>
          ProgramLowering.isRepaired(parameter.IDENTIFIER(), parameter.type()),
        )
      );
    }
    const register = ctx.registerDeclaration();
    if (register) {
      return (
        ProgramLowering.isRepaired(
          register.IDENTIFIER(),
          register.expression(),
        ) ||
        register
          .registerMember()
          .some((member) =>
            ProgramLowering.isRepaired(
              member.IDENTIFIER(),
              member.type(),
              member.accessModifier(),
              member.expression(),
            ),
          )
      );
    }
    const struct = ctx.structDeclaration();
    if (struct) {
      return (
        ProgramLowering.isRepaired(struct.IDENTIFIER()) ||
        struct
          .structMember()
          .some((member) =>
            ProgramLowering.isRepaired(member.IDENTIFIER(), member.type()),
          )
      );
    }
    const named = ctx.enumDeclaration() ?? ctx.bitmapDeclaration();
    return named !== null && ProgramLowering.isRepaired(named.IDENTIFIER());
  }

  /** Recovery dropped a required part, or invented the name */
  private static isRepaired(
    name: TerminalNode | null,
    ...required: ReadonlyArray<ParseTree | null>
  ): boolean {
    return (
      name === null || name.symbol.tokenIndex < 0 || required.includes(null)
    );
  }

  private static function(
    ctx: Parser.FunctionDeclarationContext,
  ): IFunctionDeclarationSyntax {
    return {
      returnType: SyntaxLowering.type(ctx.type()),
      name: ctx.IDENTIFIER().getText(),
      parameters: ProgramLowering.parameters(ctx.parameterList()),
      body: StatementLowering.block(ctx.block()),
      ...SyntaxLowering.node(ctx),
    };
  }

  /** A function's parameters, or null when it has no parameter list */
  static parameters(
    ctx: Parser.ParameterListContext | null,
  ): IParameterSyntax[] | null {
    return (
      ctx
        ?.parameter()
        .map((parameter) => ProgramLowering.parameter(parameter)) ?? null
    );
  }

  private static parameter(ctx: Parser.ParameterContext): IParameterSyntax {
    return {
      const: ctx.constModifier() !== null,
      type: SyntaxLowering.type(ctx.type()),
      name: ctx.IDENTIFIER().getText(),
      dimensions: ctx.arrayDimension().map(ProgramLowering.dimensionOf),
      ...SyntaxLowering.node(ctx),
    };
  }

  private static register(
    ctx: Parser.RegisterDeclarationContext,
  ): IRegisterDeclarationSyntax {
    return {
      name: ctx.IDENTIFIER().getText(),
      address: SyntaxLowering.expression(ctx.expression()),
      members: ctx.registerMember().map((member) => ({
        name: member.IDENTIFIER().getText(),
        type: SyntaxLowering.type(member.type()),
        access: member.accessModifier().getText() as TRegisterAccessMode,
        offset: SyntaxLowering.expression(member.expression()),
        ...SyntaxLowering.node(member),
      })),
      ...SyntaxLowering.node(ctx),
    };
  }

  private static struct(
    ctx: Parser.StructDeclarationContext,
  ): IStructDeclarationSyntax {
    return {
      name: ctx.IDENTIFIER().getText(),
      fields: ctx.structMember().map((member) => ({
        type: SyntaxLowering.type(member.type()),
        name: member.IDENTIFIER().getText(),
        dimensions: member.arrayDimension().map(ProgramLowering.dimensionOf),
        ...SyntaxLowering.node(member),
      })),
      ...SyntaxLowering.node(ctx),
    };
  }

  private static dimensionOf(
    this: void,
    dimension: Parser.ArrayDimensionContext,
  ): TExpression | null {
    const expression = dimension.expression();
    return expression ? SyntaxLowering.expression(expression) : null;
  }

  private static directive(
    ctx: Parser.PreprocessorDirectiveContext,
  ): Pick<TDirective, "kind" | "text"> {
    const define = ctx.defineDirective();
    if (define) {
      return {
        kind: ProgramLowering.defineKindOf(define),
        text: define.getText(),
      };
    }
    const conditional = ctx.conditionalDirective();
    if (conditional) {
      return { kind: "conditional", text: conditional.getText() };
    }
    return { kind: "none", text: "" };
  }

  private static defineKindOf(
    define: Parser.DefineDirectiveContext,
  ): TDirective["kind"] {
    if (define.DEFINE_FUNCTION()) return "define-function";
    if (define.DEFINE_WITH_VALUE()) return "define-value";
    if (define.DEFINE_FLAG()) return "define-flag";
    return "define-other";
  }
}

export default ProgramLowering;
