/**
 * Third-party C header for #1545. Two callback typedefs that differ ONLY in
 * const-ness, which is what makes the auto-const decision observable:
 *
 *   log_cb_t       takes `char *`       -- auto-const would BREAK the shape
 *   const_log_cb_t takes `const char *` -- the const must REACH the header
 *
 * A by-value scalar parameter would emit the same text either way and hide
 * the defect, which is why both typedefs take a pointer.
 *
 * Both registrars are `static inline` so the fixture links without a separate
 * C translation unit, following tests/bugs/issue-1544-cross-file-callback.
 */

#ifndef LOG_API_H
#define LOG_API_H

typedef void (*log_cb_t)(char *);
typedef void (*const_log_cb_t)(const char *);

static inline void register_log_handler(log_cb_t handler) {
    static char buffer[32] = "hi";
    handler(buffer);
}

static inline void register_const_log_handler(const_log_cb_t handler) {
    handler("hi");
}

#endif /* LOG_API_H */
