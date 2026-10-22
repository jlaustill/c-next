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
 */
import type IFunctionSymbol from "../../../types/symbols/IFunctionSymbol";
import type ICFunctionSymbol from "../../../types/symbols/c/ICFunctionSymbol";
import type TExpression from "../../../types/syntax/TExpression";
import CallbackParameterShape from "../../../utils/CallbackParameterShape";
import type ICallbackShapeFacts from "../../../utils/types/ICallbackShapeFacts";
import CallbackTypedefFormatter from "../../../utils/CallbackTypedefFormatter";
import DeclaredTypeFacts from "../../../utils/DeclaredTypeFacts";
import headerCType from "../../../utils/headerCType";
import ScopeUtils from "../../../utils/ScopeUtils";
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
  /** `*` per pointer level, `&` for a C++ reference */
  readonly indirection: string;
  /** Whether what the pointer points at is const; meaningless with none */
  readonly pointeeConst: boolean;
}

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

  static matches(
    expected: IFunctionSymbol,
    actual: ICFunctionSymbol,
    context: IAnalysisContext,
  ): boolean {
    if (actual.isVariadic === true) return false;
    const actualParameters = actual.parameters ?? [];
    if (actualParameters.length !== expected.parameters.length) return false;
    const facts = CCallbackSignature.shapeFacts(context);
    if (
      !CCallbackSignature.same(
        CCallbackSignature.parse(
          CallbackParameterShape.returnType(expected, facts),
          false,
          false,
        ),
        CCallbackSignature.parse(actual.type, false, false),
        context,
      )
    ) {
      return false;
    }
    const isCppMode = context.program.cppMode();
    return CallbackParameterShape.parameters(
      ScopeUtils.getTranspiledCName(expected),
      expected,
      facts,
    ).every((parameter, index) => {
      const cParameter = actualParameters[index];
      // The typedef's own spelling of the parameter, unnamed and with its
      // dimensions dropped: an array parameter is a pointer to its element.
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
    });
  }

  /** The `_fp` typedef's facts, as 2.1 sees the program */
  private static shapeFacts(context: IAnalysisContext): ICallbackShapeFacts {
    const { program, symbolTable } = context;
    return {
      program,
      callbackTypes: new Set<string>(),
      symbolTable,
      isKnownStruct: (typeName) =>
        DeclaredTypeFacts.isStruct(context.symbols, symbolTable, typeName),
      isFunctionType: (typeName) =>
        program.symbolByCName(typeName)?.kind === "function",
      cType: (typeName) => headerCType(typeName, symbolTable),
    };
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
  ): boolean {
    if (a.indirection !== b.indirection) return false;
    if (a.indirection !== "" && a.pointeeConst !== b.pointeeConst) return false;
    return (
      CCallbackSignature.identity(a.base, context) ===
      CCallbackSignature.identity(b.base, context)
    );
  }

  /**
   * The type a base type name denotes: a header typedef followed to what it
   * names, an exact-width `<stdint.h>` name the compiler did not see declared
   * taken from its own macros, and C's integer spellings in one word order
   * (`long unsigned int` is `unsigned long`).
   */
  private static identity(text: string, context: IAnalysisContext): string {
    const seen = new Set<string>();
    let name = text.replace(/^(?:struct|enum|union)\s+/, "").trim();
    while (!seen.has(name)) {
      seen.add(name);
      const words = name.split(/\s+/);
      if (words.every((word) => INTEGER_WORDS.has(word))) {
        return CCallbackSignature.integer(words);
      }
      if (name === "bool" || name === "_Bool") return "_Bool";
      const typedef = context.symbolTable.getCSymbol(name);
      if (
        typedef?.kind === "type" &&
        !typedef.type.includes("(") &&
        !typedef.type.includes("*")
      ) {
        name = typedef.type.replace(/^(?:struct|enum|union)\s+/, "").trim();
        continue;
      }
      const builtin = context.program.headerIntegerType(name);
      if (builtin !== null) {
        name = builtin;
        continue;
      }
      return name;
    }
    return name;
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
