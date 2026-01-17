/**
 * AST Node Types for Prettier C-Next Plugin
 *
 * These are simplified nodes optimized for Prettier's printing algorithm.
 * The parser converts ANTLR parse trees into these nodes.
 */

export interface BaseNode {
  type: string;
  start: number;
  end: number;
}

// ============================================================================
// Program
// ============================================================================

export interface Program extends BaseNode {
  type: "Program";
  includes: IncludeDirective[];
  preprocessor: PreprocessorDirective[];
  declarations: Declaration[];
  comments: Comment[];
}

// ============================================================================
// Comments
// ============================================================================

export interface Comment extends BaseNode {
  type: "Comment";
  value: string;
  commentType: "line" | "block" | "doc";
}

// ============================================================================
// Preprocessor
// ============================================================================

export interface IncludeDirective extends BaseNode {
  type: "IncludeDirective";
  path: string;
  isSystem: boolean; // <header.h> vs "header.h"
}

export type PreprocessorDirective =
  | DefineFlag
  | DefineWithValue
  | DefineFunction
  | IfdefDirective
  | IfndefDirective
  | ElseDirective
  | EndifDirective
  | PragmaTarget;

export interface DefineFlag extends BaseNode {
  type: "DefineFlag";
  name: string;
}

export interface DefineWithValue extends BaseNode {
  type: "DefineWithValue";
  raw: string; // Keep raw text - this is an error case
}

export interface DefineFunction extends BaseNode {
  type: "DefineFunction";
  raw: string; // Keep raw text - this is an error case
}

export interface IfdefDirective extends BaseNode {
  type: "IfdefDirective";
  name: string;
}

export interface IfndefDirective extends BaseNode {
  type: "IfndefDirective";
  name: string;
}

export interface ElseDirective extends BaseNode {
  type: "ElseDirective";
}

export interface EndifDirective extends BaseNode {
  type: "EndifDirective";
}

export interface PragmaTarget extends BaseNode {
  type: "PragmaTarget";
  target: string;
}

// ============================================================================
// Declarations
// ============================================================================

export type Declaration =
  | ScopeDeclaration
  | RegisterDeclaration
  | StructDeclaration
  | EnumDeclaration
  | BitmapDeclaration
  | FunctionDeclaration
  | VariableDeclaration;

export interface ScopeDeclaration extends BaseNode {
  type: "ScopeDeclaration";
  name: string;
  members: ScopeMember[];
}

export interface ScopeMember extends BaseNode {
  type: "ScopeMember";
  visibility: "public" | "private" | null;
  declaration:
    | VariableDeclaration
    | FunctionDeclaration
    | EnumDeclaration
    | BitmapDeclaration
    | RegisterDeclaration;
}

export interface RegisterDeclaration extends BaseNode {
  type: "RegisterDeclaration";
  name: string;
  address: Expression;
  members: RegisterMember[];
}

export interface RegisterMember extends BaseNode {
  type: "RegisterMember";
  name: string;
  dataType: TypeNode;
  access: "rw" | "ro" | "wo" | "w1c" | "w1s";
  offset: Expression;
}

export interface StructDeclaration extends BaseNode {
  type: "StructDeclaration";
  name: string;
  members: StructMember[];
}

export interface StructMember extends BaseNode {
  type: "StructMember";
  dataType: TypeNode;
  name: string;
  dimensions: (Expression | null)[]; // null = empty dimension like []
}

export interface EnumDeclaration extends BaseNode {
  type: "EnumDeclaration";
  name: string;
  members: EnumMember[];
}

export interface EnumMember extends BaseNode {
  type: "EnumMember";
  name: string;
  value: Expression | null;
}

export interface BitmapDeclaration extends BaseNode {
  type: "BitmapDeclaration";
  bitmapType: "bitmap8" | "bitmap16" | "bitmap24" | "bitmap32";
  name: string;
  members: BitmapMember[];
}

export interface BitmapMember extends BaseNode {
  type: "BitmapMember";
  name: string;
  width: number | null; // null means single bit
}

export interface FunctionDeclaration extends BaseNode {
  type: "FunctionDeclaration";
  returnType: TypeNode;
  name: string;
  parameters: Parameter[];
  body: Block;
}

export interface Parameter extends BaseNode {
  type: "Parameter";
  isConst: boolean;
  dataType: TypeNode;
  name: string;
  dimensions: (Expression | null)[]; // null = empty dimension like []
}

export interface VariableDeclaration extends BaseNode {
  type: "VariableDeclaration";
  isAtomic: boolean;
  isVolatile: boolean;
  isConst: boolean;
  overflow: "clamp" | "wrap" | null;
  dataType: TypeNode;
  name: string;
  dimensions: (Expression | null)[]; // null = empty dimension like []
  initializer: Expression | null;
}

// ============================================================================
// Statements
// ============================================================================

export interface Block extends BaseNode {
  type: "Block";
  statements: Statement[];
}

export type Statement =
  | VariableDeclaration
  | AssignmentStatement
  | ExpressionStatement
  | IfStatement
  | WhileStatement
  | DoWhileStatement
  | ForStatement
  | SwitchStatement
  | ReturnStatement
  | CriticalStatement
  | Block;

export interface AssignmentStatement extends BaseNode {
  type: "AssignmentStatement";
  target: AssignmentTarget;
  operator: string; // "<-", "+<-", etc.
  value: Expression;
}

export type AssignmentTarget =
  | Identifier
  | MemberAccess
  | ArrayAccess
  | ThisAccess
  | GlobalAccess;

export interface ExpressionStatement extends BaseNode {
  type: "ExpressionStatement";
  expression: Expression;
}

export interface IfStatement extends BaseNode {
  type: "IfStatement";
  condition: Expression;
  consequent: Statement;
  alternate: Statement | null;
}

export interface WhileStatement extends BaseNode {
  type: "WhileStatement";
  condition: Expression;
  body: Statement;
}

export interface DoWhileStatement extends BaseNode {
  type: "DoWhileStatement";
  body: Block;
  condition: Expression;
}

export interface ForStatement extends BaseNode {
  type: "ForStatement";
  init: ForInit | null;
  condition: Expression | null;
  update: ForUpdate | null;
  body: Statement;
}

export type ForInit = ForVarDecl | ForAssignment;

export interface ForVarDecl extends BaseNode {
  type: "ForVarDecl";
  isAtomic: boolean;
  isVolatile: boolean;
  overflow: "clamp" | "wrap" | null;
  dataType: TypeNode;
  name: string;
  dimensions: (Expression | null)[]; // null = empty dimension like []
  initializer: Expression | null;
}

export interface ForAssignment extends BaseNode {
  type: "ForAssignment";
  target: AssignmentTarget;
  operator: string;
  value: Expression;
}

export interface ForUpdate extends BaseNode {
  type: "ForUpdate";
  target: AssignmentTarget;
  operator: string;
  value: Expression;
}

export interface SwitchStatement extends BaseNode {
  type: "SwitchStatement";
  expression: Expression;
  cases: SwitchCase[];
  defaultCase: DefaultCase | null;
}

export interface SwitchCase extends BaseNode {
  type: "SwitchCase";
  labels: CaseLabel[];
  body: Block;
}

export type CaseLabel = Identifier | QualifiedType | Literal;

export interface DefaultCase extends BaseNode {
  type: "DefaultCase";
  count: number | null; // For default(N)
  body: Block;
}

export interface ReturnStatement extends BaseNode {
  type: "ReturnStatement";
  value: Expression | null;
}

export interface CriticalStatement extends BaseNode {
  type: "CriticalStatement";
  body: Block;
}

// ============================================================================
// Expressions
// ============================================================================

export type Expression =
  | TernaryExpression
  | BinaryExpression
  | UnaryExpression
  | CallExpression
  | MemberAccess
  | ArrayAccess
  | ThisAccess
  | GlobalAccess
  | CastExpression
  | SizeofExpression
  | StructInitializer
  | ArrayInitializer
  | Identifier
  | Literal
  | ParenExpression;

export interface TernaryExpression extends BaseNode {
  type: "TernaryExpression";
  condition: Expression;
  consequent: Expression;
  alternate: Expression;
}

export interface BinaryExpression extends BaseNode {
  type: "BinaryExpression";
  operator: string;
  left: Expression;
  right: Expression;
}

export interface UnaryExpression extends BaseNode {
  type: "UnaryExpression";
  operator: string; // "!", "-", "~", "&"
  operand: Expression;
}

export interface CallExpression extends BaseNode {
  type: "CallExpression";
  callee: Expression;
  arguments: Expression[];
}

export interface MemberAccess extends BaseNode {
  type: "MemberAccess";
  object: Expression;
  property: string;
}

export interface ArrayAccess extends BaseNode {
  type: "ArrayAccess";
  object: Expression;
  index: Expression;
  width: Expression | null; // For bit range [start, width]
}

export interface ThisAccess extends BaseNode {
  type: "ThisAccess";
  path: string[]; // ["member"] or ["member1", "member2"]
  index: Expression | null;
  width: Expression | null;
}

export interface GlobalAccess extends BaseNode {
  type: "GlobalAccess";
  path: string[];
  index: Expression | null;
  width: Expression | null;
}

export interface CastExpression extends BaseNode {
  type: "CastExpression";
  targetType: TypeNode;
  expression: Expression;
}

export interface SizeofExpression extends BaseNode {
  type: "SizeofExpression";
  operand: TypeNode | Expression;
}

export interface StructInitializer extends BaseNode {
  type: "StructInitializer";
  structName: string | null; // null for inferred type
  fields: FieldInitializer[];
}

export interface FieldInitializer extends BaseNode {
  type: "FieldInitializer";
  name: string;
  value: Expression;
}

export interface ArrayInitializer extends BaseNode {
  type: "ArrayInitializer";
  elements: (Expression | StructInitializer | ArrayInitializer)[];
  fillValue: Expression | null; // For [0*] syntax
}

export interface Identifier extends BaseNode {
  type: "Identifier";
  name: string;
}

export interface ParenExpression extends BaseNode {
  type: "ParenExpression";
  expression: Expression;
}

export interface Literal extends BaseNode {
  type: "Literal";
  value: string;
  literalType:
    | "integer"
    | "hex"
    | "binary"
    | "float"
    | "string"
    | "char"
    | "bool"
    | "null"
    | "suffixed_decimal"
    | "suffixed_hex"
    | "suffixed_binary"
    | "suffixed_float";
}

// ============================================================================
// Types
// ============================================================================

export type TypeNode =
  | PrimitiveType
  | StringType
  | ScopedType
  | QualifiedType
  | UserType
  | ArrayType
  | VoidType;

export interface PrimitiveType extends BaseNode {
  type: "PrimitiveType";
  name: string; // "u8", "i32", "f64", "bool", "ISR"
}

export interface StringType extends BaseNode {
  type: "StringType";
  capacity: number | null; // null for unsized
}

export interface ScopedType extends BaseNode {
  type: "ScopedType";
  name: string; // this.Type
}

export interface QualifiedType extends BaseNode {
  type: "QualifiedType";
  scope: string;
  name: string; // Scope.Type
}

export interface UserType extends BaseNode {
  type: "UserType";
  name: string;
}

export interface ArrayType extends BaseNode {
  type: "ArrayType";
  elementType: PrimitiveType | UserType;
  size: Expression;
}

export interface VoidType extends BaseNode {
  type: "VoidType";
}

// ============================================================================
// Type Guard Helpers
// ============================================================================

export type ASTNode =
  | Program
  | Comment
  | IncludeDirective
  | PreprocessorDirective
  | Declaration
  | ScopeMember
  | RegisterMember
  | StructMember
  | EnumMember
  | BitmapMember
  | Parameter
  | Block
  | Statement
  | SwitchCase
  | DefaultCase
  | ForVarDecl
  | ForAssignment
  | ForUpdate
  | FieldInitializer
  | Expression
  | TypeNode;
