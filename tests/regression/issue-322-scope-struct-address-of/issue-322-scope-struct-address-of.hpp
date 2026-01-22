#pragma once
#include <cstdint>

// Issue #322: Explicit & syntax for passing address of scope struct members
// to external C++ functions that expect pointers

// C++11 typed enum to ensure C++ mode detection
enum ConfigMode : uint8_t {
    CONFIG_OFF = 0,
    CONFIG_ON = 1
};

// Forward declaration - actual struct definition comes from transpiled C-Next code
struct AppConfig;

// External storage class that operates on pointers
class ConfigStorage {
public:
    // Takes a pointer to AppConfig and modifies the timeout field (first uint32_t at offset 0)
    // Uses void* to avoid needing complete type definition
    static inline void loadConfig(AppConfig* config) {
        // Cast to uint32_t* to access the first field (timeout)
        // This works because AppConfig has timeout as its first member
        uint32_t* ptr = reinterpret_cast<uint32_t*>(config);
        *ptr = *ptr * 2;  // Double the timeout value
    }
};
