/**
 * Issue #1588: the grammar and ASSIGNMENT_OPERATOR_MAP are two halves of one
 * fact, and nothing tied them together.
 *
 * Adding an assignment operator is a two-file edit: `grammar/CNext.g4` and
 * `src/utils/constants/OperatorMappings.ts`. Miss the second and codegen used to
 * emit a plain `=` for it -- `i +<- 1` becoming `i = 1`, an infinite loop in a
 * `for` update, at transpile exit 0.
 *
 * The mapper now throws on a lookup miss, which catches the divergence when
 * someone transpiles a program using the new operator. This catches it at the
 * source, the moment the two files disagree, without needing such a program to
 * exist. Same shape as `marker-spellings.test.ts` over the marker vocabulary.
 *
 * The grammar side is DERIVED by reading the rule, never listed here. A
 * hand-kept copy would be a third place encoding the same fact, which is the
 * thing this test exists to forbid.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import ASSIGNMENT_OPERATOR_MAP from "../../src/utils/constants/OperatorMappings.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** The quoted alternatives of the grammar's `assignmentOperator` rule. */
function grammarOperators(): string[] {
  const grammar = readFileSync(join(repoRoot, "grammar", "CNext.g4"), "utf8");
  const rule = /^assignmentOperator\s*$\r?\n(.*?)^\s*;\s*$/ms.exec(grammar);
  if (rule === null) {
    throw new Error("grammar/CNext.g4 has no assignmentOperator rule");
  }
  return Array.from(rule[1].matchAll(/'([^']+)'/g))
    .map((match) => match[1])
    .sort();
}

function mapOperators(): string[] {
  return Object.keys(ASSIGNMENT_OPERATOR_MAP).sort();
}

/**
 * The comparison itself, so the assertion and its control cannot drift apart.
 *
 * Both cases below go through this. The first version of the control did not:
 * it compared the grammar list against itself-minus-one and never called
 * `mapOperators()`, so it asserted a property of `filter` and could not go red
 * for any state of the map -- a control that reads as a second guard and is not
 * one, which is the shape this whole file exists to forbid.
 */
function parity(mapKeys: readonly string[]): {
  actual: string[];
  expected: string[];
} {
  return { actual: [...mapKeys].sort(), expected: grammarOperators() };
}

describe("assignment operator parity (#1588)", () => {
  // Guards the selector, so the assertion below cannot pass over an empty list
  // -- a regex that silently matched nothing would otherwise read as agreement.
  it("reads the alternatives out of the grammar at all", () => {
    expect(grammarOperators().length).toBeGreaterThanOrEqual(10);
  });

  it("maps exactly the operators the grammar admits", () => {
    const { actual, expected } = parity(mapOperators());
    expect(actual).toEqual(expected);
  });

  // The negative control. Agreement must not be reachable by the comparison
  // being vacuous, so this drives the SAME comparison with a real map that has
  // had one operator removed -- exercising both operands, not just one.
  it("fails when the map is missing an operator the grammar admits", () => {
    const dropped = grammarOperators()[0];
    const { actual, expected } = parity(
      mapOperators().filter((op) => op !== dropped),
    );
    expect(actual).not.toEqual(expected);
  });
});
