import NarrowingCastHelper from "./helpers/NarrowingCastHelper";
import type IProgram from "../../../types/IProgram";
import type IVariableSymbol from "../../../types/symbols/IVariableSymbol";
import type TSettledConst from "../../../types/TSettledConst";
import QualifiedCName from "../../../utils/QualifiedCName";
import ConstantFold from "../../../utils/ConstantFold";
import ScopeUtils from "../../../utils/ScopeUtils";
import type TranspileState from "../../TranspileState";
import type IGeneratorOutput from "./generators/IGeneratorOutput";
import type IGeneratorState from "./generators/IGeneratorState";
import generateLiteral from "./generators/expressions/LiteralGenerator";

/** The most negative i64, which no C literal reaches, and how C spells it */
const I64_MIN = "-9223372036854775808";
const I64_MIN_SPELLING = "(-9223372036854775807LL - 1)";

/**
 * #1739: what a private scope const is written as where it is used, or null
 * when it is emitted as its object instead (ADR-016) -- the one decision the
 * use sites and the declaration's own emission both read.
 *
 * The value is the one 1.4 settled, which is the value the const sizes an
 * array with, so a use and a dimension cannot disagree. Its initializer's text
 * was substituted here before and re-read where the use was: `M <- N * 2`
 * meant the scope's N in a dimension and the global N in a function, and
 * `this.N + 1` reached C as written.
 *
 * A use is a C constant expression, because a use can stand in a static
 * initializer, where C99 6.7.8p4 takes nothing else (a `const` object is not
 * one): an integer is spelled as a literal of its type, a float as its value
 * held at its type, a bool as `true`/`false` and an enum as its member. Each
 * is rendered by `generateLiteral`, so it is spelled as a literal of its
 * declared type. A char literal is that literal, and a name only a header
 * knows (a macro) is that name, which C evaluates. A const with no such value
 * (a string, or one whose initializer is not constant) is emitted.
 */
class PrivateConstValue {
  static inlined(
    generatorState: IGeneratorState,
    transpileState: TranspileState,
    cName: string,
  ): IGeneratorOutput | null {
    const symbol = transpileState.typingContext().program.symbolByCName(cName);
    if (symbol?.kind !== "variable" || !PrivateConstValue.canInline(symbol)) {
      return null;
    }
    return PrivateConstValue.constant(generatorState, transpileState, cName);
  }

  /**
   * Any const's value as a C constant expression, or null -- what a `case`
   * label needs of a public or file-scope const too, which is emitted as an
   * object C cannot switch on (C99 6.8.4.2p3)
   */
  static constant(
    generatorState: IGeneratorState,
    transpileState: TranspileState,
    cName: string,
  ): IGeneratorOutput | null {
    const program = transpileState.typingContext().program;
    const symbol = program.symbolByCName(cName);
    if (
      symbol?.kind !== "variable" ||
      !symbol.isConst ||
      symbol.isArray ||
      symbol.initialValueExpr === undefined ||
      symbol.initialValue === undefined
    ) {
      return null;
    }
    const settled = program.settledConstOf(cName);
    if (settled?.kind === "value" && settled.digits === I64_MIN) {
      return { code: I64_MIN_SPELLING, effects: [] };
    }
    const text = PrivateConstValue.literalText(program, symbol, settled);
    if (text === null) return null;
    // A literal has no sign: a negative value is the negated literal, in
    // parentheses so `-X` does not read as a decrement
    const negative = text.startsWith("-");
    const typeName = ConstantFold.typeNameOf(symbol.type);
    const output = generateLiteral(
      negative ? text.slice(1) : text,
      { ...generatorState, expectedType: typeName },
      transpileState,
      text.startsWith("'") && typeName !== null
        ? NarrowingCastHelper.narrowingOf("int", typeName)
        : null,
    );
    return negative ? { ...output, code: `(-${output.code})` } : output;
  }

  /** The literal the const's settled value is, before C spells it */
  private static literalText(
    program: IProgram,
    symbol: IVariableSymbol,
    settled: TSettledConst | null,
  ): string | null {
    switch (settled?.kind) {
      case "value":
        return PrivateConstValue.integerText(symbol, settled.digits);
      case "float":
        return PrivateConstValue.floatText(settled);
      case "bool":
        return settled.value ? "true" : "false";
      case "named":
        return PrivateConstValue.enumMember(program, settled);
      default:
        return PrivateConstValue.unsettledText(symbol, settled);
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
        ? PrivateConstValue.shortestF32(value)
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

  /** Issue #282: a private scope const, which is never emitted when it has a value */
  private static canInline(symbol: IVariableSymbol): boolean {
    return (
      !ScopeUtils.isGlobalScopePath(symbol.scopePath) &&
      symbol.visibility === "private"
    );
  }
}

export default PrivateConstValue;
