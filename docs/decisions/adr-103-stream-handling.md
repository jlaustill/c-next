# ADR-103: Stream Handling and File I/O

**Status:** Research
**Date:** 2026-01-06
**Decision Makers:** C-Next Language Design Team

## Context

ADR-047 implements NULL checking for stdin/stdout stream functions (fgets, fputs, etc.), but deliberately excludes file operations that return opaque handles:

```c
FILE* f = fopen("data.txt", "r");  // Returns FILE* or NULL
// ... use f ...
fclose(f);                          // Must close to avoid resource leak
```

This pattern is problematic for C-Next because:

1. **FILE\* is an opaque pointer** - Cannot be stored in a C-Next type
2. **Dynamic resource** - Requires explicit cleanup (fclose)
3. **No RAII** - C-Next doesn't have destructors
4. **NULL return** - Must handle file-not-found gracefully

This ADR researches how C-Next should handle file I/O and other stream-based resources.

## Use Cases

### Embedded Systems (Primary Target)

Most embedded systems don't have filesystems, but some do:

- SD card logging
- Configuration file reading
- Firmware update from file
- Data export

### Desktop Targets (Future)

Full file I/O for desktop C-Next targets:

- Reading/writing files
- Configuration management
- Data persistence

## Research: How Other Languages Handle This

### Rust: RAII with Drop

```rust
let file = File::open("data.txt")?;  // Returns Result<File, Error>
// file is automatically closed when it goes out of scope (Drop trait)
```

### Zig: Defer for Cleanup

```zig
const file = try std.fs.cwd().openFile("data.txt", .{});
defer file.close();  // Guaranteed cleanup on scope exit
```

### Go: Defer for Cleanup

```go
file, err := os.Open("data.txt")
if err != nil { return err }
defer file.Close()  // Cleanup on function return
```

### C++: RAII with fstream

```cpp
std::ifstream file("data.txt");  // Opens file
// Automatically closes on destruction
```

## Design Options

### Option A: Callback-Based (Minimalist)

No file handles exposed - use callbacks for file operations:

```cnx
readFile("data.txt", void(string<1024> line) {
    // Called for each line
    printf("Line: %s\n", line);
});

writeFile("data.txt", void(FileWriter writer) {
    writer.write("Hello");
    writer.write("World");
});
```

**Pros:**

- No resource management needed
- Cannot leak file handles
- Simple mental model

**Cons:**

- Limited flexibility
- Awkward for random access
- May not suit all use cases

### Option B: Scoped Resources (defer-like)

Add `defer` keyword for cleanup:

```cnx
void processFile() {
    File f <- openFile("data.txt");
    defer closeFile(f);  // Guaranteed on scope exit

    if (f = null) {
        return;
    }

    // Use f...
}
```

**Pros:**

- Familiar pattern (Go, Zig)
- Explicit cleanup
- Works with existing C patterns

**Cons:**

- Introduces new keyword
- User can forget `defer`
- Adds complexity

### Option C: with Block (Python-style)

Block-scoped resource management:

```cnx
with File f <- openFile("data.txt") {
    // f is only valid inside this block
    // Automatically closed on block exit
}
```

**Pros:**

- Cannot leak - scope enforced
- Clean syntax
- Familiar from Python

**Cons:**

- New syntax
- Indentation required
- May feel heavy for simple operations

### Option D: High-Level API Only

Don't expose FILE\* - provide high-level functions:

```cnx
// Read entire file
string<4096> content <- readFileContents("data.txt");

// Write entire file
writeFileContents("data.txt", content);

// Read lines into array
string<256> lines[100];
u32 lineCount <- readFileLines("data.txt", lines);
```

**Pros:**

- No resource management
- Safe by default
- Simple API

**Cons:**

- Memory-bound (file size limits)
- No streaming for large files
- Less flexible

## Open Questions

1. **Scope of feature**: Only embedded targets with SD cards, or all targets?

2. **Resource types**: Just files, or also network sockets, serial ports, etc.?

3. **Error handling**: How do file operations report errors?
   - Return codes (C-style)
   - Error enum returns
   - Exception-like mechanism

4. **Integration with ADR-047**: Should file handles use the same NULL checking pattern?

5. **Memory constraints**: How to handle large files on memory-limited embedded systems?

## Recommendation

**Defer to v2** - Stream handling is significant language infrastructure. The current ADR-047 approach (stdin/stdout only) provides practical value without this complexity.

When implemented, recommend starting with **Option D (High-Level API)** for simplicity, with **Option C (with block)** as a potential future enhancement for advanced use cases.

## Related ADRs

- **ADR-003**: Static Allocation - Constrains memory model
- **ADR-047**: NULL for C Interop - stdin/stdout stream functions
- **ADR-101**: Heap Allocation (Research) - Desktop memory model

## References

- [Rust File I/O](https://doc.rust-lang.org/std/fs/struct.File.html)
- [Zig defer](https://ziglang.org/documentation/master/#defer)
- [Go defer](https://go.dev/tour/flowcontrol/12)
- [Python with statement](https://docs.python.org/3/reference/compound_stmts.html#with)
