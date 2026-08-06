# ADR-063: Identifier Syntax

**Status:** Research
**Date:** 2026-08-05
**Decision Makers:** Language Design Team
**Related ADRs:** ADR-016 (Scopes — consumes this rule for `Scope__member`), ADR-017 (Enums — consumes this rule for member naming), ADR-057 (Implicit Scope Resolution), ADR-010 (C Interoperability)

## Context

C-Next builds the C name of a scope member by joining the scope name and the member name with an underscore (ADR-016: "Members become `Scope_member` in generated C"). Enums do the same for their members (ADR-017: `Motor_State_IDLE`).

Because `_` is also a legal character _inside_ an identifier, that join is **not injective** — distinct C-Next declarations can produce the same C identifier. Issue #1117 documents two independent ways this happens, both of which transpile with exit 0 and then fail in the C compiler.

**Collision class 1 — a global collides with a scope member:**

```cnx
u8 Reg_flags <- 99;

scope Reg {
    u8 flags <- 7;
}
```

```c
uint8_t Reg_flags = 99U;          /* the global */
static uint8_t Reg_flags = 7U;    /* the scope member — same identifier */
```

```
error: redefinition of 'Reg_flags'
```

**Collision class 2 — two scopes collide with each other:**

```cnx
scope A_B { u8 c <- 1;   u8 readIt() { return c; } }
scope A   { u8 B_c <- 2; u8 readIt() { return B_c; } }
```

Both members become `A_B_c`. Worse than the duplicate definition, `A_readIt()` is generated as `return A_B_c;` — it silently reads the _other scope's_ variable. The duplicate definition is caught here only because both landed in one translation unit.

The failure lands in the C compiler (or, in class 2, does not land at all), not in the transpiler. This directly contradicts C-Next's purpose: scopes exist precisely so that `Reg.flags` and a global `Reg_flags` can coexist as distinct things.

### Why a diagnostic is the wrong fix

The obvious response — detect the collision and emit an error — was considered and rejected. It imports a C limitation into C-Next and makes the programmer responsible for working around an artifact of the code generator. A user who writes a global `Reg_flags` and an unrelated `scope Reg` has written two unambiguous, well-formed declarations; refusing them is a defect in the name generation, not in the program.

### Why a longer separator alone is insufficient

Switching the separator to `__` and forbidding `__` inside identifiers is closer, but still not injective. Underscores at a component _boundary_ defeat it:

```cnx
scope A_ { u8 B;  }   /* "A_" + "__" + "B"  = A___B */
scope A  { u8 _B; }   /* "A"  + "__" + "_B" = A___B */
```

Neither `A_` nor `_B` contains consecutive underscores, so both pass such a check, and both still collide. (Verified against the transpiler: under today's single-underscore separator both emit `A__B`.)

Injectivity therefore requires constraining underscores at the boundaries as well as in runs — which is what this ADR does.

### Alternatives considered

| Option                                              | Injective | Cost                                                                                                                            |
| --------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Collision diagnostic only                           | n/a       | Rejects well-formed programs; punishes the user for a codegen artifact                                                          |
| `s_` prefix on scope members                        | **No**    | Fixes class 1 only; class 2 still collides (`s_A_B_c`)                                                                          |
| `__` separator, forbid `__` in identifiers          | **No**    | Boundary underscores still collide (`A_`/`B` vs `A`/`_B`)                                                                       |
| Forbid `_` in identifiers entirely                  | Yes       | Breaks `SysTick_Handler` (ARM vector table), 162 corpus files, and C-Next's own `byte_length`/`safe_div` builtins               |
| Length-prefixed components (`s_3Reg5flags`)         | Yes       | No naming restriction, but generated C becomes unreadable — works against the generated C being a review/certification artifact |
| **Underscores interior and single, `__` separator** | **Yes**   | **0 existing identifiers violate the rule**                                                                                     |

## Decision

**An underscore in a C-Next identifier must sit between two alphanumeric characters.**

```
IDENTIFIER : [A-Za-z] [A-Za-z0-9]* ('_' [A-Za-z0-9]+)*
```

Equivalently, an identifier may not begin with `_`, may not end with `_`, and may not contain two or more consecutive underscores.

This reserves `__` exclusively for the transpiler, which uses it as the **qualified-name separator** at every qualification level (ADR-016, ADR-017).

### Why this is injective

Let `S` and `M` be identifiers satisfying the rule, and let the qualified name be `S__M`.

- Neither `S` nor `M` contains `__` (no two consecutive underscores).
- `S` does not end with `_`, so the character preceding the separator is alphanumeric.
- `M` does not begin with `_`, so the character following the separator is alphanumeric.

Therefore `S__M` contains **exactly one** occurrence of `__`, and it is the separator. The split is unique, so `(S, M) → S__M` is injective. The argument extends unchanged to any number of components (`Scope__Enum__MEMBER`).

Additionally, a plain identifier can never collide with a qualified one: a qualified name contains `__`, and the rule forbids `__` in any identifier.

### Scope of the rule

- Applies to **identifiers declared in C-Next source**: variables, parameters, functions, scopes, structs and their fields, enums and their members, bitmaps, registers.
- Does **not** apply to symbols referenced from included C/C++ headers. Those names come from the C world, are emitted verbatim, and never participate in qualified-name construction (ADR-010). Calling `HAL_GPIO_Init()` or `strncpy()` is unaffected.

### What remains legal

The rule is deliberately narrow. Every one of these is still valid:

| Identifier        | Why it matters                                         |
| ----------------- | ------------------------------------------------------ |
| `tick_count`      | ordinary snake_case                                    |
| `CONTROL_REG`     | register naming in the existing corpus                 |
| `SysTick_Handler` | ARM Cortex-M vector table — the name is not negotiable |
| `byte_length`     | C-Next's own built-in properties (ADR-058)             |
| `safe_div`        | C-Next's own built-in functions (ADR-051)              |

A survey of the full corpus (1078 `.cnx` files across `tests/` and `examples/`) found **zero** identifiers with a leading underscore, a trailing underscore, or consecutive underscores. The rule costs no migration.

### Alignment with C and C++

The forbidden patterns are already reserved or discouraged outside C-Next:

- **C11 §7.1.3** — identifiers beginning with `_` followed by an uppercase letter or another `_` are reserved for any use; identifiers beginning with `_` are reserved at file scope.
- **C++ §lex.name/3** — identifiers containing `__` _anywhere_ are reserved to the implementation. C-Next currently passes `my__var` straight through, so `--cpp` output today declares reserved identifiers.
- **MISRA C:2012 Rule 21.2** — a reserved identifier shall not be declared.

The rule therefore removes an existing standards-compliance defect rather than introducing a new restriction.

## Diagnostic

**E0201** — identifier violates the underscore rule.

```
E0201: identifier '_value' may not begin with an underscore
  help: underscores must sit between alphanumeric characters (e.g. 'someValue' or 'some_value')
```

Reported for a leading underscore, a trailing underscore, or two or more consecutive underscores.

## Consequences

### Breaking

Generated C symbol names change, because the qualified-name separator becomes `__`:

| Before             | After                |
| ------------------ | -------------------- |
| `Motor_init`       | `Motor__init`        |
| `Reg_flags`        | `Reg__flags`         |
| `Motor_State_IDLE` | `Motor__State__IDLE` |
| `State_IDLE`       | `State__IDLE`        |

Every `.expected.c` / `.expected.h` snapshot regenerates, and any C or C++ that calls into C-Next must be updated to the new symbol names. This break is unavoidable for any fix in this area; this is the smallest form of it, since no C-Next source needs to change.

### Non-breaking

- No existing C-Next identifier requires renaming.
- Both collision classes in #1117 become unrepresentable rather than diagnosed.
- Issue #1117's second defect — bare `Reg_flags` resolving to the scope member `Reg.flags` — is resolved as a consequence. The type registry is keyed by the qualified name; once that key is `Reg__flags`, a source-level `Reg_flags` no longer matches it, so generated naming stops leaking into the source namespace (ADR-057).

## Open Questions

- Should the VS Code extension (`vscode-c-next`) surface E0201 as a live diagnostic, or is transpile-time reporting sufficient?
- C-Next's built-in vocabulary is snake*case (`byte_length`, `safe_div`, `char_count`, `element_count`). The rule permits this, so there is no conflict — but whether the language \_should* prefer camelCase builtins for internal consistency is a separate question, deliberately out of scope here.

## References

- Issue #1117 — Scope name qualification collides with the global namespace
- ADR-016 (Scopes), ADR-017 (Enums), ADR-057 (Implicit Scope Resolution), ADR-010 (C Interoperability)
- ISO/IEC 9899:2011 §7.1.3; ISO/IEC 14882 §lex.name/3; MISRA C:2012 Rule 21.2
