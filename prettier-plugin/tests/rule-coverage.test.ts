/**
 * Exhaustiveness gate for the cnx Prettier plugin (#1364).
 *
 * The previous plugin rotted for seven months because a grammar change could
 * not fail anything: it carried its own hand-written model of the grammar, and
 * nothing compared the two. This test compares them.
 *
 * `CnxParser.ruleNames` is generated from `grammar/Cnx.g4`, and the printer
 * derives its handled set from its own dispatcher. Adding a grammar rule
 * without teaching the printer to lay it out fails here.
 */

import { CnxParser } from "../../src/cnx/PARSE/2-Parse/grammar/CnxParser";
import CnxPrinter from "../src/printer";

describe("grammar rule coverage", () => {
  it("has a layout for every rule the grammar generates", () => {
    const handled = CnxPrinter.handledRuleIndices();
    const missing = CnxParser.ruleNames.filter(
      (_name, index) => !handled.has(index),
    );
    expect(missing).toEqual([]);
  });

  it("lays out no rule the grammar does not have", () => {
    const ruleCount = CnxParser.ruleNames.length;
    const unknown = [...CnxPrinter.handledRuleIndices()].filter(
      (index) => index < 0 || index >= ruleCount,
    );
    expect(unknown).toEqual([]);
  });
});
