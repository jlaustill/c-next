/* Helper for struct-tag-param.test.cnx (#1929): a C struct declared with no
   typedef, so C must write `struct Point`. */
#pragma once
#include <stdint.h>
struct Point {
    int32_t x;
};
