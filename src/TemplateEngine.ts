import fs from "fs";
import { Response } from "express";

enum NodeTypes {
    LITERAL,
    VAR,
};

type LiteralNode = {
    type: NodeTypes.LITERAL;
    contents: string;
};

type VarNode = {
    type: NodeTypes.VAR;
    name: string;
};

type TemplateNode = LiteralNode | VarNode;

type TemplateViewArgs = any;
type TemplateView = (args: TemplateViewArgs) => string;

class Lexer {
    private buffer: string;
    private cursor = 0;

    constructor(buffer: string) {
        this.buffer = buffer;
    }

    public isAtTheEnd(): boolean {
        return this.cursor >= this.buffer.length;
    }

    public advance(): string {
        return this.buffer[this.cursor++];
    }

    public peek(): string {
        return this.buffer[this.cursor];
    }

    public match(c: string): boolean {
        if(this.peek() === c) {
            this.advance();
            return true;
        }

        return false;
    }

    public skipSpaces(): void {
        while(this.match(" "));
    }


    public setCursorPos(pos: number): void {
        this.cursor = pos;
    }

    public getCursorPos(): number {
        return this.cursor;
    }

    public getBufferSlice(start: number, end: number): string {
        return this.buffer.slice(start, end);
    }
}

class Parser {
    private lexer: Lexer;

    private nodes: TemplateNode[] = [];

    constructor(buffer: string) {
        this.lexer = new Lexer(buffer);
    }

    // if the last node is literal this returns it else it creates a new one and returns it
    private getOrCreateLiteralNode(): LiteralNode {
        const len = this.nodes.length;
        if(len === 0 || this.nodes[len - 1].type !== NodeTypes.LITERAL) {
            this.nodes.push({
                type: NodeTypes.LITERAL,
                contents: "",
            });
        }
        return this.nodes[this.nodes.length - 1] as LiteralNode;
    }

    // this function always consumes at least one char
    private literal(): void {
        const node = this.getOrCreateLiteralNode();

        node.contents += this.lexer.advance();
        while(this.lexer.peek() !== "{" && !this.lexer.isAtTheEnd()) {
            node.contents += this.lexer.advance();
        }
    }

    private expression(): boolean {
        if(!this.lexer.match("{") || !this.lexer.match("{")) return false;

        this.lexer.skipSpaces();

        let varName = "";

        if(!/[A-Za-z_$]/.test(this.lexer.peek())) return false;

        varName += this.lexer.advance();

        while(/[A-Za-z_$0-9]/.test(this.lexer.peek())) {
            varName += this.lexer.advance();
        }

        this.lexer.skipSpaces();

        if(!this.lexer.match("}") || !this.lexer.match("}")) return false;

        this.nodes.push({
            type: NodeTypes.VAR,
            name: varName,
        });
        return true;
    }

    public parse(): TemplateNode[] {
        while(!this.lexer.isAtTheEnd()) {
            const initialPos = this.lexer.getCursorPos();
            if(this.expression()) continue;

            this.lexer.setCursorPos(initialPos);
            this.literal();
        }

        return this.nodes;
    }
}

type InitOpts = {
    views: Record<string, string>;
    debug?: boolean;
};

class TemplateEngine {
    private views: Map<string, TemplateView> = new Map;

    public async init(opts: InitOpts): Promise<void> {
        console.info(`[INFO] Compiling views`);
        for(const [key, path] of Object.entries(opts.views)) {
            if(opts.debug) console.info(`[INFO] Compiling "${key}" view`);
            this.views.set(key, await this.parseFile(path));
        }
    }

    public sendView(res: Response, viewName: string, args: TemplateViewArgs): void {
        const view = this.views.get(viewName);
        if(!view) {
            console.error(`[ERROR] There is no view with name "${viewName}"`);
            return;
        }

        res.setHeader("Content-Type", "text/html");
        res.send(view(args));
    }

    private async parseFile(filePath: string): Promise<TemplateView> {
        const file = await fs.promises.readFile(filePath, { encoding: "utf8" });
        const contents = file.toString();

        const parser = new Parser(contents);
        const templateNodes = parser.parse();
        return (args) => this.compileNodes(templateNodes, args);
    }

    private compileNodes(nodes: TemplateNode[], args: TemplateViewArgs): string {
        let res = "";
        for(const node of nodes) {
            switch(node.type) {
                case NodeTypes.LITERAL: {
                    res += node.contents;
                } break;
                case NodeTypes.VAR: {
                    if(node.name in args) {
                        res += args[node.name].toString();
                    } else {
                        res += "undefined";
                        console.error(`[ERROR] "${node.name}" variable wasn't provided`);
                    }
                } break;
            }
        }
        return res;
    }
}

export default new TemplateEngine();
