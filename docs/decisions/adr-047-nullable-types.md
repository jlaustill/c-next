# ADR-047: Nullable Types and Optional Returns

**Status:** Research
**Date:** 2026-01-01
**Decision Makers:** C-Next Language Design Team

## Context

Many C library functions signal failure by returning `NULL`. This pattern is pervasive:

```c
// C standard library examples that return NULL on failure
char *fgets(char *s, int n, FILE *stream);   // Returns NULL on EOF or error
void *malloc(size_t size);                    // Returns NULL on allocation failure
FILE *fopen(const char *path, const char *mode);  // Returns NULL if file can't be opened
char *getenv(const char *name);               // Returns NULL if variable not set
```

### The fgets Problem

Consider this common C-Next pattern for reading user input:

```cnx
#include <stdio.h>

string<50> userName;

u32 main(string args[]) {
    printf("What is your name? ");
    fgets(userName, userName.size, stdin);

    // Remove trailing newline
    if (userName.length > 0 && userName[userName.length - 1] = '\n') {
        userName[userName.length - 1] <- '\0';
    }

    printf("Hello, %s!\n", userName);
    return 0;
}
```

**The problem:** `fgets` returns `NULL` on EOF or error, but C-Next currently has no way to:
1. Express that a function can return `NULL`
2. Require the caller to handle the `NULL` case
3. Distinguish between "no value" and a valid value

In C, the safe pattern is:
```c
if (fgets(userName, sizeof userName, stdin) != NULL) {
    // Process the input
}
```

But C-Next's type system doesn't enforce this check.

---

## Research: How Other Languages Handle Nullable Types

### Rust: Option<T>

Rust uses an explicit `Option<T>` type that must be unwrapped:

```rust
// Option is an enum: Some(value) or None
fn get_user_input() -> Option<String> {
    let mut input = String::new();
    match io::stdin().read_line(&mut input) {
        Ok(_) => Some(input.trim().to_string()),
        Err(_) => None,
    }
}

// Caller MUST handle the None case
match get_user_input() {
    Some(name) => println!("Hello, {}!", name),
    None => println!("Failed to read input"),
}

// Or use ? for early return
let name = get_user_input()?;  // Returns None if failed
```

**Pros:**
- Compile-time null safety
- No billion-dollar mistake

**Cons:**
- Verbose for simple cases
- Requires pattern matching infrastructure

### Swift: Optional (T?)

Swift uses `?` suffix for optional types:

```swift
func readLine() -> String?  // Returns nil on EOF

// Must unwrap before use
if let name = readLine() {
    print("Hello, \(name)!")
} else {
    print("Failed to read input")
}

// Force unwrap (crashes if nil)
let name = readLine()!

// Nil coalescing
let name = readLine() ?? "Unknown"
```

**Pros:**
- Concise syntax
- Multiple unwrapping options

**Cons:**
- Force unwrap can crash
- Requires runtime nil checks

### Zig: Optional (?T)

Zig uses `?` prefix for optional types:

```zig
fn readLine() ?[]const u8 {
    // Returns null on failure
}

// Must unwrap with orelse or if
const name = readLine() orelse {
    std.debug.print("Failed\n", .{});
    return error.ReadFailed;
};

// Or with if
if (readLine()) |name| {
    std.debug.print("Hello, {s}!\n", .{name});
}
```

**Pros:**
- Zero-cost abstraction
- Compiles to simple null checks

**Cons:**
- Unfamiliar syntax

### C++17: std::optional<T>

```cpp
std::optional<std::string> get_input() {
    std::string line;
    if (std::getline(std::cin, line)) {
        return line;
    }
    return std::nullopt;
}

// Check with has_value() or operator bool
if (auto name = get_input()) {
    std::cout << "Hello, " << *name << "!\n";
}
```

---

## Design Options for C-Next

### Option A: Nullable Type Suffix (?)

Use `?` suffix to mark types that can be null:

```cnx
// Declaration
string<50>? result <- fgets(buffer, buffer.size, stdin);

// Must check before use
if (result?) {
    // result is now guaranteed non-null in this scope
    printf("Got: %s\n", result);
}

// Or provide default
string<50> name <- result ?? "Unknown";
```

**Transpiles to:**
```c
char *result = fgets(buffer, 51, stdin);
if (result != NULL) {
    printf("Got: %s\n", result);
}

const char *name = (result != NULL) ? result : "Unknown";
```

### Option B: Result Type

Use a Result type for functions that can fail:

```cnx
Result<string<50>, Error> result <- readLine(stdin);

match (result) {
    case Ok(value): {
        printf("Got: %s\n", value);
    }
    case Err(e): {
        printf("Error: %s\n", e.message);
    }
}
```

**Pros:**
- Can carry error information
- Very explicit

**Cons:**
- Requires match expressions (ADR not yet implemented)
- More complex for simple null checks

### Option C: Explicit Null Checks (Minimal Change)

Keep C semantics but add a `null` keyword and require explicit checks:

```cnx
// fgets returns pointer, can be null
string<50> result <- fgets(buffer, buffer.size, stdin);

// Compiler error: result may be null, must check
printf("Got: %s\n", result);  // ERROR!

// This works
if (result != null) {
    printf("Got: %s\n", result);  // OK, result proven non-null
}
```

### Option D: Try Expression

Add a `try` expression for functions that return null on failure:

```cnx
// try returns early if null (like Rust's ?)
string<50> input <- try fgets(buffer, buffer.size, stdin);

// Or use try-else for custom handling
string<50> input <- try fgets(buffer, buffer.size, stdin) else {
    printf("Read failed\n");
    return 1;
};
```

---

## Open Questions

1. **Scope of nullable types:**
   - Only for C interop (external functions)?
   - Or allow C-Next functions to return nullable types?

2. **Pointer types:**
   - Does C-Next have explicit pointer types?
   - Or only for C FFI?

3. **Integration with existing types:**
   - How do nullable strings work with `string<N>`?
   - Is `string<N>?` a pointer to a string buffer, or the buffer itself that might be uninitialized?

4. **Default behavior:**
   - Should C functions returning pointers be assumed nullable by default?
   - Or require explicit annotation?

5. **Error handling strategy:**
   - Is this part of a broader error handling strategy (ADR-042)?
   - Should we unify with Result types?

---

## Recommendation

**Preliminary recommendation: Option A (Nullable Type Suffix)** for the following reasons:

1. **Familiar syntax** - Swift, TypeScript, Kotlin all use `?`
2. **Minimal overhead** - Transpiles to simple null checks
3. **Gradual adoption** - Can be added to C interop without changing existing code
4. **Clear semantics** - `?` suffix clearly indicates "may be null"

However, this needs further research on:
- How it interacts with C-Next's string type
- Whether we need full Result types for richer error handling
- How to annotate C function declarations

---

## Decision

**Status: Research** - Awaiting further discussion and prototyping.

---

## References

- [Rust Option Type](https://doc.rust-lang.org/std/option/)
- [Swift Optionals](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/thebasics/#Optionals)
- [Zig Optional Types](https://ziglang.org/documentation/master/#Optionals)
- [Tony Hoare: Null References - The Billion Dollar Mistake](https://www.infoq.com/presentations/Null-References-The-Billion-Dollar-Mistake-Tony-Hoare/)
- ADR-042: Error Handling (related)
- ADR-045: String Type (affected by this decision)
