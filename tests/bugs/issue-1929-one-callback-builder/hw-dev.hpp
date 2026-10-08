// Helper for namespaced-struct-param.test.cnx (#1929): a struct inside a C++
// namespace, taken by a local callback's parameter.
#pragma once
#include <stdint.h>
namespace hw {
struct Dev {
    int32_t x;
};
}
