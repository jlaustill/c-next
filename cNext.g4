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
                STRING: '`' .*? '`';       // String literals in backticks
                FILENAME: '"' .*? '"';     // String literals in quotes for file names
                WS: [ \t\r\n]+ -> skip;

                // Parser rules
                sourceFile          // .cn files
                    : fileDirective*
                      classDeclaration EOF
                    ;

                mainSourceFile      // .cnm files
                    : fileDirective*
                      (functionDeclaration+ | classDeclaration) EOF
                    ;

                fileDirective
                    : importDirective
                    | includeDirective
                    ;

                importDirective
                    : IMPORT FILENAME ';' {
                        // Ensure the file ends with `.cn`
                        if (!$FILENAME.text.endsWith(".cn")) {
                            throw new IllegalArgumentException("Only .cn files are allowed in import directives.");
                        }
                    }
                    ;

                includeDirective
                    : INCLUDE FILENAME ';' {
                        // Ensure the file ends with `.h` or `.hpp`
                        if (!$FILENAME.text.endsWith(".h") && !$FILENAME.text.endsWith(".hpp")) {
                            throw new IllegalArgumentException("Only .h and .hpp files are allowed in #include directives.");
                        }
                    }
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
                    | RETURN expression? SEMI
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
                    | LPAREN expression RPAREN        # ParenExpr
                    ;