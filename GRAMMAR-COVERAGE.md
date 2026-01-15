# Grammar Rule Coverage Report

> Generated: 2026-01-15T15:34:37.188Z

## Summary

| Category     | Total | Covered | Percentage |
| ------------ | ----- | ------- | ---------- |
| Parser Rules | 89    | 88      | 98.9%      |
| Lexer Rules  | 117   | 112     | 95.7%      |
| **Combined** | 206   | 200     | **97.1%**  |

## Parser Rules

### Covered Parser Rules

| Rule                     | Visit Count |
| ------------------------ | ----------- |
| unaryExpression          | 28,730      |
| postfixExpression        | 27,804      |
| primaryExpression        | 27,804      |
| multiplicativeExpression | 27,527      |
| additiveExpression       | 27,197      |
| shiftExpression          | 27,076      |
| bitwiseAndExpression     | 27,045      |
| bitwiseXorExpression     | 27,034      |
| bitwiseOrExpression      | 27,014      |
| relationalExpression     | 26,385      |
| equalityExpression       | 22,424      |
| andExpression            | 22,208      |
| orExpression             | 22,191      |
| expression               | 22,036      |
| ternaryExpression        | 22,036      |
| literal                  | 18,684      |
| statement                | 17,537      |
| type                     | 5,641       |
| postfixOp                | 5,046       |
| primitiveType            | 4,446       |
| assignmentTarget         | 4,408       |
| assignmentOperator       | 4,408       |
| returnStatement          | 4,350       |
| assignmentStatement      | 4,183       |
| ifStatement              | 3,930       |
| variableDeclaration      | 3,250       |
| block                    | 3,019       |
| declaration              | 1,693       |
| functionDeclaration      | 1,292       |
| memberAccess             | 951         |
| argumentList             | 758         |
| expressionStatement      | 749         |
| program                  | 579         |
| scopeMember              | 528         |
| arrayDimension           | 414         |
| parameter                | 411         |
| userType                 | 368         |
| caseLabel                | 354         |
| switchCase               | 319         |
| parameterList            | 316         |
| structMember             | 312         |
| arrayAccess              | 261         |
| visibilityModifier       | 258         |
| forStatement             | 222         |
| forInit                  | 219         |
| forUpdate                | 219         |
| bitmapMember             | 215         |
| forVarDecl               | 213         |
| stringType               | 209         |
| thisAccess               | 186         |
| constModifier            | 165         |
| structDeclaration        | 141         |
| overflowModifier         | 116         |
| arrayInitializerElement  | 115         |
| switchStatement          | 97          |
| defaultCase              | 90          |
| registerMember           | 78          |
| accessModifier           | 78          |
| scopeDeclaration         | 75          |
| enumMember               | 74          |
| fieldInitializer         | 71          |
| whileStatement           | 69          |
| globalAccess             | 66          |
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

## Lexer Rules (Token Types)

### Covered Lexer Rules

| Rule              | Match Count |
| ----------------- | ----------- |
| IDENTIFIER        | 22,757      |
| INTEGER_LITERAL   | 16,793      |
| SEMI              | 13,276      |
| LPAREN            | 7,145       |
| RPAREN            | 7,145       |
| ASSIGN            | 5,936       |
| RETURN            | 4,350       |
| IF                | 3,930       |
| LBRACKET          | 3,532       |
| RBRACKET          | 3,532       |
| NEQ               | 3,519       |
| DOT               | 3,486       |
| LBRACE            | 3,443       |
| RBRACE            | 3,440       |
| U32               | 1,661       |
| COMMA             | 1,030       |
| MINUS             | 1,019       |
| HEX_LITERAL       | 961         |
| PLUS_ASSIGN       | 792         |
| LT                | 618         |
| VOID              | 591         |
| U8                | 561         |
| FLOAT_LITERAL     | 451         |
| EQ                | 442         |
| THIS              | 423         |
| I32               | 387         |
| TRUE              | 360         |
| GT                | 330         |
| BOOL              | 322         |
| CASE              | 319         |
| STRING_LITERAL    | 294         |
| U16               | 276         |
| I8                | 271         |
| PUBLIC            | 258         |
| MINUS_ASSIGN      | 251         |
| I16               | 250         |
| PLUS              | 234         |
| COLON             | 227         |
| FOR               | 222         |
| AND               | 216         |
| I64               | 215         |
| U64               | 209         |
| STRING            | 209         |
| GLOBAL            | 172         |
| FALSE             | 167         |
| CONST             | 165         |
| F32               | 165         |
| STAR_ASSIGN       | 147         |
| STRUCT            | 141         |
| STAR              | 135         |
| F64               | 114         |
| AT                | 110         |
| WHILE             | 100         |
| SWITCH            | 97          |
| CHAR_LITERAL      | 93          |
| DEFAULT           | 90          |
| BINARY_LITERAL    | 87          |
| SLASH             | 84          |
| T\_\_0            | 78          |
| SCOPE             | 75          |
| RSHIFT            | 68          |
| SIZEOF            | 62          |
| CLAMP             | 61          |
| SLASH_ASSIGN      | 56          |
| WRAP              | 55          |
| LSHIFT            | 53          |
| PERCENT_ASSIGN    | 53          |
| INCLUDE_DIRECTIVE | 53          |
| LSHIFT_ASSIGN     | 52          |
| RSHIFT_ASSIGN     | 52          |
| OR                | 52          |
| BITAND_ASSIGN     | 46          |
| NOT               | 46          |
| BITXOR_ASSIGN     | 44          |
| RW                | 43          |
| GTE               | 43          |
| CRITICAL          | 41          |
| PERCENT           | 40          |
| BITOR_ASSIGN      | 38          |
| ATOMIC            | 37          |
| LTE               | 36          |
| REGISTER          | 33          |
| ELSE              | 33          |
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
- [ ] `DOC_COMMENT`
- [ ] `LINE_COMMENT`
- [ ] `BLOCK_COMMENT`
- [ ] `WS`
