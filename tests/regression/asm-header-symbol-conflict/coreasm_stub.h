/*
 * Minimal reproduction of xtensa `coreasm.h`: a GNU-assembler source that ships
 * with a `.h` extension and is pulled in (transitively) from FreeRTOS port
 * headers. It is never valid C. When its preprocessing fails (its own deep
 * includes are unresolved) the transpiler falls back to parsing the RAW text as
 * C, and the C parser error-recovers over this `.macro` body and mis-collects
 * the `loop` assembler instruction mnemonic as a C symbol named `loop` — which
 * then false-conflicts with a C-Next `loop()`.
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
