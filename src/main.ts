import express from "express";
import path from "path";

import TemplateEngine from "./TemplateEngine";

import routes from "./routes";

const app = express();
const port = 3000;

const publicDir = path.resolve(__dirname, "../public/");
app.use(express.static(publicDir));

async function main() {
    await TemplateEngine.init();

    app.use(routes);

    app.listen(port, () => {
        console.log(`[INFO] Server listening on port ${port}`);
    });
}

main();
