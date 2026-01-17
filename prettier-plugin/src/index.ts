/**
 * Prettier Plugin for C-Next
 *
 * Usage:
 *   prettier --plugin ./prettier-plugin/dist/index.js --write "src/*.cnx"
 *
 * Or add to .prettierrc:
 *   { "plugins": ["./prettier-plugin"] }
 */

import { Parser, Printer, SupportLanguage } from "prettier";
import parse from "./parser";
import print from "./printer";
import * as AST from "./nodes";

/**
 * Language definition for C-Next
 */
const languages: SupportLanguage[] = [
  {
    name: "C-Next",
    parsers: ["cnext"],
    extensions: [".cnx"],
    vscodeLanguageIds: ["cnext"],
  },
];

/**
 * Parser that converts C-Next source to AST
 */
const parsers: Record<string, Parser<AST.Program>> = {
  cnext: {
    parse,
    astFormat: "cnext-ast",
    locStart: (node: AST.ASTNode) => node.start,
    locEnd: (node: AST.ASTNode) => node.end,
  },
};

/**
 * Printer that converts AST back to formatted source
 */
const printers: Record<string, Printer<AST.ASTNode>> = {
  "cnext-ast": {
    print,
    // Handle comments - required by Prettier
    printComment(commentPath) {
      const comment = commentPath.getValue() as AST.Comment;
      return comment.value;
    },
    canAttachComment(node: AST.ASTNode) {
      return node.type !== "Comment";
    },
    isBlockComment(node: AST.ASTNode) {
      return (
        node.type === "Comment" && (node as AST.Comment).commentType === "block"
      );
    },
  },
};

/**
 * Default options for C-Next formatting
 * These align with the project's conventions
 */
const options = {};

/**
 * Default formatting options - 4 space indent as per project convention
 */
const defaultOptions = {
  tabWidth: 4,
  useTabs: false,
};

// Named exports for CommonJS compatibility
export { languages, parsers, printers, options, defaultOptions };

// Default export for ESM
export default {
  languages,
  parsers,
  printers,
  options,
  defaultOptions,
};
