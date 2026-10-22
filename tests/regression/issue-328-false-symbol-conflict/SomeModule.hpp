/**
 * SomeModule.hpp - A C++ module that hasn't been migrated yet
 * This includes the generated AppData.hpp for interoperability
 * during incremental migration from C++ to cnx
 */

#ifndef SOMEMODULE_HPP
#define SOMEMODULE_HPP

#include "Display/AppData.hpp"

// A C++ class that works with AppData (read-only to simplify test)
class SomeModule {
public:
    // Returns 1 if humidity is valid (above 50), 0 otherwise
    static int validateHumidity(float humidity) {
        return humidity > 50.0f ? 1 : 0;
    }
};

#endif /* SOMEMODULE_HPP */
