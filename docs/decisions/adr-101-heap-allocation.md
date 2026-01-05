# ADR-101: Heap Allocation

**Status:** Research (v2)
**Date:** 2026-01-04
**Decision Makers:** C-Next Language Design Team
**Version:** v2

## Context

C-Next v1 targets embedded systems with static-only allocation (ADR-003). For v2, supporting desktop applications and more complex embedded systems requires heap allocation with proper safety guarantees.

### Related ADRs

- **ADR-003**: Static allocation only (v1)
- **ADR-100**: Multi-core synchronization (v2)

---

## Background

### Why v1 Avoids Heap

1. **Determinism**: Static allocation has predictable timing
2. **No fragmentation**: Heap fragmentation can cause failures
3. **No allocation failure**: Static allocation can't fail at runtime
4. **MISRA compliance**: Many MISRA rules restrict dynamic allocation

### Why v2 Needs Heap

1. **Desktop applications**: Dynamic data structures (strings, collections)
2. **Complex embedded**: Some patterns require dynamic allocation
3. **Interop**: Calling C/C++ libraries that use heap

---

## Design Questions

### Q1: Opt-In vs Opt-Out

Should heap allocation be:
- Enabled by target/config (desktop targets enable by default)?
- Explicit opt-in via pragma?
- Always available but discouraged?

### Q2: Allocation Syntax

```cnx
// Option A: Keyword
heap MyStruct data <- MyStruct.create();

// Option B: Function
MyStruct* data <- alloc(MyStruct);

// Option C: Smart pointer type
Box<MyStruct> data <- Box.new(MyStruct { ... });
```

### Q3: Deallocation Strategy

- Manual free (C-style)?
- RAII/scope-based (C++ style)?
- Reference counting?
- Ownership tracking (Rust-style)?

### Q4: Allocation Failure Handling

- Return null/optional?
- Panic/trap?
- Error return?

### Q5: Thread Safety

How does heap allocation interact with multi-core (ADR-100)?

---

## Open Questions Summary

1. When is heap allocation enabled?
2. What syntax for allocation?
3. How is memory freed?
4. How are allocation failures handled?
5. Thread safety considerations?

---

## References

- [ADR-003: Static Allocation](adr-003-static-allocation.md)
- [Rust Ownership](https://doc.rust-lang.org/book/ch04-00-understanding-ownership.html)
- [MISRA C Dynamic Memory Rules](https://www.misra.org.uk/)
