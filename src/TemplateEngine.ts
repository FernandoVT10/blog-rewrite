import fs from "fs";
import path from "path";
import chokidar from "chokidar";
import { Response } from "express";
import Handlebars, { TemplateDelegate } from "handlebars";
import { DEVELOPMENT } from "./constants";

export enum Views {
    HOME, BLOG,
};

type SendViewOpts = {
    view: Views;
    viewArgs?: any;
    layoutArgs?: any;
};

class TemplateEngine {
    private views = new Map<Views, TemplateDelegate>();
    private layout: TemplateDelegate | null = null;
    private globalArgs: any;

    private async compileTemplate(path: string): Promise<TemplateDelegate | null> {
        try {
            const file = await fs.promises.readFile(path, { encoding: "utf8" });
            const template = Handlebars.compile(file.toString());
            return template;
        } catch(e) {
            console.error(e);
            return null;
        }
    }

    private async compileView(key: Views, path: string): Promise<void> {
        console.info(`[INFO] Compiling view: "${path}"`);
        const view = await this.compileTemplate(path);
        if(view !== null) this.views.set(key, view);

        if(DEVELOPMENT) {
            chokidar.watch(path).on("change", async () => {
                console.info(`[INFO] Re-compiling view: "${path}"`);
                const view = await this.compileTemplate(path);
                if(view !== null) this.views.set(key, view);
            });
        }
    }

    public async init() {
        const viewsDir = path.resolve(__dirname, "./views/");
        await this.compileView(Views.HOME, path.resolve(viewsDir, "home.html"));
        await this.compileView(Views.BLOG, path.resolve(viewsDir, "blog.html"));

        const layoutPath = path.resolve(viewsDir, "layout/base.html");
        console.info(`[INFO] Compiling layout: "${layoutPath}"`);
        this.layout = await this.compileTemplate(layoutPath);

        this.globalArgs = {
            DEVELOPMENT,
        };
    }

    public sendView(res: Response, opts: SendViewOpts): void {
        const view = this.views.get(opts.view);
        if(!view) {
            console.error(`[ERROR] There is no view with name "${opts.view}"`);
            res.sendStatus(400);
            return;
        }

        const layoutArgs = opts.layoutArgs || {};
        const viewArgs = opts.viewArgs || {};

        if(this.globalArgs) {
            Object.assign(layoutArgs, this.globalArgs);
            Object.assign(viewArgs, this.globalArgs);
        }

        res.setHeader("Content-Type", "text/html");

        if(this.layout) {
            res.send(this.layout({
                body: view(viewArgs),
                ...layoutArgs,
            }));
        } else {
            res.send(view(viewArgs));
        }
    }
}

export default new TemplateEngine();
