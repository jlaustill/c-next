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
import * as Parser from "../../../logic/parser/grammar/CNextParser";
import AdrProvenance from "../../../state/AdrProvenance";
import ASSIGNMENT_OPERATOR_MAP from "../../../../utils/constants/OperatorMappings";

class AssignmentOperatorMapper {
  /**
   * The C operator for `operatorCtx`, recording that ADR-001's rule fired
   * there so the scope-context matrix can derive which cell it occupied.
   */
  static toCOperator(operatorCtx: Parser.AssignmentOperatorContext): string {
    AdrProvenance.record("001", operatorCtx.start?.line);
    return ASSIGNMENT_OPERATOR_MAP[operatorCtx.getText()] || "=";
  }
}

export default AssignmentOperatorMapper;
