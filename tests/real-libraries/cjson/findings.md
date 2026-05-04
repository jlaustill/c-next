# cJSON Integration Findings

**Library:** cJSON v1.7.19
**Issue:** #931
**Status:** Phase 2 cJSON tests added using ADR-061 boundary layer

## Test Progress

| Test                    | Status   | Notes                                                            |
| ----------------------- | -------- | ---------------------------------------------------------------- |
| cJSON vendored source   | **Done** | Real `cJSON.c`/`cJSON.h` under `tests/libs/cJSON/`               |
| cjson_api.h/c           | **Done** | C boundary layer for macro-declared APIs and string/free helpers |
| array-handling.test.cnx | **PASS** | Parses JSON array, reads items and numeric values                |
| json-building.test.cnx  | **PASS** | Builds object with scalar and array values, prints JSON          |

## Discoveries

### Discovery 1: Public API macro declarations

cJSON declares public functions through the `CJSON_PUBLIC(type)` function-like macro:

```c
CJSON_PUBLIC(cJSON *) cJSON_Parse(const char *value);
CJSON_PUBLIC(cJSON *) cJSON_CreateArray(void);
```

C-Next does not collect those declarations as callable C symbols directly from the raw header. The ADR-061 boundary layer exposes plain C prototypes instead:

```c
cJSON* cnext_cjson_parse(const char* text);
cJSON* cnext_cjson_create_array(void);
```

The wrapper implementation delegates to the real cJSON APIs, keeping the `.cnx` tests focused on type-safe calls.

### Discovery 2: cJSON ownership stays in C

cJSON returns heap-owned `cJSON*` trees and `char*` print buffers. The C boundary layer centralizes cleanup helpers:

```c
void cnext_cjson_delete(cJSON* item);
void cnext_cjson_free_string(char* text);
```

C-Next code calls those typed wrappers rather than handling allocator-specific details.

### Discovery 3: Opaque cJSON pointers work through wrappers

Declaring local variables as `cJSON` in C-Next is inferred as `cJSON*` when initialized from wrapper functions returning `cJSON*`:

```c-next
cJSON root <- global.cnext_cjson_parse(payload);
cJSON first <- global.cnext_cjson_get_array_item(root, 0);
```

Generated C uses pointer locals (`cJSON* root`, `cJSON* first`), validating pointer return inference against a real library type.

### Discovery 4: C-Next strings pass to `const char*` wrappers

Bounded C-Next strings compile to `char[N]` buffers and pass cleanly to wrappers expecting `const char*`:

```c-next
string<64> payload <- "[10,20,30]";
cJSON root <- global.cnext_cjson_parse(payload);
```

This supports JSON payload parsing and object key lookup without exposing unsafe pointer casts in C-Next.

## Related

- [ADR-061: C Library Interoperability](/docs/decisions/adr-061-c-library-interop.md)
- [Issue #931](https://github.com/jlaustill/c-next/issues/931)
