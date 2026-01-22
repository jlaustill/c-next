// Issue #332: Plain C struct (for comparison)
// This struct comes from a C header (not a C-Next file)

#ifndef ISSUE_332_C_HEADER_TYPES_H
#define ISSUE_332_C_HEADER_TYPES_H

#include <stdint.h>

struct Issue332AppConfig {
    int32_t setting;
    uint32_t flags;
};

#endif
