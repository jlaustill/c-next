---
name: cnext-way
description: "The C-Next way — do it right, not fast; right, not easy; right, not a shortcut. Use when implementing a fix or feature in the c-next repo, when reviewing your own work before committing or opening a PR, when tempted to work around a problem instead of fixing it, or when the user says /cnext-way, 'the c-next way', 'do it right', or asks whether work meets the project's standards."
user-invocable: true
tools: Bash, Read, Edit, Grep, Glob, Write, AskUserQuestion
---

# The C-Next Way

C-Next generates the C that goes into safety-critical embedded systems. The
generated code is a certification artifact. A shortcut here does not cost a
little time later — it ships a defect into someone's firmware, or invalidates
their qualification evidence.

Every rule below exists because the cheap version of it already failed.

---

## The five non-negotiables

These are from `CLAUDE.md`. They are absolute. If following one is genuinely
impossible, **ask** — do not decide alone.

### 1. Fix it upstream, never work around it

If C-Next generates wrong code, rejects valid syntax, or lacks a feature, fix
C-Next. No shims in the consuming project, no avoiding the language feature, no
manual edits to generated files. Block the dependent work on the upstream fix.

### 2. No duplicate code paths — and the unit is the *decision*

Sharing a detection function is **not** enough if each path then derives the
consequences separately. Ask: *if this fact changed, how many places would I
edit?* If more than one, that is the bug.

> Paths that agree only "by coincidence" — because some unrelated predicate
> currently happens to hold — are a latent divergence, not a unified path.

Real example (#1143): a report inferred output mode from a requirement's own
`modes` field instead of the report's mode. Correct *only* while every entry
reaching that line happened to be single-mode. One dual-mode entry would have
judged a C transpile against the C++ baseline.

### 3. A bug is fixed or filed. Never neither.

Including pre-existing bugs found while doing something else, and bugs you have
decided not to fix. **Never file without a minimal reproduction you have
actually run.** Touching code containing a defect means owning it.

### 4. Syntax and behavior changes need an ADR and the user's word

But first decide which you have:

| situation | what it is | what it needs |
|---|---|---|
| ADR says X, code does Y | **bug** — spec/implementation divergence | fix the code |
| ADR says X, X is wrong | **design change** | ADR revision + user approval |
| ADR is silent | **ambiguity** | ask, do not assume |

Getting this wrong wastes a round trip in either direction. `docs/decisions/`
is the authority — read it before concluding something is a bug.

### 5. Research first, ask when unclear

Update the relevant ADR with findings as you go. Never change an ADR's Status
or Decision without explicit direction.

---

## The verification discipline

This is the part that separates right from fast, and it is where this project
has been burned most often.

### A test that cannot fail proves nothing

**Mutation-check every guard, probe, or test you add.** Break the thing it
watches and confirm it goes red. If it stays green, you have written
decoration.

Three real instances, all in one week:

- `/* test-no-warnings */` compiled `-fsyntax-only` with no `-O`. It was added
  by #238 specifically to guard #231's `-Wstringop-overflow` — a middle-end
  diagnostic that **cannot fire** without optimization. A guaranteed 32-byte
  overflow into an 8-byte buffer passed it silently, for its entire life.
- A probe written to reject implicit widening accepted the exact case it
  existed to reject, so "zero failures across 1041 fixtures" measured nothing.
- A fix that skipped a ternary's condition used `getChild(0)`. The condition is
  parenthesized, so child 0 is `(`. The skip did nothing and the test passed.

### Verify claims before you repeat them — including your own

- A prior review asserted #231 came from a post-hoc overflow form.
  `git show` proved the code at the time was the *pre-check* form, which
  inverted the conclusion.
- ADR-024 justified implicit widening with "widening never loses data" — true
  of a value, false of a composite expression, which is what MISRA 10.8 is about.
- A grep for lowercase `error` "proved" no conversions were enforced. The
  transpiler prints `Error:`. **Check the exit code.**

Cite `file:line` or a command you ran. If you cannot, say you are unsure.

### Measure; do not estimate

A grep across `.cnx` files suggested ~119 affected fixtures. Prototyping the
actual change and running the suite gave 67 — and, more importantly, told us
**zero** were behavioral. Estimates cannot tell you that.

### When a rule is enforced somewhere, check everywhere

Narrowing and sign-change were enforced on a plain variable and invisible on a
sum of two — the case where truncation is *more* likely. A rule with a hole is
more dangerous than no rule, because people trust it.

---

## Generated output is derived, never authored

`.c`, `.h`, `.cpp`, `.hpp`, `.expected.*` and generated `.md` are **outputs**.

- **Never hand-edit them.** Change the generator and regenerate.
- **Never trust a textual merge of them.** A conflict-free `git merge` of
  generated files can produce output no generator would emit. After merging,
  regenerate and run the suite. (#1143: a clean merge silently resolved 53
  snapshots to a version describing a transpiler that no longer existed.)
- **A snapshot mismatch masks execution.** A fixture failing `C output mismatch`
  never runs, so behavioral regressions are invisible until after
  `npm run test:update`. Re-run afterwards before calling a change
  behavior-preserving.
- **Emitted code shaped by a standard carries an explanatory comment** naming
  the standard, the rule, and *why* the naive form would violate it. The
  generated C is the certification artifact; an auditor must be able to trace
  each non-obvious construct back to the rule that shaped it.

---

## Before you say it is done

Run these, do not assume them:

```bash
npm run build && npx tsc --noEmit
npm run unit
npm run test:q          # integration
npm run test:bugs
npm run validate:c      # cppcheck, MISRA, clang-tidy, flawfinder
npx knip                # dead code
npm run cspell:check && npm run oxlint:check
```

Then ask yourself:

- [ ] Did I **mutation-check** every test and guard I added?
- [ ] Would changing one fact require editing **more than one place**?
- [ ] Is every bug I found **fixed or filed with a reproduction I ran**?
- [ ] Did I **regenerate** rather than edit or merge any generated file?
- [ ] Did I verify each claim in my commit message, or am I repeating something?
- [ ] Does anything I wrote agree with the truth only **by coincidence**?
- [ ] If I skipped scope, did I **say so explicitly** rather than let it pass?

Report honestly. If tests fail, say so with the output. "It should work" is not
a result.

---

## The tell

You are about to take a shortcut when you catch yourself thinking:

| thought | what it means |
|---|---|
| "It's just a comment / a test / generated" | Those are the artifacts people trust most |
| "The existing code does it this way" | Pre-existing is not a defence — touching it means owning it |
| "This is a false positive" | Prove it. #231 was a *true* positive read as false for years |
| "I'll note it and move on" | Fix it or file it, with a reproduction |
| "Close enough to regenerate later" | Regenerate now; later never has the context |
| "The estimate is probably right" | Measure it |

When the right way and the fast way disagree, take the right way — and if that
changes the scope, say so and let the user decide.
