import type EHeaderLanguage from "./EHeaderLanguage";

/**
 * #1844: one header as 1.1 Discover settled it -- the text a C compile meets,
 * and the language judged from that text. Stage 2 parses `text` with the
 * parser `language` names; nothing after 1.1 reads the header or judges it
 * again, so a cold run and a warm one cannot disagree (#1851).
 */
interface IHeaderSource {
  /**
   * The preprocessed text when the header needs the preprocessor to settle
   * its `#if`s (#945), else the text as read. The raw text when
   * preprocessing failed (see `preprocessError`).
   */
  readonly text: string;

  /** Judged from `text`; a `.hpp`/`.hh`/`.hxx` header is always C++ (#211). */
  readonly language: EHeaderLanguage;

  /**
   * Why the preprocessor could not run on this header, or null. A header
   * that failed falls back to its raw text, is not offered as macro context
   * to the headers after it, and arms #985's recovery pass.
   */
  readonly preprocessError: string | null;
}

export default IHeaderSource;
