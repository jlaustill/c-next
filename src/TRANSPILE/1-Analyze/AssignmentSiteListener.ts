/**
 * Assignment Site Listener
 *
 * Hands every assignment the grammar spells to a callback as one shape: a
 * statement (`x +<- 1;`), a for-loop initializer (`for (x +<- 1; ...)`) and a
 * for-loop update (`for (...; ...; x +<- 1)`).
 *
 * Which grammar rules are assignments is a single fact about the grammar. An
 * analyzer that hooked the statement alone read the other two as absent, so
 * `for (...; ...; i +<- flag)` compiled while `i +<- flag;` was E0807 (#1668).
 */

import { CNextListener } from "../../PARSE/2-Parse/grammar/CNextListener";
import * as Parser from "../../PARSE/2-Parse/grammar/CNextParser";
import type TAssignmentSite from "./types/TAssignmentSite";

class AssignmentSiteListener extends CNextListener {
  constructor(private readonly onAssignment: (site: TAssignmentSite) => void) {
    super();
  }

  override enterAssignmentStatement = (
    ctx: Parser.AssignmentStatementContext,
  ): void => {
    this.onAssignment(ctx);
  };

  override enterForAssignment = (ctx: Parser.ForAssignmentContext): void => {
    this.onAssignment(ctx);
  };

  override enterForUpdate = (ctx: Parser.ForUpdateContext): void => {
    this.onAssignment(ctx);
  };
}

export default AssignmentSiteListener;
