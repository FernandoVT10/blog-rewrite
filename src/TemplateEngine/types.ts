export enum TokenType {
    LITERAL,
    OPEN_EXPR, CLOSE_EXPR, // "{{" and "}}"
    OPEN_BRACKET, CLOSE_BRACKET, // "[" and "]"
    OPEN_PAREN, CLOSE_PAREN, // "(" and ")"
    IDENTIFIER,
    DOT,
    NUMBER,
    IF,
    ENDIF,
    BANG, // "!"
    DOUBLE_EQUAL, BANG_EQUAL, // "==" and "!="
    GREATHER, LESS, // ">" and "<"
    GREATHER_OR_EQ, LESS_OR_EQ, // ">=" and "<="
    STRING,
    DOUBLE_AND, // "&&"
    OR, // "||"
};

export type Token = {
    type: TokenType;
    lexeme: string;
    line: number;
    col: [number, number];
};

export enum NodeTypes {
    LITERAL, VAR, IF, UNARY, BINARY
};

export type LiteralNode = {
    type: NodeTypes.LITERAL;
    contents: string;
};

export type VarNode = {
    type: NodeTypes.VAR;
    // this stores all the indexes in order. "foo.bar[2]" will output ["foo", "bar", "2"]
    keys: string[];
};

export type UnaryNode = {
    type: NodeTypes.UNARY;
    value: VarNode | number | string;
    negated: boolean;
};

export enum Operators {
    EQUAL, NOT_EQUAL, GREATHER, LESS,
    GREATHER_OR_EQ, LESS_OR_EQ, AND, OR
};

export type BinaryNode = {
    type: NodeTypes.BINARY;
    operator: Operators;
    left: LogicExpr;
    right: LogicExpr;
};

export type LogicExpr = UnaryNode | BinaryNode;

export type IfNode = {
    type: NodeTypes.IF;
    condition: LogicExpr;
    nodes: TemplateNode[];
};

export type TemplateNode = LiteralNode | VarNode | IfNode;

export const TokenAndOperators = new Map<TokenType, Operators>();
TokenAndOperators.set(TokenType.DOUBLE_EQUAL, Operators.EQUAL);
TokenAndOperators.set(TokenType.BANG_EQUAL, Operators.NOT_EQUAL);
TokenAndOperators.set(TokenType.GREATHER, Operators.GREATHER);
TokenAndOperators.set(TokenType.LESS, Operators.LESS);
TokenAndOperators.set(TokenType.GREATHER_OR_EQ, Operators.GREATHER_OR_EQ);
TokenAndOperators.set(TokenType.LESS_OR_EQ, Operators.LESS_OR_EQ);
TokenAndOperators.set(TokenType.DOUBLE_AND, Operators.AND);
TokenAndOperators.set(TokenType.OR, Operators.OR);

export type ViewArgs = any;
export type View = (args: ViewArgs) => string;
