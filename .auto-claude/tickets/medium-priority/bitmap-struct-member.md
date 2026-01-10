# Ticket: Bitmap Declaration - As Struct Member

## Description
Write test for bitmap type used as a struct member in C-Next.

## Test Category
Bitmap Declaration

## Context Being Tested
Using bitmap types as members within struct definitions for organized hardware abstraction.

## Priority
Medium

## Acceptance Criteria
- [ ] Test file created in `tests/bitmap/bitmap-struct-member.cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference for "As struct member"
- [ ] Jest test runner passes

## Test Implementation Notes
- Combine patterns from `tests/bitmap/basic-bitmap.cnx` and `tests/structs/struct-declaration.cnx`
- Define a bitmap type
- Use the bitmap as a member of a struct
- Test accessing bitmap fields through struct member access
- Test chained member access (struct.bitmap.field)
- Example syntax:
  ```
  bitmap8 StatusFlags {
      Active,      // bit 0
      Error,       // bit 1
      Ready,       // bit 2
      Reserved[5]  // bits 3-7
  }

  struct Device {
      u32 id;
      StatusFlags status;
      u8 version;
  }

  Device myDevice <- { id: 0, status: 0, version: 1 };

  void main() {
      // Access bitmap field through struct
      myDevice.status.Active <- true;
      myDevice.status.Ready <- true;

      // Read bitmap field through struct
      bool isActive <- myDevice.status.Active;
      bool hasError <- myDevice.status.Error;
  }
  ```

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
