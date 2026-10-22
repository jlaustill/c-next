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
 * The cnx side is the callback type's `_fp` typedef, read off the declaration
 * by the rules that typedef is written by (ADR-006 passing, ADR-071 `mut`).
 */
import type IFunctionSymbol from "../../../types/symbols/IFunctionSymbol";
import type IParameterInfo from "../../../types/symbols/IParameterInfo";
import type ICFunctionSymbol from "../../../types/symbols/c/ICFunctionSymbol";
import type TExpression from "../../../types/syntax/TExpression";
import DeclaredTypeFacts from "../../../utils/DeclaredTypeFacts";
import ParameterConst from "../../../utils/ParameterConst";
import ScopeUtils from "../../../utils/ScopeUtils";
import TypeCheckUtils from "../../../utils/TypeCheckUtils";
import TypeResolver from "../../../utils/TypeResolver";
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
    const expectedReturn = CCallbackSignature.cnxType(
      TypeResolver.getTypeName(expected.returnType),
      context,
    );
    if (
      !CCallbackSignature.same(
        { base: expectedReturn, indirection: "", pointeeConst: false },
        CCallbackSignature.parse(actual.type, false, false),
        context,
      )
    ) {
      return false;
    }
    const cName = ScopeUtils.getTranspiledCName(expected);
    return expected.parameters.every((parameter, index) => {
      const cParameter = actualParameters[index];
      return CCallbackSignature.same(
        CCallbackSignature.cnxParameter(cName, parameter, context),
        CCallbackSignature.parse(
          cParameter.type,
          cParameter.isConst,
          cParameter.isArray,
        ),
        context,
      );
    });
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
   * One parameter of a cnx callback type as its `_fp` typedef writes it
   * (`CallbackTypedefFormatter`): an array, a string, an opaque handle and a
   * struct are pointers (a struct a C++ reference), `const` unless `mut`; a
   * `mut` scalar is a plain pointer (ADR-071); a read-only scalar is a value.
   */
  private static cnxParameter(
    cName: string,
    parameter: IParameterInfo,
    context: IAnalysisContext,
  ): ICType {
    const program = context.program;
    const typeName = TypeResolver.getTypeName(parameter.type);
    const isCallbackType = program.symbolByCName(typeName)?.kind === "function";
    const pointeeConst = ParameterConst.isWritten(
      parameter.isConst,
      typeName,
      isCallbackType,
    );
    const base = CCallbackSignature.cnxType(typeName, context);
    if (isCallbackType) {
      return { base: `${base}_fp`, indirection: "", pointeeConst: false };
    }
    if (parameter.isArray) {
      return { base, indirection: "*", pointeeConst };
    }
    if (TypeCheckUtils.isSizedStringName(typeName)) {
      return { base: "char", indirection: "*", pointeeConst };
    }
    if (parameter.isOpaqueHandle === true) {
      return { base, indirection: "*", pointeeConst };
    }
    if (
      DeclaredTypeFacts.isStruct(context.symbols, context.symbolTable, typeName)
    ) {
      return {
        base,
        indirection: program.cppMode() ? "&" : "*",
        pointeeConst,
      };
    }
    if (program.passByValueParams().get(cName)?.has(parameter.name) === true) {
      return { base, indirection: "", pointeeConst: false };
    }
    const isScalar =
      TypeCheckUtils.isInteger(typeName) ||
      TypeCheckUtils.isFloat(typeName) ||
      typeName === "bool" ||
      program.knownEnums().has(typeName);
    return {
      base,
      indirection: isScalar ? (program.cppMode() ? "&" : "*") : "",
      pointeeConst: false,
    };
  }

  /** A cnx type name as C spells it (ADR-057): `uint32_t`, `Clock__Timer` */
  private static cnxType(typeName: string, context: IAnalysisContext): string {
    return context.program.cTypeNameAt(context.sourceFile, typeName, {
      line: 0,
      column: 0,
    });
  }

  /**
   * A C type as a header spells it: `const Reading*`, or a parameter's
   * `Reading*` with its pointee's `const` and its array-ness given apart
   */
  private static parse(
    text: string,
    isConst: boolean,
    isArray: boolean,
  ): ICType {
    const stars = (text.match(/\*/g) ?? []).length + (isArray ? 1 : 0);
    const words = text.replaceAll("*", " ").split(/\s+/).filter(Boolean);
    const qualified = words.includes("const") || isConst;
    const base = words
      .filter((word) => word !== "const" && word !== "volatile")
      .join(" ");
    return {
      base,
      indirection: "*".repeat(stars),
      pointeeConst: stars > 0 && qualified,
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
