/**
 * MISRA findings cppcheck's addon cannot see, read from the same run's dump.
 *
 * #1610: the addon's Rule 11.9 check looks only at an integer next to `=`,
 * `==`, `!=` or `?:`, so it reports `Dev* d = 0;` and never `Dev* d = {0};`.
 * Generated C wrote the second at every uninitialized scalar pointer until
 * #1610, and `validate:c` stayed green. The dump carries cppcheck's own parsed
 * variables and tokens, so the check reads types rather than matching text.
 *
 * Findings are spelled as cppcheck output lines so `MisraBaseline` parses and
 * gates them like the addon's own: generated-only, and baselined per rule.
 */

import IMisraViolation from "./types/IMisraViolation";

/** One `<token>` or `<var>` element's attributes. */
type TAttributes = ReadonlyMap<string, string>;

const ELEMENT = /^\s*<(token|var) (.*?)\/?>\s*$/;
const ATTRIBUTE = /([\w-]+)="([^"]*)"/g;
const INTEGER_ZERO = /^0[uUlL]*$/;

class MisraDump {
  /** Rules this module checks, for the guard registry (#1610) */
  static readonly RULES: readonly string[] = ["misra-c2012-11.9"];

  /**
   * Rule 11.9: a non-array pointer whose initializer is a brace-enclosed
   * integer zero. cppcheck splits `Dev* d = {0};` into the declaration and
   * `d = { 0 } ;`, so the shape is the pointer's name token followed by those
   * four. An array of pointers is an aggregate, which 11.9 allows `{0}` for.
   */
  static findings(dump: string): IMisraViolation[] {
    const tokens: TAttributes[] = [];
    const scalarPointers = new Set<string>();
    for (const line of dump.split("\n")) {
      const match = ELEMENT.exec(line);
      if (match === null) continue;
      const attributes = MisraDump.attributes(match[2]!);
      if (match[1] === "token") {
        tokens.push(attributes);
      } else if (
        attributes.get("isPointer") === "true" &&
        attributes.get("isArray") === "false"
      ) {
        scalarPointers.add(attributes.get("id")!);
      }
    }

    const violations: IMisraViolation[] = [];
    tokens.forEach((token, index) => {
      if (!scalarPointers.has(token.get("variable") ?? "")) return;
      const next = tokens.slice(index + 1, index + 5);
      const zero = next[2];
      if (
        next[0]?.get("str") === "=" &&
        next[1]?.get("str") === "{" &&
        zero?.get("isInt") === "true" &&
        INTEGER_ZERO.test(zero.get("str") ?? "") &&
        next[3]?.get("str") === "}"
      ) {
        const file = token.get("file") ?? "";
        violations.push({
          file,
          ruleId: "misra-c2012-11.9",
          raw:
            `${file}:${token.get("linenr")}:${token.get("column")}: style: ` +
            `pointer '${token.get("str")}' is initialized with {0}; only NULL ` +
            `is a null pointer constant [misra-c2012-11.9]`,
        });
      }
    });
    return violations;
  }

  private static attributes(text: string): TAttributes {
    return new Map(
      [...text.matchAll(ATTRIBUTE)].map((match) => [match[1]!, match[2]!]),
    );
  }
}

export default MisraDump;
