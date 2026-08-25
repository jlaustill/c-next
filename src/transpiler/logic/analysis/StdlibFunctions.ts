/**
 * Standard library / framework function metadata.
 *
 * Single source of truth for what C-Next knows about non-C-Next functions.
 * Two consumers, one list:
 *   - FunctionCallAnalyzer (ADR-030) asks which header declares a name.
 *   - ReturnValueUseAnalyzer (ADR-070, E0708) asks whether a name returns void.
 *
 * Keeping these in one place is required by the project's "No Duplicate Code
 * Paths" rule: a second stdlib list would drift from this one silently, and the
 * two questions would start disagreeing about which functions even exist.
 */

/** Function name -> the header that declares it. */
const HEADERS: Record<string, string> = {
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
 * Names from HEADERS whose return type is `void` (or which never return).
 *
 * ADR-070: a discarded call is only an error when there is a value to discard,
 * so these are outside E0708's domain. Everything else in HEADERS returns a
 * value. A name absent from HEADERS entirely is *unresolvable*, which is also
 * outside the rule's domain -- you cannot check a return type you cannot see.
 */
const VOID_RETURNING: ReadonlySet<string> = new Set([
  "abort",
  "analogWrite",
  "assert",
  "attachInterrupt",
  "clearerr",
  "delay",
  "delayMicroseconds",
  "detachInterrupt",
  "digitalWrite",
  "exit",
  "free",
  "interrupts",
  "noInterrupts",
  "perror",
  "pinMode",
  "qsort",
  "rewind",
  "setbuf",
  "srand",
]);

class StdlibFunctions {
  /** The header declaring `name`, or null if C-Next does not know the name. */
  static header(name: string): string | null {
    return HEADERS[name] ?? null;
  }

  /** True when `name` is a known stdlib/framework function. */
  static isKnown(name: string): boolean {
    return Object.hasOwn(HEADERS, name);
  }

  /**
   * True when `name` is known AND returns void. False for a known non-void
   * function. Callers must check isKnown() first to distinguish "returns a
   * value" from "unknown name" -- both answer false here.
   */
  static returnsVoid(name: string): boolean {
    return VOID_RETURNING.has(name);
  }
}

export default StdlibFunctions;
