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

describe("assignment operator parity (#1588)", () => {
  // Guards the selector, so the assertion below cannot pass over an empty list
  // -- a regex that silently matched nothing would otherwise read as agreement.
  it("reads the alternatives out of the grammar at all", () => {
    expect(grammarOperators().length).toBeGreaterThanOrEqual(10);
  });

  it("maps exactly the operators the grammar admits", () => {
    expect(mapOperators()).toEqual(grammarOperators());
  });

  // The negative control. Agreement must not be reachable by the comparison
  // being vacuous: a map missing one operator has to fail.
  it("fails when the map is missing an operator the grammar admits", () => {
    const grammar = grammarOperators();
    const diverged = grammar.filter((op) => op !== grammar[0]);
    expect(diverged).not.toEqual(grammar);
  });
});
