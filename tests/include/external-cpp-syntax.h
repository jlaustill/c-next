// Issue #1844: a .h whose content is C++. The extension says C; the typed enum
// does not, and that is what 1.1 judges a header's language on.
#pragma once

enum ExternalStatusCode : uint8_t { EXTERNAL_OK, EXTERNAL_FAILED };
