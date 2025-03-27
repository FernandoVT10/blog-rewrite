import express from "express";
import path from "path";

import TemplateEngine from "./TemplateEngine";

import routes from "./routes";

const app = express();
const port = 3000;

const publicDir = path.resolve(__dirname, "../public/");
const viewsDir = path.resolve(__dirname, "./views/");

app.use(express.static(publicDir));

async function main() {
    await TemplateEngine.init({
        views: {
            home: path.resolve(viewsDir, "home.html"),
        },
        debug: true,
        globalArgs: {
            DEVELOPMENT: process.env.NODE_ENV !== "production",
        }
    });

    app.use(routes);

    app.listen(port, () => {
        console.log(`[INFO] Server listening on port ${port}`);
    });
}

main();
