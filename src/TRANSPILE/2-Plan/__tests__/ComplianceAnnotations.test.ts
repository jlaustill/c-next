/**
 * #1449: the house form for a compliance annotation, asserted rather than
 * remembered.
 *
 * CLAUDE.md requires `/* <Standard> Rule <N>: <what> (<why>). *\/` and forbids
 * a nested `/*` inside the text (MISRA C:2012 Rule 3.1 -- an annotation that
 * violated a rule while citing one). Three sites used to build these strings by
 * hand and one had drifted: `forever` emitted no trailing period, and its
 * parenthetical named the C-Next construct instead of what the naive C would
 * have done. A convention in prose could not catch that; this can.
 */

import ComplianceAnnotations from "../ComplianceAnnotations";

/** `/* MISRA C:2012 Rule 8.4: what (why). *\/` */
const HOUSE_FORM = /^\/\* MISRA C:2012 Rule \d+(?:\.\d+)*: .+ \(.+\)\. \*\/$/;

describe("ComplianceAnnotations", () => {
  describe("every annotation the transpiler can emit", () => {
    it.each(ComplianceAnnotations.all().map((a) => [a.rule, a] as const))(
      "Rule %s matches the house form",
      (_rule, annotation) => {
        expect(ComplianceAnnotations.render(annotation)).toMatch(HOUSE_FORM);
      },
    );

    it.each(ComplianceAnnotations.all().map((a) => [a.rule, a] as const))(
      "Rule %s opens no nested comment (MISRA Rule 3.1)",
      (_rule, annotation) => {
        const rendered = ComplianceAnnotations.render(annotation);

        expect(rendered.slice(2, -2)).not.toContain("/*");
      },
    );

    it.each(ComplianceAnnotations.all().map((a) => [a.rule, a] as const))(
      "Rule %s says what the naive form would have done, not just what this one does",
      (_rule, annotation) => {
        // The `why` is the half CLAUDE.md is specific about, and the half that
        // drifted. A why that merely restates the construct is not one.
        expect(annotation.why.length).toBeGreaterThan(annotation.rule.length);
        expect(annotation.why.endsWith(".")).toBe(false);
      },
    );
  });

  it("cites exactly the rules it is known to cite", () => {
    // Fails loudly when a rule is added or removed, so the set an auditor would
    // enumerate stays visible in review rather than growing quietly.
    const rules = ComplianceAnnotations.all().map((a) => a.rule);

    expect(rules.sort()).toEqual(["14.3", "21.15", "8.4"]);
  });

  it("renders the slice unroll with both pointer types it names", () => {
    const rendered = ComplianceAnnotations.render(
      ComplianceAnnotations.sliceUnroll("uint8_t", "uint32_t"),
    );

    expect(rendered).toContain("uint8_t* vs uint32_t*");
    expect(rendered).toMatch(HOUSE_FORM);
  });
});
