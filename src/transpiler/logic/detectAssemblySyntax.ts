/**
 * Detect whether header content is GNU-assembler source rather than C.
 *
 * Some framework headers are pure assembler despite the `.h` extension — e.g.
 * xtensa `coreasm.h`, pulled in transitively by FreeRTOS port headers. They
 * `#define _ASMLANGUAGE` and contain `.macro` definitions whose bodies use
 * assembler instruction mnemonics such as `loop`. None of this is valid C, so
 * when the C parser error-recovers over it those mnemonics get mis-collected as
 * C symbols and then false-conflict with C-Next symbols of the same name (e.g.
 * Arduino `loop()`) — reported as "defined in multiple languages".
 *
 * Headers that merely GUARD assembler with `#ifdef __ASSEMBLER__` are unaffected:
 * preprocessing as C strips those blocks, so no assembler reaches this check.
 * Note the guard token `#ifndef _ASMLANGUAGE` survives on the raw-fallback path
 * (preprocessing failed), so this only matches the `#define _ASMLANGUAGE` form —
 * a header that fences its C prototypes behind such a guard is not assembler.
 *
 * This is a targeted heuristic for the observed FreeRTOS/xtensa case, not a
 * general assembler classifier: the directive check is robust (a line whose
 * first token is a GAS directive is never valid C at file scope), while the
 * `_ASMLANGUAGE` marker is xtensa-specific. It is applied line-by-line rather
 * than with a single multi-quantifier regex to keep matching linear and precise.
 *
 * @param content Header content (preprocessed, or raw on a preprocess fallback)
 * @returns true if the content is assembler and must be skipped for C symbol collection
 */

// GNU-assembler directives that are never valid C at file scope. A line whose
// first token is one of these marks assembler; a `.macro` body in particular
// holds instruction mnemonics like `loop` the C parser would mis-collect.
const ASSEMBLER_DIRECTIVES = new Set([
  ".macro",
  ".endm",
  ".section",
  ".global",
  ".globl",
  ".rept",
  ".endr",
  ".p2align",
]);

/** The run of non-whitespace at the start of an already-trimmed line. */
function firstToken(trimmedLine: string): string {
  const end = trimmedLine.search(/\s/);
  return end === -1 ? trimmedLine : trimmedLine.slice(0, end);
}

/**
 * A whole-file "this translation unit is assembly" self-declaration:
 * `#define _ASMLANGUAGE` (optionally `# define`, optionally with a value). An
 * `#ifndef _ASMLANGUAGE` guard is deliberately NOT matched — see file docstring.
 */
function isAssemblyLanguageDefine(trimmedLine: string): boolean {
  if (trimmedLine[0] !== "#") return false;
  const tokens = trimmedLine.slice(1).trim().split(/\s+/);
  return tokens[0] === "define" && tokens[1] === "_ASMLANGUAGE";
}

function detectAssemblySyntax(content: string): boolean {
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (line === "") continue;
    if (isAssemblyLanguageDefine(line)) return true;
    if (ASSEMBLER_DIRECTIVES.has(firstToken(line))) return true;
  }
  return false;
}

export default detectAssemblySyntax;
