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
 * @param content Header content (preprocessed, or raw on a preprocess fallback)
 * @returns true if the content is assembler and must be skipped for C symbol collection
 */

// GNU-assembler directives at line start. Header content is declarations, not
// expression statements, so a leading `.<directive>` is never valid C here.
// `.macro` is the key trigger — its body holds instruction mnemonics like `loop`.
const ASSEMBLER_DIRECTIVE =
  /^[ \t]*\.(macro|endm|section|global|globl|rept|endr|p2align)\b/m;

function detectAssemblySyntax(content: string): boolean {
  // Explicit "this translation unit is assembly" marker: match only the
  // `#define _ASMLANGUAGE` form, not a bare mention. Real C headers GUARD their
  // C prototypes with `#ifndef _ASMLANGUAGE` (e.g. xtensa xtruntime.h); on the
  // raw-fallback path that guard line is still present, and matching the token
  // anywhere would misclassify such a header as assembler and drop its C decls.
  if (/^\s*#\s*define\s+_ASMLANGUAGE\b/m.test(content)) return true;

  return ASSEMBLER_DIRECTIVE.test(content);
}

export default detectAssemblySyntax;
