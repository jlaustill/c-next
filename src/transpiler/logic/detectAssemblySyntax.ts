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
 * Crucially, the guard token (`#ifndef _ASMLANGUAGE`, `#ifndef __ASSEMBLY__`, …)
 * survives on the raw-fallback path (preprocessing failed), so only the
 * `#define <marker>` form is matched — a header that fences its C prototypes
 * behind such a guard is a normal C header, not assembler.
 *
 * This is a heuristic, not a general assembler classifier. The directive check
 * is robust (a line whose first token is a GAS directive is never valid C at
 * file scope); the marker check recognizes the common whole-file "this unit is
 * assembly" self-declarations across toolchains. It is applied line-by-line
 * rather than with a single multi-quantifier regex to keep matching linear.
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

// Whole-file "this translation unit is assembly" self-declaration macros,
// matched ONLY in their `#define` form (never the `#ifndef`/`#ifdef` guard form,
// which fences C prototypes in real C headers — see file docstring). A C header
// never defines these, since doing so would disable its own C content.
const ASSEMBLY_MARKER_MACROS = new Set([
  "_ASMLANGUAGE", // xtensa (e.g. coreasm.h)
  "__ASSEMBLY__", // Linux kernel, U-Boot, many RTOS ports
  "__ASSEMBLER__", // GCC/Clang assembling convention
]);

/** The run of non-whitespace at the start of an already-trimmed line. */
function firstToken(trimmedLine: string): string {
  const end = trimmedLine.search(/\s/);
  return end === -1 ? trimmedLine : trimmedLine.slice(0, end);
}

/**
 * True when the line is `#define <marker>` for a known assembly self-declaration
 * macro (optionally `# define`, optionally with a value). A guard such as
 * `#ifndef __ASSEMBLY__` is deliberately NOT matched — see file docstring.
 */
function isAssemblyMarkerDefine(trimmedLine: string): boolean {
  if (!trimmedLine.startsWith("#")) return false;
  const tokens = trimmedLine.slice(1).trim().split(/\s+/);
  return tokens[0] === "define" && ASSEMBLY_MARKER_MACROS.has(tokens[1]);
}

function detectAssemblySyntax(content: string): boolean {
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (line === "") continue;
    if (isAssemblyMarkerDefine(line)) return true;
    if (ASSEMBLER_DIRECTIVES.has(firstToken(line))) return true;
  }
  return false;
}

export default detectAssemblySyntax;
