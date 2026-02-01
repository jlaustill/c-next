/**
 * Assignment kinds for classification-based dispatch (ADR-109).
 *
 * The classifier checks conditions in priority order - earlier kinds
 * take precedence when multiple could match. This ordering matches
 * the original generateAssignment() method's if-else chain.
 */
enum AssignmentKind {
  // === Bitmap operations (check first - specific patterns) ===

  /** flags.Running <- true (single-bit bitmap field) */
  BITMAP_FIELD_SINGLE_BIT,

  /** flags.Mode <- 3 (multi-bit bitmap field) */
  BITMAP_FIELD_MULTI_BIT,

  /** bitmapArr[i].Field <- value (array of bitmap elements) */
  BITMAP_ARRAY_ELEMENT_FIELD,

  /** device.flags.Active <- true (struct member is bitmap) */
  STRUCT_MEMBER_BITMAP_FIELD,

  /** MOTOR.CTRL.Running <- true (register member is bitmap) */
  REGISTER_MEMBER_BITMAP_FIELD,

  /** Scope.GPIO7.ICR1.LED_BUILTIN <- value (scoped register bitmap) */
  SCOPED_REGISTER_MEMBER_BITMAP_FIELD,

  // === Register bit operations ===

  /** GPIO7.DR_SET[LED_BIT] <- true (single bit) */
  REGISTER_BIT,

  /** GPIO7.DR_SET[0, 8] <- value (bit range, includes MMIO optimization) */
  REGISTER_BIT_RANGE,

  /** this.GPIO7.DR_SET[LED_BIT] <- true (scoped register bit) */
  SCOPED_REGISTER_BIT,

  /** this.GPIO7.ICR1[6, 2] <- value (scoped register bit range) */
  SCOPED_REGISTER_BIT_RANGE,

  // === Integer bit operations ===

  /** flags[3] <- true (single bit on integer variable) */
  INTEGER_BIT,

  /** flags[0, 3] <- 5 (bit range on integer variable) */
  INTEGER_BIT_RANGE,

  /** item.byte[7] <- true (bit access on struct member) */
  STRUCT_MEMBER_BIT,

  /** matrix[i][j][FIELD_BIT] <- false (bit on multi-dim array element) */
  ARRAY_ELEMENT_BIT,

  // === String operations ===

  /** str <- "hello" (simple string variable) */
  STRING_SIMPLE,

  /** this.name <- "value" (scoped string member) */
  STRING_THIS_MEMBER,

  /** global.name <- "value" (global string) */
  STRING_GLOBAL,

  /** person.name <- "Alice" (struct field is string) */
  STRING_STRUCT_FIELD,

  /** names[0] <- "first" (string array element) */
  STRING_ARRAY_ELEMENT,

  /** config.items[0] <- "value" (struct field is string array) */
  STRING_STRUCT_ARRAY_ELEMENT,

  // === Array operations ===

  /** arr[i] <- value (normal array element) */
  ARRAY_ELEMENT,

  /** matrix[i][j] <- value (multi-dimensional array element) */
  MULTI_DIM_ARRAY_ELEMENT,

  /** buffer[0, 10] <- source (slice assignment with memcpy) */
  ARRAY_SLICE,

  // === Special operations ===

  /** atomic counter +<- 1 (atomic read-modify-write) */
  ATOMIC_RMW,

  /** clamp u8 saturated +<- 200 (saturating arithmetic) */
  OVERFLOW_CLAMP,

  // === Access patterns (global/this prefix) ===

  /** global.Scope.member <- value (cross-scope access) */
  GLOBAL_MEMBER,

  /** global.arr[i] <- value (global array element) */
  GLOBAL_ARRAY,

  /** global.reg[bit] <- value (global register bit) */
  GLOBAL_REGISTER_BIT,

  /** this.member <- value (scoped member) */
  THIS_MEMBER,

  /** this.arr[i] <- value (scoped array element) */
  THIS_ARRAY,

  // === Complex access patterns ===

  /** struct.field.subfield <- value (member chain) */
  MEMBER_CHAIN,

  // === Base case ===

  /** x <- 5 (simple variable assignment) */
  SIMPLE,
}

export default AssignmentKind;
