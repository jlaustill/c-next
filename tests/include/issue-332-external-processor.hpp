// Issue #332: External C++ class with pointer parameters
// Tests both C-Next struct pointers and C header struct pointers

#ifndef ISSUE_332_EXTERNAL_PROCESSOR_HPP
#define ISSUE_332_EXTERNAL_PROCESSOR_HPP

#include <stdint.h>
// Include the generated header for Issue332AppData (will be issue-332-cnx-types.h)
#include "issue-332-cnx-types.h"
#include "issue-332-c-header-types.h"

class Issue332DataProcessor {
public:
    // Takes pointer to C-Next struct (Issue332AppData from .cnx file)
    static void processData(Issue332AppData* data) {
        if (data) {
            data->value = data->value * 2.0f;
            data->count++;
        }
    }

    // Takes pointer to C header struct (Issue332AppConfig from .h file)
    static void processConfig(Issue332AppConfig* config) {
        if (config) {
            config->setting *= 2;
            config->flags++;
        }
    }

    // Both struct types in same function
    static void initialize(const Issue332AppConfig* config, Issue332AppData* data) {
        if (config && data) {
            data->value = static_cast<float>(config->setting);
            data->count = config->flags;
        }
    }
};

#endif // ISSUE_332_EXTERNAL_PROCESSOR_HPP
