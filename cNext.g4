grammar cNext;

// Lexer rules
PUBLIC: 'public';
STATIC: 'static';
CLASS: 'class';
TYPE_INT8: 'int8';
TYPE_INT16: 'int16';
TYPE_INT32: 'int32';
TYPE_INT64: 'int64';
TYPE_STRING: 'String';
ASSIGN: '<-';
SEMI: ';';
LBRACE: '{';
RBRACE: '}';
LPAREN: '(';
RPAREN: ')';
COMMA: ',';
RETURN: 'return';
PLUS: '+';
MINUS: '-';
MULT: '*';
DIV: '/';

ID: [a-zA-Z][a-zA-Z0-9]*;
NUMBER: [0-9]+;
STRING: '`' .*? '`';
WS: [ \t\r\n]+ -> skip;

// Parser rules
sourceFile          // .cn files
    : classDeclaration EOF
    ;

mainSourceFile      // .cnm files
    : (functionDeclaration+ | classDeclaration) EOF
    ;

classDeclaration
    : STATIC? CLASS ID 
      '{' 
         classMembers
      '}'
    ;

classMembers
    : (staticMember | regularMember)*
    ;

staticMember
    : STATIC declaration  // Static variables
    ;

regularMember   // Only allowed in non-static classes
    : declaration        // Regular variables
    | classFunction      // All functions are implicitly static
    ;

classFunction
    : PUBLIC? returnType ID
      '(' parameterList? ')'
      '{' 
         statement*
      '}'
    ;

// Global functions (only in .cnm)
functionDeclaration
    : returnType ID
      '(' parameterList? ')'
      '{' 
         statement*
      '}'
    ;

parameterList
    : parameter (',' parameter)*
    ;

parameter
    : type_specifier ID
    ;

returnType
    : type_specifier
    | 'void'
    ;

declaration
    : type_specifier 
      ID 
      '<-' 
      value 
      ';'
    ;

statement
    : declaration
    | expression ';'
    | RETURN expression? ';'
    ;

type_specifier
    : TYPE_INT8
    | TYPE_INT16
    | TYPE_INT32
    | TYPE_INT64
    | TYPE_STRING
    ;

value
    : NUMBER
    | STRING
    | ID
    ;

expression
    : value                           # ValueExpr
    | expression PLUS expression      # AddExpr
    | expression MINUS expression     # SubExpr
    | expression MULT expression      # MultExpr
    | expression DIV expression       # DivExpr
    | '(' expression ')'             # ParenExpr
    ;