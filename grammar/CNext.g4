/*
 * C-Next Grammar
 * A safer C for embedded systems development
 *
 * Key differences from C:
 * - Assignment: <- (not =)
 * - Comparison: = (not ==)
 * - No pointer syntax (* for dereference)
 * - & is read-only (get address, cannot reassign)
 * - Fixed-width types: u8, i32, f64, etc.
 * - scope for organization (ADR-016)
 * - struct for data containers (ADR-014)
 * - register bindings for hardware
 */

grammar CNext;

// ============================================================================
// Parser Rules
// ============================================================================

// Entry point
program
    : (includeDirective | preprocessorDirective)* declaration* EOF
    ;

// Include directives (passed through to generated C)
// Uses same syntax as C: #include <header.h> or #include "header.h"
includeDirective
    : INCLUDE_DIRECTIVE
    ;

// Preprocessor directives (ADR-037)
// C-Next takes a safety-first approach:
// - #define FLAG (no value) - allowed for conditional compilation
// - #define FLAG value - ERROR, must use const
// - #define NAME(args) - ERROR, function macros forbidden
// - #pragma target NAME - set target platform (ADR-049)
preprocessorDirective
    : defineDirective
    | conditionalDirective
    | pragmaDirective
    ;

defineDirective
    : DEFINE_FLAG          // Flag-only: #define PLATFORM
    | DEFINE_WITH_VALUE    // Error: #define SIZE 256
    | DEFINE_FUNCTION      // Error: #define MAX(a,b) ...
    ;

conditionalDirective
    : IFDEF_DIRECTIVE
    | IFNDEF_DIRECTIVE
    | ELSE_DIRECTIVE
    | ENDIF_DIRECTIVE
    ;

// ADR-049: Target platform pragma for code generation
pragmaDirective
    : PRAGMA_TARGET
    ;

// Top-level declarations
declaration
    : scopeDeclaration
    | registerDeclaration
    | structDeclaration
    | enumDeclaration
    | bitmapDeclaration
    | functionDeclaration
    | variableDeclaration
    ;

// ----------------------------------------------------------------------------
// Scope (ADR-016: Organization with visibility control)
// ----------------------------------------------------------------------------
scopeDeclaration
    : 'scope' IDENTIFIER '{' scopeMember* '}'
    ;

scopeMember
    : visibilityModifier? variableDeclaration
    | visibilityModifier? functionDeclaration
    | visibilityModifier? enumDeclaration
    | visibilityModifier? bitmapDeclaration
    | visibilityModifier? registerDeclaration
    ;

visibilityModifier
    : 'private'
    | 'public'
    ;

// ----------------------------------------------------------------------------
// Register Bindings (ADR-004: Type-safe hardware access)
// ----------------------------------------------------------------------------
registerDeclaration
    : 'register' IDENTIFIER '@' expression '{' registerMember* '}'
    ;

registerMember
    : IDENTIFIER ':' type accessModifier '@' expression ','?
    ;

accessModifier
    : 'rw'      // Read-Write
    | 'ro'      // Read-Only
    | 'wo'      // Write-Only
    | 'w1c'     // Write-1-to-Clear
    | 'w1s'     // Write-1-to-Set
    ;

// ----------------------------------------------------------------------------
// Struct (ADR-014: Data containers without methods)
// ----------------------------------------------------------------------------
structDeclaration
    : 'struct' IDENTIFIER '{' structMember* '}'
    ;

structMember
    : type IDENTIFIER arrayDimension* ';'
    ;

// ----------------------------------------------------------------------------
// Enum (ADR-017: Type-safe enums)
// ----------------------------------------------------------------------------
enumDeclaration
    : 'enum' IDENTIFIER '{' enumMember (',' enumMember)* ','? '}'
    ;

enumMember
    : IDENTIFIER ('<-' expression)?
    ;

// ----------------------------------------------------------------------------
// Bitmap (ADR-034: Portable bit-packed data types)
// ----------------------------------------------------------------------------
bitmapDeclaration
    : bitmapType IDENTIFIER '{' bitmapMember (',' bitmapMember)* ','? '}'
    ;

bitmapType
    : 'bitmap8'     // 8 bits, backed by u8
    | 'bitmap16'    // 16 bits, backed by u16
    | 'bitmap24'    // 24 bits, backed by u32 (3 bytes)
    | 'bitmap32'    // 32 bits, backed by u32
    ;

bitmapMember
    : IDENTIFIER ('[' INTEGER_LITERAL ']')?  // FieldName or FieldName[N]
    ;

// ----------------------------------------------------------------------------
// Functions
// ----------------------------------------------------------------------------
functionDeclaration
    : type IDENTIFIER '(' parameterList? ')' block
    ;

parameterList
    : parameter (',' parameter)*
    ;

parameter
    : constModifier? type IDENTIFIER arrayDimension*
    ;

constModifier
    : 'const'
    ;

volatileModifier
    : 'volatile'
    ;

// ADR-044: Overflow behavior modifier
overflowModifier
    : 'clamp'    // Saturating arithmetic (safe default)
    | 'wrap'     // Two's complement wrap (opt-in)
    ;

// ADR-049: Atomic modifier for ISR-safe variables
atomicModifier
    : 'atomic'
    ;

arrayDimension
    : '[' expression? ']'
    ;

// ----------------------------------------------------------------------------
// Variables (ADR-003: Static allocation, ADR-044: Overflow behavior, ADR-049: Atomic)
// ----------------------------------------------------------------------------
variableDeclaration
    : atomicModifier? volatileModifier? constModifier? overflowModifier? type IDENTIFIER arrayDimension* ('<-' expression)? ';'
    ;

// ----------------------------------------------------------------------------
// Statements
// ----------------------------------------------------------------------------
block
    : '{' statement* '}'
    ;

statement
    : variableDeclaration
    | assignmentStatement
    | expressionStatement
    | ifStatement
    | whileStatement
    | doWhileStatement
    | forStatement
    | switchStatement
    | returnStatement
    | criticalStatement    // ADR-050: Critical sections
    | block
    ;

// ADR-050: Critical section for atomic multi-variable operations
criticalStatement
    : 'critical' block
    ;

// ADR-001: <- for assignment, with compound assignment operators
assignmentStatement
    : assignmentTarget assignmentOperator expression ';'
    ;

assignmentOperator
    : '<-'      // Simple assignment
    | '+<-'     // Addition assignment
    | '-<-'     // Subtraction assignment
    | '*<-'     // Multiplication assignment
    | '/<-'     // Division assignment
    | '%<-'     // Modulo assignment
    | '&<-'     // Bitwise AND assignment
    | '|<-'     // Bitwise OR assignment
    | '^<-'     // Bitwise XOR assignment
    | '<<<-'    // Left shift assignment
    | '>><-'    // Right shift assignment
    ;

assignmentTarget
    : globalArrayAccess                    // ADR-016: global.GPIO7.DR_SET[idx] (most specific first)
    | globalMemberAccess                   // ADR-016: global.GPIO7.DR_SET
    | globalAccess                         // ADR-016: global.value
    | thisArrayAccess                      // ADR-016: this.GPIO7.DR_SET[idx] (most specific first)
    | thisMemberAccess                     // ADR-016: this.GPIO7.DR_SET
    | thisAccess                           // ADR-016: this.member access (must be before memberAccess)
    | arrayAccess                          // Must be before memberAccess (both can match arr[i])
    | memberAccess
    | IDENTIFIER
    ;

// ADR-016: this.member for scope-local access in assignment targets
thisAccess
    : 'this' '.' IDENTIFIER
    ;

// ADR-016: this.member.member for chained scope-local access
thisMemberAccess
    : 'this' '.' IDENTIFIER ('.' IDENTIFIER)+
    ;

// ADR-016: this.member[idx] or this.member.member[idx] for scope-local array/bit access
thisArrayAccess
    : 'this' '.' IDENTIFIER '[' expression ']'                           // this.arr[i]
    | 'this' '.' IDENTIFIER '[' expression ',' expression ']'            // this.reg[offset, width]
    | 'this' '.' IDENTIFIER ('.' IDENTIFIER)+ '[' expression ']'         // this.GPIO7.DR_SET[i]
    | 'this' '.' IDENTIFIER ('.' IDENTIFIER)+ '[' expression ',' expression ']'  // this.GPIO7.ICR1[6, 2]
    ;

// ADR-016: global.member for global access in assignment targets
globalAccess
    : 'global' '.' IDENTIFIER
    ;

globalMemberAccess
    : 'global' '.' IDENTIFIER ('.' IDENTIFIER)+
    ;

globalArrayAccess
    : 'global' '.' IDENTIFIER '[' expression ']'                           // global.arr[i]
    | 'global' '.' IDENTIFIER ('.' IDENTIFIER)+ '[' expression ']'         // global.GPIO7.DR_SET[i]
    ;

expressionStatement
    : expression ';'
    ;

ifStatement
    : 'if' '(' expression ')' statement ('else' statement)?
    ;

whileStatement
    : 'while' '(' expression ')' statement
    ;

// ADR-027: Do-while with MISRA-compliant boolean condition (E0701)
doWhileStatement
    : 'do' block 'while' '(' expression ')' ';'
    ;

forStatement
    : 'for' '(' forInit? ';' expression? ';' forUpdate? ')' statement
    ;

// For loop init - uses versions without trailing semicolons
forInit
    : forVarDecl
    | forAssignment
    ;

// Variable declaration without trailing semicolon (for use in for loops)
forVarDecl
    : atomicModifier? volatileModifier? overflowModifier? type IDENTIFIER arrayDimension* ('<-' expression)?
    ;

// Assignment without trailing semicolon (for use in for loops)
forAssignment
    : assignmentTarget assignmentOperator expression
    ;

forUpdate
    : assignmentTarget assignmentOperator expression
    ;

returnStatement
    : 'return' expression? ';'
    ;

// ----------------------------------------------------------------------------
// Switch Statement (ADR-025: Safe switch with MISRA compliance)
// ----------------------------------------------------------------------------
switchStatement
    : 'switch' '(' expression ')' '{' switchCase+ defaultCase? '}'
    ;

switchCase
    : 'case' caseLabel ('||' caseLabel)* block
    ;

// Case labels must be constant expressions (like C)
// No || ambiguity: logical OR isn't valid in constant context
caseLabel
    : scopedEnumValue    // Scoped enum: this.EState.IDLE (ADR-016)
    | globalEnumValue    // Global enum from scope: global.EState.IDLE
    | qualifiedType      // Enum value: EState.IDLE
    | IDENTIFIER         // Const or enum member
    | '-'? INTEGER_LITERAL  // Allow negative integers
    | '-'? HEX_LITERAL      // Allow negative hex (e.g., -0x80)
    | BINARY_LITERAL
    | CHAR_LITERAL
    ;

scopedEnumValue
    : 'this' '.' IDENTIFIER '.' IDENTIFIER
    ;

globalEnumValue
    : 'global' '.' IDENTIFIER '.' IDENTIFIER
    ;

defaultCase
    : 'default' ('(' INTEGER_LITERAL ')')? block
    ;

// ----------------------------------------------------------------------------
// Expressions
// ----------------------------------------------------------------------------
expression
    : ternaryExpression
    ;

// ADR-022: Ternary with required parentheses, no nesting (semantic check)
ternaryExpression
    : '(' orExpression ')' '?' orExpression ':' orExpression  // Ternary with required parens
    | orExpression                                             // Non-ternary path
    ;

orExpression
    : andExpression ('||' andExpression)*
    ;

andExpression
    : equalityExpression ('&&' equalityExpression)*
    ;

// ADR-001: = for equality comparison (not ==)
equalityExpression
    : relationalExpression (('=' | '!=') relationalExpression)*
    ;

relationalExpression
    : bitwiseOrExpression (('<' | '>' | '<=' | '>=') bitwiseOrExpression)*
    ;

bitwiseOrExpression
    : bitwiseXorExpression ('|' bitwiseXorExpression)*
    ;

bitwiseXorExpression
    : bitwiseAndExpression ('^' bitwiseAndExpression)*
    ;

bitwiseAndExpression
    : shiftExpression ('&' shiftExpression)*
    ;

shiftExpression
    : additiveExpression (('<<' | '>>') additiveExpression)*
    ;

additiveExpression
    : multiplicativeExpression (('+' | '-') multiplicativeExpression)*
    ;

multiplicativeExpression
    : unaryExpression (('*' | '/' | '%') unaryExpression)*
    ;

unaryExpression
    : '!' unaryExpression
    | '-' unaryExpression
    | '~' unaryExpression
    | '&' unaryExpression          // Address-of (read-only, ADR-006)
    | postfixExpression
    ;

postfixExpression
    : primaryExpression postfixOp*
    ;

postfixOp
    : '.' IDENTIFIER                           // Member access
    | '[' expression ']'                       // Array subscript / single bit
    | '[' expression ',' expression ']'        // Bit range [start, width]
    | '(' argumentList? ')'                    // Function call
    ;

primaryExpression
    : sizeofExpression                                // ADR-023: sizeof operator
    | castExpression
    | structInitializer
    | arrayInitializer                                // ADR-035: array initializers
    | 'this'                                          // ADR-016: scope-local reference
    | 'global'                                        // ADR-016: global reference
    | IDENTIFIER
    | literal
    | '(' expression ')'
    ;

// ADR-023: Sizeof expression
// sizeof(type) or sizeof(expression)
sizeofExpression
    : 'sizeof' '(' (type | expression) ')'
    ;

// ADR-017: Cast expression for enum to integer conversion
castExpression
    : '(' type ')' unaryExpression
    ;

// Struct initializer: Point { x: 10, y: 20 } or inferred { x: 10, y: 20 }
structInitializer
    : IDENTIFIER '{' fieldInitializerList? '}'    // Explicit type: Point { x: 10 }
    | '{' fieldInitializerList '}'                // Inferred type: { x: 10 } (requires context)
    ;

fieldInitializerList
    : fieldInitializer (',' fieldInitializer)* ','?
    ;

fieldInitializer
    : IDENTIFIER ':' expression
    ;

// ADR-035: Array initializers with square brackets
// [1, 2, 3] for explicit values, [0*] for fill-all
arrayInitializer
    : '[' arrayInitializerElement (',' arrayInitializerElement)* ','? ']'  // List: [1, 2, 3]
    | '[' expression '*' ']'                                                // Fill-all: [0*]
    ;

arrayInitializerElement
    : expression
    | structInitializer                              // For struct arrays: [{ x: 1 }, { x: 2 }]
    | arrayInitializer                               // For nested arrays: [[1,2], [3,4]]
    ;

memberAccess
    : IDENTIFIER ('.' IDENTIFIER)+ ('[' expression ']')+           // ADR-036: screen.pixels[0][0]
    | IDENTIFIER ('.' IDENTIFIER)+ '[' expression ',' expression ']' // GPIO7.DR[start, width]
    | IDENTIFIER ('.' IDENTIFIER)+                                  // GPIO7.DR_SET
    | IDENTIFIER ('[' expression ']')+ ('.' IDENTIFIER)+           // arr[i].field1.field2...
    | IDENTIFIER (('[' expression ']') | ('.' IDENTIFIER))+        // arr[i].field[j].member... (any mix)
    ;

arrayAccess
    : IDENTIFIER '[' expression ']'                       // Single element/bit
    | IDENTIFIER '[' expression ',' expression ']'        // Bit range [start, width]
    ;

argumentList
    : expression (',' expression)*
    ;

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------
type
    : primitiveType
    | stringType                              // ADR-045: Bounded strings
    | scopedType                              // ADR-016: this.Type for scoped types
    | qualifiedType                           // ADR-016: Scope.Type from outside scope
    | userType
    | arrayType
    | 'void'
    ;

// ADR-016: Scoped type reference (this.State -> Motor_State)
scopedType
    : 'this' '.' IDENTIFIER
    ;

// ADR-016: Qualified type from outside scope (Motor.State -> Motor_State)
qualifiedType
    : IDENTIFIER '.' IDENTIFIER
    ;

primitiveType
    : 'u8' | 'u16' | 'u32' | 'u64'     // Unsigned integers
    | 'i8' | 'i16' | 'i32' | 'i64'     // Signed integers
    | 'f32' | 'f64'                     // Floating point
    | 'bool'                            // Boolean
    | 'ISR'                             // ADR-040: Interrupt Service Routine function pointer
    ;

userType
    : IDENTIFIER
    ;

// ADR-045: Bounded string type
// string<N> where N is character capacity (not including null terminator)
stringType
    : 'string' '<' INTEGER_LITERAL '>'    // Sized: string<64>
    | 'string'                             // Unsized: for const inference
    ;

arrayType
    : primitiveType '[' expression ']'
    | userType '[' expression ']'
    ;

// ----------------------------------------------------------------------------
// Literals (ADR-024: Type suffixes OPTIONAL, validated against target type)
// ----------------------------------------------------------------------------
literal
    : SUFFIXED_DECIMAL      // 42u8, 1000i32 (explicit type)
    | SUFFIXED_HEX          // 0xFFu16 (explicit type)
    | SUFFIXED_BINARY       // 0b1010u8 (explicit type)
    | SUFFIXED_FLOAT        // 3.14f32 (explicit type)
    | INTEGER_LITERAL       // 42 (type inferred from context, validated to fit)
    | HEX_LITERAL           // 0xFF (type inferred from context)
    | BINARY_LITERAL        // 0b1010 (type inferred from context)
    | FLOAT_LITERAL         // 3.14 (type inferred from context)
    | STRING_LITERAL
    | CHAR_LITERAL
    | 'true'
    | 'false'
    | 'null'
    | 'NULL'      // ADR-047: C library NULL for interop
    ;

// ============================================================================
// Lexer Rules
// ============================================================================

// Preprocessor directives (passed through to C)
// Matches: #include <header.h> or #include "header.h"
INCLUDE_DIRECTIVE
    : '#' [ \t]* 'include' [ \t]* ('<' ~[>\r\n]* '>' | '"' ~["\r\n]* '"')
    ;

// ADR-037: Preprocessor directive tokens
// Order matters: more specific patterns must come first

// Function-like macro (ERROR): #define NAME(
// Must check for '(' before value pattern
DEFINE_FUNCTION
    : '#' [ \t]* 'define' [ \t]+ [a-zA-Z_] [a-zA-Z0-9_]* [ \t]* '(' ~[\r\n]*
    ;

// Define with value (ERROR): #define NAME value
// Has content after the identifier
DEFINE_WITH_VALUE
    : '#' [ \t]* 'define' [ \t]+ [a-zA-Z_] [a-zA-Z0-9_]* [ \t]+ ~[\r\n]+
    ;

// Flag-only define (OK): #define NAME
// Just the identifier, nothing after (except whitespace/newline)
DEFINE_FLAG
    : '#' [ \t]* 'define' [ \t]+ [a-zA-Z_] [a-zA-Z0-9_]* [ \t]*
    ;

// Conditional compilation directives (pass through)
IFDEF_DIRECTIVE
    : '#' [ \t]* 'ifdef' [ \t]+ [a-zA-Z_] [a-zA-Z0-9_]* [ \t]*
    ;

IFNDEF_DIRECTIVE
    : '#' [ \t]* 'ifndef' [ \t]+ [a-zA-Z_] [a-zA-Z0-9_]* [ \t]*
    ;

ELSE_DIRECTIVE
    : '#' [ \t]* 'else' [ \t]*
    ;

ENDIF_DIRECTIVE
    : '#' [ \t]* 'endif' [ \t]*
    ;

// ADR-049: Target platform pragma
// Matches: #pragma target teensy41, #pragma target cortex-m7, etc.
PRAGMA_TARGET
    : '#' [ \t]* 'pragma' [ \t]+ 'target' [ \t]+ [a-zA-Z_] [a-zA-Z0-9_\-]*
    ;

// Keywords
SCOPE       : 'scope';
STRUCT      : 'struct';
ENUM        : 'enum';
THIS        : 'this';      // ADR-016: scope-local reference
GLOBAL      : 'global';    // ADR-016: global reference
REGISTER    : 'register';
PRIVATE     : 'private';
PUBLIC      : 'public';
CONST       : 'const';
VOLATILE    : 'volatile';
VOID        : 'void';
IF          : 'if';
ELSE        : 'else';
WHILE       : 'while';
DO          : 'do';       // ADR-027: Do-while loops
FOR         : 'for';
SWITCH      : 'switch';   // ADR-025: Switch statements
CASE        : 'case';
DEFAULT     : 'default';
RETURN      : 'return';
TRUE        : 'true';
FALSE       : 'false';
NULL        : 'null';
C_NULL      : 'NULL';     // ADR-047: C library NULL for interop
STRING      : 'string';   // ADR-045: Bounded string type
SIZEOF      : 'sizeof';   // ADR-023: Sizeof operator

// ADR-034: Bitmap type keywords
BITMAP8     : 'bitmap8';
BITMAP16    : 'bitmap16';
BITMAP24    : 'bitmap24';
BITMAP32    : 'bitmap32';

// Access modifiers for registers
RW          : 'rw';
RO          : 'ro';
WO          : 'wo';
W1C         : 'w1c';
W1S         : 'w1s';

// Overflow behavior keywords (ADR-044)
CLAMP       : 'clamp';
WRAP        : 'wrap';

// ADR-049: Atomic types for ISR-safe variables
ATOMIC      : 'atomic';

// ADR-050: Critical sections for multi-variable atomic operations
CRITICAL    : 'critical';

// ADR-024: Type-suffixed numeric literals (REQUIRED)
// These MUST come before unsuffixed literals so ANTLR matches them first
// Suffixes: u8, u16, u32, u64, i8, i16, i32, i64, f32, f64

// Float with suffix: 3.14f32, 2.718f64, 1e10f64
SUFFIXED_FLOAT
    : ([0-9]+ '.' [0-9]+ ([eE] [+-]? [0-9]+)? | [0-9]+ [eE] [+-]? [0-9]+) [fF] ('32' | '64')
    ;

// Hex with suffix: 0xFFu8, 0xDEADBEEFu32
SUFFIXED_HEX
    : '0' [xX] [0-9a-fA-F]+ ([uUiI] ('8' | '16' | '32' | '64'))
    ;

// Binary with suffix: 0b1010u8, 0b11110000u8
SUFFIXED_BINARY
    : '0' [bB] [01]+ ([uUiI] ('8' | '16' | '32' | '64'))
    ;

// Decimal integer with suffix: 42u8, 1000i32, 255u8
SUFFIXED_DECIMAL
    : [0-9]+ ([uUiI] ('8' | '16' | '32' | '64'))
    ;

// Primitive types
U8          : 'u8';
U16         : 'u16';
U32         : 'u32';
U64         : 'u64';
I8          : 'i8';
I16         : 'i16';
I32         : 'i32';
I64         : 'i64';
F32         : 'f32';
F64         : 'f64';
BOOL        : 'bool';
ISR_TYPE    : 'ISR';        // ADR-040: Interrupt Service Routine type

// Operators
// Compound assignment operators (must be before simple operators for correct matching)
LSHIFT_ASSIGN   : '<<<-';   // Left shift assignment
RSHIFT_ASSIGN   : '>><-';   // Right shift assignment
PLUS_ASSIGN     : '+<-';    // Addition assignment
MINUS_ASSIGN    : '-<-';    // Subtraction assignment
STAR_ASSIGN     : '*<-';    // Multiplication assignment
SLASH_ASSIGN    : '/<-';    // Division assignment
PERCENT_ASSIGN  : '%<-';    // Modulo assignment
BITAND_ASSIGN   : '&<-';    // Bitwise AND assignment
BITOR_ASSIGN    : '|<-';    // Bitwise OR assignment
BITXOR_ASSIGN   : '^<-';    // Bitwise XOR assignment

// Simple operators
ASSIGN      : '<-';
EQ          : '=';
NEQ         : '!=';
LT          : '<';
GT          : '>';
LTE         : '<=';
GTE         : '>=';
PLUS        : '+';
MINUS       : '-';
STAR        : '*';
SLASH       : '/';
PERCENT     : '%';
AND         : '&&';
OR          : '||';
NOT         : '!';
BITAND      : '&';
BITOR       : '|';
BITXOR      : '^';
BITNOT      : '~';
LSHIFT      : '<<';
RSHIFT      : '>>';

// Punctuation
LPAREN      : '(';
RPAREN      : ')';
LBRACE      : '{';
RBRACE      : '}';
LBRACKET    : '[';
RBRACKET    : ']';
SEMI        : ';';
COMMA       : ',';
DOT         : '.';
DOTDOT      : '..';
AT          : '@';
COLON       : ':';

// Note: BOOL_LITERAL handled by TRUE/FALSE tokens above

HEX_LITERAL
    : '0' [xX] [0-9a-fA-F]+
    ;

BINARY_LITERAL
    : '0' [bB] [01]+
    ;

FLOAT_LITERAL
    : [0-9]+ '.' [0-9]+ ([eE] [+-]? [0-9]+)?
    | [0-9]+ [eE] [+-]? [0-9]+
    ;

INTEGER_LITERAL
    : [0-9]+
    ;

STRING_LITERAL
    : '"' (~["\r\n\\] | '\\' .)* '"'
    ;

CHAR_LITERAL
    : '\'' (~['\r\n\\] | '\\' .) '\''
    ;

// Identifiers
IDENTIFIER
    : [a-zA-Z_] [a-zA-Z0-9_]*
    ;

// Comments - preserved on HIDDEN channel for output (ADR-043)
// DOC_COMMENT must be before LINE_COMMENT (ANTLR matches first rule that fits)
DOC_COMMENT
    : '///' ~[\r\n]* -> channel(HIDDEN)
    ;

LINE_COMMENT
    : '//' ~[\r\n]* -> channel(HIDDEN)
    ;

BLOCK_COMMENT
    : '/*' .*? '*/' -> channel(HIDDEN)
    ;

// Whitespace
WS
    : [ \t\r\n]+ -> skip
    ;
