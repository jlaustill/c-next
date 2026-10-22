/**
 * #1619, ADR-029: whether a function a C header declares matches a cnx
 * callback type, by C type identity under the run's own header compiler.
 *
 * `unsigned long millis(void)` matches `u32 tickSource()` where the compiler
 * makes `uint32_t` an `unsigned long` (arm-none-eabi-gcc, avr-gcc), and does
 * not where it makes it an `unsigned int` (x86-64 gcc): two C types of one
 * width are still two types (C11 6.2.7), and a call through a pointer of the
 * other is undefined (C11 6.3.2.3p8).
 *
 * The cnx side is the callback type's `_fp` typedef as 2.2 writes it:
 * `CallbackParameterShape` decides it and `CallbackTypedefFormatter` spells
 * it, for 2.2's typedef and for this comparison alike.
 *
 * A header parameter its lowering does not fully carry -- a pointer to a
 * function or to an array, a function-pointer or array typedef, an inner
 * array dimension that is not a literal -- is "unknown", never a mismatch.
 */
import type ICallbackTypedefParameter from "../../../types/ICallbackTypedefParameter";
import type IFunctionSymbol from "../../../types/symbols/IFunctionSymbol";
import type ICFunctionSymbol from "../../../types/symbols/c/ICFunctionSymbol";
import type ICParameterInfo from "../../../types/symbols/c/ICParameterInfo";
import type TExpression from "../../../types/syntax/TExpression";
import CallbackParameterShape from "../../../utils/CallbackParameterShape";
import CallbackTypedefFormatter from "../../../utils/CallbackTypedefFormatter";
import ScopeUtils from "../../../utils/ScopeUtils";
import type ICallbackShapeFacts from "../../../utils/types/ICallbackShapeFacts";
import type IAnalysisContext from "../types/IAnalysisContext";

/** The words C's integer type spellings are made of, in any order */
const INTEGER_WORDS = new Set([
  "signed",
  "unsigned",
  "char",
  "short",
  "int",
  "long",
]);

/** One C type as the compiler tells types apart */
interface ICType {
  readonly base: string;
  /** `*` per pointer level, then `&` for a C++ reference */
  readonly indirection: string;
  /** Whether what the pointer points at is const; meaningless with none */
  readonly pointeeConst: boolean;
}

type TSignatureMatch = "match" | "mismatch" | "unknown";

class CCallbackSignature {
  /**
   * The C function a callback value names: a bare name, or `global.name`,
   * that binds to nothing of cnx's own and that a C header declares.
   */
  static foreignFunction(
    value: TExpression,
    context: IAnalysisContext,
  ): ICFunctionSymbol | null {
    const named = CCallbackSignature.namedValue(value);
    if (named === null) return null;
    const binding = context.program.bindValue(
      context.sourceFile,
      named.root,
      named.name,
      value.span,
    );
    if (binding?.kind !== "foreign") return null;
    const symbol = context.symbolTable
      .getCOverloads(named.name)
      .find((candidate) => candidate.kind === "function");
    return symbol?.kind === "function" ? symbol : null;
  }

  /** A definite mismatch anywhere wins; otherwise any unknown part is unknown */
  static compare(
    expected: IFunctionSymbol,
    actual: ICFunctionSymbol,
    context: IAnalysisContext,
  ): TSignatureMatch {
    if (actual.isVariadic === true) return "mismatch";
    const actualParameters = actual.parameters ?? [];
    if (actualParameters.length !== expected.parameters.length) {
      return "mismatch";
    }
    const facts: ICallbackShapeFacts = {
      program: context.program,
      symbols: context.symbols,
      symbolTable: context.symbolTable,
    };
    const isCppMode = context.program.cppMode();
    const verdicts = [
      CCallbackSignature.same(
        CCallbackSignature.parse(
          CallbackParameterShape.returnType(expected, facts),
          false,
          false,
        ),
        CCallbackSignature.parse(actual.type, false, false),
        context,
      ),
      ...CallbackParameterShape.parameters(
        ScopeUtils.getTranspiledCName(expected),
        expected,
        facts,
      ).map((parameter, index) =>
        CCallbackSignature.compareParameter(
          parameter,
          (expected.parameters[index].arrayDimensions ?? []).map(String),
          actualParameters[index],
          isCppMode,
          context,
        ),
      ),
    ];
    if (verdicts.includes("mismatch")) return "mismatch";
    return verdicts.includes("unknown") ? "unknown" : "match";
  }

  private static compareParameter(
    parameter: Required<ICallbackTypedefParameter>,
    slotDimensions: readonly string[],
    cParameter: ICParameterInfo,
    isCppMode: boolean,
    context: IAnalysisContext,
  ): TSignatureMatch {
    if (cParameter.isNestedDeclarator === true) return "unknown";
    const dimensions = CCallbackSignature.innerDimensions(
      slotDimensions,
      cParameter.arrayDimensions ?? [],
    );
    if (dimensions !== "match") return dimensions;
    // The typedef's own spelling of the parameter, unnamed and with its
    // dimensions apart: an array parameter is a pointer to its element.
    const typedefText = CallbackTypedefFormatter.formatParameterList(
      [{ ...parameter, name: "", arrayDims: "" }],
      isCppMode,
    );
    return CCallbackSignature.same(
      CCallbackSignature.parse(typedefText, false, parameter.isArray),
      CCallbackSignature.parse(
        cParameter.type,
        cParameter.isConst,
        cParameter.isArray,
      ),
      context,
    );
  }

  /**
   * Every dimension of an array parameter but the first, which decays, is
   * part of its type: `uint8_t g[4][8]` is `const uint8_t (*)[8]`.
   */
  private static innerDimensions(
    slot: readonly string[],
    header: readonly string[],
  ): TSignatureMatch {
    const slotInner = slot.slice(1);
    const headerInner = header.slice(1);
    if (slotInner.length !== headerInner.length) return "mismatch";
    let result: TSignatureMatch = "match";
    slotInner.forEach((dimension, index) => {
      const other = headerInner[index].trim();
      if (dimension.trim() === other) return;
      if (/^\d+$/.test(dimension.trim()) && /^\d+$/.test(other)) {
        result = "mismatch";
      } else if (result === "match") {
        result = "unknown";
      }
    });
    return result;
  }

  private static namedValue(
    value: TExpression,
  ): { root: "global" | null; name: string } | null {
    if (value.kind === "identifier") return { root: null, name: value.name };
    if (
      value.kind === "postfix" &&
      value.primary.kind === "root" &&
      value.primary.root === "global" &&
      value.ops.length === 1 &&
      value.ops[0].kind === "member"
    ) {
      return { root: "global", name: value.ops[0].name };
    }
    return null;
  }

  /**
   * A C type as a header or the `_fp` typedef spells it: `const Reading*`,
   * `const Reading&`, or a parameter's `Reading*` with its pointee's `const`
   * and its array-ness given apart
   */
  private static parse(
    text: string,
    isConst: boolean,
    isArray: boolean,
  ): ICType {
    const stars = (text.match(/\*/g) ?? []).length + (isArray ? 1 : 0);
    const indirection = "*".repeat(stars) + (text.includes("&") ? "&" : "");
    const words = text.replaceAll(/[*&]/g, " ").split(/\s+/).filter(Boolean);
    const qualified = words.includes("const") || isConst;
    const base = words
      .filter((word) => word !== "const" && word !== "volatile")
      .join(" ");
    return {
      base,
      indirection,
      pointeeConst: indirection !== "" && qualified,
    };
  }

  private static same(
    a: ICType,
    b: ICType,
    context: IAnalysisContext,
  ): TSignatureMatch {
    if (CCallbackSignature.equal(a, b, context)) return "match";
    const resolvedA = CCallbackSignature.resolve(a, context);
    const resolvedB = CCallbackSignature.resolve(b, context);
    if (resolvedA === null || resolvedB === null) return "unknown";
    return CCallbackSignature.equal(resolvedA, resolvedB, context)
      ? "match"
      : "mismatch";
  }

  private static equal(a: ICType, b: ICType, context: IAnalysisContext) {
    if (a.indirection !== b.indirection) return false;
    if (a.indirection !== "" && a.pointeeConst !== b.pointeeConst) return false;
    return (
      CCallbackSignature.identity(a.base, context) ===
      CCallbackSignature.identity(b.base, context)
    );
  }

  /**
   * A header typedef followed until its base names none, its own `*`s
   * counted: `SampleRef` (`typedef Sample *SampleRef`) is `Sample*`. Null
   * for a typedef of a function pointer or an array, whose shape the
   * lowering does not carry.
   */
  private static resolve(
    type: ICType,
    context: IAnalysisContext,
  ): ICType | null {
    const seen = new Set<string>();
    let current = type;
    for (;;) {
      const name = CCallbackSignature.untagged(current.base);
      if (seen.has(name)) return current;
      seen.add(name);
      const typedef = context.symbolTable.getCSymbol(name);
      if (typedef?.kind !== "type") return current;
      if (typedef.type.includes("(") || typedef.arrayDimensions?.length) {
        return null;
      }
      const inner = CCallbackSignature.parse(typedef.type, false, false);
      current = {
        base: inner.base,
        indirection: inner.indirection + current.indirection,
        // `const SampleRef` is `Sample * const`: the const is the pointer's
        pointeeConst:
          current.indirection === ""
            ? inner.pointeeConst
            : current.pointeeConst,
      };
    }
  }

  /**
   * The type a base type name denotes: an exact-width `<stdint.h>` name the
   * compiler did not see declared taken from its own macros, and C's integer
   * spellings in one word order (`long unsigned int` is `unsigned long`).
   */
  private static identity(text: string, context: IAnalysisContext): string {
    const untagged = CCallbackSignature.untagged(text);
    const name = context.program.headerIntegerType(untagged) ?? untagged;
    const words = name.split(/\s+/);
    if (words.every((word) => INTEGER_WORDS.has(word))) {
      return CCallbackSignature.integer(words);
    }
    if (name === "bool" || name === "_Bool") return "_Bool";
    return name;
  }

  private static untagged(text: string): string {
    return text.replace(/^(?:struct|enum|union)\s+/, "").trim();
  }

  private static integer(words: readonly string[]): string {
    const unsigned = words.includes("unsigned");
    if (words.includes("char")) {
      if (unsigned) return "unsigned char";
      return words.includes("signed") ? "signed char" : "char";
    }
    const longs = words.filter((word) => word === "long").length;
    let size = "int";
    if (words.includes("short")) size = "short";
    else if (longs === 2) size = "long long";
    else if (longs === 1) size = "long";
    return unsigned ? `unsigned ${size}` : size;
  }
}

export default CCallbackSignature;
