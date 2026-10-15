# ADR-071: Read-Only by Default (`mut`)

**Status:** Accepted
**Date:** 2026-10-15
**Decision Makers:** Language Design Team
**Related ADRs:** ADR-006 (Simplified References), ADR-013 (Const Qualifier), ADR-029 (Function Pointers), ADR-061 (C Library Interop)
**Related Issues:** #2099 (this ADR), #2100 (ADR-013 out of date with the shipped auto-const behavior), #1529 (callback typedef takes its `const` from the body), #986 (array parameters lost auto-`const`)

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

### Most bindings are never written

Measured over the conformance corpus (every `.cnx` under `tests/` and `examples/`, 1982
files) with the transpiler's own analysis, not a text search: for a parameter, the
direct-and-transitive answer that decides the generated signatures above; for every other
binding, the binder that decides which declaration each assignment target, `safe_div`/
`safe_mod` output and call argument names, with a call argument counted as a write when the
C-Next callee writes that parameter. Parameters were counted in the 1942 files that reach
whole-program analysis; other bindings in the 1449 that reach the const check (the other 533
are 519 fixtures that stop at an earlier error and 14 helpers that do not transpile alone).

| Binding        | Declared | Written (needs `mut`) | — only through a call | Declared `const` | Neither written nor `const` |
| -------------- | -------: | --------------------: | --------------------: | ---------------: | --------------------------: |
| parameter      |     1511 |                   300 |                    73 |              120 |                        1102 |
| local          |     5139 |                  1142 |                   121 |               40 |                        3958 |
| `for` variable |      239 |                   237 |                     0 |                0 |                           2 |
| global         |     1139 |                   413 |                     4 |              273 |                         474 |
| scope member   |      449 |                   192 |                     1 |              101 |                         158 |
| **all**        | **8477** |              **2284** |               **199** |          **534** |                    **5694** |

- 20 of the 73 parameters written only through a call are written through a callee that is
  not C-Next (a C/C++ header).
- 35 bindings are both written and `const`; they are the fixtures that assert E0877.
- 97 more bindings are passed to a C/C++ function or a builtin and written nowhere else. Each
  needs `mut` only if that parameter is a non-`const` pointer, which the count does not
  decide; it is an upper bound, not part of the 2284.

So a declaration that says nothing is already read-only two times in three. Today that
guarantee is unstated; `const` is written on 534 of the 5694 + 534 read-only bindings.

A control in the same runs confirmed the analysis reports a direct write, a write through a
call, a `this.` write to a scope member, a `for` update and a global write as written, and
an unwritten parameter, local, global and scope member as not written.

## Decision

**Accepted by the owner on 2026-10-15** (#2099): adopt, before v1, for every binding, and
`const` is no longer written.

1. Every binding is **read-only by default**: parameters, locals, `for` variables, globals and
   scope members.
2. A binding that is written — assigned, used as a `safe_div`/`safe_mod` output, or passed to
   a parameter that is written — is declared **`mut`**. Writing a binding that is not `mut`
   is a compile error.

   ```cnx
   u32 LIMIT <- 5;                       // read-only: no keyword

   void readOnly(u32 value) { u32 local <- value; }
   void bump(mut u32 v) { v <- v + 1; }  // written: says so

   void tick() {
       mut u32 count <- 0;
       count <- count + 1;
       readOnly(LIMIT);                  // compiles
   }
   ```

3. A parameter's generated signature follows its declaration, not the body.
4. This is `0xx` work: it ships before v1.
5. `const` on a declaration is a compile error ("`const` is the default; remove it").
6. A `mut` that nothing writes is a compile error ("'v' is never written; remove `mut`"),
   except where the `mut` is fixed by something outside the body: a function used as a
   callback type (ADR-029), whose `mut` is part of the type its implementations match, and a
   global that C code writes.

Rejected:

- **Parameters only.** Explored first; the owner widened it so one rule covers every binding.
- **Keeping the body-derived inference as the language rule.** It is what produces the three
  problems in Context; the analysis stays, but as a check on the declaration, not as its
  substitute.
- **Ada-style `in` / `out` / `inout` modes.** ADR-013 Alternative 2 already weighed them;
  `mut` adds one keyword where modes add three and an `out` rule C has no way to express.

## Open Questions

Each is from #2099 and is the owner's to answer. A recommendation is not a decision.

### Q1: `const`, once it is the default — decided

An error (Decision 5). The rewrite in Q8 removes all 534 mechanically, so a warning or a
migration window would protect no code.

### Q2: Writing a binding that is not `mut`, and a `mut` that is never needed — decided

**Recommendation: a new diagnostic for the write**, not E0877. E0877's help is "remove `const`",
which is the wrong advice when there is no `const` to remove:

```text
error[E08xx]: cannot assign to 'count': bindings are read-only unless declared `mut`
       help: declare it `mut u32 count` if it must change
```

**A `mut` that nothing writes is also an error** (Decision 6), so a declaration never claims
more than the code needs — with two exemptions:

- a function used as a callback type (ADR-029): its body is the default and is often empty,
  while the functions assigned to it may write; its `mut` is part of the type;
- a global another language writes: a C-Next global a C file or an interrupt handler written
  in C assigns is written in no C-Next code, so the analysis would call its `mut` unused.

### Q3 and Q4: Passing a binding to a parameter that writes

```cnx
const u32 LIMIT <- 5;                // today's spelling
void sink(mut u32 v) { v <- 1; }
void forward(u32 v) { sink(v); }     // forward's v is read-only
```

**Recommendation: one rule.** Passing a binding to a `mut` parameter writes it, so the binding
must be `mut`, with Q2's diagnostic. E0878 ("cannot pass const ... to non-const parameter")
becomes that diagnostic: there is no longer a "non-const" parameter that is not `mut`, so the
`LIMIT` call in Context compiles and `sink(LIMIT)` is the error. The same applies to a C/C++
parameter that is a non-`const` pointer (ADR-061): 20 parameters are writable today only for
that reason, and up to 97 other bindings are passed to C/C++ or builtin parameters.

A callee nothing declares does not reach this rule: calling a function with no C-Next
definition and no header declaration is already an error (E0422, "function 'g' called before
definition"), so every call has a signature to check.

ADR-062 (Proposed, not established) answers the array half of this by inference, falling back to
"mutable" with a note. With a declared `mut` there is nothing to infer, so ADR-062 is revisited
rather than implemented as written.

### Q5: Callbacks (ADR-029)

**Recommendation:** `mut` is part of the function-as-type signature and comes from the
declaration only. A function assigned to a callback type matches its parameters' `mut` exactly,
the same way it already matches type and `const` (E0879). This removes #1529's class of defect:
two identical declarations always have one pointer type.

### Q6: Generated C

**Recommendation for parameters**, decided by the declaration alone:

| Parameter    | Read-only (default)     | `mut`             |
| ------------ | ----------------------- | ----------------- |
| scalar       | `uint32_t v` (by value) | `uint32_t* v`     |
| struct (C)   | `const Point* p`        | `Point* p`        |
| struct (C++) | `const Point& p`        | `Point& p`        |
| array        | `const uint8_t data[4]` | `uint8_t data[4]` |

Still open, for parameters and every other binding alike: whether a read-only binding is
emitted with C's `const` (`const uint32_t LIMIT = 5U;`, `const uint32_t v`). For a global it is
what a C file including the header sees, and MISRA C:2012 Rule 8.13 asks for it on pointed-to
types. Emitting it everywhere changes the generated C of every unmarked read-only binding —
5694 in the corpus.

### Q7: Which bindings — decided

All of them (Decision 1).

### Q8: Can the migration be automated?

**Recommendation: yes, and it was measured.** The rewrite is: add `mut` to every written binding
(2284 in the corpus) and delete `const` from every binding that has it (534). The analysis that
produced those counts is the one that would drive the rewrite. The 97 bindings passed only to
C/C++ or builtin parameters need that parameter's signature first. The written bindings in
error-expecting fixtures (130) need review rather than the rewrite: the 35 that assert E0877 on a
`const` binding become fixtures for Q2's diagnostic (drop `const`, add nothing).

### Q9: Which release — decided

`0xx`: before v1 (Decision 4).

## Diagnostics

None allocated yet. Q1 needs one code (`const` on a declaration), Q2 needs two (a write to a
binding that is not `mut`, including passing it to a `mut` parameter; a `mut` nothing writes),
and Q3 retires or redefines E0878. The implementation issue allocates each code with its fixture.

| Code | Meaning | Asserted by |
| ---- | ------- | ----------- |

## Scope-Context Matrix (#1219)

Every cell can occur. A global or a scope member is declared in one file and written from a
function or scope method in the same file, in a file that includes it directly, or in one that
includes it transitively; its `mut` sits in the declaring file. A call into a `mut` parameter
also happens in a global or scope-member initializer: today's E0878 fires there
(`u32 g <- twice(LIMIT);` at file scope and inside a scope both report it), and Q3 changes it.

Every cell is `warn` until the implementation lands: nothing enforces this ADR yet and no
fixture can occupy a cell. The implementation issue promotes each to `error` with its fixture.

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

- **Breaking, everywhere.** Every program that writes any binding stops compiling until the
  binding says `mut`, and every `const` stops compiling until it is removed (Decision 5).
  In the corpus that is 2284 and 534 declarations (Context).
- **The common case gets shorter.** 5694 corpus bindings are already read-only and unmarked; they
  keep their spelling and gain a guarantee they did not have.
- **A constant can be passed to a read-only function** without the callee writing `const`.
- **Signatures stop depending on bodies**, so a change inside a function body can no longer
  change its C prototype, its header, or its callback type.
- **ADR-013 is superseded once this is implemented.** Its Alternative 1 — default immutability,
  rejected then as too aggressive for C developers — is what this adopts; its opt-in `const`
  is what this replaces.
- **ADR-062** is revisited (Q3 and Q4).
- **Learning C-Next:** every tutorial and example that writes a variable changes.

## References

- #2099 — the decision, the measurement and how to reproduce it
- #2100 — ADR-013's auto-const section is out of date; read it before ADR-013
- #1529 — callback typedef takes its `const` from auto-const
- ADR-013 Alternative 1 and Q5 — the previous rejection of default immutability
- `tests/adr-013/const-param-assign-error.test.cnx` — E0877 on a written `const` parameter
- MISRA C:2012 Rule 8.13 — a pointer should point to a const-qualified type whenever possible
