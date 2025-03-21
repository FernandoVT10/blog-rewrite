import { Response } from "express";
import Compiler from "./Compiler";

import {
    View,
    ViewArgs
} from "./types";

// FORMAL GRAMMAR
// Expr = If | OpenExpr Variable CloseExpr
// Variable = VarName (("." VarName) | ("[" Number+ "]"))?
// VarName = [A-Za-z_$] [A-Za-z_$0-9]+
//
// If = IfStart Literal IfEnd
// IfStart = OpenExpr "if" Spaces "(" Spaces Condition Spaces ")" CloseExpr
// IfStart = OpenExpr "endif" CloseExpr
// LogicExpr = Bynary | Unary
// Binary = (Binary | Unary) Operation (Binary | Unary)
// Operation = "==" | ">" | "<" | ">=" | "<=" | "!="
// Unary = "!"? (Variable | String | Number)
// String = "\"" * "\""
// Number [0-9]
//
// OpenExpr = "{{" Spaces
// CloseExpr = Spaces "}}"
// Spaces = " "+
// Literal = !OpenExpr *

type InitOpts = {
    views: Record<string, string>;
    debug?: boolean;
};

class TemplateEngine {
    private views: Map<string, View> = new Map;

    public async init(opts: InitOpts): Promise<void> {
        console.info(`[INFO] Compiling views`);
        for(const [key, path] of Object.entries(opts.views)) {
            if(opts.debug) console.info(`[INFO] Compiling "${key}" view`);
            try {
                const compiler = new Compiler();
                const view = await compiler.compileFile(path);

                if(view) {
                    this.views.set(key, view);
                }
            } catch(e) {
                console.log(e);
            }
        }
    }

    public sendView(res: Response, viewName: string, args: ViewArgs): void {
        const view = this.views.get(viewName);
        if(!view) {
            console.error(`[ERROR] There is no view with name "${viewName}"`);
            res.sendStatus(400);
            return;
        }

        res.setHeader("Content-Type", "text/html");
        res.send(view(args));
    }
}

export default new TemplateEngine();
