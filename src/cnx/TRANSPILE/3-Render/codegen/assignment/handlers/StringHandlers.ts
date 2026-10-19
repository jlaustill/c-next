/**
 * String assignment handler (ADR-065).
 *
 * STRING_COPY: a write of one `string<N>` -- `str <- "hello"`,
 * `this.cfg.name <- "x"`, `parr[1].name <- "x"` -- through any spelling.
 */
import AssignmentKind from "../../../../../types/AssignmentKind";
import IAssignmentContext from "../../../../2-Plan/types/IAssignmentContext";
import StringUtils from "../../../../../utils/StringUtils";
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
 * The terminator store spells the target a second time, so a target whose
 * subscript has a side effect is reached once, through a temp (#1731 review).
 * A copy from another string calls `cnx_string_copy` instead (#2207):
 * `strncpy` with overlapping arguments is undefined, and `names[i]` can be
 * `names[j]`.
 *
 * #1450 box 4: no `requireInclude("string")` here -- `needsString` is raised
 * by three independent channels before this runs (the effect channel during
 * expression rendering, `CodeGenerator.generateType`, type registration),
 * which is why deleting the six calls this file had moved no fixture.
 */
const HOISTED_COPY_ANNOTATION =
  "/* ADR-045 / Issue #1731: target reached once through a temp (its subscript has a side effect, and the terminator store would evaluate it again). */";

function copyIntoAssignmentTarget(ctx: IAssignmentContext): string {
  const planned = ctx.plannedStringCopy;
  invariant(
    planned !== null,
    "the classifier routes a planned write of one string<N> here",
  );
  const { capacity } = planned;
  const target = ctx.renderTarget();
  // #2207: a source that can be the target is copied by the helper, which is
  // safe when the two are one object; it reaches the target once as well
  if (planned.throughHelper) {
    return `${StringUtils.COPY_HELPER}(${target}, ${ctx.generatedValue}, ${capacity}U);`;
  }
  if (!ctx.targetIndexHasSideEffect) {
    return StringUtils.copyWithNull(target, ctx.generatedValue, capacity);
  }
  // `names[pick()] <- "x"` calls pick() once: the copy and its terminator both
  // write through one pointer to the element, as #1887's clamp does.
  // TODO(#2192): `char*` drops a volatile element's qualifier, as `strncpy`'s
  // own parameter does on the plain path; a fix changes both sites.
  const element = ctx.state.getNextTempVarName();
  const copy = StringUtils.copyWithNull(element, ctx.generatedValue, capacity);
  return `${HOISTED_COPY_ANNOTATION}\n{ char* ${element} = ${target}; ${copy} }`;
}

const stringHandlers: ReadonlyArray<[AssignmentKind, TAssignmentHandler]> = [
  [AssignmentKind.STRING_COPY, copyIntoAssignmentTarget],
];

export default stringHandlers;
