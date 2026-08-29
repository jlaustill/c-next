/**
 * Prettier Plugin for C-Next
 *
 * Usage:
 *   prettier --plugin ./prettier-plugin/dist/index.js --write "src/*.cnx"
 *
 * Or add to .prettierrc:
 *   { "plugins": ["./prettier-plugin/dist/index.js"] }
 *
 * The plugin prints ANTLR's parse tree directly (#1364). There is no bespoke
 * AST: node types and the rule index are generated from `grammar/CNext.g4`, so
 * a grammar change cannot silently leave the formatter behind.
 */

import { Parser, Printer, SupportLanguage } from "prettier";

import Cst from "./cst";
import parse from "./parser";
import CNextPrinter from "./printer";
import TPrintableNode from "./types/TPrintableNode";

const languages: SupportLanguage[] = [
  {
    name: "C-Next",
    parsers: ["cnext"],
    extensions: [".cnx"],
    vscodeLanguageIds: ["cnext"],
  },
];

const parsers: Record<string, Parser<TPrintableNode>> = {
  cnext: {
    parse,
    astFormat: "cnext-cst",
    locStart: (node: TPrintableNode) => Cst.startOffsetOf(node),
    locEnd: (node: TPrintableNode) => Cst.endOffsetOf(node),
  },
};

const printers: Record<string, Printer<TPrintableNode>> = {
  "cnext-cst": {
    print: CNextPrinter.print,

    /**
     * Confine traversal to `children`.
     *
     * ANTLR contexts carry a `parent` back-pointer. Prettier's traversal
     * follows every own property, so without this it walks parent -> child ->
     * parent forever. This is the documented escape hatch, and it is what makes
     * printing the parse tree directly viable at all.
     */
    getVisitorKeys: () => ["children"],

    /**
     * Prettier's comment attachment is deliberately disabled.
     *
     * It classifies a comment as leading or trailing by looking for newlines in
     * the *current* text, so reflowing a line can flip the verdict on the next
     * run -- a block comment migrating across a `+` forever. Comments are
     * instead anchored to their token during parsing and printed from there, so
     * they never move at all.
     */
    canAttachComment: () => false,
  },
};

const options = {};

/** 4-space indent, matching the project's C-Next sources. */
const defaultOptions = {
  tabWidth: 4,
  useTabs: false,
};

export default {
  languages,
  parsers,
  printers,
  options,
  defaultOptions,
};
