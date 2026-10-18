/**
 * String assignment handler (ADR-065).
 *
 * STRING_COPY: a write of one `string<N>` -- `str <- "hello"`,
 * `this.cfg.name <- "x"`, `parr[1].name <- "x"` -- through any spelling.
 */
import AssignmentKind from "../../../../../types/AssignmentKind";
import IAssignmentContext from "../../../../2-Plan/types/IAssignmentContext";
import AssignmentClassifier from "../../../../2-Plan/AssignmentClassifier";
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
 * qualification included; the capacity is the classifier's own decision.
 *
 * #1450 box 4: no `requireInclude("string")` here -- `needsString` is raised
 * by three independent channels before this runs (the effect channel during
 * expression rendering, `CodeGenerator.generateType`, type registration),
 * which is why deleting the six calls this file had moved no fixture.
 */
function copyIntoAssignmentTarget(ctx: IAssignmentContext): string {
  const capacity = AssignmentClassifier.writtenStringCapacity(ctx);
  invariant(
    capacity !== null,
    "the classifier routes a write of one string<N> here",
  );
  return StringUtils.copyWithNull(
    ctx.renderTarget(),
    ctx.generatedValue,
    capacity,
  );
}

const stringHandlers: ReadonlyArray<[AssignmentKind, TAssignmentHandler]> = [
  [AssignmentKind.STRING_COPY, copyIntoAssignmentTarget],
];

export default stringHandlers;
