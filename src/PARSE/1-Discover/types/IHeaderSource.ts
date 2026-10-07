import type EHeaderLanguage from "./EHeaderLanguage";

/**
 * #1844: one header as 1.1 Discover settled it -- the text Stage 2 parses,
 * and the language judged from the text a C compile meets. Stage 2 parses `text` with the
 * parser `language` names; nothing after 1.1 reads the header or judges it
 * again, so a cold run and a warm one cannot disagree (#1851).
 */
interface IHeaderSource {
  /**
   * What Stage 2 parses: the preprocessed text when the header needs the
   * preprocessor to settle its `#if`s (#945), else the text as read, whose
   * `#define`s Stage 2 still collects. The language is judged on the
   * preprocessed text either way (see `language`).
   */
  readonly text: string;

  /**
   * Judged from the header's own lines as a C compile meets them -- always
   * its preprocessed text, `#if` or not (#1852); a
   * `.hpp`/`.hh`/`.hxx` header is always C++ (#211).
   */
  readonly language: EHeaderLanguage;
}

export default IHeaderSource;
