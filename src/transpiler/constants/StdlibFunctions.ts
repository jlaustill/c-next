/**
 * Standard library / framework function metadata.
 *
 * Single source of truth for:
 *  - which external functions are "known" (don't require a C-Next definition),
 *    mapped to the header that declares them (used by FunctionCallAnalyzer for
 *    define-before-use exemption and header injection), and
 *  - which of those return `void` (used by ReturnValueCast to decide whether a
 *    discarded statement-level call needs a MISRA C:2012 Rule 17.7 `(void)`
 *    cast — see #847).
 *
 * Previously the header map lived privately inside FunctionCallAnalyzer; it was
 * lifted here so the codegen layer can share the exact same list rather than
 * maintaining a parallel copy.
 */
class StdlibFunctions {
  /**
   * Function name → header file. These are considered "external" and don't
   * need to be defined in C-Next.
   */
  static readonly HEADERS: Readonly<Record<string, string>> = {
    // stdio.h
    printf: "stdio.h",
    fprintf: "stdio.h",
    sprintf: "stdio.h",
    snprintf: "stdio.h",
    scanf: "stdio.h",
    fscanf: "stdio.h",
    sscanf: "stdio.h",
    fopen: "stdio.h",
    fclose: "stdio.h",
    fread: "stdio.h",
    fwrite: "stdio.h",
    fgets: "stdio.h",
    fputs: "stdio.h",
    fgetc: "stdio.h",
    fputc: "stdio.h",
    puts: "stdio.h",
    putchar: "stdio.h",
    getchar: "stdio.h",
    gets: "stdio.h",
    perror: "stdio.h",
    fflush: "stdio.h",
    fseek: "stdio.h",
    ftell: "stdio.h",
    rewind: "stdio.h",
    feof: "stdio.h",
    ferror: "stdio.h",
    clearerr: "stdio.h",
    remove: "stdio.h",
    rename: "stdio.h",
    tmpfile: "stdio.h",
    tmpnam: "stdio.h",
    setbuf: "stdio.h",
    setvbuf: "stdio.h",
    // stdlib.h
    malloc: "stdlib.h",
    calloc: "stdlib.h",
    realloc: "stdlib.h",
    free: "stdlib.h",
    atoi: "stdlib.h",
    atof: "stdlib.h",
    atol: "stdlib.h",
    atoll: "stdlib.h",
    strtol: "stdlib.h",
    strtoul: "stdlib.h",
    strtoll: "stdlib.h",
    strtoull: "stdlib.h",
    strtof: "stdlib.h",
    strtod: "stdlib.h",
    strtold: "stdlib.h",
    rand: "stdlib.h",
    srand: "stdlib.h",
    exit: "stdlib.h",
    abort: "stdlib.h",
    atexit: "stdlib.h",
    system: "stdlib.h",
    getenv: "stdlib.h",
    abs: "stdlib.h",
    labs: "stdlib.h",
    llabs: "stdlib.h",
    div: "stdlib.h",
    ldiv: "stdlib.h",
    lldiv: "stdlib.h",
    qsort: "stdlib.h",
    bsearch: "stdlib.h",
    // string.h
    strlen: "string.h",
    strcpy: "string.h",
    strncpy: "string.h",
    strcat: "string.h",
    strncat: "string.h",
    strcmp: "string.h",
    strncmp: "string.h",
    strchr: "string.h",
    strrchr: "string.h",
    strstr: "string.h",
    strtok: "string.h",
    memcpy: "string.h",
    memmove: "string.h",
    memset: "string.h",
    memcmp: "string.h",
    memchr: "string.h",
    // math.h
    sin: "math.h",
    cos: "math.h",
    tan: "math.h",
    asin: "math.h",
    acos: "math.h",
    atan: "math.h",
    atan2: "math.h",
    sinh: "math.h",
    cosh: "math.h",
    tanh: "math.h",
    exp: "math.h",
    log: "math.h",
    log10: "math.h",
    log2: "math.h",
    pow: "math.h",
    sqrt: "math.h",
    cbrt: "math.h",
    ceil: "math.h",
    floor: "math.h",
    round: "math.h",
    trunc: "math.h",
    fabs: "math.h",
    fmod: "math.h",
    remainder: "math.h",
    fmax: "math.h",
    fmin: "math.h",
    hypot: "math.h",
    ldexp: "math.h",
    frexp: "math.h",
    modf: "math.h",
    // C99 classification macros (also functions in C++)
    isnan: "math.h",
    isinf: "math.h",
    isfinite: "math.h",
    isnormal: "math.h",
    signbit: "math.h",
    fpclassify: "math.h",
    nan: "math.h",
    nanf: "math.h",
    nanl: "math.h",
    // ctype.h
    isalnum: "ctype.h",
    isalpha: "ctype.h",
    isdigit: "ctype.h",
    isxdigit: "ctype.h",
    islower: "ctype.h",
    isupper: "ctype.h",
    isspace: "ctype.h",
    ispunct: "ctype.h",
    isprint: "ctype.h",
    isgraph: "ctype.h",
    iscntrl: "ctype.h",
    tolower: "ctype.h",
    toupper: "ctype.h",
    // time.h
    time: "time.h",
    clock: "time.h",
    difftime: "time.h",
    mktime: "time.h",
    strftime: "time.h",
    localtime: "time.h",
    gmtime: "time.h",
    asctime: "time.h",
    ctime: "time.h",
    // assert.h
    assert: "assert.h",
    // Arduino framework
    pinMode: "Arduino.h",
    digitalWrite: "Arduino.h",
    digitalRead: "Arduino.h",
    analogRead: "Arduino.h",
    analogWrite: "Arduino.h",
    delay: "Arduino.h",
    delayMicroseconds: "Arduino.h",
    millis: "Arduino.h",
    micros: "Arduino.h",
    attachInterrupt: "Arduino.h",
    detachInterrupt: "Arduino.h",
    noInterrupts: "Arduino.h",
    interrupts: "Arduino.h",
    Serial: "Arduino.h",
    Wire: "Arduino.h",
    SPI: "Arduino.h",
  };

  /**
   * Subset of HEADERS that return `void`. A discarded statement-level call to
   * one of these does NOT violate MISRA Rule 17.7, so codegen must not wrap it
   * in a `(void)` cast (which would also be churn for the very common embedded
   * `digitalWrite(...)` / `delay(...)` idioms). Every other known function is
   * treated as returning a value.
   */
  static readonly VOID_FUNCTIONS: ReadonlySet<string> = new Set([
    // stdio.h
    "perror",
    "rewind",
    "clearerr",
    "setbuf",
    // stdlib.h
    "free",
    "srand",
    "exit",
    "abort",
    "qsort",
    // assert.h (macro expanding to a void expression)
    "assert",
    // Arduino framework
    "pinMode",
    "digitalWrite",
    "analogWrite",
    "delay",
    "delayMicroseconds",
    "attachInterrupt",
    "detachInterrupt",
    "noInterrupts",
    "interrupts",
  ]);

  /** Header that declares `name`, or null if not a known stdlib function. */
  static getHeader(name: string): string | null {
    return StdlibFunctions.HEADERS[name] ?? null;
  }

  /** True if `name` is a known stdlib/framework function. */
  static isKnown(name: string): boolean {
    return name in StdlibFunctions.HEADERS;
  }

  /**
   * True if `name` is a known stdlib/framework function that returns a value
   * (i.e. discarding its result violates MISRA Rule 17.7). Unknown functions
   * return false — we can't justify a cast we can't prove is needed.
   */
  static returnsNonVoid(name: string): boolean {
    return (
      StdlibFunctions.isKnown(name) && !StdlibFunctions.VOID_FUNCTIONS.has(name)
    );
  }
}

export default StdlibFunctions;
