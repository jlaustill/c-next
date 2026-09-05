# ADR-063: Identifier Syntax and the Reserved Transpiler Namespace

**Status:** Accepted
**Date:** 2026-08-05 (amended 2026-08-07 — reserved `cnx_` prefix, include-guard construction)
**Decision Makers:** Language Design Team
**Related ADRs:** ADR-016 (Scopes — consumes this rule for `Scope__member`), ADR-017 (Enums — consumes this rule for member naming), ADR-057 (Implicit Scope Resolution), ADR-010 (C Interoperability), ADR-105 (Prefixed Includes — would make filenames qualified-name components)

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

**Collision class 3 — a transpiler-invented name collides with a user name.** _(Added by the 2026-08-07 amendment; issues #1131, #1133.)_

The transpiler emits names no user wrote: loop and slice temporaries, a `strlen` cache, overflow helpers, include guards. Historically each family invented its own spelling, and three of the four chose shapes a user is allowed to declare:

| Family                  | Shape                   | Collides with user source |
| ----------------------- | ----------------------- | ------------------------- |
| `strlen` cache          | `_<var>_len`            | **yes** (#1131)           |
| slice-assignment unroll | `_tmp<N>`               | **yes** (#1131)           |
| argument temporary      | `_cnx_tmp_<N>`          | **yes**                   |
| overflow helper         | `cnx_clamp_<op>_<type>` | no                        |
| include guard           | `<BASENAME>_H`          | **yes** (#1133 cause 3)   |

Verified in #1131: a user global `_msg_len` is shadowed by the generated `strlen` cache, and every subsequent read binds to the wrong storage — `gcc -std=c99 -Wall -Wextra` completely clean, transpiler exit 0, expected 47 and got 10.

This class is **not** addressed by the underscore rule below. That rule makes the _join_ injective; it says nothing about whether a generated name is distinguishable from a declared one. The two are independent problems and need independent mechanisms — see "Why the reserved prefix does not replace the underscore rule".

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

Separately, for keeping transpiler-invented names out of the user's namespace (collision class 3):

| Option                                                      | Disjoint | Cost                                                                                                                                |
| ----------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Leave as-is (`_tmp<N>`, `_<var>_len`)                       | **No**   | Silent miscompiles, verified in #1131                                                                                               |
| Spell injected names with `__` to make them unrepresentable | Yes      | Zero migration cost, but overloads the qualified-name separator to mean "not a qualified name"; worsens C++ `lex.name/3.2` exposure |
| Gensym — scan the file and pick a free name                 | Yes      | Output depends on unrelated source content, so an edit elsewhere renames temporaries; hostile to reviewable diffs                   |
| **Reserved `cnx_` prefix (chosen)**                         | **Yes**  | **0 existing user identifiers violate the rule; already the convention for overflow helpers**                                       |

And for making the include guard collision-free (#1133):

| Option                                                 | Injective                         | Cost                                                           |
| ------------------------------------------------------ | --------------------------------- | -------------------------------------------------------------- |
| Basename, uppercased (status quo)                      | **No**                            | Silently skips a header; verified wrong runtime value          |
| `#pragma once`                                         | Yes                               | Not ISO C; hostile to the MISRA certification posture          |
| Path + hash of the true path                           | In practice                       | `CNX_CAN_CONFIG_A3F19B2E_H` — unreadable artifact              |
| Escape-encoded, case-preserved                         | Yes                               | `CNX_can_1config_H` — unreadable, breaks macro-case convention |
| **Full relative path + collision diagnostic (chosen)** | **Yes, by rejecting the residue** | **Readable; rejects only genuinely confusable filenames**      |

## Decision

Two independent rules. **Part 1** makes the qualified-name join injective; **part 2** keeps the transpiler's own names out of the user's namespace. Neither implies the other.

### Part 1 — the underscore rule

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

### Part 2 — the reserved transpiler namespace

**An identifier declared in C-Next source may not begin with `cnx_`, compared case-insensitively.**

That reserves the entire `cnx_` / `CNX_` / `Cnx_` … space for the transpiler. Every name the transpiler invents — one that corresponds to no user declaration — is spelled with it:

| Family          | Name                    | Notes                                               |
| --------------- | ----------------------- | --------------------------------------------------- |
| overflow helper | `cnx_clamp_<op>_<type>` | unchanged — already conformed before this amendment |
| temporary       | `cnx_tmp<N>`            | replaces both `_tmp<N>` and `_cnx_tmp_<N>`          |
| `strlen` cache  | `cnx_len_<var>`         | replaces `_<var>_len`                               |
| include guard   | `CNX_<PATH>_H`          | see "Include guards" below                          |

**Prefix-only.** `my_cnx_buffer` is legal; only the leading position is reserved. A prefix is what makes the namespaces disjoint, so that is all the rule constrains.

**Case-insensitive**, for two reasons. Include guards are uppercase by universal C convention while identifiers are not, so a case-insensitive rule covers both with one statement instead of two. And it forecloses the confusing near-miss: `Cnx_state` would otherwise be legal, read as transpiler output to every reviewer, and be neither.

**Declaration contexts only**, exactly as part 1 (see "Scope of the rule"). A C-Next file that _calls_ an external C symbol named `cnx_foo()` is untouched.

### Why the reserved prefix does not replace the underscore rule

The two parts look similar and are often conflated. They are not interchangeable, and neither can be dropped in favour of the other.

Part 1 answers _"which components produced this name?"_ (injectivity of the join). Part 2 answers _"who wrote this name, the user or the transpiler?"_ (namespace disjointness). Collision class 1 happens to be fixed by either; class 2 only by part 1; class 3 only by part 2.

**A prefix cannot deliver injectivity.** Prefixing class 2 relocates it without solving it — scope `A_B` member `c` and scope `A` member `B_c` both become `cnx_A_B_c`.

**And the prefix buys back neither constraint.** Both remain load-bearing:

- Relaxing "no `__`": scope `A__B` member `C` → `A__B__C`; scope `A` member `B__C` → `A__B__C`. Collides.
- Relaxing "no trailing `_`": scope `A_` member `B` → `A___B`; scope `A` member `_B` → `A___B`. Collides.

The corollary matters for implementers: a transpiler-invented name must **not** be spelled with `__` to make it unrepresentable in user source. That works, but it lies — `__` asserts "qualified user name, component boundary here", and a temporary has no components. Use the prefix, which asserts something true.

### Include guards

The guard is built from the source file's path **relative to the project root**, extension stripped, uppercased, with every non-alphanumeric character replaced by `_`:

```
src/can/config.cnx    →  CNX_SRC_CAN_CONFIG_H
src/uart/config.cnx   →  CNX_SRC_UART_CONFIG_H
Display/Utils.cnx     →  CNX_DISPLAY_UTILS_H
```

The project root is the directory found by walking up for `cnext.config.json`, `platformio.ini`, `.git` or `package.json` — the same discovery the cache and `compile_commands.json` lookup already use. It falls back to the input directory when no marker is found, and to the basename for a file outside that base.

Keying on the **path** rather than the basename is what makes same-basename files in different directories distinguishable (#1133 cause 2). Keying it under `CNX_` is what stops a user's `GUARDCOL_H` constant from erasing a guard (#1133 cause 3).

**Why the project root rather than the input directory.** The guard has to identify a file the same way regardless of which entry point pulled it in. Anchoring on the input directory fails that: building `app.cnx` yields `CNX_CAN_CONFIG_H` for `can/config.cnx`, while building `can/config.cnx` directly yields `CNX_CONFIG_H` for the same file. A project that compiles translation units individually — the normal case for a Makefile — would then produce two headers whose guards disagree, and #1133 cause 2 returns the moment a consumer includes both. The project root is stable across both invocations. The cost is longer guards in deeply nested trees, which is cosmetic and visible mostly in this repository's own `tests/` tree.

**Uppercasing is a lossy map, so this is not injective on its own,** and no amount of prefixing fixes that: `mod-a.cnx` and `mod_a.cnx` both sanitize to `CNX_MOD_A_H`, as do `Mod.cnx` and `mod.cnx` on a case-sensitive filesystem. The residue is handled by a diagnostic (**E0203**) that fires when two files in one compilation produce the same guard.

This is deliberately the same move part 1 makes: constrain the input domain so the mapping can stay readable, rather than complicate the mapping. The rejected alternatives — appending a hash of the true path, or escape-encoding it — are both injective without a diagnostic, and both trade away the readability of the generated artifact for a case that is a code smell in its own right. Two files in one build differing only by `-` versus `_`, or only by case, are confusing to humans before they are confusing to the preprocessor.

The "Why a diagnostic is the wrong fix" argument above does **not** apply here. It concerns identifiers the user writes, where refusing a well-formed program punishes the author for a codegen artifact. A filename is not a declaration; renaming a file is a trivial, local, one-time act; and the guard collision is silent today, which is the actual defect in #1133.

### Enforcement: semantic, not lexical

The grammar above is **specification, not implementation**. The rule is enforced semantically, as diagnostic E0201, while the `IDENTIFIER` lexer rule stays permissive. Three reasons:

1. **Diagnostic quality.** A lexical rejection surfaces as a token-recognition failure followed by cascading parse errors — no error code, no source-accurate location for the identifier, and no `help:` line. An ADR that defines an error code has already implicitly chosen semantic enforcement.
2. **The C-interop carve-out.** The analyzer checks only _declaration_ contexts. A C-Next file that _calls_ an external symbol such as `__disable_irq()` or `_exit()` is untouched, which is exactly the scope this ADR specifies. A lexer rule cannot make that distinction.
3. **Cost.** A grammar change forces `npm run antlr:all` and re-committing the generated parser sources, for no benefit here.

Preprocessor directive tokens (`#define`, `#ifdef`, `#ifndef`, `#pragma target`) embed their own identifier character classes in the grammar and are deliberately **not** covered by this rule, so include guards such as `#ifndef __MY_GUARD__` continue to work.

### Scope of the rules

Both parts have the same scope.

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

| Pattern                   | Occurrences    | Legal under this rule |
| ------------------------- | -------------- | --------------------- |
| Trailing `_`              | 0              | no                    |
| Consecutive `__`          | 0              | no                    |
| Leading `_`               | 1 (`_handler`) | **yes**               |
| Leading `cnx_` (any case) | 0              | no                    |

**No existing C-Next source requires renaming.**

The `cnx_` figure is worth stating precisely, because a grep for `cnx_` over the corpus does return hits — 7 distinct names, all of the form `cnx_clamp_<op>_<type>`. Every one of them appears only in generated `.c` output, as an overflow helper. None is declared in `.cnx` source. Part 2 therefore does not introduce a convention; it reserves one the transpiler had already adopted for its overflow helpers and failed to apply to its temporaries and guards.

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

## Diagnostics

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

Reported for a trailing underscore or two or more consecutive underscores, over declaration contexts only; references to external C/C++ symbols are not checked.

**E0202** — identifier uses the reserved transpiler prefix.

```
error[E0202]: Identifier 'cnx_buffer' cannot begin with 'cnx_'. That prefix is
reserved for names the transpiler generates, compared case-insensitively.
```

Reported when a declared identifier begins with `cnx_` in any case. Decided by the same classification as E0201, so the two rules cannot drift apart — one classifier, two violation kinds.

**E0203** — two source files produce the same include guard.

```
error[E0203]: Source files 'mod-a.cnx' and 'mod_a.cnx' both produce the include
guard 'CNX_MOD_A_H'. Rename one so the generated headers stay distinguishable.
```

Reported once per colliding pair, before header generation. Reachable only through the residue described in "Include guards": filenames differing solely by characters that sanitize together, or solely by case.

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

The 2026-08-07 amendment changes two further families of generated names:

| Before         | After           |
| -------------- | --------------- |
| `_tmp<N>`      | `cnx_tmp<N>`    |
| `_cnx_tmp_<N>` | `cnx_tmp<N>`    |
| `_<var>_len`   | `cnx_len_<var>` |
| `<BASENAME>_H` | `CNX_<PATH>_H`  |

Temporaries are function-local and guards are internal to the generated header, so neither is part of the interface a C or C++ consumer links against — unlike the separator change above, nothing downstream must be updated. Every `.expected.h` snapshot regenerates for the guard, and those `.expected.c` snapshots containing a temporary regenerate with it.

A user identifier beginning with `cnx_` is newly rejected. Zero occur in the corpus (see "Migration cost"), so this breaks no existing C-Next source.

### Non-breaking

- No existing C-Next identifier requires renaming.
- Both collision classes in #1117 become unrepresentable rather than diagnosed.
- Collision class 3 becomes unrepresentable for temporaries and helpers: a user cannot declare a name in the transpiler's namespace, so a generated name cannot shadow one. The include-guard residue is the sole case that remains diagnosed rather than unrepresentable, for the reasons given in "Include guards".
- Include resolution keys on the resolved path rather than the basename, so two `.cnx` files sharing a basename both reach the compilation (#1134). That fix is a prerequisite for the guard change, not a consequence of it: while same-basename files were silently dropped, the guard collision they cause was unreachable within a single compilation.
- Issue #1117's second defect — bare `Reg_flags` resolving to the scope member `Reg.flags` — is resolved as a consequence. The type registry is keyed by the qualified name; once that key is `Reg__flags`, a source-level `Reg_flags` no longer matches it, so generated naming stops leaking into the source namespace (ADR-057).

## Open Questions

- Should `--cpp` mode emit real `namespace Scope { }` blocks instead of the flat `Scope__member` name? That would remove the C++ reserved-identifier consequence described above entirely, since the flat form would never reach a C++ translation unit. Larger change, and orthogonal to injectivity — C output is unaffected either way.
- If ADR-105 (Prefixed Includes) is adopted, a **filename becomes a qualified-name component** — `Arduino.Serial.begin()` → `Arduino__Serial__begin`. Part 1's constraints would then have to apply to filenames as well as identifiers, since nothing today stops a file being named `mod__a.cnx` or `mod_.cnx`. The include-guard rule above already takes a first step by keying on the path and diagnosing the residue; ADR-105 should decide whether to extend the full underscore rule to filenames rather than invent a parallel one.
- Should a **file-scope** identifier be permitted to begin with `_`? C11 §7.1.3 reserves those, so a leading-underscore global emits a reserved C identifier. The motivating idiom (`_handler`) is a struct member and is unaffected, so this rule does not restrict it — but a narrower "leading `_` on globals only" check could be added later without affecting injectivity.

Live diagnostics in the VS Code extension are tracked separately: every transpiler diagnostic should surface in the editor, not only E0201 — see [jlaustill/vscode-c-next#8](https://github.com/jlaustill/vscode-c-next/issues/8). That issue also captures a prerequisite in this repo: a diagnostic's code and help text are currently dropped on the way to the editor, so `helpText` never reaches users today.

## References

- Issue #1117 — Scope name qualification collides with the global namespace
- Issue #1131 — Generated temporaries shadow user globals (collision class 3)
- Issue #1133 — Include-guard macros are not injective
- Issue #1134 — Two included `.cnx` files sharing a basename: the second is silently dropped
- Issue #1132 — Reserve the `cnx_` prefix for the transpiler (E0202)
- Issue #1307 — Injectivity holds for the whole string but not within the target's
  significant-character budget: C99 §5.2.4.1 guarantees 31 characters for an external
  identifier, and `Scope__member` spends them on the encoding. Diagnosed as **E0204**;
  MISRA C:2012 Rule 5.1.

  This is not the diagnostic "Why a diagnostic is the wrong fix" rejects, and the
  difference is what makes that section's argument hold. There, a diagnostic would
  have stood in for an encoding that _can_ be made injective, so rejecting a
  well-formed program was avoidable and therefore wrong. Here it cannot: 51 characters
  do not fit in 31, and the only encodings that would fit are the length-prefixed and
  hashed forms this ADR already rejected for destroying the readability of the
  generated artifact. A diagnostic is the least-cost remaining option, not a substitute
  for one.

- Issue #1338 — the same gap against the 63-character _internal_ budget (Rule 5.9), open
- Issue #1357 — injectivity is a property of the _encoder_, and there were two. One walked
  the whole scope chain; the other joined a single level. They agree at depth one and
  diverge at depth two, where the one-level form drops every outer component and so is not
  injective at all. Eleven sites used the one-level form after their producer had already
  been converted to walk the chain.

  Measured, not assumed: the divergence is unreachable from `.cnx` source because a
  scope member cannot itself be a scope declaration, so every scope chain a program can
  build is depth one and the two encoders coincide. ADR-016 forbids nesting permanently
  rather than deferring it, so that agreement is a decision and not a coincidence with a
  scheduled expiry. The guard is still written at the dotted-path level, because a deeper
  chain is constructible there whatever the source syntax admits.

  The second half removed the ability to express the one-level form at all. Building a
  name now states that a COMPLETE path is in hand, rather than reading as an act of
  joining two things, and the one remaining routine that qualified against an enclosing
  scope was moved and made to take that whole path rather than a scope's leaf name.
  Nothing that builds an encoded name is scope-aware any more, which makes threading the
  path the only way to express the correct thing and a compile error the consequence of
  not having it.

  What remains is a call SHAPE — a whole-path builder handed exactly two parts — which no
  import-level rule can see, because that builder has 38 legitimate whole-path callers. Two gates split that: `.dependency-cruiser.cjs` widened
  `collectors-build-names-from-scopes` from the collectors seam to every directory
  measurably needing nothing from the encoder (parser, preprocessor, data — 42
  files against the original 7), and `npm run scope-joins:check` holds the residual
  population at `docs/architecture/scope-join-sites.md`, which is generated and owns the
  count — restating it here is how it drifts.
  That inventory counts an element as scope-denoting when its NAME says so or when
  the enclosing block guards it with `is(Known)Scope(<that element>)`; a name
  heuristic alone missed six sites spelled `parts[0]` or `identifierChain[0]`,
  which nobody will ever rename, so the residue would have been undercounted and a
  later zero would have licensed removing the gate.
  That inventory is keyed on per-file counts rather than `file:line`: #1374 records
  that a citation gate cannot detect two rows trading sites, and one unrelated
  eleven-site change silently invalidated eighteen `file:line` citations elsewhere in
  these docs through pure line drift.

- Issue #1292 — diagnostics name `cnxScopedName`, not the generated identifier
- ADR-016 (Scopes), ADR-017 (Enums), ADR-057 (Implicit Scope Resolution), ADR-010 (C Interoperability), ADR-105 (Prefixed Includes)
- ISO/IEC 9899:2011 §7.1.3; ISO/IEC 14882 §lex.name/3; MISRA C:2012 Rule 21.2; ISO/IEC 9899:1999 §5.2.4.1
