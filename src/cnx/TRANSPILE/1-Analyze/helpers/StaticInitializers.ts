/**
 * #1735: the values a static-storage initializer holds.
 *
 * A file-scope or scope variable is initialized before the program runs, so C
 * requires each value in its initializer to be a constant expression (C99
 * 6.7.8p4): a `const` object is not one, and neither is ADR-044's clamp helper
 * call. Each is a value fixed at compile time (ADR-044, #1175), `mut` or not.
 * One of a C-Next number or bool type that is not written as a literal is
 * folded here, at the type its position holds it at: the one answer 2.1
 * rejects (E0909, E0910) and 2.2 spells.
 */
import type IProgram from "../../../types/IProgram";
import type IVariableSymbol from "../../../types/symbols/IVariableSymbol";
import type IValuePosition from "../../../types/IValuePosition";
import type TConstExpr from "../../../types/TConstExpr";
import type TSettledConst from "../../../types/TSettledConst";
import type IProgramSyntax from "../../../types/syntax/IProgramSyntax";
import type TDeclarationSyntax from "../../../types/syntax/TDeclarationSyntax";
import type TExpression from "../../../types/syntax/TExpression";
import ConstExprLowering from "../../../utils/ConstExprLowering";
import ConstantFold from "../../../utils/ConstantFold";
import LengthProperty from "../../../utils/LengthProperty";
import TypeCheckUtils from "../../../utils/TypeCheckUtils";
import TypeText from "../../../utils/TypeText";
import type IStaticValue from "../types/IStaticValue";
import ValuePositions from "./ValuePositions";

type TConstName = Extract<TConstExpr, { kind: "name" }>;

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
          const typeName = StaticInitializers.typeAt(positions, value);
          return typeName === null || StaticInitializers.isLiteral(value)
            ? []
            : [{ declaration, value, typeName }];
        }),
      );
  }

  /** The value, held at its type, by the fold every pass shares */
  static settle(
    value: IStaticValue,
    program: IProgram,
    sourceFile: string,
  ): TSettledConst | null {
    return ConstantFold.primitiveValue(
      ConstExprLowering.lower(value.value),
      ConstantFold.environment(program, sourceFile),
      value.typeName,
    );
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
    return StaticInitializers.names(ConstExprLowering.lower(value)).some(
      (name) => {
        // `x.type_bit_length` is a size, which C is never asked to read
        if (LengthProperty.isLength(name.path.at(-1) ?? "")) return false;
        const binding = program.bindValue(
          sourceFile,
          name.root,
          name.path[0] ?? "",
          name.at,
        );
        return binding?.kind === "variable" || binding?.kind === "local";
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
    if (lowered.kind !== "name" || lowered.path.length !== 1) return null;
    const binding = program.bindValue(
      sourceFile,
      lowered.root,
      lowered.path[0],
      lowered.at,
    );
    return binding?.kind === "variable" ? binding.symbol : null;
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
