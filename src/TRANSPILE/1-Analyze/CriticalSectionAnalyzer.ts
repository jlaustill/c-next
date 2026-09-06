/**
 * E0853: `return` inside a `critical` block leaves interrupts disabled.
 *
 * The generated C brackets the block with `__cnx_get_PRIMASK()` /
 * `__cnx_disable_irq()` on the way in and `__cnx_set_PRIMASK(__primask)` on the
 * way out. A `return` jumps past the restore, so on device the interrupts stay
 * off -- not a wrong value, a hung system.
 *
 * ## Why this moved, and what moving found
 *
 * #1322 relocates it from three throws in `TypeValidator`, which shared one
 * message and were driven by a hand-rolled recursion:
 * `_validateStatementForEarlyExit` enumerated the statement kinds it would
 * descend into -- return, if, while, for, do-while.
 *
 * It did not list `switch`. So this compiled clean:
 *
 *     critical {
 *         switch (value) {
 *             case 1 { return value; }
 *         }
 *     }
 *
 * and emitted a `return` sitting between `__cnx_disable_irq()` and
 * `__cnx_set_PRIMASK()`. That is the exact hazard the rule exists to prevent,
 * shipped past the guard that prevents it.
 *
 * A walk cannot have that hole, because it does not enumerate -- it visits.
 * Any statement the grammar can nest inside a critical block is reached,
 * including ones added later, without this file being edited.
 */

import { ParseTreeWalker } from "antlr4ng";

import { CNextListener } from "../../transpiler/logic/parser/grammar/CNextListener";
import * as Parser from "../../transpiler/logic/parser/grammar/CNextParser";
import ParserUtils from "../../utils/ParserUtils";
import ICriticalSectionError from "./types/ICriticalSectionError";

class CriticalSectionListener extends CNextListener {
  /**
   * How many `critical` blocks are open. A counter rather than a boolean
   * because `critical` nests, and a boolean cleared by the inner block's exit
   * would stop applying while still inside the outer one.
   */
  private depth = 0;

  private readonly found: ICriticalSectionError[] = [];

  public errors(): ICriticalSectionError[] {
    return this.found;
  }

  override enterCriticalStatement = (): void => {
    this.depth += 1;
  };

  override exitCriticalStatement = (): void => {
    this.depth -= 1;
  };

  override enterReturnStatement = (
    ctx: Parser.ReturnStatementContext,
  ): void => {
    if (this.depth === 0) return;
    const { line, column } = ParserUtils.getPosition(ctx);
    this.found.push({
      code: "E0853",
      line,
      column,
      message:
        "Cannot use 'return' inside critical section - would leave interrupts disabled",
      helpText:
        "The interrupt state is restored after the block; a `return` jumps past that restore. Assign the value to a variable inside the block and return it after the block closes.",
    });
  };
}

class CriticalSectionAnalyzer {
  public analyze(tree: Parser.ProgramContext): ICriticalSectionError[] {
    const listener = new CriticalSectionListener();
    ParseTreeWalker.DEFAULT.walk(listener, tree);
    return listener.errors();
  }
}

export default CriticalSectionAnalyzer;
