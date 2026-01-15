# Grammar Rule Coverage Report

> Generated: 2026-01-15T03:48:48.957Z

## Summary

| Category     | Total | Covered | Percentage |
| ------------ | ----- | ------- | ---------- |
| Parser Rules | 91    | 88      | 96.7%      |
| Lexer Rules  | 119   | 112     | 94.1%      |
| **Combined** | 210   | 200     | **95.2%**  |

## Parser Rules

### Covered Parser Rules

| Rule                     | Visit Count |
| ------------------------ | ----------- |
| unaryExpression          | 27,795      |
| postfixExpression        | 26,889      |
| primaryExpression        | 26,889      |
| multiplicativeExpression | 26,648      |
| additiveExpression       | 26,350      |
| shiftExpression          | 26,242      |
| bitwiseAndExpression     | 26,211      |
| bitwiseXorExpression     | 26,200      |
| bitwiseOrExpression      | 26,180      |
| relationalExpression     | 25,551      |
| equalityExpression       | 21,760      |
| andExpression            | 21,544      |
| orExpression             | 21,527      |
| expression               | 21,372      |
| ternaryExpression        | 21,372      |
| literal                  | 17,978      |
| statement                | 16,883      |
| type                     | 5,591       |
| postfixOp                | 4,954       |
| primitiveType            | 4,396       |
| returnStatement          | 4,155       |
| assignmentTarget         | 4,140       |
| assignmentOperator       | 4,140       |
| assignmentStatement      | 3,915       |
| ifStatement              | 3,760       |
| variableDeclaration      | 3,225       |
| block                    | 2,994       |
| declaration              | 1,683       |
| functionDeclaration      | 1,267       |
| memberAccess             | 951         |
| argumentList             | 758         |
| expressionStatement      | 749         |
| program                  | 573         |
| scopeMember              | 507         |
| arrayDimension           | 414         |
| parameter                | 411         |
| userType                 | 368         |
| caseLabel                | 354         |
| switchCase               | 319         |
| parameterList            | 316         |
| structMember             | 312         |
| arrayAccess              | 259         |
| visibilityModifier       | 258         |
| forStatement             | 222         |
| forInit                  | 219         |
| forUpdate                | 219         |
| bitmapMember             | 215         |
| forVarDecl               | 213         |
| stringType               | 209         |
| constModifier            | 165         |
| structDeclaration        | 141         |
| thisAccess               | 134         |
| arrayInitializerElement  | 115         |
| overflowModifier         | 100         |
| switchStatement          | 97          |
| defaultCase              | 90          |
| registerMember           | 78          |
| accessModifier           | 78          |
| enumMember               | 74          |
| scopeDeclaration         | 73          |
| fieldInitializer         | 71          |
| whileStatement           | 69          |
| sizeofExpression         | 62          |
| includeDirective         | 53          |
| qualifiedType            | 42          |
| criticalStatement        | 41          |
| atomicModifier           | 37          |
| structInitializer        | 33          |
| fieldInitializerList     | 33          |
| registerDeclaration      | 33          |
| doWhileStatement         | 31          |
| arrayInitializer         | 29          |
| preprocessorDirective    | 28          |
| bitmapDeclaration        | 25          |
| bitmapType               | 25          |
| castExpression           | 24          |
| enumDeclaration          | 22          |
| volatileModifier         | 19          |
| pragmaDirective          | 14          |
| globalAccess             | 14          |
| defineDirective          | 9           |
| thisMemberAccess         | 7           |
| forAssignment            | 6           |
| thisArrayAccess          | 6           |
| conditionalDirective     | 5           |
| globalArrayAccess        | 4           |
| scopedType               | 2           |
| arrayType                | 1           |

### Never Visited Parser Rules

These parser rules were never executed during test runs. Consider adding tests for these language constructs.

- [ ] `globalMemberAccess`
- [ ] `genericType`
- [ ] `typeArgument`

## Lexer Rules (Token Types)

### Covered Lexer Rules

| Rule              | Match Count |
| ----------------- | ----------- |
| IDENTIFIER        | 22,220      |
| INTEGER_LITERAL   | 16,145      |
| SEMI              | 12,788      |
| LPAREN            | 6,929       |
| RPAREN            | 6,929       |
| ASSIGN            | 5,772       |
| RETURN            | 4,155       |
| IF                | 3,760       |
| LBRACKET          | 3,530       |
| RBRACKET          | 3,529       |
| LBRACE            | 3,416       |
| RBRACE            | 3,413       |
| NEQ               | 3,349       |
| DOT               | 3,309       |
| U32               | 1,649       |
| COMMA             | 1,028       |
| MINUS             | 984         |
| HEX_LITERAL       | 903         |
| PLUS_ASSIGN       | 791         |
| LT                | 618         |
| VOID              | 591         |
| U8                | 559         |
| FLOAT_LITERAL     | 451         |
| EQ                | 442         |
| I32               | 362         |
| TRUE              | 360         |
| THIS              | 336         |
| GT                | 330         |
| BOOL              | 322         |
| CASE              | 319         |
| STRING_LITERAL    | 294         |
| U16               | 274         |
| I8                | 269         |
| PUBLIC            | 258         |
| I16               | 248         |
| MINUS_ASSIGN      | 247         |
| COLON             | 227         |
| FOR               | 222         |
| PLUS              | 217         |
| AND               | 216         |
| I64               | 213         |
| STRING            | 209         |
| U64               | 206         |
| FALSE             | 167         |
| CONST             | 165         |
| F32               | 165         |
| STRUCT            | 141         |
| STAR              | 116         |
| F64               | 114         |
| AT                | 110         |
| WHILE             | 100         |
| SWITCH            | 97          |
| GLOBAL            | 94          |
| CHAR_LITERAL      | 93          |
| DEFAULT           | 90          |
| BINARY_LITERAL    | 87          |
| T\_\_0            | 78          |
| SCOPE             | 73          |
| SLASH             | 70          |
| STAR_ASSIGN       | 65          |
| RSHIFT            | 62          |
| SIZEOF            | 62          |
| CLAMP             | 53          |
| INCLUDE_DIRECTIVE | 53          |
| OR                | 52          |
| SLASH_ASSIGN      | 50          |
| PERCENT_ASSIGN    | 47          |
| WRAP              | 47          |
| LSHIFT_ASSIGN     | 46          |
| RSHIFT_ASSIGN     | 46          |
| LSHIFT            | 46          |
| NOT               | 46          |
| RW                | 43          |
| GTE               | 43          |
| CRITICAL          | 41          |
| BITAND_ASSIGN     | 40          |
| BITXOR_ASSIGN     | 38          |
| PERCENT           | 37          |
| ATOMIC            | 37          |
| LTE               | 36          |
| REGISTER          | 33          |
| ELSE              | 33          |
| BITOR_ASSIGN      | 32          |
| BITAND            | 31          |
| DO                | 31          |
| SUFFIXED_DECIMAL  | 23          |
| ENUM              | 22          |
| BITOR             | 20          |
| VOLATILE          | 19          |
| BITNOT            | 18          |
| WO                | 17          |
| ISR_TYPE          | 15          |
| PRAGMA_TARGET     | 14          |
| BITMAP8           | 12          |
| BITXOR            | 11          |
| C_NULL            | 10          |
| RO                | 10          |
| SUFFIXED_FLOAT    | 10          |
| SUFFIXED_HEX      | 7           |
| SUFFIXED_BINARY   | 7           |
| DEFINE_FLAG       | 7           |
| BITMAP16          | 5           |
| BITMAP32          | 5           |
| W1C               | 4           |
| BITMAP24          | 3           |
| W1S               | 3           |
| ENDIF_DIRECTIVE   | 2           |
| IFDEF_DIRECTIVE   | 1           |
| IFNDEF_DIRECTIVE  | 1           |
| ELSE_DIRECTIVE    | 1           |
| DEFINE_FUNCTION   | 1           |
| DEFINE_WITH_VALUE | 1           |

### Never Matched Lexer Rules

These token types were never matched during test runs. Some may be expected (comments, whitespace) while others may indicate missing test coverage.

- [ ] `PRIVATE`
- [ ] `NULL`
- [ ] `DOTDOT`
- [ ] `DOC_COMMENT`
- [ ] `LINE_COMMENT`
- [ ] `BLOCK_COMMENT`
- [ ] `WS`
