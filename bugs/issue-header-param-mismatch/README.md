# Bug: Header/Implementation Parameter Signature Mismatch

## Summary

When a scope function takes a struct parameter by value (`const Config config`), the transpiler generates inconsistent signatures:

- **Header**: `void Manager_initialize(const Config* config);` (pointer)
- **Implementation**: `void Manager_initialize(const Config config)` (value)

This causes linker errors because C++ name mangling differs for these signatures.

## Minimal Reproducer

```c-next
struct Config {
    i32 value;
}

scope Manager {
    public void initialize(const Config config) {
        // Bug manifests here
    }
}
```

## Expected Behavior

Both header and implementation should have matching signatures. Per ADR-006, structs are passed by reference automatically, so expected output would be:

```cpp
// Header
void Manager_initialize(const Config& config);

// Implementation
void Manager_initialize(const Config& config) { ... }
```

Or if using pointers:

```cpp
// Both files
void Manager_initialize(const Config* config);
```

## Actual Behavior

- Header: `const Config*` (pointer)
- Implementation: `const Config` (value)

## Impact

Build fails with linker error:

```
undefined reference to `Manager_initialize'
```

## Found In

- OSSM project: `src/Data/MAX31856Manager.cnx`
- Function: `initialize(const AppConfig config)`
