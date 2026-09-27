/**
 * ADR-049: the one judge of a target description.
 *
 * A description is a set of field values, and it arrives two ways: as a row of
 * the target catalog, and (ADR-049, "Inline description") as a program's
 * description pragmas. Both are checked here, against the one schema in
 * `TARGET_DESCRIPTION_FIELDS`, so a catalog row and a pragma cannot be held to
 * different rules.
 *
 * A defect in the shipped catalog is an installation defect, not a user
 * diagnostic, so `catalog()` throws once, listing every problem, rather than
 * reporting a code.
 */
import TARGET_DESCRIPTION_FIELDS from "../../transpiler/constants/TARGET_DESCRIPTION_FIELDS";
import invariant from "../../utils/invariant";
import type ITargetCatalogEntry from "../../transpiler/types/ITargetCatalogEntry";
import type ITargetCatalogSource from "../../transpiler/types/ITargetCatalogSource";
import type ITargetDescription from "../../transpiler/types/ITargetDescription";
import type ITargetFieldSpec from "../../transpiler/types/ITargetFieldSpec";
import type TTargetFieldValue from "../../transpiler/types/TTargetFieldValue";

/** The catalog schema versions this compiler reads */
const SCHEMA_VERSION = 1;

const DESCRIPTION_STRUCT = "TargetDescription";
const ALIAS_STRUCT = "TargetAlias";
const VERSION_CONST = "TARGET_SCHEMA_VERSION";

/** A name is one pragma word, so `#pragma target <name>` can spell it */
const PRAGMA_WORD = /^[a-zA-Z0-9_][a-zA-Z0-9_.+-]*$/;

/** The C relations a description must satisfy, smallest first */
const ORDERED_WIDTHS: readonly (readonly (keyof ITargetDescription)[])[] = [
  ["short_bits", "int_bits", "long_bits", "long_long_bits"],
  ["float_bits", "double_bits", "long_double_bits"],
];

const ALIAS_MEMBERS: ReadonlyMap<string, string> = new Map([
  ["name", "string"],
  ["target", "string"],
]);

/** What `catalog()` has read so far */
interface ICollected {
  readonly names: Set<string>;
  readonly descriptions: Map<string, ITargetDescription>;
  readonly aliases: { name: string; target: string; line: number }[];
}

class TargetDescriptions {
  /**
   * Check one description's fields. Returns the description, or every problem
   * with it -- never both.
   */
  static check(
    fields: ReadonlyMap<string, TTargetFieldValue>,
  ): { description: ITargetDescription } | { errors: string[] } {
    const errors: string[] = [];
    for (const field of fields.keys()) {
      if (!Object.hasOwn(TARGET_DESCRIPTION_FIELDS, field)) {
        errors.push(`unknown field '${field}'`);
      }
    }

    const missing: string[] = [];
    for (const [field, spec] of Object.entries(TARGET_DESCRIPTION_FIELDS)) {
      const value = fields.get(field);
      if (value === undefined) {
        if (!spec.optional) {
          missing.push(field);
        }
        continue;
      }
      const problem = TargetDescriptions.valueProblem(field, spec, value);
      if (problem) {
        errors.push(problem);
      }
    }
    if (missing.length > 0) {
      errors.push(`missing: ${missing.join(", ")}`);
    }
    if (errors.length > 0) {
      return { errors };
    }

    const description: Record<string, unknown> = Object.fromEntries(fields);
    // Checked against the schema, not cast (#1668 review): the fields above
    // were validated one by one, and this says so in a form the compiler
    // can hold the result to
    invariant(
      TargetDescriptions.isDescription(description),
      "every field of a validated description has its schema's type",
    );
    for (const chain of ORDERED_WIDTHS) {
      for (let i = 1; i < chain.length; i++) {
        const narrower = chain[i - 1];
        const wider = chain[i];
        if (Number(description[narrower]) > Number(description[wider])) {
          errors.push(`${narrower} is wider than ${wider}`);
        }
      }
    }
    return errors.length > 0 ? { errors } : { description };
  }

  /** Whether every schema field is present, or optional, with its kind's type */
  private static isDescription(
    value: Record<string, unknown>,
  ): value is Record<string, unknown> & ITargetDescription {
    return Object.entries(TARGET_DESCRIPTION_FIELDS).every(([field, spec]) => {
      const present = value[field];
      if (present === undefined) return spec.optional;
      const jsType = spec.kind === "unsigned" ? "number" : spec.kind;
      return typeof present === jsType;
    });
  }

  /**
   * Whether two descriptions describe the same platform: every required fact
   * equal, whatever the names. So an alias agrees with its target, and an
   * inline description agrees with the catalog row it spells out. The
   * toolchain fields are not compared -- they never change a program's
   * meaning.
   */
  static equal(a: ITargetDescription, b: ITargetDescription): boolean {
    return Object.entries(TARGET_DESCRIPTION_FIELDS).every(
      ([field, spec]) =>
        spec.optional ||
        field === "name" ||
        a[field as keyof ITargetDescription] ===
          b[field as keyof ITargetDescription],
    );
  }

  /**
   * Every name the catalog defines, aliases included, mapped to the
   * description it denotes. Throws on any defect, listing all of them.
   */
  static catalog(
    source: ITargetCatalogSource,
    path: string,
  ): ReadonlyMap<string, ITargetDescription> {
    const errors = [...source.errors];
    TargetDescriptions.checkSchema(source, errors);

    const collected: ICollected = {
      names: new Set(),
      descriptions: new Map(),
      aliases: [],
    };
    for (const entry of source.entries) {
      TargetDescriptions.collect(entry, collected, errors);
    }

    // Resolved against descriptions only, so an alias of an alias is refused
    // rather than silently followed.
    const targets = new Map(collected.descriptions);
    for (const alias of collected.aliases) {
      const description = collected.descriptions.get(alias.target);
      if (description) {
        targets.set(alias.name, description);
      } else {
        errors.push(
          `line ${alias.line}: alias '${alias.name}' names '${alias.target}', which is not a ${DESCRIPTION_STRUCT}`,
        );
      }
    }

    if (errors.length > 0) {
      throw new Error(
        `The target catalog ${path} is invalid; the compiler installation is broken:\n  ${errors.join("\n  ")}`,
      );
    }
    return targets;
  }

  private static collect(
    entry: ITargetCatalogEntry,
    collected: ICollected,
    errors: string[],
  ): void {
    if (entry.typeName === DESCRIPTION_STRUCT) {
      const result = TargetDescriptions.check(entry.fields);
      if ("errors" in result) {
        for (const error of result.errors) {
          errors.push(`line ${entry.line}: ${entry.constName}: ${error}`);
        }
      } else if (
        TargetDescriptions.claim(
          result.description.name,
          entry.line,
          collected,
          errors,
        )
      ) {
        collected.descriptions.set(result.description.name, result.description);
      }
      return;
    }
    if (entry.typeName === ALIAS_STRUCT) {
      const name = entry.fields.get("name");
      const target = entry.fields.get("target");
      if (
        typeof name !== "string" ||
        typeof target !== "string" ||
        entry.fields.size !== 2
      ) {
        errors.push(
          `line ${entry.line}: ${entry.constName}: an alias gives exactly a name and a target`,
        );
      } else if (
        TargetDescriptions.claim(name, entry.line, collected, errors)
      ) {
        collected.aliases.push({ name, target, line: entry.line });
      }
      return;
    }
    if (entry.constName !== VERSION_CONST) {
      errors.push(
        `line ${entry.line}: '${entry.constName}' is neither a ${DESCRIPTION_STRUCT} nor a ${ALIAS_STRUCT}`,
      );
    }
  }

  /** Whether `name` may be defined: one pragma word, not defined before */
  private static claim(
    name: string,
    line: number,
    collected: ICollected,
    errors: string[],
  ): boolean {
    if (!PRAGMA_WORD.test(name)) {
      errors.push(`line ${line}: '${name}' is not one pragma word`);
      return false;
    }
    if (collected.names.has(name)) {
      errors.push(`line ${line}: '${name}' is defined twice`);
      return false;
    }
    collected.names.add(name);
    return true;
  }

  /**
   * What is wrong with one field's value, or null. The same judgement a
   * catalog row gets, for a description pragma.
   */
  static fieldProblem(field: string, value: TTargetFieldValue): string | null {
    const spec: ITargetFieldSpec | undefined =
      TARGET_DESCRIPTION_FIELDS[field as keyof ITargetDescription];
    return spec
      ? TargetDescriptions.valueProblem(field, spec, value)
      : `unknown field '${field}'`;
  }

  private static valueProblem(
    field: string,
    spec: ITargetFieldSpec,
    value: TTargetFieldValue,
  ): string | null {
    const kind = TargetDescriptions.kindOf(value);
    if (kind !== spec.kind) {
      return `${field} must be ${spec.kind === "unsigned" ? "an unsigned integer" : `a ${spec.kind}`}`;
    }
    if (typeof value !== "number") {
      return null;
    }
    if (spec.allowed && !spec.allowed.includes(value)) {
      return `${field} must be one of ${spec.allowed.join(", ")}`;
    }
    if (spec.min !== undefined && value < spec.min) {
      return `${field} must be at least ${spec.min}`;
    }
    return null;
  }

  private static kindOf(value: TTargetFieldValue): ITargetFieldSpec["kind"] {
    if (typeof value === "number") {
      return "unsigned";
    }
    return typeof value === "boolean" ? "boolean" : "string";
  }

  /** The version constant and both structs, member for member */
  private static checkSchema(
    source: ITargetCatalogSource,
    errors: string[],
  ): void {
    const version = source.entries.find((e) => e.constName === VERSION_CONST);
    if (version?.value !== SCHEMA_VERSION) {
      errors.push(
        `${VERSION_CONST} must be ${SCHEMA_VERSION}, the schema version this compiler reads`,
      );
    }

    const expected = new Map(
      Object.entries(TARGET_DESCRIPTION_FIELDS).map(([field, spec]) => [
        field,
        spec.kind,
      ]),
    );
    TargetDescriptions.checkStruct(
      source,
      DESCRIPTION_STRUCT,
      expected,
      errors,
    );
    TargetDescriptions.checkStruct(source, ALIAS_STRUCT, ALIAS_MEMBERS, errors);
  }

  private static checkStruct(
    source: ITargetCatalogSource,
    struct: string,
    expected: ReadonlyMap<string, string>,
    errors: string[],
  ): void {
    const members = source.structs.get(struct);
    if (!members) {
      errors.push(`struct ${struct} is missing`);
      return;
    }
    for (const [member, type] of members) {
      const kind = expected.get(member);
      if (kind === undefined) {
        errors.push(
          `struct ${struct} has '${member}', which the schema does not`,
        );
      } else if (TargetDescriptions.memberKind(type) !== kind) {
        errors.push(
          `struct ${struct}: '${member}' must hold a ${kind}, not ${type}`,
        );
      }
    }
    for (const member of expected.keys()) {
      if (!members.has(member)) {
        errors.push(`struct ${struct} lacks '${member}'`);
      }
    }
  }

  /** The schema kind a C-Next member type holds, or the type itself */
  private static memberKind(type: string): string {
    if (type === "bool") {
      return "boolean";
    }
    if (/^u(?:8|16|32|64)$/.test(type)) {
      return "unsigned";
    }
    return /^string<\d+>$/.test(type) ? "string" : type;
  }
}

export default TargetDescriptions;
