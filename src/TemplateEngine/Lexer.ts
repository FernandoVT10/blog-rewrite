import Compiler from "./Compiler";
import { TokenType, Token } from "./types";

export default class Lexer {
    private buffer: string;
    private start = 0;
    private current = 0;
    private colStart = 1;
    private colCurrent = 1;
    private line = 1;
    private tokens: Token[] = [];
    private keywords: Map<string, TokenType> = new Map;
    private compiler: Compiler;

    constructor(buffer: string, compiler: Compiler) {
        this.buffer = buffer;
        this.keywords.set("if", TokenType.IF);
        this.keywords.set("endif", TokenType.ENDIF);
        this.keywords.set("for", TokenType.FOR);
        this.keywords.set("endfor", TokenType.ENDFOR);
        this.keywords.set("in", TokenType.IN);
        this.compiler = compiler;
    }

    private isAtTheEnd(): boolean {
        return this.current >= this.buffer.length;
    }

    private advance(): string {
        this.colCurrent++;
        if(this.buffer[this.current] == "\n") {
            this.line++;
            this.colStart = 1;
            this.colCurrent = 1;
        }

        return this.buffer[this.current++];
    }

    private match(c: string): boolean {
        if(this.peek() === c) {
            this.advance();
            return true;
        }

        return false;
    }

    private peek(): string {
        return this.buffer[this.current];
    }

    private addToken(type: TokenType, lexeme?: string): void {
        if(lexeme === undefined) {
            lexeme = this.buffer.slice(this.start, this.current);
        }
        this.tokens.push({
            type,
            lexeme,
            line: this.line,
            col: [this.colStart, this.colCurrent],
        });
        this.start = this.current;
        this.colStart = this.colCurrent;
    }

    private identifier(): void {
        while(/[A-Za-z$_0-9]/.test(this.peek()) && !this.isAtTheEnd()) this.advance();

        const text = this.buffer.slice(this.start, this.current);
        const type = this.keywords.get(text);

        if(type === undefined) {
            this.addToken(TokenType.IDENTIFIER);
        } else {
            this.addToken(type);
        }
    }

    private number(): void {
        while(/[0-9]/.test(this.peek()) && !this.isAtTheEnd()) this.advance();
        this.addToken(TokenType.NUMBER);
    }

    private string(): void {
        while(this.peek() !== '"' && this.peek() !== "\n" && !this.isAtTheEnd())
            this.advance();

        if(!this.match('"')) {
            this.error('Missing terminating " character', this.line, [this.colStart, this.colCurrent]);
        }

        const lexeme = this.buffer.slice(this.start + 1, this.current - 1);
        this.addToken(TokenType.STRING, lexeme);
    }

    private scanExpr(): void {
        while(this.peek() !== "}" && this.peek() !== "\n" && !this.isAtTheEnd()) {
            const c = this.advance();

            switch(c) {
                case ".": this.addToken(TokenType.DOT); break;
                case "[": this.addToken(TokenType.OPEN_BRACKET); break;
                case "]": this.addToken(TokenType.CLOSE_BRACKET); break;
                case "(": this.addToken(TokenType.OPEN_PAREN); break;
                case ")": this.addToken(TokenType.CLOSE_PAREN); break;
                case "!":
                    this.addToken(this.match("=") ? TokenType.BANG_EQUAL : TokenType.BANG);
                    break;
                case "=":
                    if(this.match("=")) {
                        this.addToken(TokenType.DOUBLE_EQUAL);
                    } else {
                        this.advance();
                        this.error(`Expected character "="`, this.line, this.colCurrent - 1);
                    }
                    break;
                case ">":
                    this.addToken(
                        this.match("=") ? TokenType.GREATHER_OR_EQ : TokenType.GREATHER
                    );
                    break;
                case "<":
                    this.addToken(
                        this.match("=") ? TokenType.LESS_OR_EQ : TokenType.LESS
                    );
                    break;
                case "\"": this.string(); break;
                case "&":
                    if(this.match("&")) {
                        this.addToken(TokenType.DOUBLE_AND);
                    } else {
                        this.advance();
                        this.error(`Expected character "&"`, this.line, this.colCurrent - 1);
                    }
                    break;
                case "|":
                    if(this.match("|")) {
                        this.addToken(TokenType.OR);
                    } else {
                        this.advance();
                        this.error(`Expected character "|"`, this.line, this.colCurrent - 1);
                    }
                    break;
                // ignore spaces
                case " ":
                    this.start = this.current;
                    this.colStart = this.colCurrent;
                    break;
                default: {
                    if(/[0-9]/.test(c)) {
                        this.number();
                    } else if(/[A-Za-z$_]/.test(c)) {
                        this.identifier();
                    } else {
                        this.error(`Unexpected character`, this.line, this.colCurrent - 1);
                    }
                }
            }
        }

        if(this.match("}") && this.match("}")) {
            this.addToken(TokenType.CLOSE_EXPR);
        }
    }

    private scanLiteral(): void {
        while(this.peek() !== "{" && !this.isAtTheEnd()) this.advance();
        this.addToken(TokenType.LITERAL);
    }

    private error(message: string, line: number, col: number | number[]): void {
        this.compiler.syntaxError(message, line, col);
        this.start = this.current;
        this.colStart = this.colCurrent;
    }

    public scanTokens(): Token[] {
        while(!this.isAtTheEnd()) {
            let c = this.advance();

            if(c === "{" && this.match("{")) {
                this.addToken(TokenType.OPEN_EXPR);
                this.scanExpr();
            } else {
                this.scanLiteral();
            }
        }

        this.addToken(TokenType.EOF);

        return this.tokens;
    }
}
