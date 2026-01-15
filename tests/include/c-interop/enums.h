#ifndef C_INTEROP_ENUMS_H
#define C_INTEROP_ENUMS_H

/*
 * C Interop Test Enums
 * Test enum definitions for C-Next interop testing
 */

/* Named enum with sequential values (0, 1, 2) */
enum Color {
    COLOR_RED,
    COLOR_GREEN,
    COLOR_BLUE
};

/* Named enum with explicit values */
enum Status {
    STATUS_OK = 0,
    STATUS_ERROR = -1,
    STATUS_PENDING = 100,
    STATUS_COMPLETE = 200
};

/* Typedef enum - common C pattern */
typedef enum {
    PRIORITY_LOW = 0,
    PRIORITY_MEDIUM = 50,
    PRIORITY_HIGH = 100,
    PRIORITY_CRITICAL = 255
} Priority;

/* Enum for bit flags */
typedef enum {
    FLAG_NONE = 0,
    FLAG_READ = 1,
    FLAG_WRITE = 2,
    FLAG_EXECUTE = 4,
    FLAG_ALL = 7
} Permissions;

/* Enum with non-sequential values */
typedef enum {
    BAUD_9600 = 9600,
    BAUD_19200 = 19200,
    BAUD_38400 = 38400,
    BAUD_115200 = 115200
} BaudRate;

#endif /* C_INTEROP_ENUMS_H */
