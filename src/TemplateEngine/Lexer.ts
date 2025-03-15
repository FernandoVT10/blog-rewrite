import { TokenType, Token } from "./types";

enum ANSIColor {
    RED = "\x1b[31m",
    BLUE = "\x1b[34m",
    GRAY = "\x1b[90m",
};

function formatString(color: ANSIColor, msg: string): string {
    return `${color}${msg}\x1b[0m`;
}

export default class Lexer {
    private buffer: string;
    private start = 0;
    private current = 0;
    private line = 1;
    private tokens: Token[] = [];
    private keywords: Map<string, TokenType> = new Map;
    private filePath: string;

    constructor(buffer: string, filePath: string) {
        this.buffer = buffer;
        this.keywords.set("if", TokenType.IF);
        this.keywords.set("endif", TokenType.ENDIF);
        this.filePath = filePath;
    }

    private isAtTheEnd(): boolean {
        return this.current >= this.buffer.length;
    }

    private advance(): string {
        if(this.buffer[this.current] == "\n") {
            this.line++;
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
        this.tokens.push({ type, lexeme, line: this.line, column: this.start });
        this.start = this.current;
    }

    private identifier(): void {
        while(/[A-Za-z$_0-9]/.test(this.peek())) this.advance();

        const text = this.buffer.slice(this.start, this.current);
        const type = this.keywords.get(text);

        if(type === undefined) {
            this.addToken(TokenType.IDENTIFIER);
        } else {
            this.addToken(type);
        }
    }

    private number(): void {
        while(/[0-9]/.test(this.peek())) this.advance();
        this.addToken(TokenType.NUMBER);
    }

    private string(): void {
        while(this.peek() !== '"' && this.peek() !== "\n" && !this.isAtTheEnd())
            this.advance();

        if(!this.match('"')) {
            throw this.lexingError('missing terminating " character');
        }

        const lexeme = this.buffer.slice(this.start + 1, this.current - 1);
        this.addToken(TokenType.STRING, lexeme);
    }

    private scanExpr(): void {
        while(this.peek() !== "}" && this.peek() !== "\n") {
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
                        this.start++;
                        throw this.lexingError(`Expected character "="`, true);
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
                        this.start++;
                        throw this.lexingError(`Expected character "&"`, true);
                    }
                    break;
                // ignore spaces
                case " ":
                    this.start = this.current;
                    break;
                default: {
                    if(/[0-9]/.test(c)) {
                        this.number();
                    } else if(/[A-Za-z$_]/.test(c)) {
                        this.identifier();
                    } else {
                        throw this.lexingError(`Unexpected character`, true);
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

    private lexingError(message: string, mode?: boolean): Error {
        let start = this.start;
        while(start > 0 && this.buffer[start - 1] !== '\n') start--;
        let end = this.start;
        while(end < this.buffer.length - 1 && this.buffer[end] !== '\n') end++;

        const bufLine = this.buffer.slice(start, end);

        let error = "";

        const spaces = (n: number): string => "".padStart(n, " ");

        // filepath:line
        error += formatString(ANSIColor.RED, `${this.filePath}:${this.line}`) + "\n";

        // ERROR: message
        error += `${formatString(ANSIColor.RED, "ERROR:")} ${message}\n`;

        const tokenStart = this.start - start;

        // the line of code where the error is
        if(mode) {
            const left = bufLine.slice(0, tokenStart);
            const highlightedCode = formatString(ANSIColor.RED, bufLine[tokenStart]);
            const right = bufLine.slice(tokenStart + 1);
            error += `${spaces(4)}${this.line} |${left}${highlightedCode}${right}\n`;
        } else {
            const code = bufLine.slice(0, tokenStart);
            const highlightedCode = formatString(ANSIColor.RED, bufLine.slice(tokenStart));
            error += `${spaces(4)}${this.line} |${code}${highlightedCode}\n`;
        }

        // A mark pointing the exact place where the error was found
        const lineLen = this.line.toString().length;
        const highlight = "".padEnd(bufLine.length - tokenStart - 1, "~");
        error += `${spaces(4 + lineLen)} |${spaces(tokenStart)}${formatString(ANSIColor.RED, "^")}`;

        if(!mode) {
            error += formatString(ANSIColor.RED, highlight);
        }

        return new Error(error);
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

        return this.tokens;
    }
}
