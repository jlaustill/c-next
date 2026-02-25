# README Restructure Design

**Date:** 2026-02-25
**Status:** Approved

## Problem Statement

The README received feedback that:

1. Length (~870 lines) is overwhelming for first-time visitors
2. "Thought exercise" tagline undersells the project's maturity
3. Missing direct "Why not Rust?" answer
4. No CI badge despite having GitHub Actions workflows
5. "Projects Using C-Next" table is thin

## Design Decision

**Approach A: Aggressive Split** — Reduce README to ~200-250 lines focused on the hook and getting started. Move detailed content to dedicated docs.

## New README Structure

1. **Title + Badges** — Add GitHub Actions CI badge
2. **One-liner + Status** — Keep current
3. **Quick Example** — Keep current (this is the hook)
4. **Why C-Next?** — NEW section addressing toolchain question
5. **Philosophy** — KEEP (TypeScript model, KISS, DRY, Simplicity table)
6. **Installation** — Keep current
7. **Usage** — Keep current
8. **VS Code Extension** — Keep current
9. **PlatformIO Integration** — Condensed with link to full docs
10. **Projects Using C-Next** — Expanded with test-teensy
11. **Documentation** — NEW section with links
12. **Development** — Keep current
13. **Contributing + License + Acknowledgments** — Keep current

## "Why C-Next?" Content

```markdown
## Why C-Next?

C-Next transpiles to **standard C99**. Your existing toolchain — GCC, Clang, IAR, arm-none-eabi-gcc — compiles the output.

This means:

- **50+ years of GCC optimizations** work out of the box
- **Existing debuggers and profilers** just work (GDB, Ozone, etc.)
- **No new runtime** — the generated C is what runs on your hardware
- **Incremental adoption** — drop a single `.cnx` file into an existing project

Other memory-safe languages require adopting an entirely new toolchain, build system, and ecosystem. C-Next gives you safety improvements while keeping your investment in C infrastructure.
```

## Files to Create/Modify

| File                             | Action                           |
| -------------------------------- | -------------------------------- |
| `README.md`                      | Restructure per design           |
| `docs/language-guide.md`         | NEW — move Core Features content |
| `docs/architecture-decisions.md` | NEW — move ADR tables            |
| GitHub repo description          | Update via `gh repo edit`        |

## Content Migration

### Moves to `docs/language-guide.md`

All "Core Features" content:

- Assignment vs Equality
- Fixed-Width Types
- Register Bindings
- Type-Aware Bit Indexing
- Slice Assignment
- Scopes
- Switch Statements
- Ternary Operator
- Bounded Strings
- Callbacks
- Atomic Variables
- Volatile Variables
- Critical Sections
- NULL for C Library Interop
- Startup Allocation
- Hardware Testing

### Moves to `docs/architecture-decisions.md`

All ADR tables:

- Implemented (40+ ADRs)
- Accepted
- Superseded
- Research (v1 Roadmap)
- Research (v2 Roadmap)
- Rejected

## CI Badge

```markdown
[![CI](https://github.com/jlaustill/c-next/actions/workflows/pr-checks.yml/badge.svg)](https://github.com/jlaustill/c-next/actions/workflows/pr-checks.yml)
```

## Expanded Projects Table

| Project                                   | Description                                                                        |
| ----------------------------------------- | ---------------------------------------------------------------------------------- |
| [OSSM](https://github.com/jlaustill/ossm) | Open-source stroke machine firmware using C-Next for safe embedded control         |
| [test-teensy](test-teensy/)               | Hardware verification project — validates transpiler output on Teensy MicroMod/4.0 |

## GitHub Repo Description

**Current:** "A thought exercise around a memory safe low level language"

**New:** "A safer C for embedded systems — transpiles to clean, readable C99"

## Success Criteria

- [ ] README reduced to ~200-250 lines
- [ ] All content preserved (just reorganized)
- [ ] New visitors can understand what C-Next is in <30 seconds
- [ ] Detailed docs easily discoverable via links
- [ ] CI badge visible
- [ ] Repo description updated
