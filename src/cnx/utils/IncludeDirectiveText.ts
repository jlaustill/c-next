/**
 * The text of an `#include` directive: split into the path it names and its
 * form, and joined back.
 *
 * #1672 made this the one split of a directive's text: 1.1 reads the lexer's
 * token with it, and 2.1 and 2.3 read the parser's, which is the same token.
 * Each held regexes of its own, which agreed with it on every fixture.
 *
 * #1444: it lived on `IncludeDiscovery`, so every pass that read include text
 * reached a discovery primitive to do it. Splitting text decides nothing about
 * which files exist, and three passes need it, which is `utils/`' admission
 * test. Whether a spelling names C-Next source is a decision, and stays with
 * 1.1 Discover, which records its answer per directive.
 */
class IncludeDirectiveText {
  /**
   * One `INCLUDE_DIRECTIVE` token's path and delimiter, or null when the text
   * names nothing: `#include <>` is a token too, and text with no delimiter
   * is not a directive.
   *
   * @param text - An `INCLUDE_DIRECTIVE` token's text, exactly
   */
  static split(text: string): { path: string; isLocal: boolean } | null {
    const open = text.search(/[<"]/);
    if (open === -1) return null;
    const path = text.slice(open + 1, -1);
    return path === "" ? null : { path, isLocal: text[open] === '"' };
  }

  /**
   * The directive that names `include`: `#include "path"` or `#include <path>`.
   * The key 1.1 records its answers under and later passes read them by.
   */
  static join(include: { path: string; isLocal: boolean }): string {
    return IncludeDirectiveText.ofSpec(IncludeDirectiveText._spelled(include));
  }

  /** The directive that includes `spec` (`"x.h"` or `<x.h>`), as `join` writes it */
  static ofSpec(spec: string): string {
    return `#include ${spec}`;
  }

  /**
   * The spec a translation unit includes `text` by: `"x.h"` or `<x.h>`, or
   * null when `text` names nothing.
   */
  static spec(text: string): string | null {
    const include = IncludeDirectiveText.split(text);
    return include === null ? null : IncludeDirectiveText._spelled(include);
  }

  /** `"path"` or `<path>`: the one place a form is spelled */
  private static _spelled(include: { path: string; isLocal: boolean }): string {
    return include.isLocal ? `"${include.path}"` : `<${include.path}>`;
  }
}

export default IncludeDirectiveText;
