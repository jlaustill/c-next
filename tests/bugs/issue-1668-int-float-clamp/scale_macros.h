/* Helper (not a test): header float macros for two #1668 fixtures. The
 * execution fixture combines them with a cast integer (spelling only), and
 * mixed-category-compound-rejected asserts E0810 on `u32 y *<- SCALE_F`.
 * #1688 types each one from its replacement tokens (ADR-024). */
#ifndef SCALE_MACROS_H
#define SCALE_MACROS_H

#define SCALE_F 2.5f
#define SCALE_D (5.0 / 2.0)

#endif
