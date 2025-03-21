export enum TokenType {
    LITERAL,
    OPEN_EXPR, CLOSE_EXPR, // "{{" and "}}"
    OPEN_BRACKET, CLOSE_BRACKET, // "[" and "]"
    OPEN_PAREN, CLOSE_PAREN, // "(" and ")"
    IDENTIFIER,
    DOT,
    NUMBER,
    IF, ENDIF,
    BANG, // "!"
    DOUBLE_EQUAL, BANG_EQUAL, // "==" and "!="
    GREATHER, LESS, // ">" and "<"
    GREATHER_OR_EQ, LESS_OR_EQ, // ">=" and "<="
    STRING,
    DOUBLE_AND, // "&&"
    OR, // "||"
    FOR, ENDFOR, IN,
    EOF,
};

export type Token = {
    type: TokenType;
    lexeme: string;
    line: number;
    col: [number, number];
};

export enum StmtTypes {
    LITERAL, IF, FOR, VAR,
};

export enum ExprTypes {
    UNARY, BINARY,
};

export type Literal = {
    type: StmtTypes.LITERAL;
    contents: string;
};

export type VarStmt = {
    type: StmtTypes.VAR;
    // this stores all the indexes in order. "foo.bar[2]" will output ["foo", "bar", "2"]
    keys: string[];
};

export type UnaryExpr = {
    type: ExprTypes.UNARY;
    value: VarStmt | number | string;
    negated: boolean;
};

export enum Operators {
    EQUAL, NOT_EQUAL, GREATHER, LESS,
    GREATHER_OR_EQ, LESS_OR_EQ, AND, OR
};

export type BinaryExpr = {
    type: ExprTypes.BINARY;
    operator: Operators;
    left: LogicExpr;
    right: LogicExpr;
};

export type LogicExpr = UnaryExpr | BinaryExpr;

export type IfStmt = {
    type: StmtTypes.IF;
    condition: LogicExpr;
    stmts: Stmt[];
};

export type ForStmt = {
    type: StmtTypes.FOR;
    arrayVar: VarStmt;
    itemName: string;
    stmts: Stmt[];
};

export type Stmt = IfStmt | ForStmt | Literal | VarStmt;

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
