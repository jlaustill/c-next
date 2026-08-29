import { ParserRuleContext, TerminalNode } from "antlr4ng";

/**
 * Anything Prettier may be handed as a node while printing C-Next.
 *
 * The plugin prints ANTLR's parse tree directly, so a "node" is either a rule
 * context or one of its tokens — there is no bespoke AST in between.
 */
type TCstNode = ParserRuleContext | TerminalNode;

export default TCstNode;
