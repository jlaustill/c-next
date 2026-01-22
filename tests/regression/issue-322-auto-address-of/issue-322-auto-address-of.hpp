// Issue #322: External C++ class with pointer parameters
// Used to test automatic &-insertion by transpiler

#ifndef ISSUE_322_AUTO_ADDRESS_OF_HPP
#define ISSUE_322_AUTO_ADDRESS_OF_HPP

#include <stdint.h>

struct AppConfig {
    uint32_t timeout;
    uint32_t retries;
};

// External C++ class with static methods expecting pointers
class ConfigStorage {
public:
    // Modifies config through pointer - doubles the timeout
    static void loadConfig(AppConfig* config) {
        if (config) {
            config->timeout *= 2;
        }
    }

    // Reads config through const pointer - returns timeout value
    static uint32_t getTimeout(const AppConfig* config) {
        return config ? config->timeout : 0;
    }
};

#endif // ISSUE_322_AUTO_ADDRESS_OF_HPP
