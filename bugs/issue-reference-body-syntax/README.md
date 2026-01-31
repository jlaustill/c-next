# Bug: Reference semantics not applied to function body

## Summary

PR #555 changed function signatures to use C++ references (`const T&`) in C++ mode, but the function body code generation still uses pointer syntax in some cases.

## Minimal Reproducer

```c-next
struct Config {
    i32 magic;
    i32 version;
}

scope Storage {
    public bool validate(const Config config) {
        if (config.magic != 123) { return false; }
        return true;
    }

    public void loadDefaults(Config config) {
        config.magic <- 123;
        config.version <- 1;
    }

    public Config copy(const Config config) {
        Config result <- config;
        return result;
    }
}
```

## Generated Output (C++ mode)

```cpp
bool Storage_validate(const Config& config) {
    if (config.magic != 123) {  // ✓ CORRECT - dot syntax
        return false;
    }
    return true;
}

void Storage_loadDefaults(Config& config) {
    config->magic = 123;   // ✗ BUG - arrow syntax on reference
    config->version = 1;   // ✗ BUG - arrow syntax on reference
}

Config Storage_copy(const Config& config) {
    Config result = (*config);  // ✗ BUG - dereference on reference
    return result;
}
```

## Expected Output

```cpp
void Storage_loadDefaults(Config& config) {
    config.magic = 123;    // dot syntax for reference
    config.version = 1;
}

Config Storage_copy(const Config& config) {
    Config result = config;  // no dereference needed for reference
    return result;
}
```

## Pattern

| Operation                 | Current (buggy)   | Expected       |
| ------------------------- | ----------------- | -------------- |
| Read member in condition  | `config.magic` ✓  | `config.magic` |
| Write member (assignment) | `config->magic` ✗ | `config.magic` |
| Use as value (copy)       | `(*config)` ✗     | `config`       |

## Root Cause

The code generator applies reference semantics for read-only member access but still uses pointer semantics for:

1. Member write access (assignment target)
2. Whole-struct value usage

## Related

- PR #555 - Added reference semantics for function signatures
- This bug is a follow-up fix needed for complete reference support
