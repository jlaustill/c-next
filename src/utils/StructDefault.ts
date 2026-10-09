/**
 * ADR-029 section 3 "Never Null": which fields of a struct hold something
 * other than zero when a value of it is declared without an initializer.
 *
 * A callback field holds the function its type was defined from, and a field
 * whose type is itself such a struct holds that struct's default. Every other
 * field is zero (ADR-015), which is what the aggregate brace already gives.
 *
 * #1283 / #1570 / #1565: this is one decision with three readers -- the
 * declaration-site initializer, the generated `<Struct>_init()` and the E0381
 * analyzer -- so it is asked here rather than worked out at each. It reads the
 * whole-program struct table (`structFields`, populated by 1.3 Declare for
 * every struct this file can see: top-level, scope-nested and included), not
 * the set of init functions generated so far, so the answer cannot depend on
 * the order the structs are declared in (#1570).
 */
import type IStructDefaultFacts from "../types/IStructDefaultFacts";
import type IStructFieldDefault from "../types/IStructFieldDefault";

class StructDefault {
  /**
   * The fields of `structName` whose default is not zero, in declaration
   * order. Empty when the whole struct defaults to zero, including when
   * `structName` is not a struct at all.
   */
  static fieldsOf(
    structName: string,
    facts: IStructDefaultFacts,
  ): readonly IStructFieldDefault[] {
    const fields = facts.structFields.get(structName);
    if (!fields) {
      return [];
    }
    const dimensions = facts.structFieldDimensions.get(structName);
    const result: IStructFieldDefault[] = [];
    for (const [fieldName, typeName] of fields) {
      const value = StructDefault.valueOf(typeName, facts);
      if (value !== null) {
        result.push({
          fieldName,
          value,
          dimensions: dimensions?.get(fieldName) ?? [],
        });
      }
    }
    return result;
  }

  /** Does a value of `structName` hold anything other than zero by default? */
  static hasDefault(structName: string, facts: IStructDefaultFacts): boolean {
    return StructDefault.fieldsOf(structName, facts).length > 0;
  }

  private static valueOf(
    typeName: string,
    facts: IStructDefaultFacts,
  ): IStructFieldDefault["value"] | null {
    if (facts.isCallbackType(typeName)) {
      return { kind: "callback", functionName: typeName };
    }
    // C has no by-value self-containing struct, so this recursion is bounded
    // by the nesting depth the program actually declares.
    if (StructDefault.hasDefault(typeName, facts)) {
      return { kind: "struct", structName: typeName };
    }
    return null;
  }
}

export default StructDefault;
