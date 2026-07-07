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
  // Explicit "this translation unit is assembly" marker used by many arch headers.
  if (/\b_ASMLANGUAGE\b/.test(content)) return true;

  return ASSEMBLER_DIRECTIVE.test(content);
}

export default detectAssemblySyntax;
