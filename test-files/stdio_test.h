// Simple test header file to simulate standard C library functions
#ifndef STDIO_TEST_H
#define STDIO_TEST_H

// Function declarations
int printf(const char* format, ...);
int scanf(const char* format, ...);
char* fgets(char* str, int n, FILE* stream);
int puts(const char* str);

// Variable declarations
extern FILE* stdin;
extern FILE* stdout;
extern FILE* stderr;

// Type definitions
typedef struct {
    int _fileno;
    char* _base;
    int _cnt;
} FILE;

// Constants
static const int EOF = -1;
static const int BUFSIZ = 1024;

#endif