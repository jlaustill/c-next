/**
 * DeclaredTypeFacts -- what a declared type NAME tells you about a variable.
 *
 * ## Why this exists (#1651)
 *
 * Four sites independently answered "is this name an enum or a bitmap, and how
 * wide is it": the declaration path, the bitmap-array path, the parameter path
 * and the cross-file symbol converter. All four read the same two sets, so the
 * DETECTION was already shared -- and CLAUDE.md is explicit that this is not
 * enough, because each then derived the CONSEQUENCES for itself.
 *
 * They diverged twice before anyone looked, in the same direction both times:
 * the cross-file converter is the one that forgets a field.
 *
 * - #1303 -- it dropped `overflowBehavior`, so an imported `u8` wrapped where
 *   the declared ADR-044 behavior said saturate.
 * - #1651 -- it dropped `isBitmap`/`bitmapTypeName`, so `shared.Active <- 1`
 *   one include hop from the declaration classified as a struct member write
 *   and emitted `shared.Active = 1`: a member access on a scalar, which gcc
 *   rejects outright. The same statement same-file lowered to mask-and-shift.
 *
 * It had also diverged a third time without being noticed, on the width: the
 * converter computed `TYPE_WIDTH[name]`, which has no entry for a bitmap type,
 * so every cross-file bitmap registered `bitWidth: 0` against the real 8/16/
 * 32/64 the other three record. Reads survive that because
 * `getNumericBitWidth` re-derives the width from the name when the registered
 * one is 0 -- a compensation in a fourth module for a fact the registry was
 * supposed to carry. Byte-count consumers have no such fallback.
 *
 * So the quintuple is derived ONCE, here, and the callers keep only what
 * genuinely differs between them: the width of a name that is neither an enum
 * nor a bitmap, which is a string capacity in one caller and a primitive width
 * in the others.
 */
import type IDeclaredTypeFacts from "../transpiler/types/IDeclaredTypeFacts";
import type IDeclaredTypeSets from "../transpiler/types/IDeclaredTypeSets";
import type IStructFieldLookup from "../transpiler/types/IStructFieldLookup";

class DeclaredTypeFacts {
  /**
   * Classify a base type name against the declared enum and bitmap sets.
   *
   * `fallbackBitWidth` is used only when the name is neither -- callers answer
   * that differently and correctly: a string variable is 8 (its element), a
   * parameter is its primitive width, an enum registers 0 and is widened to
   * ADR-017's 32 bits at the point of use rather than here.
   */
  static of(
    baseType: string,
    sets: IDeclaredTypeSets | null,
    fallbackBitWidth: number,
  ): IDeclaredTypeFacts {
    const isEnum = DeclaredTypeFacts.isEnum(sets, baseType);
    const isBitmap = DeclaredTypeFacts.isBitmap(sets, baseType);

    return {
      isEnum,
      enumTypeName: isEnum ? baseType : undefined,
      isBitmap,
      bitmapTypeName: isBitmap ? baseType : undefined,
      bitWidth: isBitmap
        ? (sets?.bitmapBitWidth.get(baseType) ?? 0)
        : fallbackBitWidth,
    };
  }

  /**
   * Is this name a declared enum / bitmap / scope?
   *
   * #1456: one-line set lookups, but they had exactly one home --
   * `CodeGenState.isKnownEnum` and friends -- so 2.1 Analyze had to read
   * render state to ask. Both callers share these now: `CodeGenState`
   * delegates, and an analyzer passes the view its `IAnalysisContext` carries.
   *
   * The `?? false` is the existing reading of an absent symbol view: "nothing
   * is known yet", never "not an enum".
   */
  static isEnum(sets: IDeclaredTypeSets | null, name: string): boolean {
    return sets?.knownEnums.has(name) ?? false;
  }

  /** @see isEnum */
  static isBitmap(sets: IDeclaredTypeSets | null, name: string): boolean {
    return sets?.knownBitmaps.has(name) ?? false;
  }

  /** @see isEnum */
  static isScope(sets: IDeclaredTypeSets | null, name: string): boolean {
    return sets?.knownScopes.has(name) ?? false;
  }

  /**
   * Is this type name a struct? Bitmaps count -- they are struct-like and take
   * the same pass-by-reference `->` treatment (#551).
   *
   * ## Why this is here and not at three call sites (#1656)
   *
   * It was at three, spelled the same way each time and reached by 19 callers:
   * `CodeGenState.isKnownStruct`, `SymbolLookupHelper.isKnownStruct` (through
   * `IOrchestrator`), and `ExpressionTypeResolver.isStructType` in 2-Plan,
   * which alone has ten sites through `IOrchestrator.isStructType`. All three
   * ran the identical three checks in the identical order; the 2-Plan copy
   * differed from the `state/` copy only in `CodeGenState.` versus `this.`.
   *
   * They had not diverged in RESULT, which is why nothing caught them -- they
   * had diverged in FAILURE MODE. See `IStructFieldLookup` for that, and for
   * why the lookup is required rather than optional here.
   *
   * The per-file sets answer first because they are the file's own view; the
   * run-wide table answers for a struct declared in an included header, which
   * the per-file sets do not carry. Both are needed, which is why this takes
   * two arguments rather than pretending one source suffices (#1312).
   *
   * `!== undefined` is deliberate. `getStructFields` returns a `Map`, and an
   * empty `Map` is truthy, so all three call sites read a zero-field struct as
   * known by accident rather than by decision. No such struct is reachable
   * today -- `SymbolTable.addStructField` always sets a field on creation --
   * so this states the existing behavior rather than changing it.
   */
  static isStruct(
    sets: IDeclaredTypeSets | null,
    fields: IStructFieldLookup,
    typeName: string,
  ): boolean {
    if (sets?.knownStructs.has(typeName)) return true;
    if (sets?.knownBitmaps.has(typeName)) return true;
    return fields.getStructFields(typeName) !== undefined;
  }
}

export default DeclaredTypeFacts;
