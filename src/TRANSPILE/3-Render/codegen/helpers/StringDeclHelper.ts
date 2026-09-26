/**
 * StringDeclHelper - Generates string variable declarations
 *
 * Issue #644: Extracted from CodeGenerator to reduce file size.
 * Migrated to use CodeGenState instead of constructor DI.
 *
 * Handles all string-related declaration patterns (ADR-045):
 * - Bounded strings: string<64> name
 * - String arrays: string<64>[4] items
 * - String concatenation: string<64> result <- str1 + str2
 * - Substring extraction: string<64> sub <- str[0, 5]
 * - Unsized const strings: const string name <- "literal"
 *
 * ## It renders a plan; it does not read a tree (#1445 box 3)
 *
 * Every question this file used to ask of a parse node -- which of the three
 * string forms is this, what capacity does it declare, is the initializer a
 * concatenation -- is answered by `VariableDeclHelper._planStringDecl` and
 * arrives as `TPlannedStringDecl`. What is left here is the part that is
 * genuinely rendering: the NUL-terminated `[capacity + 1]` convention, the
 * bounded copy sequences, and the capacity diagnostics.
 *
 * The plan is built at the call site rather than in `CodeGenerator`, where
 * every other planner on this branch sits, and that placement is MEASURED
 * rather than preferred. `VariableDeclHelper.generateVariableDecl` calls
 * `trackLocalVariable` -- which registers the declared variable's type info,
 * string capacity included -- BEFORE it reaches the string path, so the
 * variable's own name resolves inside its own initializer: `string<32> s <-
 * s + "x"` is detected as a concatenation and rejected with E0864 for
 * "capacity 33", which is 32 read back off `s`'s own declaration. Planning one
 * frame earlier, in `CodeGenerator.generateVariableDecl`, would ask the
 * registry before that registration and lose the diagnostic. (That the name
 * resolves at all is a separate defect, filed as #1643; this comment records
 * why the placement cannot be changed while it holds.)
 */

import IPlannedStringInit from "../types/IPlannedStringInit";
import VariableModifierBuilder from "./VariableModifierBuilder";
import IRenderedModifiers from "../types/IRenderedModifiers";
import IStringConcatOps from "../types/IStringConcatOps";
import ISubstringOps from "../types/ISubstringOps";
import TPlannedStringDecl from "../types/TPlannedStringDecl";
import StringOperationsHelper from "./StringOperationsHelper";
import StringUtils from "../../../../utils/StringUtils";
import invariant from "../../../../utils/invariant";
import type TranspileState from "../../../TranspileState";

/**
 * Generates string variable declarations in C.
 */
class StringDeclHelper {
  /**
   * Generate the declaration a string plan describes.
   *
   * @param name - the EMITTED identifier (ADR-057), not the source spelling
   * @param isConst - whether the declaration carries `const`, which only the
   *   unsized form consults: it is the difference between an inferred capacity
   *   and E0862
   */
  static generateStringDecl(
    plan: TPlannedStringDecl,
    name: string,
    modifiers: IRenderedModifiers,
    isConst: boolean,
    state: TranspileState,
  ): string {
    switch (plan.kind) {
      case "array":
        return StringDeclHelper._generateStringArray(
          plan,
          name,
          modifiers,
          state,
        );
      case "bounded":
        return StringDeclHelper._generateBoundedStringDecl(
          plan.capacity,
          plan.init,
          name,
          modifiers,
          state,
        );
      case "unsized":
        return StringDeclHelper._generateUnsizedStringDecl(
          plan.initText,
          name,
          modifiers,
          isConst,
          state,
        );
    }
  }

  /**
   * Issue #1029: Generate string array declaration.
   * Handles: string<32>[4] items -> char items[4][33] = {0};
   */
  private static _generateStringArray(
    plan: Extract<TPlannedStringDecl, { kind: "array" }>,
    name: string,
    modifiers: IRenderedModifiers,
    state: TranspileState,
  ): string {
    const {
      extern,
      const: constMod,
      atomic,
      volatile: volatileMod,
    } = modifiers;

    const decl = `${extern}${constMod}${atomic}${volatileMod}char ${name}${plan.dimensions}[${plan.elementCapacity + 1}]`;

    // Track as local array
    // ADR-057: `name` is the EMITTED identifier; every registry keys on the
    // source spelling, which is what references in the source say.
    state.localArrays.add(state.sourceLocalName(name));

    // No initializer - zero-initialize
    if (!plan.renderInit) {
      return `${decl} = {0};`;
    }

    // The array-initializer bookkeeping is written BY the render below and read
    // immediately after, so the reset, the render and the reads are one window.
    state.resetArrayInitTracking();
    const initValue = plan.renderInit();

    // Check if it was an array initializer
    if (!state.wasArrayInit()) {
      invariant(
        false,
        `a string array is initialized from literals -- E0866 rejects a variable initializer in pass 2.1`,
      );
    }

    // Validate element count if declared size is available
    if (plan.declaredSize !== null) {
      const isFillAll = state.lastArrayFillValue !== undefined;
      const elementCount = state.lastArrayInitCount;

      if (!isFillAll && elementCount !== plan.declaredSize) {
        invariant(
          false,
          `a string array initializer matches its declared size -- E0866 rejects [${plan.declaredSize}] against ${elementCount} element(s) in pass 2.1`,
        );
      }
    }

    // Handle fill-all expansion if needed
    const finalInitValue = StringDeclHelper._expandFillAll(
      initValue,
      plan.declaredSize,
      state,
    );

    // MISRA C:2012 Rules 9.3/9.4 - String literals don't fill all inner array bytes,
    // but C standard guarantees zero-initialization of remaining elements
    const suppression =
      "// cppcheck-suppress misra-c2012-9.3\n// cppcheck-suppress misra-c2012-9.4\n";
    return `${suppression}${decl} = ${finalInitValue};`;
  }

  /**
   * Expand fill-all syntax (`{= value}`) to one element per declared slot.
   */
  private static _expandFillAll(
    initValue: string,
    declaredSize: number | null,
    state: TranspileState,
  ): string {
    const fillVal = state.lastArrayFillValue;
    if (fillVal === undefined) {
      return initValue;
    }

    // Empty string fill doesn't need expansion (C handles {""} correctly)
    if (fillVal === '""') {
      return initValue;
    }

    if (declaredSize === null) {
      return initValue;
    }

    const elements = new Array<string>(declaredSize).fill(fillVal);
    return `{${elements.join(", ")}}`;
  }

  /**
   * Generate bounded string declaration (string<N>).
   */
  private static _generateBoundedStringDecl(
    capacity: number,
    init: IPlannedStringInit | null,
    name: string,
    modifiers: IRenderedModifiers,
    state: TranspileState,
  ): string {
    const {
      extern,
      const: constMod,
      atomic,
      volatile: volatileMod,
    } = modifiers;
    // #1164 / #1642: `atomic`/`volatile` belong on EVERY bounded arm. They were
    // dropped on the no-initializer arm first and on the with-initializer arms
    // second, each time producing a definition that conflicted with its own
    // header while the transpiler exited 0.
    const qualifiers = `${atomic}${volatileMod}`;

    // Simple bounded string without initializer
    if (!init) {
      return `${extern}${constMod}${qualifiers}char ${name}[${capacity + 1}] = "";`;
    }

    // ADR-045 asks the four initializer forms in a fixed order, and the order is
    // load-bearing: `renderSubstring` generates the index expressions when it
    // answers, so it is asked only after `concat` has declined.
    if (init.concat) {
      return StringDeclHelper._generateConcatDecl(
        name,
        capacity,
        init.concat,
        constMod,
        qualifiers,
        state,
      );
    }

    const substringOps = init.renderSubstring();
    if (substringOps) {
      return StringDeclHelper._generateSubstringDecl(
        name,
        capacity,
        substringOps,
        constMod,
        qualifiers,
        state,
      );
    }

    // Validate and check if it's a literal or variable
    const isLiteral = StringDeclHelper._validateStringInit(
      init.text,
      capacity,
      state,
    );

    if (isLiteral) {
      // String literal: can use direct initialization
      return `${extern}${constMod}${qualifiers}char ${name}[${capacity + 1}] = ${init.render()};`;
    }

    // String variable: cannot use C array initialization, so declare empty and
    // copy. Issue #1044: use the same bounded copy as the reassignment path
    // (strncpy + explicit null terminator via StringUtils.copyWithNull) rather
    // than an unbounded strcpy, which flawfinder flags as CWE-120.
    // Issue #1030: string-to-string initialization
    if (!state.inFunctionBody) {
      invariant(
        false,
        `a string at file scope is initialized by a literal -- E0863 rejects a copy from a variable in pass 2.1`,
      );
    }

    const srcExpr = init.render();
    // Issue #1037: continuation lines carry no indent of their own — the block
    // emitter (CodeGenerator.generateBlock) prefixes every line.
    const lines: string[] = [];
    lines.push(
      `${constMod}${qualifiers}char ${name}[${capacity + 1}] = "";`,
      StringUtils.copyWithNull(name, srcExpr, capacity),
    );
    return lines.join("\n");
  }

  /**
   * Validate string initialization (literal length and variable capacity)
   * Returns true if the expression is a string literal, false if it's a variable.
   */
  private static _validateStringInit(
    exprText: string,
    capacity: number,
    state: TranspileState,
  ): boolean {
    // Validate string literal fits capacity
    if (exprText.startsWith('"') && exprText.endsWith('"')) {
      const content = StringUtils.literalLength(exprText);
      if (content > capacity) {
        invariant(
          false,
          `a string literal fits its declared capacity -- E0864 rejects ${content} chars in string<${capacity}> in pass 2.1`,
        );
      }
      return true; // Is a literal
    }

    // Check for string variable assignment
    const srcCapacity = StringOperationsHelper.getStringExprCapacity(
      exprText,
      state,
    );
    if (srcCapacity !== null && srcCapacity > capacity) {
      invariant(
        false,
        `a string source fits its destination -- E0864 rejects string<${srcCapacity}> into string<${capacity}> in pass 2.1`,
      );
    }
    return false; // Is a variable (not a literal)
  }

  /**
   * Generate string concatenation declaration.
   */
  private static _generateConcatDecl(
    name: string,
    capacity: number,
    concatOps: IStringConcatOps,
    constMod: string,
    qualifiers: string,
    state: TranspileState,
  ): string {
    // String concatenation requires runtime function calls (strncpy, strncat)
    // which cannot exist at global scope in C
    if (!state.inFunctionBody) {
      invariant(
        false,
        `a string at file scope is initialized by a literal -- E0863 rejects a concatenation in pass 2.1`,
      );
    }

    // Validate capacity: dest >= left + right
    const requiredCapacity = concatOps.leftCapacity + concatOps.rightCapacity;
    if (requiredCapacity > capacity) {
      invariant(
        false,
        `a concatenation fits its destination -- E0864 rejects ${requiredCapacity} into string<${capacity}> in pass 2.1`,
      );
    }

    // Generate safe concatenation code. Issue #1037: continuation lines carry
    // no indent of their own — the block emitter prefixes every line.
    // The copy sequence itself is owned by StringUtils.concat -- including the
    // MISRA 17.7 `(void)` casts (ADR-070 Case 1). Rebuilding it here would be a
    // second path that has to be kept in step by hand.
    const lines: string[] = [];
    lines.push(
      `${constMod}${qualifiers}char ${name}[${capacity + 1}] = "";`,
      ...StringUtils.concat(name, concatOps.left, concatOps.right, capacity),
    );
    return lines.join("\n");
  }

  /**
   * Generate substring extraction declaration.
   */
  private static _generateSubstringDecl(
    name: string,
    capacity: number,
    substringOps: ISubstringOps,
    constMod: string,
    qualifiers: string,
    state: TranspileState,
  ): string {
    // Substring extraction requires runtime function calls (strncpy)
    // which cannot exist at global scope in C
    if (!state.inFunctionBody) {
      invariant(
        false,
        `a string at file scope is initialized by a literal -- E0863 rejects a substring in pass 2.1`,
      );
    }

    // For compile-time validation, we need numeric literals
    const startNum = Number.parseInt(substringOps.start, 10);
    const lengthNum = Number.parseInt(substringOps.lengthExpression, 10);

    // Only validate bounds if both start and length are compile-time constants
    if (!Number.isNaN(startNum) && !Number.isNaN(lengthNum)) {
      // Bounds check: start + length <= sourceCapacity
      if (startNum + lengthNum > substringOps.sourceCapacity) {
        invariant(
          false,
          `substring bounds stay within the source -- E0865 rejects [${startNum}, ${lengthNum}] against string<${substringOps.sourceCapacity}> in pass 2.1`,
        );
      }
    }

    // Validate destination capacity can hold the substring
    if (!Number.isNaN(lengthNum) && lengthNum > capacity) {
      invariant(
        false,
        `a substring fits its destination -- E0864 rejects ${lengthNum} into string<${capacity}> in pass 2.1`,
      );
    }

    // Generate safe substring extraction code. Issue #1037: continuation lines
    // carry no indent of their own — the block emitter prefixes every line.
    // Extraction sequence owned by StringUtils.substring (see _generateConcatDecl).
    const lines: string[] = [];
    lines.push(
      `${constMod}${qualifiers}char ${name}[${capacity + 1}] = "";`,
      ...StringUtils.substring(
        name,
        substringOps.source,
        substringOps.start,
        substringOps.lengthExpression,
      ),
    );
    return lines.join("\n");
  }

  /**
   * Generate unsized const string declaration.
   */
  private static _generateUnsizedStringDecl(
    initText: string | null,
    name: string,
    modifiers: IRenderedModifiers,
    isConst: boolean,
    state: TranspileState,
  ): string {
    if (!isConst) {
      invariant(
        false,
        "a non-const string states its capacity -- E0862 rejects an unsized one in pass 2.1",
      );
    }

    if (initText === null) {
      invariant(
        false,
        "an unsized const string has an initializer to infer from -- E0862 rejects one without in pass 2.1",
      );
    }

    if (!initText.startsWith('"') || !initText.endsWith('"')) {
      invariant(
        false,
        "an unsized const string infers from a LITERAL -- E0862 rejects any other initializer in pass 2.1",
      );
    }

    // Infer capacity from literal length
    const inferredCapacity = StringUtils.literalLength(initText);

    // Register in type registry with inferred capacity
    state.setVariableTypeInfo(state.sourceLocalName(name), {
      baseType: "char",
      bitWidth: 8,
      isArray: true,
      arrayDimensions: [inferredCapacity + 1],
      isConst: true,
      isString: true,
      stringCapacity: inferredCapacity,
    });

    // #1642's open box. This arm hand-assembled `${extern}const `, dropping
    // `atomic`/`volatile` and hardcoding the `const` rather than reading the
    // one the caller resolved -- so the `.h`, which derives the qualifier from
    // the SYMBOL, emitted `extern volatile const char x[2];` against this
    // file's `const char x[2] = "v";` and the translation unit did not
    // compile. It was unreachable until the E0862 predicate beside it started
    // asking the grammar instead of the declaration's text, which is why the
    // bounded arms were fixed in #1642 and this one was not.
    //
    // `toPrefix` is the single encoder the bounded arms above spell out by
    // hand; using it here is what makes a fifth arm impossible to forget.
    //
    // The hardcoded `const` was also STATING an invariant -- an unsized string
    // is const, which E0862 enforces in 2.1 -- so dropping it silently would
    // have traded one masked bug for another. Asserted instead, which is the
    // same fact without the mask: if the invariant ever breaks, this says so
    // rather than quietly emitting a non-const definition against a `const`
    // declaration in the header.
    invariant(
      modifiers.const !== "",
      "an unsized string is const -- E0862 rejects a non-const one in pass 2.1, before this runs",
    );

    const prefix = VariableModifierBuilder.toPrefix(modifiers);
    return `${prefix}char ${name}[${inferredCapacity + 1}] = ${initText};`;
  }
}

export default StringDeclHelper;
