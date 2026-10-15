# ADR-071: Read-Only Parameters by Default (`mut`)

**Status:** Research
**Date:** 2026-10-15
**Decision Makers:** Language Design Team
**Related ADRs:** ADR-006 (Simplified References), ADR-013 (Const Qualifier), ADR-029 (Function Pointers), ADR-061 (C Library Interop)
**Related Issues:** #2099 (this ADR), #2100 (ADR-013 out of date with the shipped auto-const behavior), #1529 (callback typedef takes its `const` from the body), #986 (array parameters lost auto-`const`)

> This ADR is an exploration. Nothing in it is decided. Each question below carries a
> recommendation so the owner has something concrete to accept or reject; until then it
> is a proposal, not C-Next syntax.

## Context

### A parameter's declaration and its generated signature disagree

ADR-013 makes `const` opt-in: an unqualified parameter is writable. ADR-006 then decides
the generated signature from the body — whether the function writes the parameter, directly
or through a call. So the same unqualified declaration produces different C depending on
what the body does:

```cnx
struct Point { u32 x; u32 y; }

void show(const u32 v)     { u32 a <- v; }
void readScalar(u32 v)     { u32 a <- v; }
void bump(u32 v)           { v <- v + 1; }
void readPoint(Point p)    { u32 a <- p.x; }
void movePoint(Point p)    { p.x <- 1; }
void fill(u8[4] data)      { u8 a <- data[0]; }
```

```c
void show(const uint32_t v)   { uint32_t a = v; }
void readScalar(uint32_t v)   { uint32_t a = v; }
void bump(uint32_t* v)        { (*v) = cnx_clamp_add_u32((*v), 1U); }
void readPoint(const Point* p){ uint32_t a = p->x; }
void movePoint(Point* p)      { p->x = 1U; }
void fill(uint8_t data[4])    { uint8_t a = data[0U]; }
```

The transpiler already knows which parameters are written, and it uses that knowledge for
the C signature. The language does not: `readScalar` declares a writable parameter, generates
a read-only by-value one, and the const check still treats it as writable.

### The const check uses the declaration, so a read-only callee rejects a constant

```cnx
const u32 LIMIT <- 5;
void readOnly(u32 value) { u32 local <- value; }
void caller() { readOnly(LIMIT); }
```

```text
error[E0878]: cannot pass const 'LIMIT' to non-const parameter 'value' of function 'readOnly'
       help: The callee may write through that parameter; declare it `const` in the callee, or pass a mutable copy (ADR-013).
```

`readOnly` is generated as `void readOnly(uint32_t value)` — by value, so nothing could be
written back — yet the call is an error. The same call in a global or scope-member
initializer is rejected the same way. The fix today is to write `const` on a parameter the
transpiler already proved is read-only.

### A callback's type depends on its body

A function used as a callback type (ADR-029) gets its pointer type from the same body-derived
answer, so two functions with identical declarations can get incompatible pointer types
(#1529). A signature derived from the declaration alone cannot disagree with itself.

### How much code is affected (measured)

Measured over the conformance corpus (every `.cnx` under `tests/` and `examples/`) with the
transpiler's own modification analysis — the same direct-and-transitive answer that decides
the generated signatures above, not a text search. 1942 of the 1982 files reached the
analysis, plus one `.cnext` helper they include. The other 40 stop before it when transpiled
on their own, almost all of them fixtures that expect an earlier compile error.

| Measure                                                                  | Count |
| ------------------------------------------------------------------------ | ----: |
| Parameters analyzed                                                      |  1511 |
| Written, so they would need `mut`                                        |   300 |
| — written directly in the body                                           |   227 |
| — written only through a call                                            |    73 |
| — of those 73, only through a callee that is not C-Next (a C/C++ header) |    20 |
| — in a fixture that expects a compile error                              |    44 |
| Declared `const` today, which would become redundant                     |   120 |
| — of those, written anyway (fixtures that assert E0877)                  |    11 |
| Neither written nor `const` (no source change; becomes read-only)        |  1102 |

A control in the same run confirmed the analysis reports a direct write and a write through
a call as written, and a read-only parameter as not written.

## Decision

**Not yet made.** The proposal being explored:

1. A function parameter is **read-only by default**.
2. A parameter the function may write — directly, through a call, or by passing it to a
   C/C++ parameter that is a non-`const` pointer — is declared **`mut`**:

   ```cnx
   void show(u32 v)         { u32 a <- v; }     // read-only: no keyword
   void bump(mut u32 v)     { v <- v + 1; }     // writable: says so
   ```

3. The generated signature follows the declaration, not the body.
4. Only parameters change. Locals, globals and scope members keep ADR-013's opt-in `const`.

Rejected at the outset:

- **Keeping the body-derived inference as the language rule.** It is what produces the three
  problems in Context; the analysis stays, but as a check on the declaration, not as its
  substitute.
- **Ada-style `in` / `out` / `inout` modes.** ADR-013 Alternative 2 already weighed them;
  `mut` adds one keyword where modes add three and an `out` rule C has no way to express.

## Open Questions

Each is from #2099. A recommendation is not a decision.

### Q1: `const` on a parameter, once it is redundant

Options: an error, a warning, or accepted for a migration window.

**Recommendation: an error.** C-Next reports errors, not warnings, and the rewrite in Q8 removes
every one of the 120 mechanically, so a window would protect no code.

### Q2: Writing a parameter that is not `mut`, and a `mut` that is never needed

**Recommendation: a new diagnostic for the write**, not E0877. E0877's help is "remove `const`
from the declaration", which is the wrong advice when there is no `const` to remove:

```text
error[E08xx]: cannot write parameter 'v' of function 'readScalar': parameters are read-only unless declared `mut`
       help: declare it `mut u32 v` if the function must change it
```

**A `mut` that nothing writes is also an error**, mirroring ADR-013's "missing `const` is an
error when it could be used", so a declaration never claims more than the body needs — with
one exemption: a function used as a callback type (ADR-029). Its body is the default and is
often empty, while the functions assigned to it may write; its `mut` is part of the type.

### Q3: What E0878 becomes

**Recommendation:** "cannot pass a `const` value to a `mut` parameter", firing only on a
parameter declared `mut`. The `LIMIT` example in Context compiles.

### Q4: Forwarding a read-only parameter

```cnx
void sink(mut u32 v) { v <- 1; }
void forward(u32 v) { sink(v); }   // forward's v is read-only
```

**Recommendation: an error, with Q2's diagnostic** — passing it to a `mut` parameter is a
write. The same applies to a C/C++ parameter that is a non-`const` pointer (ADR-061): 20
parameters in the corpus are writable today only for that reason, and each would need `mut`.

Still open: a callee nothing declares (no C-Next definition, no header). Today that is assumed
to write. Under this proposal the choice is an error ("cannot tell whether 'f' writes 'v'")
or requiring `mut`.

ADR-062 (Proposed, not established) answers the array half of this question by inference,
falling back to "mutable" with a note. With a declared `mut` there is nothing to infer, so
adopting this ADR means revisiting ADR-062 rather than implementing it as written.

### Q5: Callbacks (ADR-029)

**Recommendation:** `mut` is part of the function-as-type signature and comes from the
declaration only. A function assigned to a callback type matches its parameters' `mut`
exactly, the same way it already matches type and `const` (E0879). This removes #1529's
class of defect: two identical declarations always have one pointer type.

### Q6: Generated signatures (ADR-006)

**Recommendation**, decided by the declaration alone:

| Parameter    | Read-only (default)     | `mut`             |
| ------------ | ----------------------- | ----------------- |
| scalar       | `uint32_t v` (by value) | `uint32_t* v`     |
| struct (C)   | `const Point* p`        | `Point* p`        |
| struct (C++) | `const Point& p`        | `Point& p`        |
| array        | `const uint8_t data[4]` | `uint8_t data[4]` |

Still open: whether a read-only by-value scalar is emitted `const uint32_t v`. It changes
nothing a caller can observe; it does change the generated C for every read-only scalar
parameter, where today only the ones written `const` carry it.

### Q7: Parameters only

**Recommendation: yes.** A parameter is an interface — the caller is affected by whether it is
written, and the signature is what a C caller links against. A local, a global or a scope
member is visible to the code that declares it, and ADR-013's opt-in `const` serves it.

### Q8: Can the migration be automated?

**Recommendation: yes, and it was measured.** The rewrite is: add `mut` to every written
parameter (300 in the corpus) and delete `const` from every parameter that has it (120). The
analysis that produced those counts is the one that would drive the rewrite. The 44 written
parameters in error-expecting fixtures need review rather than the rewrite: the 11 that assert
E0877 on a `const` parameter become fixtures for Q2's diagnostic (drop `const`, add nothing).

### Q9: Which release

**Recommendation: `0xx` — before v1.** It breaks every program that writes a parameter. Before
v1 that is a minor-version change with a mechanical rewrite; after v1 it is a v2 break.
The cost: a `0xx` ADR gates v1, so v1 waits for this to be implemented or rejected.
The number `071` assumes this answer; choosing `1xx` renumbers the ADR.

## Diagnostics

None allocated. If the proposal is adopted, Q1 needs one code (redundant `const` on a
parameter), Q2 needs two (a write to a parameter not declared `mut`, including forwarding
one; a `mut` nothing writes), and Q3 changes what E0878 means. The implementation issue
allocates each code with its fixture.

| Code | Meaning | Asserted by |
| ---- | ------- | ----------- |

## Scope-Context Matrix (#1219)

Every cell can occur. A parameter write or a forwarding call happens inside a function or a
scope method. A call into a `mut` parameter also happens in a global or scope-member
initializer: today's E0878 fires there (`u32 g <- twice(LIMIT);` at file scope and inside a
scope both report it), and Q3 changes that diagnostic.

Every cell is `warn`: the decision is not made, so nothing implements it and no fixture can
occupy a cell. The implementation issue promotes each to `error` with its fixture.

<!-- MATRIX-SEVERITY -->

| Context            | Relationship        | Severity |
| ------------------ | ------------------- | -------- |
| global variable    | same file           | warn     |
| top-level function | same file           | warn     |
| scope member       | same file           | warn     |
| scope method       | same file           | warn     |
| global variable    | imported direct     | warn     |
| top-level function | imported direct     | warn     |
| scope member       | imported direct     | warn     |
| scope method       | imported direct     | warn     |
| global variable    | imported transitive | warn     |
| top-level function | imported transitive | warn     |
| scope member       | imported transitive | warn     |
| scope method       | imported transitive | warn     |

## Consequences

- **Breaking.** Every program that writes a parameter stops compiling until the parameter says
  `mut`; every parameter written `const` stops compiling until the `const` is removed. In the
  corpus that is 300 and 120 parameters (Context).
- **The common case gets shorter.** 1102 corpus parameters are already read-only and unmarked;
  they keep their spelling and gain a guarantee they did not have.
- **A constant can be passed to a read-only function** without the callee writing `const`.
- **Signatures stop depending on bodies**, so a change inside a function body can no longer
  change its C prototype, its header, or its callback type.
- **ADR-013's Alternative 1** — rejected then as too aggressive — is what this revisits. If it is
  adopted, ADR-013's parameter rules (Q1 and Q4 there) are superseded for parameters only.
- **ADR-062** would need revisiting (Q4).

## References

- #2099 — the exploration card; the measurement and how to reproduce it are recorded there
- #2100 — ADR-013's auto-const section is out of date; read it before ADR-013
- #1529 — callback typedef takes its `const` from auto-const
- ADR-013 Alternative 1 and Q5 — the previous rejection of default immutability
- `tests/adr-013/const-param-assign-error.test.cnx` — E0877 on a written `const` parameter
- MISRA C:2012 Rule 8.13 — a pointer should point to a const-qualified type whenever possible
