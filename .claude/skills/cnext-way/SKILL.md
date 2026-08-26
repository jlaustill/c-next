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

## The six non-negotiables

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

### 3. Nothing goes under the rug. Fix it or file it. Hard stop.

Not just bugs — **anything you notice**. A smell, a doubt, a "that looks wrong",
a pre-existing defect you tripped over while doing something else, a thing you
decided not to fix. Every one of them ends in exactly one of two states:

- **fixed**, or
- **filed**, with a minimal reproduction you have actually run.

There is no third state. "Worth noting" is not a state. "I'll mention it in the
summary" is not a state — a summary scrolls away, an issue does not. Deciding
something is not worth fixing is fine; deciding it is not worth *recording* is
not yours to make.

Touching code containing a defect means owning it. "It pre-dates this change"
and "it follows an existing pattern" are not defences.

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

### 6. Never merge a new SonarQube issue — gate green or not

The quality gate is a floor, not the standard. It permits duplication up to 3%,
coverage down to 80%, and says nothing at all about an issue that does not move
a rating. **A green gate with an open issue on your code is still a fail.**

Check the issues themselves, not the badge:

```bash
curl -s "https://sonarcloud.io/api/issues/search?componentKeys=jlaustill_c-next&pullRequest=<n>&statuses=OPEN,CONFIRMED&ps=100"
```

Real example (#1153): the gate reported **OK** while one CRITICAL cognitive-
complexity issue sat on new code. Nothing would have failed; the PR would have
merged carrying it.

If an issue is genuinely a false positive, that is a case to make explicitly —
say why, in the PR — not to leave sitting open because the gate tolerated it.

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

### A guard you cannot reach is not a guard

Mutation-checking proves a guard *can* fail. It says nothing about the cases the
harness never constructs. **Coverage of contexts is a separate axis from coverage
of behaviour**, and a suite green on one looks exactly like a suite green on both.

#1260 shipped E0708 with a mutation table where every guard reddened on demand —
and three resolution paths unenforced. Its unit harness resolved a single
in-memory source, so same-file was the only context it could build. A bare
intra-scope `read()`, a `Helper.compute()` across a `.cnx` include, and a
non-void function from an included `.hpp` were each accepted in silence, each
emitting the exact Rule 17.7 violation that PR removed from the baseline. The
suite was 1098/1098 with the fixes applied *or* reverted.

The tell was structural, not statistical: `externalReturnType()` had two
references in the whole repository — its definition and its one call site. Ask
which contexts the code can be reached through — inside a scope, across a `.cnx`
include, from a `.h`, from a `.hpp` — and which of them a fixture actually
builds. Reaching them takes real support files, not a bigger unit test;
`tests/bugs/issue-847-misra-17-7-lowering/` carries one fixture per context.

### A measurement needs a control too

A mutation table is evidence, and evidence collection can itself be wrong. This
one **fails in the direction of thoroughness**, which is why it survives: a
contaminated run shows *more* red, and red is the answer you are hoping for.

The first mutation pass over #1260's four new fixtures showed each mutation
reddening every *earlier* fixture as well. Nothing had actually failed. A
mutation that lets a `test-error` fixture compile leaves `.test.c`/`.test.h`
behind, and those stale artifacts fail the guard afterwards even once the source
is restored. It was caught only because the cascade was mechanically impossible
— a C-header lookup cannot affect an intra-scope call. In a different order it
would have read as a stronger result than the truth.

The same table has a second way to lie, in the same flattering direction: a
mutation that never applied. Scripted mutations match on source text, and source
text moves — a reformat joined two lines and the edit silently matched nothing,
so the "mutation" ran against unmodified code and reported green. That is
indistinguishable from a guard that cannot fail. **Assert that the mutation
changed the file**, and treat an unexpected green as a broken experiment before
a coverage gap.

So: **a mutation must redden exactly the guard it targets**, one to one; a table
where one change reddens several is reporting contamination, not sensitivity.
And a fixture wants a **negative control** for the opposite failure.
`external-c-discard.test.cnx` calls a `void` C function on the line above the
flagged one, and its `.expected.error` names only the non-void call — so an
analyzer that flagged every call regardless of return type would fail it. The
positive assertion catches under-enforcement; the control catches the opposite.

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

- [ ] Did I **mutation-check** every test and guard I added — one mutation
      reddening exactly one guard?
- [ ] Can my harness even **construct** the contexts this code runs in, or is it
      green only where it can reach?
- [ ] Would changing one fact require editing **more than one place**?
- [ ] Is **everything** I noticed fixed or filed — not just the bugs?
- [ ] Are there **zero** open Sonar issues on my code, regardless of the gate?
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
