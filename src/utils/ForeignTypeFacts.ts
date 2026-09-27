import type SymbolTable from "../PARSE/3-Declare/SymbolTable";
import type TCSymbol from "../transpiler/types/symbols/c/TCSymbol";
import type TCppSymbol from "../transpiler/types/symbols/cpp/TCppSymbol";
import type IForeignSymbolLookup from "../transpiler/types/IForeignSymbolLookup";
import type IOperandType from "../transpiler/types/IOperandType";
import type ITargetDescription from "../transpiler/types/ITargetDescription";

/**
 * What C-Next may read of a C or C++ header symbol's type.
 *
 * Two readers, one owner:
 *
 * - the operand typer's, `operandType` and the members built on it: a
 *   header value's essential category and width, from its spelling and the
 *   run's target (#1668, R4). Every pass types operands through it.
 * - render's declared type info, `variableType`: a struct global's type, a
 *   pointer to one included (#978: `font_t* g` is read through `->`), which
 *   the operand typer deliberately leaves untyped, and a floating scalar.
 *
 * A floating answer is given in C-Next spelling (`f32`/`f64`), so no caller has
 * to know that `float` and `double` are floating too.
 */
class ForeignTypeFacts {
  /** Typedef hops followed before giving up, so a cycle cannot loop. */
  private static readonly MAX_TYPEDEF_HOPS = 8;

  /**
   * The type C-Next may use for a C header variable: its struct type, or its
   * floating type. Null for anything else, including arrays and pointers of a
   * floating type.
   */
  static variableType(symbolTable: SymbolTable, name: string): string | null {
    const symbol = ForeignTypeFacts.foreignSymbol(symbolTable, name);
    if (symbol?.kind !== "variable" || !symbol.type) return null;

    const baseType = ForeignTypeFacts.stripOnePointer(symbol.type);
    if (ForeignTypeFacts.isStruct(symbolTable, baseType)) return baseType;
    if (symbol.isArray) return null;
    return ForeignTypeFacts.usableType(symbolTable, symbol.type);
  }

  /** A scalar C type as C-Next may use it: a struct, or floating. */
  private static usableType(
    symbolTable: SymbolTable,
    cType: string,
  ): string | null {
    const baseType = ForeignTypeFacts.stripOnePointer(cType);
    if (ForeignTypeFacts.isStruct(symbolTable, baseType)) return baseType;
    if (cType.endsWith("*")) return null;
    return ForeignTypeFacts.floatingType(symbolTable, cType);
  }

  /**
   * A header symbol by name: C first, then C++ (a `.hpp` in `--cpp` mode).
   * Both carry the same `kind` and `type` string for the shapes read here.
   */
  private static foreignSymbol(
    symbolTable: SymbolTable,
    name: string,
  ): TCSymbol | TCppSymbol | undefined {
    return symbolTable.getCSymbol(name) ?? symbolTable.getCppSymbol(name);
  }

  private static isStruct(symbolTable: SymbolTable, type: string): boolean {
    return (
      symbolTable.isTypedefStructType(type) ||
      symbolTable.getStructFields(type) !== undefined
    );
  }

  /**
   * Strip trailing pointer stars from a C type string (e.g., "font_t*" → "font_t").
   * Uses string operations instead of regex to avoid SonarCloud ReDoS flag (S5852).
   */
  /**
   * What a C pointer type points at: `font_t*` is `font_t`. One level only
   * (#1435's review): stripping every `*` made `Dev**` claim to be a `Dev*`,
   * and a call site took its address for a `Dev**` parameter -- a `Dev***`.
   * One level leaves `Dev*`, which is no struct, so a pointer to a pointer
   * gets no answer here and its reader asks the declared C type.
   */
  private static stripOnePointer(type: string): string {
    return type.endsWith("*") ? type.slice(0, -1).trim() : type;
  }

  /**
   * `f32` for C `float`, `f64` for `double`, following typedefs
   * (`float32_t`); null for a non-floating or pointer type.
   */
  private static floatingType(
    symbolTable: SymbolTable,
    cType: string,
  ): "f32" | "f64" | null {
    let type = ForeignTypeFacts.unqualified(cType);
    for (let hop = 0; hop < ForeignTypeFacts.MAX_TYPEDEF_HOPS; hop += 1) {
      if (type.includes("*")) return null;
      if (type === "float") return "f32";
      if (type === "double") return "f64";
      const typedef = ForeignTypeFacts.foreignSymbol(symbolTable, type);
      if (typedef?.kind !== "type" || !typedef.type) return null;
      type = ForeignTypeFacts.unqualified(typedef.type);
    }
    return null;
  }

  /**
   * #1668 (R4): a C or C++ value's operand type, from its declared spelling
   * and the run's target.
   *
   * The spelling is matched against the C types the language knows at EVERY
   * hop of the typedef walk, before the typedef is followed. Headers are
   * preprocessed with a toolchain chosen independently of the target, so
   * `uint32_t -> __uint32_t -> unsigned int` would otherwise take `int`'s
   * width from the wrong platform; the fixed-width name is fixed.
   *
   * - integers: category from the C type, width from `target` (the
   *   `intN_t` family is always N; `int_fastN_t` and `intmax_t` are the C
   *   library's choice, so their width is unknown);
   * - `char` is character, `_Bool`/`bool` Boolean, a C or C++ enum enum;
   * - `float`/`double`/`long double` floating, at the target's widths;
   * - a struct keeps its name, for field access;
   * - an array keeps its dimensions whatever its element (#978), so a
   *   subscript on it stays element access; a pointer is untyped.
   *
   * @param dimensions the declaration's array dimensions, if it is an array
   */
  static operandType(
    cType: string,
    lookup: IForeignSymbolLookup,
    target: ITargetDescription | null,
    dimensions: ReadonlyArray<number | string> = [],
  ): IOperandType | null {
    const walked = ForeignTypeFacts.elementOf(cType, lookup, target);
    const element = walked?.element ?? null;
    // The declaration's own dimensions lead: `vec3 gv[2]` is `float[2][3]`
    const allDimensions = [...dimensions, ...(walked?.dimensions ?? [])];
    if (element === null && allDimensions.length === 0) {
      return null;
    }
    return {
      typeName: null,
      category: "none",
      bitWidth: null,
      ...element,
      dimensions: allDimensions,
      stringCapacity: null,
      enumTypeName: null,
      bitmapTypeName: null,
      overflow: null,
      hasSideEffect: false,
      form: { kind: "foreign", indeterminate: false },
      binding: null,
    };
  }

  /**
   * Whether `name` is a C or C++ type: one of C's own (`uint32_t`, `size_t`,
   * `unsigned int` -- known by spelling, as `operandType` knows them), or a
   * typedef, struct, class or enum a header declares. A name that is
   * neither is not a header's type, whatever a C-Next declaration spelled.
   */
  static isForeignType(
    name: string,
    lookup: IForeignSymbolLookup,
    target: ITargetDescription | null,
  ): boolean {
    if (ForeignTypeFacts.knownSpelling(name, target) !== undefined) return true;
    const kinds = new Set(["type", "struct", "class", "enum"]);
    const c = lookup.getCSymbol(name);
    const cpp = lookup.getCppSymbol(name);
    return (
      (c !== undefined && kinds.has(c.kind)) ||
      (cpp !== undefined && kinds.has(cpp.kind)) ||
      lookup.isTypedefStructType(name)
    );
  }

  /** A C variable (C first, then C++): `name` as a header declares it */
  static variableOperand(
    name: string,
    lookup: IForeignSymbolLookup,
    target: ITargetDescription | null,
  ): IOperandType | null {
    const symbol = lookup.getCSymbol(name) ?? lookup.getCppSymbol(name);
    if (symbol?.kind !== "variable" || !symbol.type) return null;
    return ForeignTypeFacts.operandType(
      ForeignTypeFacts.inNamespaceOf(name, symbol.type, lookup),
      lookup,
      target,
      symbol.isArray ? (symbol.arrayDimensions ?? [""]) : [],
    );
  }

  /**
   * A type spelled inside a C++ namespace, as C++ looks it up: `PS` in
   * `namespace NS` is `NS::PS` when NS declares one, else the enclosing
   * namespace's, out to the global one. A header's collectors key a
   * namespace's types by their full name, and a variable records its type
   * as written (#1668 review: `NS.nps.pf` was untyped).
   */
  private static inNamespaceOf(
    qualifiedName: string,
    type: string,
    lookup: IForeignSymbolLookup,
  ): string {
    const spelling = ForeignTypeFacts.spellingOf(type);
    const scopes = qualifiedName.split("::").slice(0, -1);
    for (let depth = scopes.length; depth > 0; depth -= 1) {
      const candidate = [...scopes.slice(0, depth), spelling].join("::");
      const symbol = lookup.getCppSymbol(candidate);
      if (
        symbol !== undefined &&
        (symbol.kind === "type" ||
          symbol.kind === "struct" ||
          symbol.kind === "class" ||
          symbol.kind === "enum")
      ) {
        return candidate;
      }
    }
    return type;
  }

  /** A field of a C struct */
  static fieldOperand(
    structName: string,
    field: string,
    lookup: IForeignSymbolLookup,
    target: ITargetDescription | null,
  ): IOperandType | null {
    const info = lookup.getStructFieldInfo(structName, field);
    if (!info?.type) return null;
    return ForeignTypeFacts.operandType(
      info.type,
      lookup,
      target,
      info.arrayDimensions ?? [],
    );
  }

  /**
   * What calling a C struct's function-pointer field gives, `ops.get()`:
   * the pointed-to function's result, through any typedefs to the pointer
   * (`typedef float (*getter_t)(void)`). Null when the result is a type
   * C-Next does not read; undefined when the field is not a function
   * pointer at all.
   */
  static fieldCallOperand(
    structName: string,
    field: string,
    lookup: IForeignSymbolLookup,
    target: ITargetDescription | null,
  ): IOperandType | null | undefined {
    const info = lookup.getStructFieldInfo(structName, field);
    if (!info?.type || info.arrayDimensions?.length) return undefined;
    let type = ForeignTypeFacts.spellingOf(info.type);
    for (let hop = 0; hop < ForeignTypeFacts.MAX_TYPEDEF_HOPS; hop += 1) {
      const result = ForeignTypeFacts.pointedFunctionResult(type);
      if (result !== null) {
        return ForeignTypeFacts.operandType(result, lookup, target);
      }
      const typedef = lookup.getCSymbol(type) ?? lookup.getCppSymbol(type);
      if (typedef?.kind !== "type" || !typedef.type) return undefined;
      type = ForeignTypeFacts.spellingOf(typedef.type);
    }
    return undefined;
  }

  /**
   * The result type a function-pointer spelling names: `float` for
   * `float (*)(void)`, null for any other spelling. String operations rather
   * than a regex, as `stripOnePointer` does, to avoid backtracking
   * (SonarCloud S5852).
   */
  private static pointedFunctionResult(type: string): string | null {
    const star = type.indexOf("*");
    const open = star < 0 ? -1 : type.lastIndexOf("(", star);
    const close = star < 0 ? -1 : type.indexOf(")", star);
    if (open < 0 || close < 0) return null;
    const between = type.slice(open + 1, star) + type.slice(star + 1, close);
    const parameters = type.slice(close + 1).trim();
    if (
      between.trim() !== "" ||
      !parameters.startsWith("(") ||
      !parameters.endsWith(")")
    ) {
      return null;
    }
    const result = type.slice(0, open).trim();
    return result === "" ? null : result;
  }

  /**
   * The result of calling a C function or a C++ function (by its `::` key).
   * A C++ overload set whose return categories disagree is indeterminate:
   * which one the call selects is C++'s overload resolution, not ours.
   */
  static callOperand(
    name: string,
    lookup: IForeignSymbolLookup,
    target: ITargetDescription | null,
  ): IOperandType | null {
    const cFunction = lookup.getCSymbol(name);
    const returns =
      cFunction?.kind === "function"
        ? [cFunction.type]
        : lookup
            .getCppOverloads(name)
            .filter((symbol) => symbol.kind === "function")
            .map((symbol) => ("type" in symbol ? symbol.type : undefined));
    const results = returns.map((type) =>
      type ? ForeignTypeFacts.operandType(type, lookup, target) : null,
    );
    if (results.length === 0) return null;
    const first = results[0];
    const agree = results.every(
      (result) =>
        result?.category === first?.category &&
        result?.typeName === first?.typeName,
    );
    if (!agree) {
      return {
        ...ForeignTypeFacts.UNTYPED,
        hasSideEffect: true,
        form: { kind: "foreign", indeterminate: true },
      };
    }
    return first ? { ...first, hasSideEffect: true } : null;
  }

  private static readonly UNTYPED: IOperandType = {
    typeName: null,
    dimensions: [],
    category: "none",
    bitWidth: null,
    stringCapacity: null,
    enumTypeName: null,
    bitmapTypeName: null,
    overflow: null,
    hasSideEffect: false,
    form: { kind: "foreign", indeterminate: false },
    binding: null,
  };

  /**
   * The element type a spelling denotes, walking typedefs spelling-first, and
   * the array dimensions the typedefs it passed through add.
   */
  private static elementOf(
    cType: string,
    lookup: IForeignSymbolLookup,
    target: ITargetDescription | null,
  ): {
    element: Pick<IOperandType, "typeName" | "category" | "bitWidth"> | null;
    dimensions: Array<number | string>;
  } | null {
    const dimensions: Array<number | string> = [];
    const found = (
      element: Pick<IOperandType, "typeName" | "category" | "bitWidth"> | null,
    ) => ({ element, dimensions });
    let type = ForeignTypeFacts.spellingOf(cType);
    // An anonymous enum is named by the typedef that names it
    let typedefName = type;
    for (let hop = 0; hop < ForeignTypeFacts.MAX_TYPEDEF_HOPS; hop += 1) {
      if (type.includes("*") || type.includes("&")) {
        return dimensions.length > 0 ? found(null) : null;
      }
      const known = ForeignTypeFacts.knownSpelling(type, target);
      if (known !== undefined) return found(known);
      if (type.startsWith("enum ") || ForeignTypeFacts.isEnum(lookup, type)) {
        return found({
          typeName: type.startsWith("enum {")
            ? typedefName
            : type.replace(/^enum /, ""),
          category: "enum",
          bitWidth: null,
        });
      }
      const tag = type.replace(/^struct /, "");
      if (lookup.isTypedefStructType(tag) || lookup.getStructFields(tag)) {
        return found({ typeName: tag, category: "none", bitWidth: null });
      }
      const typedef = lookup.getCSymbol(type) ?? lookup.getCppSymbol(type);
      if (typedef?.kind !== "type" || !typedef.type) {
        return dimensions.length > 0 ? found(null) : null;
      }
      if ("arrayDimensions" in typedef && typedef.arrayDimensions) {
        dimensions.push(...typedef.arrayDimensions);
      }
      typedefName = type;
      type = ForeignTypeFacts.spellingOf(typedef.type);
    }
    return null;
  }

  private static isEnum(lookup: IForeignSymbolLookup, type: string): boolean {
    return (
      lookup.getCSymbol(type)?.kind === "enum" ||
      lookup.getCppSymbol(type)?.kind === "enum"
    );
  }

  /** Qualifiers and a leading `std::` or `::` removed, blanks collapsed */
  private static spellingOf(cType: string): string {
    return ForeignTypeFacts.unqualified(cType).replace(/^(?:std)?::/, "");
  }

  /**
   * The C types the language knows by name, or undefined for any other
   * spelling. A known name with no width on this target (no target, or the C
   * library's choice) keeps its category and gives a null width.
   */
  private static knownSpelling(
    type: string,
    target: ITargetDescription | null,
  ): Pick<IOperandType, "typeName" | "category" | "bitWidth"> | undefined {
    const fixed = /^(u?)int(?:_least)?(8|16|32|64)_t$/.exec(type);
    if (fixed) {
      return ForeignTypeFacts.integer(fixed[1] === "u", Number(fixed[2]));
    }
    if (/^u?int_fast(?:8|16|32|64)_t$|^u?intmax_t$/.test(type)) {
      return ForeignTypeFacts.integer(type.startsWith("u"), null);
    }
    switch (type) {
      case "size_t":
        return ForeignTypeFacts.integer(true, target?.size_t_bits ?? null);
      case "ptrdiff_t":
      case "intptr_t":
        return ForeignTypeFacts.integer(false, target?.pointer_bits ?? null);
      case "uintptr_t":
        return ForeignTypeFacts.integer(true, target?.pointer_bits ?? null);
      case "char":
        return { typeName: "char", category: "character", bitWidth: 8 };
      case "_Bool":
      case "bool":
        return { typeName: "bool", category: "boolean", bitWidth: null };
      case "float":
        return ForeignTypeFacts.floating(target?.float_bits ?? 32);
      case "double":
        return ForeignTypeFacts.floating(target?.double_bits ?? 64);
      case "long double":
        return ForeignTypeFacts.floating(target?.long_double_bits ?? null);
    }
    return ForeignTypeFacts.standardInteger(type, target);
  }

  /** `signed char`, `unsigned`, `long long int` and the rest of C's integers */
  private static standardInteger(
    type: string,
    target: ITargetDescription | null,
  ): Pick<IOperandType, "typeName" | "category" | "bitWidth"> | undefined {
    const words = type.split(" ");
    const allowed = new Set([
      "signed",
      "unsigned",
      "short",
      "long",
      "int",
      "char",
    ]);
    if (!words.every((word) => allowed.has(word))) return undefined;
    const isUnsigned = words.includes("unsigned");
    if (words.includes("char")) {
      return words.length === 2
        ? ForeignTypeFacts.integer(isUnsigned, 8)
        : undefined;
    }
    const longs = words.filter((word) => word === "long").length;
    let width: number | null | undefined = target?.int_bits;
    if (words.includes("short")) width = target?.short_bits;
    if (longs === 1) width = target?.long_bits;
    if (longs === 2) width = target?.long_long_bits;
    return ForeignTypeFacts.integer(isUnsigned, width ?? null);
  }

  private static integer(
    isUnsigned: boolean,
    width: number | null,
  ): Pick<IOperandType, "typeName" | "category" | "bitWidth"> {
    const sized = width !== null && [8, 16, 32, 64].includes(width);
    return {
      typeName: sized ? `${isUnsigned ? "u" : "i"}${width}` : null,
      category: isUnsigned ? "unsigned" : "signed",
      bitWidth: width,
    };
  }

  private static floating(
    width: number | null,
  ): Pick<IOperandType, "typeName" | "category" | "bitWidth"> {
    return {
      typeName: width === 32 || width === 64 ? `f${width}` : null,
      category: "floating",
      bitWidth: null,
    };
  }

  private static unqualified(cType: string): string {
    return cType
      .replace(/\b(?:const|volatile)\b/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }
}

export default ForeignTypeFacts;
