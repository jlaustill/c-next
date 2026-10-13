/**
 * MISRA 10.3: the type whose minimum a `-` literal is, when 2.3 writes it as
 * that type's `<limits.h>` macro. `-2147483648` is `-(2147483648)` in C, and
 * 2147483648 does not fit `int`.
 */
type TNegativeMinimum = "int32_t" | "int64_t";

export default TNegativeMinimum;
