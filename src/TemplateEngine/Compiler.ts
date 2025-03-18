import fs from "fs";

import Lexer from "./Lexer";

enum ANSIColor {
    RED = "\x1b[31m",
    BLUE = "\x1b[34m",
    GRAY = "\x1b[90m",
};

function formatString(color: ANSIColor, msg: string): string {
    return `${color}${msg}\x1b[0m`;
}

export default class Compiler {
    private buffer = "";
    private hadErrors = false;
    private filePath: string;

    public async compileFile(filePath: string): Promise<void> {
        const file = await fs.promises.readFile(filePath, { encoding: "utf8" });
        this.filePath = filePath;
        this.buffer = file.toString();

        const lexer = new Lexer(this.buffer, this);
        lexer.scanTokens();

        if(this.hadErrors) {
            console.log("Had errors");
        }
    }

    private getBufLine(line: number): string {
        let start = 0;

        let x = 0;
        while(line > 1 && x < this.buffer.length) {
            if(this.buffer[x] === "\n") line--;
            start++;
            x++;
        }

        let end = start;

        while(end < this.buffer.length - 1 && this.buffer[end] !== '\n') end++;

        return this.buffer.slice(start, end);
    }

    public lexingError(message: string, line: number, col: number | number[]): void {
        const bufLine = this.getBufLine(line);

        let error = "";

        const spaces = (n: number): string => "".padStart(n, " ");

        const colNumber = Array.isArray(col) ? col[0] : col;
        // filepath:line
        error += formatString(ANSIColor.RED, `${this.filePath}:${line}:${colNumber}`) + "\n";

        // ERROR: message
        error += `${formatString(ANSIColor.RED, "ERROR:")} ${message}\n`;

        let errorStart: number, errorEnd: number;

        if(Array.isArray(col)) {
            errorStart = col[0] - 1;
            errorEnd = col[1] - 1;
        } else {
            errorStart = col - 1;
            errorEnd = col;
        }

        // the line of code where the error is

        const left = bufLine.slice(0, errorStart);
        const highlightedCode = formatString(ANSIColor.RED, bufLine.slice(errorStart, errorEnd));
        const right = bufLine.slice(errorEnd);
        error += `${spaces(4)}${line} |${left}${highlightedCode}${right}\n`;

        // A mark pointing the exact place where the error was found
        const lineLen = line.toString().length;
        const errorMark = "^".padEnd(errorEnd - errorStart, "~");
        error += `${spaces(4 + lineLen)} |${spaces(errorStart)}${formatString(ANSIColor.RED, errorMark)}`;

        console.log(error);
        this.hadErrors = true;
    }
}
