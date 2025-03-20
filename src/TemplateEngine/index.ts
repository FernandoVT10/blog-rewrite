import { Response } from "express";
import Compiler from "./Compiler";

import {
    VarNode,
    UnaryNode,
    LogicExpr,
    NodeTypes,
    Operators,
    IfNode,
    TemplateNode,
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

    private getVariableValue(node: VarNode, args: ViewArgs): any {
        let currentPath = "";
        let currentObj: any = args;

        for(let i = 0; i < node.keys.length; i++) {
            const key = node.keys[i];

            if(typeof currentObj !== "object") {
                console.error(`[ERROR] "${key}" can't be found in "${currentPath}"`);
                return "undefined";
            }

            if(i > 0) {
                // if the "key" starts with a number, it means it's an index
                if(/[0-9]/.test(key[0])) {
                    currentPath += `[${key}]`;
                } else {
                    currentPath += `.${key}`;
                }
            } else {
                currentPath = key;
            }

            if(currentObj[key] !== undefined) {
                // if it's the last key we return it's value stringified
                if(i === node.keys.length - 1) {
                    return currentObj[key];
                } else {
                    currentObj = currentObj[key];
                }
            } else {
                console.error(`[ERROR] "${currentPath}" is undefined`);
                return "undefined";
            }
        }

        return "undefined";
    }

    private compileUnary(unary: UnaryNode, args: ViewArgs): any {
        let val: any;
        switch(typeof(unary.value)) {
            case "number":
            case "string":
                val = unary.value;
                break;
            default:
                val = this.getVariableValue(unary.value, args);
        }
        return unary.negated ? !val : val;
    }

    private compileLogicExpr(logicExpr: LogicExpr, args: ViewArgs): any {
        if(logicExpr.type === NodeTypes.UNARY) {
            return this.compileUnary(logicExpr, args);
        } else if(logicExpr.type === NodeTypes.BINARY) {
            const v1 = this.compileLogicExpr(logicExpr.left, args);
            const v2 = this.compileLogicExpr(logicExpr.right, args);

            switch(logicExpr.operator) {
                case Operators.EQUAL: return v1 === v2;
                case Operators.NOT_EQUAL: return v1 !== v2;
                case Operators.GREATHER: return v1 > v2;
                case Operators.LESS: return v1 < v2;
                case Operators.GREATHER_OR_EQ: return v1 >= v2;
                case Operators.LESS_OR_EQ: return v1 <= v2;
                case Operators.AND: return v1 && v2;
            }
        }

        return false;
    }

    private compileIf(node: IfNode, args: ViewArgs): string {
        if(this.compileLogicExpr(node.condition, args)) {
            return this.compileNodes(node.nodes, args);
        }

        return "";
    }

    public compileNodes(nodes: TemplateNode[], args: ViewArgs): string {
        let res = "";
        for(const node of nodes) {
            switch(node.type) {
                case NodeTypes.LITERAL: {
                    res += node.contents;
                } break;
                case NodeTypes.VAR: {
                    res += this.getVariableValue(node, args).toString();
                } break;
                case NodeTypes.IF: {
                    res += this.compileIf(node, args);
                } break;
            }
        }
        return res;
    }
}

export default new TemplateEngine();
