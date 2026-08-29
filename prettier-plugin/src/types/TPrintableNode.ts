import ICommentNode from "./ICommentNode";
import TCstNode from "./TCstNode";

/**
 * Every value Prettier may hand the printer.
 *
 * Parse-tree nodes come from ANTLR; comment nodes are lifted off the HIDDEN
 * channel and reach the printer through `printComment` rather than the tree.
 */
type TPrintableNode = TCstNode | ICommentNode;

export default TPrintableNode;
