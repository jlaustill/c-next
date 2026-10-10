/**
 * The spelling of a struct's ADR-029 default (see `StructDefault`) as a brace
 * initializer -- used at every declaration with no initializer and as the body
 * of the generated `<Struct>_init()`, so the two cannot disagree (#1283).
 *
 * The brace is a constant expression in both languages, which is what a
 * file-scope or `static` declaration needs: C forbids a function call there,
 * so `Ticker t = Ticker_init();` is not an option at file scope.
 *
 * - C names only the fields whose default is not zero, by designator
 *   (`{ .handler = onTick }`); C99 6.7.8p21 zero-fills the rest. Naming a
 *   zero field would bring back #1568's `.data = 0` / `.ticks = {0}` shapes.
 * - C++14 has no designated initializers, so every field is spelled in
 *   declaration order and a zero field is `{}` (value-initialization, valid
 *   for any member type). Leaving a trailing field out instead is
 *   `-Wmissing-field-initializers` (#1557).
 *
 * MISRA C:2012 Rule 9.3 (no partially initialized array): an array whose
 * elements have a default lists every element.
 */
import invariant from "../../../../utils/invariant";
import StructDefault from "../../../../utils/StructDefault";
import type IStructFieldDefault from "../../../../types/IStructFieldDefault";
import type IStructDefaultRenderContext from "../types/IStructDefaultRenderContext";

class StructDefaultInitializer {
  /**
   * The brace for a value of `structName` -- repeated over `counts`, the
   * element count of each dimension, when the declaration is an array -- or null when its default is all zero and
   * the caller's aggregate zero is already correct.
   */
  static render(
    structName: string,
    counts: readonly (number | null)[],
    ctx: IStructDefaultRenderContext,
  ): string | null {
    if (!StructDefault.hasDefault(structName, ctx)) {
      return null;
    }
    return StructDefaultInitializer.repeat(
      StructDefaultInitializer.renderStruct(structName, ctx),
      counts,
      structName,
    );
  }

  private static renderStruct(
    structName: string,
    ctx: IStructDefaultRenderContext,
  ): string {
    const defaults = new Map<string, IStructFieldDefault>(
      StructDefault.fieldsOf(structName, ctx).map((field) => [
        field.fieldName,
        field,
      ]),
    );
    const parts: string[] = [];
    for (const [fieldName, typeName] of ctx.structFields.get(structName)!) {
      const value = StructDefaultInitializer.fieldValue(
        defaults.get(fieldName),
        typeName,
        ctx.fieldElementCounts(structName, fieldName),
        ctx,
      );
      if (ctx.cppMode) {
        parts.push(value ?? "{}");
      } else if (value !== null) {
        parts.push(`.${fieldName} = ${value}`);
      }
    }
    return `{ ${parts.join(", ")} }`;
  }

  /** A field's non-zero value, or null when zero is its default. */
  private static fieldValue(
    fieldDefault: IStructFieldDefault | undefined,
    typeName: string,
    counts: readonly (number | null)[],
    ctx: IStructDefaultRenderContext,
  ): string | null {
    if (fieldDefault !== undefined) {
      const element =
        fieldDefault.value.kind === "callback"
          ? fieldDefault.value.functionName
          : StructDefaultInitializer.renderStruct(
              fieldDefault.value.structName,
              ctx,
            );
      return StructDefaultInitializer.repeat(element, counts, typeName);
    }
    // #1566: an enum's zero is its zero enumerator, which need not be 0.
    const enumZero = ctx.enumZeroOf(typeName);
    return enumZero === null
      ? null
      : StructDefaultInitializer.repeat(enumZero, counts, typeName);
  }

  private static repeat(
    element: string,
    counts: readonly (number | null)[],
    typeName: string,
  ): string {
    if (counts.length === 0) {
      return element;
    }
    const [size, ...rest] = counts;
    invariant(
      size !== null,
      `2.1 rejects an array of '${typeName}' whose element count C-Next cannot read (E0359)`,
    );
    const inner = StructDefaultInitializer.repeat(element, rest, typeName);
    return `{ ${new Array<string>(size).fill(inner).join(", ")} }`;
  }
}

export default StructDefaultInitializer;
