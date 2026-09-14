/**
 * ADR-001: the one place a C-Next assignment operator becomes its C form.
 *
 * #1322 unified the TABLE -- a byte-identical `ASSIGNMENT_OPERATOR_MAP` had
 * stood in `CodeGenerator` beside the shared one. What stayed duplicated was
 * the DECISION: `getText()`, the lookup, and the `|| "="` fallback were
 * rewritten at three call sites (`AssignmentContextBuilder`, and both the
 * `forAssignment` and `forUpdate` paths in `ControlFlowGenerator`). CLAUDE.md
 * counts that separately from the data -- "single source of truth means the
 * _decision_" -- and three copies of a fallback diverge silently.
 *
 * #1585 is what forced it: ADR-001 needs a provenance site for its assignment
 * half, and adding one to each of three sites would have been a fourth thing
 * to keep in step. One decision, one recording.
 *
 * The `|| "="` fallback is preserved exactly rather than tightened. The grammar
 * admits only the eleven operators the map holds, so it is unreachable today;
 * turning it into a throw is a behavior change this card has no mandate for.
 */
import AdrProvenance from "../../../state/AdrProvenance";
import ASSIGNMENT_OPERATOR_MAP from "../../../../utils/constants/OperatorMappings";

class AssignmentOperatorMapper {
  /**
   * The C operator for `cnextOp`, recording that ADR-001's rule fired at
   * `line` so the scope-context matrix can derive which cell it occupied.
   *
   * Takes the operator's TEXT and LINE rather than its parse context on
   * purpose. Accepting the context reads better at the three call sites, and
   * `npm run parse-tree:check` rejected it: #1317 gates the population of
   * modules holding a parse tree and forbids it growing, and this one has no
   * question for the tree that a string and a number cannot answer.
   */
  static toCOperator(cnextOp: string, line: number | undefined): string {
    AdrProvenance.record("001", line);
    return ASSIGNMENT_OPERATOR_MAP[cnextOp] || "=";
  }
}

export default AssignmentOperatorMapper;
