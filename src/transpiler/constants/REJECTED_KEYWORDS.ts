/**
 * Words that parse as a bare IDENTIFIER but are deliberately not part of
 * C-Next, and get their own diagnostic rather than a generic one.
 *
 * ADR-026 (Status: Rejected) excludes `break` and `continue` from the language;
 * `CodeGenerator` rejects them with E0703 naming the structured alternative.
 * Because they reach the parser as identifiers, the undeclared-name analyses
 * (E0426/E0427) see them first and would otherwise report "'break' is not
 * defined" -- true, useless, and hiding the message that tells the author what
 * to write instead.
 *
 * Shared so that a third rejected word is added in ONE place. Spelling this
 * list twice is the duplicate-decision shape `CLAUDE.md` forbids: the analyzer
 * skipping a word the generator no longer rejects would silence both
 * diagnostics at once.
 */
const REJECTED_KEYWORDS: ReadonlySet<string> = new Set(["break", "continue"]);

export default REJECTED_KEYWORDS;
