import type IProgram from "../../../types/IProgram";
import type IVariableSymbol from "../../../types/symbols/IVariableSymbol";
import type TSettledConst from "../../../types/TSettledConst";
import QualifiedCName from "../../../utils/QualifiedCName";
import ScopeUtils from "../../../utils/ScopeUtils";
import type TranspileState from "../../TranspileState";
import type IGeneratorOutput from "./generators/IGeneratorOutput";
import type IGeneratorState from "./generators/IGeneratorState";
import generateLiteral from "./generators/expressions/LiteralGenerator";

/** C's spelling of the most negative i64, which no literal reaches */
const I64_MIN = "-9223372036854775808";

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
 * declared type is. A const with no such value (a string, or one whose
 * initializer is not constant) is emitted.
 */
class PrivateConstValue {
  static inlined(
    generatorState: IGeneratorState,
    transpileState: TranspileState,
    cName: string,
  ): IGeneratorOutput | null {
    const program = transpileState.typingContext().program;
    const symbol = program.symbolByCName(cName);
    if (symbol?.kind !== "variable" || !PrivateConstValue.canInline(symbol)) {
      return null;
    }
    const text = PrivateConstValue.literalText(
      program,
      symbol,
      program.settledConstOf(cName),
    );
    if (text === null) return null;
    // A literal has no sign: a negative value is the negated literal, in
    // parentheses so `-X` does not read as a decrement
    const negative = text.startsWith("-");
    const settled = program.settledConstOf(cName)!;
    const output = generateLiteral(
      negative ? text.slice(1) : text,
      {
        ...generatorState,
        expectedType: settled.kind === "value" ? settled.typeName : null,
      },
      transpileState,
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
        return null;
    }
  }

  /** A literal initializer keeps its notation (`0xAB`); the rest are digits */
  private static integerText(symbol: IVariableSymbol, digits: string): string {
    if (digits === I64_MIN) return "-9223372036854775807LL - 1";
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

  private static shortestF32(value: number): string {
    for (let digits = 1; digits < 9; digits++) {
      const spelled = String(Number(value.toPrecision(digits)));
      if (Math.fround(Number(spelled)) === value) return spelled;
    }
    return String(Number(value.toPrecision(9)));
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

  /** Issue #282/#500: a private, scalar scope const with an initializer */
  private static canInline(symbol: IVariableSymbol): boolean {
    return (
      !ScopeUtils.isGlobalScopePath(symbol.scopePath) &&
      symbol.visibility === "private" &&
      symbol.isConst &&
      !symbol.isArray &&
      symbol.initialValueExpr !== undefined &&
      symbol.initialValue !== undefined
    );
  }
}

export default PrivateConstValue;
