grammar cNext;

                // Lexer rules
                IMPORT: 'import';
                INCLUDE: '#include';
                PUBLIC: 'public';
                STATIC: 'static';
                CLASS: 'class';
                TYPE_INT8: 'int8';
                TYPE_INT16: 'int16';
                TYPE_INT32: 'int32';
                TYPE_INT64: 'int64';
                TYPE_UINT8: 'uint8';
                TYPE_UINT16: 'uint16';
                TYPE_UINT32: 'uint32';
                TYPE_UINT64: 'uint64';
                TYPE_FLOAT32: 'float32';
                TYPE_FLOAT64: 'float64';
                TYPE_FLOAT96: 'float96';
                TYPE_STRING: 'String';
                TYPE_BOOLEAN: 'boolean';
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
                DOT: '.';

                ID: [a-zA-Z_][a-zA-Z0-9_]*;
                NUMBER: [0-9]+('.'[0-9]+)?;  // Support decimal numbers
                STRING: '`' .*? '`';         // String literals in backticks
                FILENAME: '"' .*? '"';       // String literals in quotes for file names
                WS: [ \t\r\n]+ -> skip;

                // Parser rules
                sourceFile          // .cn files
                    : fileDirective*
                      classDeclaration EOF
                    ;

                mainSourceFile      // .cnm files
                    : fileDirective*
                      (globalDeclaration | functionDeclaration | classDeclaration)* EOF
                    ;
                    
                globalDeclaration
                    : ID ID SEMI  // Object instantiation like "Blink blinker;"
                    ;

                fileDirective
                    : importDirective
                    | includeDirective
                    ;

                importDirective
                    : IMPORT FILENAME ';'
                    ;

                includeDirective
                    : INCLUDE FILENAME ';'
                    ;

                classDeclaration
                    : STATIC? CLASS ID
                      LBRACE
                         classMembers
                      RBRACE
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
                      LPAREN parameterList? RPAREN
                      LBRACE
                         statement*
                      RBRACE
                    ;

                // Global functions (only in .cnm)
                functionDeclaration
                    : returnType ID
                      LPAREN parameterList? RPAREN
                      LBRACE
                         statement*
                      RBRACE
                    ;

                parameterList
                    : parameter (COMMA parameter)*
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
                      ASSIGN
                      value
                      SEMI
                    ;

                statement
                    : declaration
                    | expression SEMI
                    | functionCall SEMI
                    | methodCall SEMI
                    | RETURN expression? SEMI
                    ;

                type_specifier
                    : TYPE_INT8
                    | TYPE_INT16
                    | TYPE_INT32
                    | TYPE_INT64
                    | TYPE_UINT8
                    | TYPE_UINT16
                    | TYPE_UINT32
                    | TYPE_UINT64
                    | TYPE_FLOAT32
                    | TYPE_FLOAT64
                    | TYPE_FLOAT96
                    | TYPE_STRING
                    | TYPE_BOOLEAN
                    ;

                value
                    : NUMBER
                    | STRING
                    | ID
                    ;

                functionCall
                    : ID LPAREN argumentList? RPAREN
                    ;
                    
                methodCall
                    : ID DOT ID LPAREN argumentList? RPAREN
                    ;
                    
                argumentList
                    : expression (COMMA expression)*
                    ;

                expression
                    : value                           # ValueExpr
                    | expression PLUS expression      # AddExpr
                    | expression MINUS expression     # SubExpr
                    | expression MULT expression      # MultExpr
                    | expression DIV expression       # DivExpr
                    | LPAREN expression RPAREN        # ParenExpr
                    ;