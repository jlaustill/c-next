# Ticket: Scope Declaration - Public Visibility

## Description
Write test for public visibility modifier on scope members in C-Next.

## Test Category
Scope Declaration

## Context Being Tested
Using the `public` visibility modifier on scope members to allow external access.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/scope/scope-public.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for public visibility
- [ ] Jest test runner passes

## Test Implementation Notes
- Declare public members within a scope
- Verify public members are accessible from outside the scope
- Example syntax:
  ```
  scope Sensor {
      public u32 reading;
      public bool enabled;

      void update(u32 newValue) {
          this.reading <- newValue;
      }
  }

  void main() {
      Sensor.reading <- 100;
      Sensor.enabled <- true;
  }
  ```
- Verify transpiled C code correctly exposes public members

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
