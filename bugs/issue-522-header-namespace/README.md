# Issue #522: Header Generator C++ Namespace Type Mismatch

## Bug Description

When using C++ namespaced types, the generated header file contained
underscore-format type names (e.g., `Lib_Sub_Data`) while the .cpp file
correctly used `::` syntax (`Lib::Sub::Data`). This caused type mismatches.

## Before Fix

The header would incorrectly contain:

```c
typedef struct Lib_Sub_Data Lib_Sub_Data;
extern Lib_Sub_Data globalData;
```

While the .cpp file correctly had:

```cpp
Lib::Sub::Data globalData = ...;
```

## After Fix

The header correctly filters out C++ namespace types entirely, since they
cannot be forward-declared or used in `extern "C"` blocks:

```c
#ifdef __cplusplus
extern "C" {
#endif

// No extern for globalData - it uses a C++ namespace type

#ifdef __cplusplus
}
#endif
```

## To Reproduce (with fix applied)

```bash
cd bugs/issue-522-header-namespace
npx tsx ../../src/index.ts test.cnx --header-out .
cat test.h  # Should NOT contain Lib_Sub_Data
```
