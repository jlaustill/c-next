# C-Next Project Instructions

## Starting a Task

**Always ask the user what they want to work on.** Do not assume based on the roadmap or queue.

## Workflow: Research First

1. **Always start with research/planning** before implementation
2. If unsure about approach, **ask the user**
3. Update the relevant ADR with research findings, links, and context as you go
4. **Never update ADR status or decisions without user direction**

## Testing Requirements

**Tests are mandatory for all feature work:**

1. Create test files in `tests/` directory as you implement
2. Verify transpiled output compiles cleanly with `npm run analyze`
3. Run tests before considering a task complete

## Task Completion Requirements

**A task is NOT complete until all relevant documentation is updated:**

- `README.md` — Must reflect any new features, syntax, or ADR status changes
- `docs/decisions/adr-*.md` — Relevant ADR must be created/updated
- `docs/learn-cnext-in-y-minutes.md` — Must include examples of new syntax/features
- Memory bank is updated

If implementing a feature, all documents must be current and memory must be updated before the task is done.

## ADR Status Rules

**CRITICAL: NEVER change an ADR status without explicit user confirmation.**

- ADR status values: Research, Accepted, Implemented, Rejected
- An ADR is not "Accepted" until the user explicitly accepts it
- An ADR is not "Implemented" until the user confirms implementation is complete
- Always ask before changing status, no exceptions
- **DO** update ADRs with research, context, links, and findings
- **DO NOT** change Status or Decision sections without explicit approval

**Documentation Sync Order:**
- When moving an ADR to "Implemented", update the ADR file FIRST, then update README.md
- Never move an ADR to "Implemented" in README.md before updating the ADR file itself
- This prevents README and ADR files from getting out of sync
