# README Restructure Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restructure README from ~870 lines to ~200-250 lines, moving detailed content to dedicated docs files.

**Architecture:** Extract Core Features and ADR tables to separate markdown files. Add new content (Why C-Next?, CI badge, expanded projects). Update GitHub repo description.

**Tech Stack:** Markdown, GitHub CLI (`gh`)

---

## Task 1: Create docs/language-guide.md

**Files:**
- Create: `docs/language-guide.md`
- Reference: `README.md:269-665` (Core Features section through Hardware Testing)

**Step 1: Create language-guide.md with header and Core Features content**

Create `docs/language-guide.md` with:
- Title and introduction
- All content from README "Core Features" section (lines 269-665)
- Preserve all code examples exactly

The file should start with:
```markdown
# C-Next Language Guide

This guide covers all C-Next language features in detail. For a quick introduction, see the [README](../README.md).

## Table of Contents

- [Assignment vs Equality](#assignment--vs-equality-)
- [Fixed-Width Types](#fixed-width-types)
- [Register Bindings](#register-bindings)
- [Type-Aware Bit Indexing](#type-aware-bit-indexing)
- [Slice Assignment](#slice-assignment-for-memory-operations)
- [Scopes](#scopes-adr-016)
- [Switch Statements](#switch-statements-adr-025)
- [Ternary Operator](#ternary-operator-adr-022)
- [Bounded Strings](#bounded-strings-adr-045)
- [Callbacks](#callbacks-adr-029)
- [Atomic Variables](#atomic-variables-adr-049)
- [Volatile Variables](#volatile-variables-adr-108)
- [Critical Sections](#critical-sections-adr-050)
- [NULL for C Library Interop](#null-for-c-library-interop-adr-047)
- [Startup Allocation](#startup-allocation)
- [Hardware Testing](#hardware-testing)
```

Then copy all content from README lines 269-665 (Core Features through Hardware Testing).

**Step 2: Verify file created correctly**

Run: `wc -l docs/language-guide.md`
Expected: ~420 lines (Core Features content + header)

**Step 3: Commit**

```bash
git add docs/language-guide.md
git commit -m "docs: create language-guide.md with Core Features content"
```

---

## Task 2: Create docs/architecture-decisions.md

**Files:**
- Create: `docs/architecture-decisions.md`
- Reference: `README.md:697-798` (ADR tables section)

**Step 1: Create architecture-decisions.md with ADR tables**

Create `docs/architecture-decisions.md` with:
- Title and introduction
- All ADR tables from README (Implemented, Accepted, Superseded, Research v1, Research v2, Rejected)

The file should start with:
```markdown
# Architecture Decision Records

This document lists all Architecture Decision Records (ADRs) for the C-Next project.

ADRs are stored in [`docs/decisions/`](decisions/) and document significant design choices.
```

Then copy all ADR tables from README lines 697-798.

**Step 2: Verify file created correctly**

Run: `wc -l docs/architecture-decisions.md`
Expected: ~110 lines

**Step 3: Commit**

```bash
git add docs/architecture-decisions.md
git commit -m "docs: create architecture-decisions.md with ADR tables"
```

---

## Task 3: Restructure README.md

**Files:**
- Modify: `README.md`

**Step 1: Rewrite README with new structure**

Replace README.md with new structure:
1. Title + Badges (add CI badge)
2. One-liner + Status (keep)
3. Quick Example (keep)
4. **Why C-Next?** (NEW)
5. Philosophy (keep, including Simplicity Constraint table)
6. Installation (keep)
7. Usage (keep)
8. VS Code Extension (keep)
9. PlatformIO Integration (CONDENSED - remove detailed sections, add link)
10. Projects Using C-Next (EXPANDED with test-teensy)
11. **Documentation** (NEW - links to language-guide.md, architecture-decisions.md)
12. Project Structure (keep)
13. Development (keep)
14. Contributing (keep)
15. License (keep)
16. Acknowledgments (keep)

**CI badge to add after existing badges:**
```markdown
[![CI](https://github.com/jlaustill/c-next/actions/workflows/pr-checks.yml/badge.svg)](https://github.com/jlaustill/c-next/actions/workflows/pr-checks.yml)
```

**Why C-Next? section (insert after Quick Example):**
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

**Condensed PlatformIO section:**
```markdown
## Getting Started with PlatformIO

C-Next integrates seamlessly with PlatformIO. Quick setup:

```bash
cnext --pio-install
```

This creates a pre-build script that automatically transpiles `.cnx` files before each build.

**Full guide:** See [PlatformIO Integration](docs/platformio-integration.md) for the complete workflow including why you should commit generated files.
```

**Expanded Projects table:**
```markdown
## Projects Using C-Next

| Project | Description |
| ------- | ----------- |
| [OSSM](https://github.com/jlaustill/ossm) | Open-source stroke machine firmware using C-Next for safe embedded control |
| [test-teensy](test-teensy/) | Hardware verification project — validates transpiler output on Teensy MicroMod/4.0 |

_Using C-Next in your project? Open an issue to get listed!_
```

**NEW Documentation section (before Development):**
```markdown
## Documentation

| Resource | Description |
| -------- | ----------- |
| [Language Guide](docs/language-guide.md) | Complete reference for all C-Next features |
| [Architecture Decisions](docs/architecture-decisions.md) | 50+ ADRs documenting design choices |
| [Learn C-Next in Y Minutes](docs/learn-cnext-in-y-minutes.md) | Quick syntax overview |
| [Error Codes](docs/error-codes.md) | Compiler error reference |
| [MISRA Compliance](docs/misra-compliance.md) | MISRA C:2012 compliance details |
```

**Step 2: Verify README length**

Run: `wc -l README.md`
Expected: ~200-250 lines

**Step 3: Commit**

```bash
git add README.md
git commit -m "docs: restructure README - add Why C-Next, move features to language-guide"
```

---

## Task 4: Create docs/platformio-integration.md

**Files:**
- Create: `docs/platformio-integration.md`
- Reference: `README.md:105-218` (original detailed PlatformIO section)

**Step 1: Create platformio-integration.md**

Move the detailed PlatformIO content from the original README (Quick Setup through Uninstall) to this new file.

The file should start with:
```markdown
# PlatformIO Integration

C-Next integrates seamlessly with PlatformIO embedded projects. The transpiler automatically converts `.cnx` files to `.c`, `.h`, and `.cpp` as needed before each build.
```

Then include all the detailed content: Quick Setup, Usage workflow, Why Commit Generated Files, Example Project Structure, Uninstall, Manual Integration.

**Step 2: Verify file created**

Run: `wc -l docs/platformio-integration.md`
Expected: ~110 lines

**Step 3: Commit**

```bash
git add docs/platformio-integration.md
git commit -m "docs: create platformio-integration.md with full PlatformIO guide"
```

---

## Task 5: Update GitHub repo description

**Step 1: Update repo description**

Run:
```bash
gh repo edit jlaustill/c-next --description "A safer C for embedded systems — transpiles to clean, readable C99"
```

**Step 2: Verify update**

Run:
```bash
gh api repos/jlaustill/c-next --jq '.description'
```
Expected: `A safer C for embedded systems — transpiles to clean, readable C99`

**Step 3: No commit needed** (this is a GitHub API operation)

---

## Task 6: Final verification

**Step 1: Verify README line count**

Run: `wc -l README.md`
Expected: 200-250 lines

**Step 2: Verify all links work**

Run:
```bash
# Check that referenced files exist
ls -la docs/language-guide.md docs/architecture-decisions.md docs/platformio-integration.md
```
Expected: All three files exist

**Step 3: Verify no content was lost**

Check that key sections exist in appropriate files:
- Core Features in `docs/language-guide.md`
- ADR tables in `docs/architecture-decisions.md`
- PlatformIO details in `docs/platformio-integration.md`

**Step 4: Final commit if any fixes needed**

If adjustments were made:
```bash
git add -A
git commit -m "docs: final README restructure adjustments"
```

---

## Success Criteria Checklist

- [ ] README reduced to ~200-250 lines
- [ ] `docs/language-guide.md` contains all Core Features
- [ ] `docs/architecture-decisions.md` contains all ADR tables
- [ ] `docs/platformio-integration.md` contains full PlatformIO guide
- [ ] CI badge added to README
- [ ] "Why C-Next?" section added
- [ ] Projects table expanded with test-teensy
- [ ] Documentation section with links added
- [ ] GitHub repo description updated
