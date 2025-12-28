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
 * - namespace for singletons
 * - class without inheritance
 * - register bindings for hardware
 */

grammar CNext;

// ============================================================================
// Parser Rules
// ============================================================================

// Entry point
program
    : includeDirective* declaration* EOF
    ;

// Include directives (passed through to generated C)
// Uses same syntax as C: #include <header.h> or #include "header.h"
includeDirective
    : INCLUDE_DIRECTIVE
    ;

// Top-level declarations
declaration
    : namespaceDeclaration
    | classDeclaration
    | registerDeclaration
    | structDeclaration
    | functionDeclaration
    | variableDeclaration
    ;

// ----------------------------------------------------------------------------
// Namespace (ADR-002: Singleton services)
// ----------------------------------------------------------------------------
namespaceDeclaration
    : 'namespace' IDENTIFIER '{' namespaceMember* '}'
    ;

namespaceMember
    : visibilityModifier? variableDeclaration
    | visibilityModifier? functionDeclaration
    ;

visibilityModifier
    : 'private'
    | 'public'
    ;

// ----------------------------------------------------------------------------
// Class (ADR-005: Multiple instances, no inheritance)
// ----------------------------------------------------------------------------
classDeclaration
    : 'class' IDENTIFIER typeParameters? '{' classMember* '}'
    ;

classMember
    : visibilityModifier? fieldDeclaration
    | visibilityModifier? methodDeclaration
    | constructorDeclaration
    ;

fieldDeclaration
    : type IDENTIFIER arrayDimension? ';'
    ;

methodDeclaration
    : type IDENTIFIER '(' parameterList? ')' block
    ;

constructorDeclaration
    : IDENTIFIER '(' parameterList? ')' block
    ;

// Type parameters for generic classes: RingBuffer<u8, 256>
typeParameters
    : '<' typeParameter (',' typeParameter)* '>'
    ;

typeParameter
    : IDENTIFIER
    | INTEGER_LITERAL
    ;

// ----------------------------------------------------------------------------
// Register Bindings (ADR-004: Type-safe hardware access)
// ----------------------------------------------------------------------------
registerDeclaration
    : 'register' IDENTIFIER '@' expression '{' registerMember* '}'
    ;

registerMember
    : IDENTIFIER ':' type accessModifier '@' expression registerBitfields? ','?
    ;

accessModifier
    : 'rw'      // Read-Write
    | 'ro'      // Read-Only
    | 'wo'      // Write-Only
    | 'w1c'     // Write-1-to-Clear
    | 'w1s'     // Write-1-to-Set
    ;

registerBitfields
    : '{' bitfieldMember* '}'
    ;

bitfieldMember
    : IDENTIFIER ':' 'bits' '[' expression '..' expression ']' ','?
    ;

// ----------------------------------------------------------------------------
// Struct (traditional C-like struct)
// ----------------------------------------------------------------------------
structDeclaration
    : 'struct' IDENTIFIER '{' structMember* '}' defaultAddress? ';'
    ;

structMember
    : volatileModifier? type IDENTIFIER ';'
    ;

volatileModifier
    : 'volatile'
    ;

defaultAddress
    : expression
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
    : constModifier? type IDENTIFIER arrayDimension?
    ;

constModifier
    : 'const'
    ;

arrayDimension
    : '[' expression? ']'
    ;

// ----------------------------------------------------------------------------
// Variables (ADR-003: Static allocation)
// ----------------------------------------------------------------------------
variableDeclaration
    : constModifier? type IDENTIFIER arrayDimension? ('<-' expression)? ';'
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
    | forStatement
    | returnStatement
    | block
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
    : arrayAccess                          // Must be before memberAccess (both can match arr[i])
    | memberAccess
    | IDENTIFIER
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
    : type IDENTIFIER arrayDimension? ('<-' expression)?
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
// Expressions
// ----------------------------------------------------------------------------
expression
    : orExpression
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
    : IDENTIFIER
    | literal
    | '(' expression ')'
    ;

memberAccess
    : IDENTIFIER ('.' IDENTIFIER)+ '[' expression ']'              // GPIO7.DR_SET[bit]
    | IDENTIFIER ('.' IDENTIFIER)+ '[' expression ',' expression ']' // GPIO7.DR[start, width]
    | IDENTIFIER ('.' IDENTIFIER)+                                  // GPIO7.DR_SET
    | IDENTIFIER ('[' expression ']')+ ('.' IDENTIFIER)?           // arr[i].field
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
    | userType
    | arrayType
    | genericType
    | 'void'
    ;

primitiveType
    : 'u8' | 'u16' | 'u32' | 'u64'     // Unsigned integers
    | 'i8' | 'i16' | 'i32' | 'i64'     // Signed integers
    | 'f32' | 'f64'                     // Floating point
    | 'bool'                            // Boolean
    ;

userType
    : IDENTIFIER
    ;

arrayType
    : primitiveType '[' expression ']'
    | userType '[' expression ']'
    ;

genericType
    : IDENTIFIER '<' typeArgument (',' typeArgument)* '>'
    ;

typeArgument
    : type
    | expression    // For numeric type parameters like buffer sizes
    ;

// ----------------------------------------------------------------------------
// Literals
// ----------------------------------------------------------------------------
literal
    : INTEGER_LITERAL
    | HEX_LITERAL
    | BINARY_LITERAL
    | FLOAT_LITERAL
    | STRING_LITERAL
    | CHAR_LITERAL
    | 'true'
    | 'false'
    | 'null'
    ;

// ============================================================================
// Lexer Rules
// ============================================================================

// Preprocessor directives (passed through to C)
// Matches: #include <header.h> or #include "header.h"
INCLUDE_DIRECTIVE
    : '#' [ \t]* 'include' [ \t]* ('<' ~[>\r\n]* '>' | '"' ~["\r\n]* '"')
    ;

// Keywords
NAMESPACE   : 'namespace';
CLASS       : 'class';
STRUCT      : 'struct';
REGISTER    : 'register';
PRIVATE     : 'private';
PUBLIC      : 'public';
CONST       : 'const';
VOLATILE    : 'volatile';
VOID        : 'void';
IF          : 'if';
ELSE        : 'else';
WHILE       : 'while';
FOR         : 'for';
RETURN      : 'return';
TRUE        : 'true';
FALSE       : 'false';
NULL        : 'null';

// Access modifiers for registers
RW          : 'rw';
RO          : 'ro';
WO          : 'wo';
W1C         : 'w1c';
W1S         : 'w1s';
BITS        : 'bits';

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

// Comments
LINE_COMMENT
    : '//' ~[\r\n]* -> skip
    ;

BLOCK_COMMENT
    : '/*' .*? '*/' -> skip
    ;

DOC_COMMENT
    : '///' ~[\r\n]* -> channel(HIDDEN)
    ;

// Whitespace
WS
    : [ \t\r\n]+ -> skip
    ;
