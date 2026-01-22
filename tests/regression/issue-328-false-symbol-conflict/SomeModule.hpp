/**
 * SomeModule.hpp - A C++ module that hasn't been migrated yet
 * This includes the generated AppData.h for interoperability
 * during incremental migration from C++ to C-Next
 */

#ifndef SOMEMODULE_HPP
#define SOMEMODULE_HPP

#include "Display/AppData.h"

// A C++ class that works with AppData (read-only to simplify test)
class SomeModule {
public:
    // Returns 1 if humidity is valid (above 50), 0 otherwise
    static int validateHumidity(float humidity) {
        return humidity > 50.0f ? 1 : 0;
    }
};

#endif /* SOMEMODULE_HPP */
