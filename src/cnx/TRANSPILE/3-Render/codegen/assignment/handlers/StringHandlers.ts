/**
 * String assignment handler (ADR-065).
 *
 * STRING_COPY: a write of one `string<N>` -- `str <- "hello"`,
 * `this.cfg.name <- "x"`, `parr[1].name <- "x"` -- through any spelling,
 * of any ADR-045 value: a copy, a concatenation or a substring (#1257).
 */
import AssignmentKind from "../../../../../types/AssignmentKind";
import IAssignmentContext from "../../../../2-Plan/types/IAssignmentContext";
import StringUtils from "../../../../../utils/StringUtils";
import ComplianceAnnotations from "../../../../2-Plan/ComplianceAnnotations";
import TAssignmentHandler from "./TAssignmentHandler";
import invariant from "../../../../../utils/invariant";

// #1322: `validateNotCompound` is gone -- E0857 in pass 2.1. It was defined
// here AND in the sibling handler, verbatim: one rule, two copies, in a group
// of six.

/**
 * Emit a bounded copy into whatever the target renders to, sized by the
 * `string<N>` the target writes.
 *
 * #1731: one handler, because the six it replaced differed only in how each
 * spelled its target. Three re-rendered it by hand from `identifiers[0]` and
 * `identifiers[1]` -- `cfg.label` on a pointer parameter (#1256),
 * `parr.name[1]` for `parr[1].name` (#1748), the bare `tags[0]` for a scope's
 * `this.tags[0]` (#1903) -- and the element forms dropped the terminator. The
 * target renderer already answers how a target is spelled, `->` and scope
 * qualification included; the capacity is 2.2's decision, planned with the
 * write (#1731 review).
 *
 * Every copy is one `cnx_string_copy` call (#2207): `strncpy` with
 * overlapping arguments is undefined, and `names[i]` can be `names[j]`. A
 * call reaches its target once, so a subscript with a side effect runs once
 * (#1731 review), and one form leaves the same bytes however the value is
 * spelled (#2207 review).
 *
 * #1450 box 4: no `requireInclude("string")` here -- `needsString` is raised
 * by three independent channels before this runs (the effect channel during
 * expression rendering, `CodeGenerator.generateType`, type registration),
 * which is why deleting the six calls this file had moved no fixture.
 */
function copyIntoAssignmentTarget(ctx: IAssignmentContext): string {
  const capacity = ctx.plannedStringCapacity;
  invariant(
    capacity !== null,
    "the classifier routes a planned write of one string<N> here",
  );
  const renderParts = ctx.plannedStringParts;
  // TODO(#2192): the helper's `char*` drops a volatile element's qualifier,
  // as `strncpy`'s own parameter did
  if (renderParts === null) {
    return StringUtils.copy(ctx.renderTarget(), ctx.generatedValue, capacity);
  }
  // #1257: a concatenation or a substring is built apart, then copied in
  // whole, so a part that reads the target reads it unchanged
  const temp = ctx.state.getNextTempVarName();
  return [
    ComplianceAnnotations.render(ComplianceAnnotations.STRING_BUILT_APART),
    "{",
    `    char ${temp}[${capacity + 1}] = "";`,
    ...StringUtils.build(temp, capacity, renderParts()).map(
      (line) => `    ${line}`,
    ),
    `    ${StringUtils.copy(ctx.renderTarget(), temp, capacity)}`,
    "}",
  ].join("\n");
}

const stringHandlers: ReadonlyArray<[AssignmentKind, TAssignmentHandler]> = [
  [AssignmentKind.STRING_COPY, copyIntoAssignmentTarget],
];

export default stringHandlers;
