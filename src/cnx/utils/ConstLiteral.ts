import type IProgram from "../types/IProgram";
import type IVariableSymbol from "../types/symbols/IVariableSymbol";
import type TSettledConst from "../types/TSettledConst";
import QualifiedCName from "./QualifiedCName";

/**
 * The C constant a const is written as where its value is used, or null when
 * it has none C can take: the one answer to "is this a const with a value".
 * Render spells the use from it (`PrivateConstValue`), and 2.1 asks it of a
 * case label (E0717), so a label 2.1 accepts is one render can write (#2051
 * review: the two decided it separately, and a string const passed E0717 to
 * reach gcc as `case Panel__S:`).
 *
 * An integer is its literal's notation or its settled digits, a float its
 * value held at its type, a bool `true`/`false`, an enum-typed const its
 * member, a char literal that literal and a header macro named alone that
 * macro. A string, an array or an initializer 1.4 could not settle is null.
 */
class ConstLiteral {
  static textOf(program: IProgram, symbol: IVariableSymbol): string | null {
    if (
      !symbol.isConst ||
      symbol.isArray ||
      symbol.initialValueExpr === undefined ||
      symbol.initialValue === undefined
    ) {
      return null;
    }
    return ConstLiteral.literalText(
      program,
      symbol,
      program.settledConstOf(symbol.fullyQualifiedCName),
    );
  }

  /** The literal the const's settled value is, before C spells it */
  private static literalText(
    program: IProgram,
    symbol: IVariableSymbol,
    settled: TSettledConst | null,
  ): string | null {
    switch (settled?.kind) {
      case "value":
        return ConstLiteral.integerText(symbol, settled.digits);
      case "float":
        return ConstLiteral.floatText(settled);
      case "bool":
        return settled.value ? "true" : "false";
      case "named":
        return ConstLiteral.enumMember(program, settled);
      default:
        return ConstLiteral.unsettledText(symbol, settled);
    }
  }

  /**
   * A constant 1.4 has no value for, which C does: a char literal, and a
   * header macro named alone (parenthesized, as its expansion may not be one
   * operand). Anything else is null.
   */
  private static unsettledText(
    symbol: IVariableSymbol,
    settled: TSettledConst | null,
  ): string | null {
    const expr = symbol.initialValueExpr!;
    if (
      settled?.kind === "notConstant" &&
      settled.reason === "character" &&
      expr.kind === "other" &&
      expr.what === "character"
    ) {
      return symbol.initialValue!;
    }
    if (
      settled?.kind === "foreign" &&
      expr.kind === "name" &&
      expr.root === null &&
      expr.path.length === 1
    ) {
      return `(${expr.path[0]})`;
    }
    return null;
  }

  /** A literal initializer keeps its notation (`0xAB`); the rest are digits */
  private static integerText(symbol: IVariableSymbol, digits: string): string {
    const expr = symbol.initialValueExpr!;
    return expr.kind === "literal" ? symbol.initialValue! : digits;
  }

  /**
   * The shortest decimal that is the value at its type: an f32's is suffixed,
   * so C reads it as the float the const holds, not as a double.
   */
  private static floatText(
    settled: Extract<TSettledConst, { kind: "float" }>,
  ): string | null {
    const value = Number(settled.digits);
    if (!Number.isFinite(value)) return null;
    if (Object.is(value, -0)) return `-0.0${settled.typeName}`;
    const shortest =
      settled.typeName === "f32"
        ? ConstLiteral.shortestF32(value)
        : String(value);
    const spelled = /[.eE]/.test(shortest) ? shortest : `${shortest}.0`;
    return `${spelled}${settled.typeName}`;
  }

  /** Nine significant digits always reach a float, so the loop ends */
  private static shortestF32(value: number): string {
    let digits = 1;
    while (Math.fround(Number(value.toPrecision(digits))) !== value) digits++;
    return String(Number(value.toPrecision(digits)));
  }

  /** The member of the const's enum that has its value */
  private static enumMember(
    program: IProgram,
    settled: Extract<TSettledConst, { kind: "named" }>,
  ): string | null {
    const enumSymbol = program.symbolByCName(settled.typeName);
    if (enumSymbol?.kind !== "enum") return null;
    const names = [...enumSymbol.members.keys()];
    const index = program
      .enumMemberValues(settled.typeName)
      .findIndex(
        (member) =>
          member.kind === "value" && member.value.toString() === settled.digits,
      );
    return index < 0
      ? null
      : QualifiedCName.fromParts([settled.typeName, names[index]]);
  }
}

export default ConstLiteral;
