/*
 * Minimal reproduction of xtensa `coreasm.h`: a GNU-assembler source that ships
 * with a `.h` extension and is pulled in (transitively) from FreeRTOS port
 * headers. It is never valid C. When the transpiler parsed its RAW text as C
 * (it did when the header's own deep includes failed to preprocess), the C
 * parser error-recovered over this `.macro` body and mis-collected the `loop`
 * assembler instruction mnemonic as a C symbol named `loop` — which then
 * false-conflicted with a C-Next `loop()`. #1844: no header is read raw now.
 *
 * Structure copied faithfully from the real header (the `floop_` macro).
 */
#define _ASMLANGUAGE

	.macro	floop_	ar, startlabel, endlabelref
	.ifdef	_infloop_
	.if	_infloop_
	.err	// Error: floop cannot be nested
	.endif
	.endif
	.set	_infloop_, 1
#if XCHAL_HAVE_LOOPS
	loop	\ar, \endlabelref
#else /* XCHAL_HAVE_LOOPS */
\startlabel:
	addi	\ar, \ar, -1
#endif /* XCHAL_HAVE_LOOPS */
	.endm	// floop_
