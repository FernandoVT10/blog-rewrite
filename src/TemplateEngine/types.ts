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
};

export type Token = {
    type: TokenType;
    lexeme: string;
    line: number;
    column: number
};
