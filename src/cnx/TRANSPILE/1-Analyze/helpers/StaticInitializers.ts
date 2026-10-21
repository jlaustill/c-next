/**
 * #1735: the values a static-storage initializer holds.
 *
 * A file-scope or scope variable is initialized before the program runs, so C
 * requires each value in its initializer to be a constant expression (C99
 * 6.7.8p4): a `const` object is not one, and neither is ADR-044's clamp helper
 * call. Each is a value fixed at compile time (ADR-044, #1175), `mut` or not.
 * One of a C-Next number or bool type that is not written as a literal is
 * folded here, at the type its position holds it at: the one answer 2.1
 * rejects (E0909, E0910) and 2.2 spells. One of any other type (an enum, a
 * struct) has no typed fold, but is asked the same question untyped, so one
 * that reads a variable or calls a function is rejected too (#2018).
 */
import type IProgram from "../../../types/IProgram";
import type TValueBinding from "../../../types/TValueBinding";
import type ISourcePosition from "../../../utils/types/ISourcePosition";
import type IVariableSymbol from "../../../types/symbols/IVariableSymbol";
import type IValuePosition from "../../../types/IValuePosition";
import type TConstExpr from "../../../types/TConstExpr";
import type TSettledConst from "../../../types/TSettledConst";
import type IProgramSyntax from "../../../types/syntax/IProgramSyntax";
import type TDeclarationSyntax from "../../../types/syntax/TDeclarationSyntax";
import type TExpression from "../../../types/syntax/TExpression";
import ConstExprLowering from "../../../utils/ConstExprLowering";
import ConstExprPrinter from "../../../utils/ConstExprPrinter";
import ConstantEvaluator from "../../../utils/ConstantEvaluator";
import ConstantFold from "../../../utils/ConstantFold";
import LengthProperty from "../../../utils/LengthProperty";
import TypeCheckUtils from "../../../utils/TypeCheckUtils";
import TypeText from "../../../utils/TypeText";
import type IStaticValue from "../types/IStaticValue";
import ValuePositions from "./ValuePositions";

type TConstName = Extract<TConstExpr, { kind: "name" }>;
type TReason = Extract<TSettledConst, { kind: "notConstant" }>["reason"];

/** What a value of no number or bool type has no value for C by */
const UNTYPED_WITHOUT_VALUE: ReadonlySet<TReason> = new Set<TReason>([
  "variable",
  "parameter",
  "call",
]);

class StaticInitializers {
  /** Each value to fold in the file's static-storage initializers */
  static values(
    program: IProgramSyntax,
    positions: ReadonlyMap<TExpression, IValuePosition>,
  ): IStaticValue[] {
    return program.declarations
      .flatMap(({ declaration }) =>
        StaticInitializers.declarations(declaration),
      )
      .flatMap((declaration) =>
        StaticInitializers.leaves(declaration.initializer!).flatMap((value) => {
          return StaticInitializers.isLiteral(value)
            ? []
            : [
                {
                  declaration,
                  value,
                  typeName: StaticInitializers.typeAt(positions, value),
                },
              ];
        }),
      );
  }

  /**
   * The value, held at its type, by the fold every pass shares. One of no
   * number or bool type is only asked whether it has a value: null when it
   * does, why not when it does not.
   */
  static settle(
    value: IStaticValue,
    program: IProgram,
    sourceFile: string,
  ): TSettledConst | null {
    const lowered = ConstExprLowering.lower(value.value);
    const env = ConstantFold.environment(program, sourceFile);
    if (value.typeName !== null) {
      return ConstantFold.primitiveValue(lowered, env, value.typeName);
    }
    const result = ConstantEvaluator.evaluate(lowered, env);
    return result.kind === "value" ? null : result;
  }

  /**
   * Whether the value has none C can be given, which 2.1 reports (E0909):
   * one of a number or bool type that C-Next cannot fold and C cannot
   * evaluate; one of any other type that reads a variable or calls a function
   */
  static lacksValue(value: IStaticValue, settled: TSettledConst): boolean {
    if (settled.kind !== "notConstant") return false;
    return value.typeName === null
      ? UNTYPED_WITHOUT_VALUE.has(settled.reason)
      : !StaticInitializers.cHasValue(settled);
  }

  /**
   * A value C evaluates that reads a C-Next const, written as dimensions are
   * (`ConstantFold.settled`): each C-Next name as its value, each header name
   * as C spells it -- since C cannot read the const object (#1735 review)
   */
  static cText(
    value: IStaticValue,
    program: IProgram,
    sourceFile: string,
  ): string {
    return ConstExprPrinter.toC(
      ConstExprLowering.lower(value.value),
      ConstantFold.environment(program, sourceFile),
    );
  }

  /** Whether the value is a cast, whose operand is what does not fit */
  static isCast(value: IStaticValue): boolean {
    return ConstExprLowering.lower(value.value).kind === "cast";
  }

  /**
   * Whether the value reads a variable, `const` or not: what C rejects in a
   * static initializer, where an enum member or a length property is not
   */
  static readsVariable(
    value: TExpression,
    program: IProgram,
    sourceFile: string,
  ): boolean {
    return StaticInitializers.bindings(value, program, sourceFile).some(
      ({ binding }) => binding.kind === "variable" || binding.kind === "local",
    );
  }

  /**
   * What each name the value reads binds to, and where it is written; a
   * length property's subject is a size, which C is never asked to read
   */
  static bindings(
    value: TExpression,
    program: IProgram,
    sourceFile: string,
  ): { readonly binding: TValueBinding; readonly at: ISourcePosition }[] {
    return StaticInitializers.names(ConstExprLowering.lower(value)).flatMap(
      (name) => {
        if (LengthProperty.isLength(name.path.at(-1) ?? "")) return [];
        const target = program.constantTargetOf(sourceFile, name);
        return target === null
          ? []
          : [{ binding: target.binding, at: name.at }];
      },
    );
  }

  /**
   * Whether C has a value C-Next does not: a char literal, or a name only a
   * header declares, reached directly or through the consts it is read from
   */
  static cHasValue(settled: TSettledConst): boolean {
    if (settled.kind === "foreign") return true;
    if (settled.kind !== "notConstant") return false;
    if (settled.reason === "character") return true;
    return settled.reason === "unfolded" && settled.because !== undefined
      ? StaticInitializers.cHasValue(settled.because)
      : false;
  }

  /**
   * The const a value names alone, as `CH` or `S.LIMIT` -- what C is given
   * when C-Next has no value for it but C does (`cHasValue`) -- or null
   */
  static namedConst(
    value: TExpression,
    program: IProgram,
    sourceFile: string,
  ): IVariableSymbol | null {
    const lowered = ConstExprLowering.lower(value);
    if (lowered.kind !== "name") return null;
    const target = program.constantTargetOf(sourceFile, lowered);
    return target?.binding.kind === "variable" && target.rest.length === 0
      ? target.binding.symbol
      : null;
  }

  /** Each bare name the value reads (`N`, not `this.N` or `S.N`) */
  static bareNames(value: TExpression): TConstName[] {
    return StaticInitializers.names(ConstExprLowering.lower(value)).filter(
      (name) => name.root === null && name.path.length === 1,
    );
  }

  private static names(expr: TConstExpr): TConstName[] {
    switch (expr.kind) {
      case "name":
        return [expr];
      case "cast":
      case "unary":
        return StaticInitializers.names(expr.operand);
      case "binary":
        return [
          ...StaticInitializers.names(expr.left),
          ...StaticInitializers.names(expr.right),
        ];
      case "ternary":
        return [expr.condition, expr.whenTrue, expr.whenFalse].flatMap(
          StaticInitializers.names,
        );
      default:
        return [];
    }
  }

  /** The file's file-scope and scope variables that have an initializer */
  private static declarations(
    declaration: TDeclarationSyntax,
  ): IStaticValue["declaration"][] {
    if (declaration.kind === "scope") {
      return declaration.members.flatMap((member) =>
        StaticInitializers.declarations(member.declaration),
      );
    }
    return declaration.kind === "variableDeclaration" && declaration.initializer
      ? [declaration]
      : [];
  }

  /** The values an initializer holds: an array's elements, a struct's fields */
  private static leaves(expr: TExpression): TExpression[] {
    switch (expr.kind) {
      case "arrayInitializer":
        return expr.fill === null
          ? expr.elements.flatMap(StaticInitializers.leaves)
          : StaticInitializers.leaves(expr.fill);
      case "structInitializer":
        return expr.fields.flatMap((field) =>
          StaticInitializers.leaves(field.value),
        );
      default:
        return [expr];
    }
  }

  /** The number or bool type the value's position holds it at, or null */
  private static typeAt(
    positions: ReadonlyMap<TExpression, IValuePosition>,
    value: TExpression,
  ): string | null {
    const typeText = ValuePositions.at(positions, value).typeText;
    if (typeText === null) return null;
    const typeName = TypeText.withoutDimensions(typeText);
    return TypeCheckUtils.isInteger(typeName) ||
      TypeCheckUtils.isFloat(typeName) ||
      typeName === "bool"
      ? typeName
      : null;
  }

  /** A literal is written as it stands, so it keeps its notation (`0xAB`) */
  private static isLiteral(value: TExpression): boolean {
    return (
      value.kind === "literal" ||
      (value.kind === "unary" &&
        value.operator === "-" &&
        value.operand.kind === "literal")
    );
  }
}

export default StaticInitializers;
