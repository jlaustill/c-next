# ADR-063: Identifier Syntax

**Status:** Accepted
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

Injectivity therefore requires constraining the separator's **left** boundary — a component may not end with `_` — in addition to forbidding runs. That is what this ADR does. Notably the _right_ boundary needs no constraint; see "Why leading underscores are permitted".

### Alternatives considered

| Option                                           | Injective | Cost                                                                                                                            |
| ------------------------------------------------ | --------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Collision diagnostic only                        | n/a       | Rejects well-formed programs; punishes the user for a codegen artifact                                                          |
| `s_` prefix on scope members                     | **No**    | Fixes class 1 only; class 2 still collides (`s_A_B_c`)                                                                          |
| `__` separator, forbid only `__` in identifiers  | **No**    | Boundary underscores still collide (`A_`/`B` vs `A`/`_B`)                                                                       |
| Forbid `_` in identifiers entirely               | Yes       | Breaks `SysTick_Handler` (ARM vector table), 162 corpus files, and C-Next's own `byte_length`/`safe_div` builtins               |
| Forbid leading, trailing **and** consecutive `_` | Yes       | Correct, but needlessly strict — breaks the `_handler` private-member idiom (ADR-029) for no additional guarantee               |
| Length-prefixed components (`s_3Reg5flags`)      | Yes       | No naming restriction, but generated C becomes unreadable — works against the generated C being a review/certification artifact |
| **Forbid trailing and consecutive `_` (chosen)** | **Yes**   | **0 existing identifiers violate the rule**                                                                                     |

## Decision

**A C-Next identifier may not end with `_`, and may not contain two or more consecutive underscores.**

Stated against the existing lexer rule, which is unchanged:

```
IDENTIFIER : [a-zA-Z_] [a-zA-Z0-9_]*      // grammar/CNext.g4, unchanged

constraints:
  1. must not contain "__"
  2. must not end with "_"
```

Expressing this as a single production is easy to get subtly wrong — it must admit
`_1count` (a leading underscore followed by a digit, which the lexer accepts) while
rejecting `__a`, and it must not admit a leading digit. The two constraints above
are the normative statement; anything deriving the same language is equivalent.

A **leading** underscore remains legal — see "Why leading underscores are permitted" below.

This reserves `__` exclusively for the transpiler, which uses it as the **qualified-name separator** at every qualification level (ADR-016, ADR-017).

### Why this is injective

Let `S` and `M` be identifiers satisfying the rule, and let the qualified name be `S__M`.

Suppose the same string admits two different splits, `X = S₁__M₁ = S₂__M₂`, with `|S₁| < |S₂|`. The separator of split 1 occupies positions `|S₁|` and `|S₁|+1`, both underscores. If `|S₂| ≥ |S₁|+2`, then `S₂` would contain both of those positions — i.e. `S₂` would contain `__`, which the rule forbids. So `|S₂| = |S₁|+1`, which makes `S₂ = S₁ + "_"` — an identifier ending in an underscore, also forbidden. Both cases contradict the rule, so the split is unique. ∎

The argument extends unchanged to any number of components (`Scope__Enum__MEMBER`).

Additionally, a plain identifier can never collide with a qualified one: a qualified name contains `__`, and the rule forbids `__` in any identifier.

### Why leading underscores are permitted

The proof above constrains only the **left** boundary of the separator — it needs `S` not to end with `_`, and needs neither component to contain `__`. What `M` _begins_ with never enters the argument. Forbidding a leading underscore would therefore restrict the language without buying any additional guarantee.

This matters in practice: a leading underscore marking a private struct member is an established C-Next idiom, taught in `docs/language-guide.md` and used throughout ADR-029 (Function Pointers):

```cnx
struct Controller {
    onReceive _handler;    // type is onReceive, initialized to default
}
```

Permitting it keeps ADR-029 and the language guide correct as written, and reduces the migration cost of this ADR to zero.

### Enforcement: semantic, not lexical

The grammar above is **specification, not implementation**. The rule is enforced by a semantic analyzer (`IdentifierSyntaxAnalyzer`, diagnostic E0201), and the `IDENTIFIER` lexer rule in `grammar/CNext.g4` stays permissive. Three reasons:

1. **Diagnostic quality.** `CNextSourceParser` forwards ANTLR messages verbatim, so a lexer rejection surfaces as `token recognition error at: '_'` followed by cascading parser errors — with no error code, no source-accurate location for the identifier, and no `help:` line. An ADR that defines an error code has already implicitly chosen semantic enforcement.
2. **The C-interop carve-out.** The analyzer checks only _declaration_ contexts. A C-Next file that _calls_ an external symbol such as `__disable_irq()` or `_exit()` is untouched, which is exactly the scope this ADR specifies. A lexer rule cannot make that distinction.
3. **Cost.** A grammar change forces `npm run antlr:all` and re-committing the generated parser sources, for no benefit here.

Preprocessor directive tokens (`#define`, `#ifdef`, `#ifndef`, `#pragma target`) embed their own identifier character classes in the grammar and are deliberately **not** covered by this rule, so include guards such as `#ifndef __MY_GUARD__` continue to work.

### Scope of the rule

- Applies to **identifiers declared in C-Next source**: variables, parameters, functions, scopes, structs and their fields, enums and their members, bitmaps, registers.
- Does **not** apply to symbols referenced from included C/C++ headers. Those names come from the C world, are emitted verbatim, and never participate in qualified-name construction (ADR-010). Calling `HAL_GPIO_Init()` or `strncpy()` is unaffected.

### What remains legal

The rule is deliberately narrow. Every one of these is still valid:

| Identifier        | Why it matters                                         |
| ----------------- | ------------------------------------------------------ |
| `tick_count`      | ordinary `snake_case`                                  |
| `CONTROL_REG`     | register naming in the existing corpus                 |
| `SysTick_Handler` | ARM Cortex-M vector table — the name is not negotiable |
| `byte_length`     | C-Next's own built-in properties (ADR-058)             |
| `safe_div`        | C-Next's own built-in functions (ADR-051)              |
| `_handler`        | private-member idiom taught in ADR-029                 |

### Migration cost

Every identifier token in `tests/` and `examples/` was extracted (comments and string literals stripped) and checked against the rule — **4541 distinct identifiers**:

| Pattern          | Occurrences    | Legal under this rule |
| ---------------- | -------------- | --------------------- |
| Trailing `_`     | 0              | no                    |
| Consecutive `__` | 0              | no                    |
| Leading `_`      | 1 (`_handler`) | **yes**               |

**No existing C-Next source requires renaming.**

An earlier revision of this ADR also forbade leading underscores and claimed zero violations on that basis. That claim was incorrect — `_handler` appears in three callback tests, in `docs/language-guide.md`, and 21 times in ADR-029. Since the injectivity proof does not depend on the leading position (see above), the rule was relaxed rather than the corpus migrated.

### Alignment with C and C++

The forbidden patterns are already reserved or discouraged outside C-Next:

- **C11 §7.1.3** — identifiers beginning with `_` followed by an uppercase letter or another `_` are reserved for any use. Forbidding `__` covers the `__`-prefixed half of this.
- **C++ §lex.name/3.2** — identifiers containing `__` _anywhere_ are reserved to the implementation.
- **MISRA C:2012 Rule 21.2** — a reserved identifier shall not be declared.

C11 §7.1.3 additionally reserves identifiers beginning with a single `_` **at file scope**. This rule permits them, which is a deliberate narrowing: the motivating use (`_handler`, ADR-029) is a _struct member_, and member names are not file-scope identifiers, so no reserved name is emitted. A leading-underscore **global** would emit a file-scope reserved identifier — see Open Questions.

For **C output the rule is a net improvement**: C reserves only identifiers that _begin_ with `__`, and `Scope__member` does not.

For **`--cpp` output it is a regression, and the tradeoff is accepted deliberately.** C++ reserves every identifier _containing_ `__`, so every scope function, scope variable, enum member, bitmap and register emitted in C++ mode is now implementation-reserved. Before this ADR the only way to produce one was a user writing `my__var` — which occurs zero times in the 4541-identifier corpus. Confirmed with the toolchain this repo already ships:

```
$ clang-tidy rid.cpp -checks='-*,bugprone-reserved-identifier' -- -std=c++14
warning: declaration uses identifier 'S__buf', which is a reserved identifier
warning: declaration uses identifier 'S__init', which is a reserved identifier
$ clang-tidy rid.c   -checks='-*,bugprone-reserved-identifier' -- -std=c99
(nothing)
```

Nothing breaks and nothing miscompiles: no real toolchain collides with these names, and `npm run validate:c` does not flag it (`batch-validate.mjs` passes no `-checks=`, and the repo has no `.clang-tidy`). It is a conformance property of the generated artifact, and it matters for MISRA C++:2008 17-0-1 / AUTOSAR M17-0-1.

C is C-Next's primary target and the injectivity argument is language-independent, so the separator is not re-litigated over this. The clean long-term fix for C++ mode is to emit real `namespace Scope { }` blocks so the flat name never reaches a C++ translation unit — see Open Questions.

## Diagnostic

**E0201** — identifier violates the underscore rule.

Actual output, as asserted by `tests/analysis/identifier-*-underscore.expected.error`:

```
error[E0201]: Identifier 'value_' cannot end with an underscore. A trailing
underscore would make scope-qualified names ambiguous in generated C.

error[E0201]: Identifier 'my__value' cannot contain consecutive underscores.
'__' is reserved as the separator for scope-qualified names in generated C.
```

Each error also carries a `helpText` suggesting a legal name, but that field is
dropped before reaching the user (see Open Questions) so it does not appear above.

Reported for a trailing underscore or two or more consecutive underscores. Emitted by `IdentifierSyntaxAnalyzer` over declaration contexts only; references to external C/C++ symbols are not checked.

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

- Should `--cpp` mode emit real `namespace Scope { }` blocks instead of the flat `Scope__member` name? That would remove the C++ reserved-identifier consequence described above entirely, since the flat form would never reach a C++ translation unit. Larger change, and orthogonal to injectivity — C output is unaffected either way.
- Should a **file-scope** identifier be permitted to begin with `_`? C11 §7.1.3 reserves those, so a leading-underscore global emits a reserved C identifier. The motivating idiom (`_handler`) is a struct member and is unaffected, so this rule does not restrict it — but a narrower "leading `_` on globals only" check could be added later without affecting injectivity.

Live diagnostics in the VS Code extension are tracked separately: every transpiler diagnostic should surface in the editor, not only E0201 — see [jlaustill/vscode-c-next#8](https://github.com/jlaustill/vscode-c-next/issues/8). That issue also captures a prerequisite in this repo: `collectErrors()` currently drops `code` and `helpText` when mapping to `ITranspileError`, so `helpText` never reaches users today.

## References

- Issue #1117 — Scope name qualification collides with the global namespace
- ADR-016 (Scopes), ADR-017 (Enums), ADR-057 (Implicit Scope Resolution), ADR-010 (C Interoperability)
- ISO/IEC 9899:2011 §7.1.3; ISO/IEC 14882 §lex.name/3; MISRA C:2012 Rule 21.2
